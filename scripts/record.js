// Enregistre un vrai procès (réponses du serveur) dans public/demo-data.json.
// Sert au mode « procès enregistré » sur un hébergement statique (Vercel, GitHub Pages…), où il n'y a pas de serveur Node.
// Usage : npm run record   (le dépôt de démonstration doit être cloné dans demo/)
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, [join(ROOT, 'src', 'server.js')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/api/case`)).ok) return; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
}
const post = async (path, body) => (await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();

// Aucun chemin local de cette machine dans le fichier publié.
const scrub = (v) => JSON.parse(JSON.stringify(v).split(ROOT.replace(/\\/g, '\\\\')).join('.'));

try {
  await waitUp();
  const out = { recordedAt: new Date().toISOString() };
  for (const lang of ['en', 'fr']) {
    const c = await (await fetch(`${BASE}/api/case?lang=${lang}`)).json();
    const testimony = {};
    for (const w of c.witnesses) {
      testimony[w.name] = {
        honest: await post('/api/testimony', { lang, author: w.name, perjury: false }),
        perjury: await post('/api/testimony', { lang, author: w.name, perjury: true }),
      };
    }
    const duel = { honest: await post('/api/duel', { lang, perjury: false }), perjury: await post('/api/duel', { lang, perjury: true }) };
    const verdict = await post('/api/verdict', { lang });
    out[lang] = scrub({ case: c, testimony, duel, verdict });
  }
  await writeFile(join(ROOT, 'public', 'demo-data.json'), JSON.stringify(out, null, 1));
  console.log('recorded public/demo-data.json');
} finally {
  server.kill();
}
