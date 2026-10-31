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

const clip = (s, n = 46) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/**
 * Ce que git répond réellement pour un commit cité : sert de « pièce à conviction » affichée dans la salle.
 * Les lignes viennent de git lui-même (git show / git cat-file), pas d'un texte inventé.
 */
export async function proofOf(repo, claim, v) {
  const hash = claim.hash;
  if (!hash || !HASH.test(hash)) return { cmd: 'git cat-file -e ?', lines: ['fatal: not a valid object name', 'exit code 128'] };
  if (v.code === 'r_missing') {
    let msg = `fatal: Not a valid object name ${hash}`;
    try { await run('git', ['-C', repo, 'cat-file', '-e', hash]); } catch (e) { msg = String(e.stderr || msg).split('\n')[0] || msg; }
    return { cmd: `git cat-file -e ${hash}`, lines: [clip(msg), 'exit code 128'] };
  }
  const out = await git(repo, ['show', '--no-color', '--unified=0', '--date=short', '--format=Author: %an%nDate:   %ad%n%s', hash], { allowFail: true });
  const rows = out.split('\n');
  const head = rows.slice(0, 3).map((l) => clip(l));
  if (v.code === 'r_other') return { cmd: `git show -s ${hash}`, lines: [head[0], `claimed by: ${claim.author}`, 'author mismatch'] };
  const body = [];
  for (const l of rows.slice(3)) {
    if (/^diff --git/.test(l)) body.push('@@ ' + clip(l.split(' b/')[1] ?? '', 40));
    else if (/^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l) && l.trim().length > 1) body.push(clip(l, 40));
    if (body.length >= 5) break;
  }
  if (v.code === 'r_no_quote') return { cmd: `git show ${hash}`, lines: [...head.slice(0, 2), 'quote not found in commit'] };
  return { cmd: `git show ${hash}`, lines: [...head.slice(0, 2), ...body].slice(0, 7) };
}
