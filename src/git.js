import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const run = promisify(execFile);
const HASH = /^[0-9a-f]{4,40}$/i;

export async function git(repo, args, { allowFail = false } = {}) {
  try {
    const { stdout } = await run('git', ['-C', repo, ...args], { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    if (allowFail) return '';
    throw err;
  }
}

export function assertRepo(repo) {
  if (typeof repo !== 'string' || !repo || !existsSync(join(repo, '.git'))) {
    throw new Error('Dépôt git introuvable : ' + repo);
  }
}

const SEP = '\x1f';
const REC = '\x1e';

/** Tous les commits de la branche courante, du plus récent au plus ancien. */
export async function allCommits(repo) {
  const out = await git(repo, ['log', `--format=%H${SEP}%an${SEP}%aI${SEP}%s${REC}`]);
  return out
    .split(REC)
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r) => {
      const [hash, author, date, subject] = r.split(SEP);
      return { hash, author, date, subject };
    });
}

export function groupByAuthor(commits) {
  const map = new Map();
  for (const c of commits) {
    const a = map.get(c.author) ?? { name: c.author, commits: [] };
    a.commits.push(c);
    map.set(c.author, a);
  }
  return [...map.values()]
    .map((a) => ({
      name: a.name,
      count: a.commits.length,
      first: a.commits[a.commits.length - 1].date,
      last: a.commits[0].date,
      commits: a.commits,
    }))
    .sort((x, y) => y.count - x.count);
}

export async function filesOfCommit(repo, hash) {
  const out = await git(repo, ['show', '--name-only', '--format=', hash]);
  return out.split('\n').filter(Boolean);
}

/**
 * Vérifie une affirmation d'un fantôme contre le dépôt.
 * Une phrase est valide si le hash existe, appartient bien au témoin,
 * et si la citation (si fournie) figure dans le message ou le diff.
 */
export async function verifyClaim(repo, { hash, quote, author }) {
  if (!hash || !HASH.test(hash)) return { ok: false, reason: 'hash invalide' };
  const full = (await git(repo, ['rev-parse', '--verify', '--quiet', `${hash}^{commit}`], { allowFail: true })).trim();
  if (!full) return { ok: false, reason: 'ce commit n’existe pas' };
  const meta = (await git(repo, ['show', '-s', `--format=%an${SEP}%B`, full])).split(SEP);
  const realAuthor = meta[0];
  if (author && realAuthor !== author) {
    return { ok: false, reason: `ce commit est de ${realAuthor}`, full };
  }
  if (quote && quote.trim()) {
    const q = quote.trim().toLowerCase();
    const msg = (meta[1] ?? '').toLowerCase();
    let found = msg.includes(q);
    if (!found) {
      const patch = await git(repo, ['show', '--format=', full]);
      found = patch.toLowerCase().includes(q);
    }
    if (!found) return { ok: false, reason: 'citation absente du commit', full };
    return { ok: true, reason: 'extrait trouvé dans le commit', full };
  }
  return { ok: true, reason: 'commit trouvé, auteur correct', full };
}
