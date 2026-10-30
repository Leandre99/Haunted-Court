import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRepo, allCommits, groupByAuthor } from './git.js';
import { gatherFacts, judge } from './facts.js';
import { summon } from './witness.js';
import { render } from './verdict.js';
import { duel, bestPair } from './duel.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_REPO = existsSync(join(ROOT, 'demo', 'django-userena', '.git')) ? join(ROOT, 'demo', 'django-userena') : ROOT;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

const cache = new Map();
async function load(repo) {
  assertRepo(repo);
  if (!cache.has(repo)) {
    const commits = await allCommits(repo);
    if (!commits.length) throw new Error('Dépôt vide');
    const { facts, todos, testFiles } = await gatherFacts(repo, commits);
    cache.set(repo, { commits, authors: groupByAuthor(commits), facts, todos, testFiles });
  }
  return cache.get(repo);
}

// « Petar Radosevic » et « Petar Radošević » sont la même personne : on ne convoque qu'un fantôme.
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
function dedupe(authors) {
  const seen = new Set();
  return authors.filter((a) => !seen.has(fold(a.name)) && seen.add(fold(a.name)));
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readJson(req) {
  let s = '';
  for await (const chunk of req) {
    s += chunk;
    if (s.length > 1e5) throw new Error('corps trop gros');
  }
  return s ? JSON.parse(s) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/case' && req.method === 'GET') {
      const repo = resolve(url.searchParams.get('repo') || DEFAULT_REPO);
      const c = await load(repo);
      const first = c.commits[c.commits.length - 1].date.slice(0, 4);
      const last = c.commits[0].date.slice(0, 4);
      return send(res, 200, {
        repo,
        name: repo.split(/[\\/]/).pop(),
        commits: c.commits.length,
        span: `${first}-${last}`,
        facts: c.facts,
        witnesses: dedupe(c.authors).slice(0, 3).map(({ name, count, first, last }) => ({ name, count, years: `${first.slice(0, 4)}-${last.slice(0, 4)}` })),
        llm: Boolean(process.env.ANTHROPIC_API_KEY),
      });
    }
    if (url.pathname === '/api/testimony' && req.method === 'POST') {
      const { repo = DEFAULT_REPO, author, perjury } = await readJson(req);
      const c = await load(resolve(repo));
      return send(res, 200, await summon(resolve(repo), author, c.commits, { perjury: Boolean(perjury) }));
    }
    if (url.pathname === '/api/duel' && req.method === 'POST') {
      const { repo = DEFAULT_REPO, perjury, a: wantA, b: wantB } = await readJson(req);
      let a = wantA, b = wantB;
      const r = resolve(repo);
      const c = await load(r);
      if (!a || !b) {
        const pair = await bestPair(r, dedupe(c.authors).slice(0, 3).map((x) => x.name));
        if (!pair) throw new Error('Aucun couple de témoins ne partage un fichier.');
        ({ a, b } = pair);
      }
      return send(res, 200, await duel(r, a, b, { perjury: Boolean(perjury) }));
    }
    if (url.pathname === '/api/verdict' && req.method === 'POST') {
      const { repo = DEFAULT_REPO } = await readJson(req);
      const r = resolve(repo);
      const c = await load(r);
      const tally = judge(c.facts);
      return send(res, 200, { ...tally, ...(await render(r, c.facts, tally)) });
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'inconnu' });

    // fichiers statiques
    const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^([/\\])+/, '');
    const file = join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC) || !existsSync(file)) return send(res, 404, 'introuvable', 'text/plain');
    return send(res, 200, await readFile(file), MIME[extname(file)] || 'application/octet-stream');
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Haunted Court : http://127.0.0.1:${PORT}  (dépôt par défaut : ${DEFAULT_REPO})`);
});
