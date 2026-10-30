import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { t } from './i18n.js';

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

export function assertRepo(repo, lang) {
  if (typeof repo !== 'string' || !repo || !existsSync(join(repo, '.git'))) {
    throw new Error(t(lang, 'err_repo', { repo }));
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
 * Retourne un code (r_*) traduisible par i18n.reason().
 */
export async function verifyClaim(repo, { hash, quote, author }) {
  if (!hash || !HASH.test(hash)) return { ok: false, code: 'r_bad_hash' };
  const full = (await git(repo, ['rev-parse', '--verify', '--quiet', `${hash}^{commit}`], { allowFail: true })).trim();
  if (!full) return { ok: false, code: 'r_missing' };
  const meta = (await git(repo, ['show', '-s', `--format=%an${SEP}%B`, full])).split(SEP);
  const realAuthor = meta[0];
  if (author && realAuthor !== author) return { ok: false, code: 'r_other', by: realAuthor, full };
  if (quote && quote.trim()) {
    const q = quote.trim().toLowerCase();
    let found = (meta[1] ?? '').toLowerCase().includes(q);
    if (!found) found = (await git(repo, ['show', '--format=', full])).toLowerCase().includes(q);
    return found ? { ok: true, code: 'r_quote_ok', full } : { ok: false, code: 'r_no_quote', full };
  }
  return { ok: true, code: 'r_ok', full };
}
