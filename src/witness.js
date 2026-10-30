import { filesOfCommit, verifyClaim } from './git.js';

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

function verbFor(subject) {
  const s = subject.toLowerCase();
  if (/^(fix|bug|correct)/.test(s)) return 'J’ai corrigé';
  if (/^(add|new|create|implement)/.test(s)) return 'J’ai ajouté';
  if (/^(remove|delete|drop)/.test(s)) return 'J’ai supprimé';
  if (/^(refactor|clean|rename|move)/.test(s)) return 'J’ai remanié';
  if (/^(update|bump|upgrade)/.test(s)) return 'J’ai mis à jour';
  return 'J’ai écrit';
}

function offlineTestimony(author, commits, others, perjury) {
  const out = pick(commits).map((c) => ({
    text: `${verbFor(c.subject)} ceci, en ${new Date(c.date).getFullYear()} : ‹ ${c.subject} ›`,
    hash: c.hash.slice(0, 7),
    quote: c.subject,
  }));
  if (perjury) {
    const other = meaningful(others)[0];
    if (other) {
      out.splice(2, 0, {
        text: `C’est moi qui ai fait ça : ‹ ${other.subject} ›`,
        hash: other.hash.slice(0, 7),
        quote: other.subject,
      });
    }
  }
  return out;
}

async function llmTestimony(repo, author, commits) {
  const sample = pick(commits, 8);
  const lines = [];
  for (const c of sample) {
    const files = (await filesOfCommit(repo, c.hash)).slice(0, 4).join(', ');
    lines.push(`${c.hash.slice(0, 7)} | ${c.date.slice(0, 10)} | ${c.subject} | ${files}`);
  }
  const prompt = [
    `Tu es le fantôme du développeur « ${author} », appelé à la barre d'un tribunal qui juge un dépôt git mort.`,
    `Voici une partie de tes vrais commits (hash | date | message | fichiers) :`,
    lines.join('\n'),
    ``,
    `Fais 4 déclarations à la première personne, en français, dans le ton d'un développeur mort : sobre, un peu amer, jamais drôle à tout prix.`,
    `Chaque déclaration doit s'appuyer sur UN de ces commits. Réponds UNIQUEMENT par un tableau JSON :`,
    `[{"text": "...", "hash": "<hash court ci-dessus>", "quote": "<extrait EXACT du message du commit>"}]`,
    `Ne cite aucun hash absent de la liste.`,
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  const data = await res.json();
  const text = data.content?.map((b) => b.text ?? '').join('') ?? '';
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  return JSON.parse(json);
}

/** Convoque un témoin : génère ses déclarations puis vérifie chacune contre git. */
export async function summon(repo, author, allCommits, { perjury = false } = {}) {
  const mine = allCommits.filter((c) => c.author === author);
  if (!mine.length) throw new Error('Témoin inconnu : ' + author);
  const others = allCommits.filter((c) => c.author !== author);

  let statements;
  let mode = 'offline';
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      statements = await llmTestimony(repo, author, mine);
      mode = 'llm';
    } catch (err) {
      console.warn('LLM indisponible, repli hors-ligne :', err.message);
    }
  }
  statements ??= offlineTestimony(author, mine, others, perjury);

  const verified = [];
  for (const s of statements) {
    const v = await verifyClaim(repo, { hash: s.hash, quote: s.quote, author });
    verified.push({ text: s.text, hash: s.hash, quote: s.quote, ok: v.ok, reason: v.reason });
  }
  return {
    witness: author,
    mode,
    years: `${new Date(mine[mine.length - 1].date).getFullYear()}-${new Date(mine[0].date).getFullYear()}`,
    commits: mine.length,
    statements: verified,
  };
}
