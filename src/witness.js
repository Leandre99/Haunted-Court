import { filesOfCommit, verifyClaim } from './git.js';
import { t, reason, normLang } from './i18n.js';

const MODEL = process.env.HAUNTED_MODEL || 'claude-sonnet-5-5';

function meaningful(commits) {
  return commits.filter((c) => c.subject.length >= 12 && !/^merge\b/i.test(c.subject));
}

/** Quatre commits répartis sur toute la carrière du témoin. */
function pick(commits, n = 4) {
  const list = meaningful(commits);
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.floor((i * (list.length - 1)) / (n - 1))]);
}

/** Le verbe est deviné d'après le message de commit (anglais, comme la plupart des dépôts). */
function verbKey(subject) {
  const s = subject.toLowerCase();
  if (/^(fix|bug|correct)/.test(s)) return 'v_fix';
  if (/^(add|new|create|implement)/.test(s)) return 'v_add';
  if (/^(remove|delete|drop)/.test(s)) return 'v_remove';
  if (/^(refactor|clean|rename|move)/.test(s)) return 'v_refactor';
  if (/^(update|bump|upgrade)/.test(s)) return 'v_update';
  return 'v_write';
}

function offlineTestimony(lang, commits, others, perjury) {
  const out = pick(commits).map((c) => ({
    text: t(lang, 'w_line', { verb: t(lang, verbKey(c.subject)), year: new Date(c.date).getFullYear(), subject: c.subject }),
    hash: c.hash.slice(0, 7),
    quote: c.subject,
  }));
  if (perjury) {
    const other = meaningful(others)[0];
    if (other) out.splice(2, 0, { text: t(lang, 'w_perjury', { subject: other.subject }), hash: other.hash.slice(0, 7), quote: other.subject });
  }
  return out;
}

async function llmTestimony(repo, author, commits, lang) {
  const sample = pick(commits, 8);
  const lines = [];
  for (const c of sample) {
    const files = (await filesOfCommit(repo, c.hash)).slice(0, 4).join(', ');
    lines.push(`${c.hash.slice(0, 7)} | ${c.date.slice(0, 10)} | ${c.subject} | ${files}`);
  }
  const prompt = [
    `You are the ghost of the developer "${author}", called to the stand in a court trying a dead git repository.`,
    `Here are some of your real commits (hash | date | message | files):`,
    lines.join('\n'),
    ``,
    `Make 4 first-person statements in ${t(lang, 'llm_lang')}, in the tone of a dead developer: sober, a little bitter, never trying to be funny.`,
    `Each statement must rest on ONE of these commits. Reply ONLY with a JSON array:`,
    `[{"text": "...", "hash": "<short hash from the list>", "quote": "<EXACT excerpt of the commit message>"}]`,
    `Never cite a hash that is not in the list.`,
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  const data = await res.json();
  const text = data.content?.map((b) => b.text ?? '').join('') ?? '';
  return JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
}

/** Convoque un témoin : génère ses déclarations puis vérifie chacune contre git. */
export async function summon(repo, author, allCommits, { perjury = false, lang = 'en' } = {}) {
  lang = normLang(lang);
  const mine = allCommits.filter((c) => c.author === author);
  if (!mine.length) throw new Error(t(lang, 'err_witness', { name: author }));
  const others = allCommits.filter((c) => c.author !== author);

  let statements;
  let mode = 'offline';
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      statements = await llmTestimony(repo, author, mine, lang);
      mode = 'llm';
    } catch (err) {
      console.warn('LLM unavailable, falling back to offline mode:', err.message);
    }
  }
  statements ??= offlineTestimony(lang, mine, others, perjury);

  const verified = [];
  for (const s of statements) {
    const v = await verifyClaim(repo, { hash: s.hash, quote: s.quote, author });
    verified.push({ text: s.text, hash: s.hash, quote: s.quote, ok: v.ok, code: v.code, reason: reason(lang, v) });
  }
  return {
    witness: author,
    mode,
    years: `${new Date(mine[mine.length - 1].date).getFullYear()}-${new Date(mine[0].date).getFullYear()}`,
    commits: mine.length,
    statements: verified,
  };
}
