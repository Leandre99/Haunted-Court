import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRepo, allCommits, groupByAuthor } from './git.js';
import { gatherFacts, judge, localizeFacts } from './facts.js';
import { summon } from './witness.js';
import { render } from './verdict.js';
import { duel, bestPair } from './duel.js';
import { parseSessions, parseArtifactLines, buildTranscript, transcriptFileName } from './transcript.js';
import { t, normLang } from './i18n.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
// Hébergement public : on écoute sur toutes les interfaces et on ne juge QUE le dépôt de démonstration
// (sinon n'importe qui pourrait demander au serveur de lire un chemin arbitraire).
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_MODE = process.env.HC_PUBLIC === '1';
const DEFAULT_REPO = existsSync(join(ROOT, 'demo', 'django-userena', '.git')) ? join(ROOT, 'demo', 'django-userena') : ROOT;

const repoOf = (wanted) => (PUBLIC_MODE ? DEFAULT_REPO : resolve(wanted || DEFAULT_REPO));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'application/octet-stream' };

const cache = new Map();
async function load(repo, lang) {
  assertRepo(repo, lang);
  if (!cache.has(repo)) {
    const commits = await allCommits(repo);
    if (!commits.length) throw new Error(t(lang, 'err_empty'));
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

function send(res, code, body, type = 'application/json', headers = {}) {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readJson(req) {
  let s = '';
  for await (const chunk of req) {
    s += chunk;
    if (s.length > 1e5) throw new Error('request body too large');
  }
  return s ? JSON.parse(s) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let lang = normLang(url.searchParams.get('lang'));
  try {
    if (url.pathname === '/api/case' && req.method === 'GET') {
      const repo = repoOf(url.searchParams.get('repo'));
      const c = await load(repo, lang);
      const first = c.commits[c.commits.length - 1].date.slice(0, 4);
      const last = c.commits[0].date.slice(0, 4);
      return send(res, 200, {
        repo,
        name: repo.split(/[\\/]/).pop(),
        commits: c.commits.length,
        span: `${first}-${last}`,
        facts: localizeFacts(c.facts, lang),
        witnesses: dedupe(c.authors).slice(0, 3).map(({ name, count, first, last }) => ({ name, count, years: `${first.slice(0, 4)}-${last.slice(0, 4)}` })),
        llm: Boolean(process.env.ANTHROPIC_API_KEY),
      });
    }
    if (url.pathname === '/api/testimony' && req.method === 'POST') {
      const body = await readJson(req);
      lang = normLang(body.lang);
      const repo = repoOf(body.repo);
      const c = await load(repo, lang);
      return send(res, 200, await summon(repo, body.author, c.commits, { perjury: Boolean(body.perjury), lang }));
    }
    if (url.pathname === '/api/duel' && req.method === 'POST') {
      const body = await readJson(req);
      lang = normLang(body.lang);
      const r = repoOf(body.repo);
      const c = await load(r, lang);
      let { a, b } = body;
      if (!a || !b) {
        const pair = await bestPair(r, dedupe(c.authors).slice(0, 3).map((x) => x.name));
        if (!pair) throw new Error(t(lang, 'err_pair'));
        ({ a, b } = pair);
      }
      return send(res, 200, await duel(r, a, b, { perjury: Boolean(body.perjury), lang }));
    }
    if (url.pathname === '/api/verdict' && req.method === 'POST') {
      const body = await readJson(req);
      lang = normLang(body.lang);
      const r = repoOf(body.repo);
      const c = await load(r, lang);
      const tally = judge(c.facts);
      return send(res, 200, { ...tally, ...(await render(r, localizeFacts(c.facts, lang), tally, lang)) });
    }
    if (url.pathname === '/api/transcript' && req.method === 'POST') {
      const body = (await readJson(req)) ?? {};
      lang = normLang(body.lang);
      let sessions;
      try {
        sessions = parseSessions(body.sessions, lang);
      } catch (err) {
        if (err.status === 400) return send(res, 400, { error: err.message });
        throw err;
      }
      const r = repoOf(body.repo);
      const c = await load(r, lang);
      const md = await buildTranscript({ repo: r, lang, sessions, tally: judge(c.facts), artifactLines: parseArtifactLines(body.verdict?.lines) });
      return send(res, 200, md, 'text/markdown; charset=utf-8', { 'content-disposition': `attachment; filename="${transcriptFileName(r)}"` });
    }
    if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    // fichiers statiques
    const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^([/\\])+/, '');
    const file = join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC) || !existsSync(file)) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, await readFile(file), MIME[extname(file)] || 'application/octet-stream');
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Haunted Court: http://${HOST}:${PORT}  (default repository: ${DEFAULT_REPO}${PUBLIC_MODE ? ', public mode' : ''})`);
});
