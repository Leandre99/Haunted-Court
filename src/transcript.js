import { basename, resolve } from 'node:path';
import { verifyClaim, proofOf } from './git.js';
import { t, reason, normLang } from './i18n.js';

// Transcript du procès : le serveur revérifie chaque déclaration contre git avant de l'écrire.
// Ce que le client a envoyé (ok, code, reason, proof) est ignoré ; seuls text, hash, quote et le témoin sont lus.

const MAX_SESSIONS = 20;
const MAX_STATEMENTS = 100;
const MAX_ARTIFACT_LINES = 10;

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v, max) => typeof v === 'string' && v.length <= max;

/** Valide et normalise les séances (témoignages et duels). Lève BadRequest (400) si la forme est invalide. */
export function parseSessions(raw, lang = 'en') {
  const bad = () => new BadRequest(t(lang, 'err_transcript'));
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SESSIONS) throw bad();
  let total = 0;
  const sessions = raw.map((s) => {
    if (!isObj(s) || !Array.isArray(s.statements)) throw bad();
    total += s.statements.length;
    if (total > MAX_STATEMENTS) throw bad();
    const duel = Array.isArray(s.witnesses);
    if (duel && !(s.witnesses.length === 2 && s.witnesses.every((w) => isStr(w, 200) && w))) throw bad();
    if (!duel && !(isStr(s.witness, 200) && s.witness)) throw bad();
    if (duel && s.file !== undefined && !isStr(s.file, 500)) throw bad();
    const statements = s.statements.map((x) => {
      if (!isObj(x) || !isStr(x.text, 2000) || !isStr(x.hash, 200)) throw bad();
      if (x.quote !== undefined && !isStr(x.quote, 2000)) throw bad();
      const witness = duel ? x.witness : s.witness;
      if (duel ? !s.witnesses.includes(witness) : false) throw bad();
      return { witness, text: x.text, hash: x.hash, quote: x.quote };
    });
    return duel
      ? { kind: 'duel', witnesses: s.witnesses, file: s.file ?? '', statements }
      : { kind: 'testimony', witness: s.witness, statements };
  });
  return sessions;
}

/** Lignes de l'artefact du verdict (chemin du clone, etc.) : texte inerte, bornées. */
export function parseArtifactLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l) => typeof l === 'string').slice(0, MAX_ARTIFACT_LINES).map((l) => l.slice(0, 200));
}

/** Une seule ligne, sans retour chariot, sans accent grave ni balise : ne peut pas casser la structure Markdown. */
const inline = (s, max = 300) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/`/g, "'")
    .replace(/</g, '&lt;')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const fence = (lines) => ['```text', ...lines.map((l) => inline(l, 200)), '```'];

export function transcriptFileName(repo) {
  const name = basename(resolve(repo)).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
  return `trial-transcript-${name || 'repo'}.md`;
}

/**
 * Produit le Markdown du transcript. `tally` vient de judge() (jamais du client).
 * Ne modifie pas le dépôt : seulement verifyClaim() et proofOf() (lectures git).
 */
export async function buildTranscript({ repo, lang = 'en', sessions, tally, artifactLines = [] }) {
  lang = normLang(lang);
  const out = [`# ${t(lang, 'tr_title')}`, '', t(lang, 'rep_repo', { name: inline(basename(resolve(repo)), 100) }), ''];
  let verified = 0;
  let rejected = 0;

  for (const s of sessions) {
    out.push(
      s.kind === 'duel'
        ? `## ${t(lang, 'tr_duel', { a: inline(s.witnesses[0], 100), b: inline(s.witnesses[1], 100) })}`
        : `## ${t(lang, 'tr_witness', { name: inline(s.witness, 100) })}`,
      ''
    );
    if (s.kind === 'duel' && s.file) out.push(t(lang, 'tr_file', { file: `\`${inline(s.file, 200)}\`` }), '');

    let n = 0;
    for (const st of s.statements) {
      n += 1;
      const v = await verifyClaim(repo, { hash: st.hash, quote: st.quote, author: st.witness });
      const proof = await proofOf(repo, { hash: st.hash, author: st.witness }, v);
      if (v.ok) verified += 1; else rejected += 1;
      const heading = s.kind === 'duel' ? t(lang, 'tr_statement_by', { n, name: inline(st.witness, 100) }) : t(lang, 'tr_statement', { n });
      out.push(
        `### ${heading}`,
        '',
        `> ${inline(st.text, 600)}`,
        '',
        `- ${t(lang, 'tr_commit')}: \`${inline(st.hash, 64) || '—'}\``,
        `- ${t(lang, 'tr_status')}: ${t(lang, v.ok ? 'tr_ok' : 'tr_bad')}`,
        `- ${t(lang, 'tr_reason')}: ${inline(reason(lang, v), 200)}`,
        `- ${t(lang, 'tr_proof')}:`,
        '',
        ...fence([`$ ${proof.cmd}`, ...proof.lines]),
        ''
      );
    }
  }

  out.push(`## ${t(lang, 'tr_summary')}`, '', t(lang, 'tr_counts', { v: verified, r: rejected }), '');
  out.push(`## ${t(lang, 'tr_verdict', { verdict: t(lang, tally.verdict) })}`, '', t(lang, 'rep_points', { d: tally.defense, p: tally.prosecution }), '');
  if (artifactLines.length) out.push(...fence(artifactLines), '');
  return out.join('\n');
}