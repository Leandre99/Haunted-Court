import { git, verifyClaim } from './git.js';
import { t, reason, normLang } from './i18n.js';

// Fichiers qui font de mauvais débats : traductions, binaires, métadonnées, docs.
const NOISE = /\.(po|mo|lock|min\.js|svg|png|jpe?g|gif|ico|md|rst|txt|cfg|ini|json|ya?ml)$|(^|\/)(locale|migrations|docs?)\/|(^|\/)(__init__\.py|setup\.py|readme[^/]*|changelog[^/]*|history[^/]*|license[^/]*|manifest\.in)$/i;
const CODE = /\.(py|js|jsx|ts|tsx|rb|go|java|kt|php|c|h|cc|cpp|rs|cs|swift|scala|html|css)$/i;
const TRIVIAL = /\b(bump|release|version|typo|merge|whitespace|pep8|pyflakes)\b/i;
const SEP = '\x1f';
const REC = '\x1e';

/**
 * Cherche le fichier que les deux témoins ont le plus touché tous les deux.
 * Retourne leurs commits sur ce fichier, du plus ancien au plus récent.
 */
export async function contestedFile(repo, a, b) {
  const out = await git(repo, ['log', '--name-only', `--format=${REC}%H${SEP}%an${SEP}%aI${SEP}%s`]);
  const files = new Map();
  for (const rec of out.split(REC)) {
    if (!rec.trim()) continue;
    const [head, ...rest] = rec.split('\n');
    const [hash, author, date, subject] = head.split(SEP);
    if (author !== a && author !== b) continue;
    if (TRIVIAL.test(subject) || subject.length < 12) continue;
    for (const f of rest.filter(Boolean)) {
      if (NOISE.test(f) || !CODE.test(f)) continue;
      const e = files.get(f) ?? { [a]: [], [b]: [] };
      e[author].push({ hash, author, date, subject });
      files.set(f, e);
    }
  }
  let best = null;
  for (const [file, e] of files) {
    const score = Math.min(e[a].length, e[b].length);
    if (score === 0) continue;
    const total = e[a].length + e[b].length;
    if (!best || score > best.score || (score === best.score && total > best.total)) best = { file, score, total, a: e[a], b: e[b] };
  }
  if (!best) return null;
  const chrono = (l) => [...l].sort((x, y) => x.date.localeCompare(y.date));
  return { file: best.file, score: best.score, a: chrono(best.a), b: chrono(best.b) };
}

/** Parmi les témoins, le couple qui se dispute le plus le même fichier. */
export async function bestPair(repo, names) {
  let best = null;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const c = await contestedFile(repo, names[i], names[j]);
      if (c && (!best || c.score > best.score)) best = { a: names[i], b: names[j], score: c.score };
    }
  }
  return best;
}

const year = (c) => new Date(c.date).getFullYear();

/** Un contre-interrogatoire : A et B se répondent à tour de rôle, chaque phrase est vérifiée. */
export async function duel(repo, a, b, { perjury = false, rounds = 3, lang = 'en' } = {}) {
  lang = normLang(lang);
  const c = await contestedFile(repo, a, b);
  if (!c) throw new Error(t(lang, 'err_shared', { a, b }));
  const n = Math.min(rounds, c.a.length, c.b.length);
  const pick = (list) => Array.from({ length: n }, (_, i) => list[n === 1 ? 0 : Math.round((i * (list.length - 1)) / (n - 1))]);
  const as = pick(c.a);
  const bs = pick(c.b);

  const lines = [];
  for (let i = 0; i < n; i++) {
    lines.push({ side: 0, c: as[i], text: t(lang, i === 0 ? 'd_open' : 'd_again', { subject: as[i].subject, year: year(as[i]) }) });
    // Parjure de démonstration : B s'attribue un commit de A.
    const liar = perjury && i === Math.min(1, n - 1);
    const bc = liar ? as[i] : bs[i];
    lines.push({ side: 1, c: bc, text: t(lang, liar ? 'd_liar' : 'd_retort', { subject: bc.subject, year: year(bc) }) });
  }

  const witnesses = [a, b];
  const statements = [];
  for (const l of lines) {
    const author = witnesses[l.side];
    const v = await verifyClaim(repo, { hash: l.c.hash.slice(0, 7), quote: l.c.subject, author });
    statements.push({ side: l.side, witness: author, text: l.text, hash: l.c.hash.slice(0, 7), quote: l.c.subject, ok: v.ok, code: v.code, reason: reason(lang, v) });
  }
  return { file: c.file, witnesses, statements };
}
