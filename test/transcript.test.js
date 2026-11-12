import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allCommits } from '../src/git.js';
import { duel } from '../src/duel.js';
import { summon } from '../src/witness.js';
import { t } from '../src/i18n.js';
import { buildTranscript, parseSessions, parseArtifactLines, transcriptFileName } from '../src/transcript.js';

// Spec trial-transcript: the server re-verifies every statement against git and ends with the verdict.

const TALLY = { defense: 7, prosecution: 4, verdict: 'EXECUTER' };
const ROOT = join(import.meta.dirname, '..');
let dir;
let commits;

const sh = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
const headings = (md) => md.split('\n').filter((l) => /^#{1,6} /.test(l));
const fences = (md) => md.split('\n').filter((l) => l.startsWith('```'));
const refsState = () => [sh('for-each-ref'), sh('rev-parse', 'HEAD'), sh('status', '--porcelain'), sh('branch', '--list')].join('|');

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hc-transcript-'));
  sh('init', '-q');
  let n = 0;
  const commit = (name, file, msg) => {
    writeFileSync(join(dir, file), `v${++n}\n`);
    sh('add', '.');
    sh('-c', `user.name=${name}`, '-c', 'user.email=x@x.io', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', msg, `--date=${2010 + n}-01-01T00:00:00`);
  };
  commit('Odile', 'models.py', 'add profile model for users');
  commit('Raven', 'models.py', 'rename `profile` fields to new scheme');
  commit('Odile', 'models.py', 'fix profile permissions check');
  commit('Raven', 'models.py', 'drop legacy profile columns');
  commits = await allCommits(dir);
});

after(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const testimony = async (author, opts) => {
  const tm = await summon(dir, author, commits, opts);
  return { witness: tm.witness, statements: tm.statements };
};

test('honest testimony: each statement has hash, status, reason, proof; the verdict comes last', async () => {
  const s = await testimony('Odile');
  const md = await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([s]), tally: TALLY });
  assert.match(md, /^# Haunted Court — trial transcript/);
  assert.match(md, /## Witness: Odile/);
  for (const st of s.statements) {
    const full = commits.find((c) => c.hash.startsWith(st.hash)).hash;
    assert.ok(md.includes('`' + st.hash + '`'), 'hash listed');
    assert.ok(st.proof.lines.length > 0 && md.includes(`$ ${st.proof.cmd}`), `${full} proof`);
  }
  assert.equal((md.match(/Status: VERIFIED/g) ?? []).length, s.statements.length);
  assert.ok(!md.includes('REJECTED'));
  assert.match(md, /commit found, author correct|quote found in the commit/);
  const last = headings(md).at(-1);
  assert.equal(last, '## Verdict: EXECUTE');
  assert.match(md, /Defense points: 7 — Prosecution points: 4/);
  assert.match(md, /Verified: \d+ — Rejected: 0/);
});

test('a forged ok/reason/proof is ignored: git decides', async () => {
  const raven = commits.find((c) => c.author === 'Raven');
  const forged = { witness: 'Odile', statements: [{ text: 'I wrote this', hash: raven.hash.slice(0, 7), quote: raven.subject, ok: true, code: 'r_ok', reason: 'commit found, author correct', proof: { cmd: 'git show FORGED', lines: ['FORGED LINE'] } }] };
  const md = await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([forged]), tally: TALLY });
  assert.match(md, /Status: REJECTED/);
  assert.match(md, /Reason: this commit is by Raven/);
  assert.ok(!md.includes('FORGED'));
  assert.match(md, /Verified: 0 — Rejected: 1/);
});

test('a malformed hash is listed as rejected without reaching git', async () => {
  const s = { witness: 'Odile', statements: [{ text: 'x', hash: '--output=/tmp/x', quote: 'y' }] };
  const md = await buildTranscript({ repo: join(tmpdir(), 'hc-no-such-repo'), lang: 'en', sessions: parseSessions([s]), tally: TALLY });
  assert.match(md, /Status: REJECTED/);
  assert.match(md, /Reason: invalid hash/);
});

test('a rejected perjury is kept in the transcript with its reason', async () => {
  const s = await testimony('Odile', { perjury: true });
  const md = await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([s]), tally: TALLY });
  assert.equal((md.match(/Status: REJECTED/g) ?? []).length, 1);
  assert.match(md, /Reason: this commit is by /);
});

test('a duel lists both witnesses, the contested file and who speaks', async () => {
  const d = await duel(dir, 'Odile', 'Raven', { rounds: 2 });
  const md = await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([{ file: d.file, witnesses: d.witnesses, statements: d.statements }]), tally: TALLY });
  assert.match(md, /## Duel: Odile vs Raven/);
  assert.match(md, /Contested file: `models\.py`/);
  assert.match(md, /### Statement 1 — Odile/);
  assert.match(md, /### Statement 2 — Raven/);
  assert.equal((md.match(/Status: VERIFIED/g) ?? []).length, 4);
});

test('backticks in git subjects cannot close the proof fence', async () => {
  const d = await duel(dir, 'Odile', 'Raven', { rounds: 2 });
  const md = await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([{ file: d.file, witnesses: d.witnesses, statements: d.statements }]), tally: TALLY });
  assert.equal(fences(md).length, d.statements.length * 2);
  assert.ok(fences(md).every((l, i) => (i % 2 === 0 ? l === '```text' : l === '```')));
});

test('property: any text or hash keeps the document structure', async () => {
  const expected = ['# Haunted Court — trial transcript', '## Witness: Odile', '### Statement 1', '## Summary', '## Verdict: EXECUTE'];
  await fc.assert(
    fc.asyncProperty(fc.string({ unit: 'binary' }), fc.string({ unit: 'binary' }), async (text, hash) => {
      fc.pre(text.length <= 2000 && hash.length <= 200);
      const md = await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([{ witness: 'Odile', statements: [{ text, hash, quote: 'q' }] }]), tally: TALLY });
      assert.deepEqual(headings(md), expected);
      assert.equal(fences(md).length, 2);
      assert.equal(md.split('\n').filter((l) => l.startsWith('> ')).length, 1);
    }),
    { numRuns: 60 }
  );
});

test('French output uses French labels and no English transcript label', async () => {
  const s = await testimony('Odile');
  const md = await buildTranscript({ repo: dir, lang: 'fr', sessions: parseSessions([s], 'fr'), tally: TALLY });
  assert.match(md, new RegExp(`^# ${t('fr', 'tr_title')}`));
  assert.ok(md.includes(t('fr', 'tr_ok')));
  assert.ok(md.includes('## ' + t('fr', 'tr_verdict', { verdict: t('fr', 'EXECUTER') })));
  for (const k of ['tr_summary', 'tr_proof', 'tr_status']) assert.ok(!md.includes(t('en', k) + ':') || t('en', k) === t('fr', k));
  assert.ok(!md.includes('VERIFIED'));
});

test('generating a transcript leaves the repository untouched', async () => {
  const before = refsState();
  const s = await testimony('Odile', { perjury: true });
  await buildTranscript({ repo: dir, lang: 'en', sessions: parseSessions([s]), tally: TALLY });
  assert.equal(refsState(), before);
  assert.ok(!sh('branch', '--all').includes('haunted-court'));
});

test('invalid session shapes are refused with status 400', () => {
  const bads = [undefined, null, 'x', [], Array.from({ length: 21 }, () => ({ witness: 'a', statements: [] })), [{ witness: 'a' }], [{ witness: '', statements: [] }],
    [{ witness: 'a', statements: [{ text: 1, hash: 'abcd1234' }] }], [{ witnesses: ['a'], statements: [] }],
    [{ witnesses: ['a', 'b'], statements: [{ witness: 'zzz', text: 't', hash: 'abcd1234' }] }],
    [{ witness: 'a', statements: Array.from({ length: 101 }, () => ({ text: 't', hash: 'abcd1234' })) }]];
  for (const b of bads) {
    assert.throws(() => parseSessions(b), (e) => e.status === 400, JSON.stringify(b)?.slice(0, 60));
  }
  assert.throws(() => parseSessions([], 'fr'), (e) => e.message === t('fr', 'err_transcript'));
});

test('artifact lines and file names are bounded and safe', () => {
  assert.deepEqual(parseArtifactLines('x'), []);
  assert.equal(parseArtifactLines(Array.from({ length: 30 }, () => 'a'.repeat(500))).length, 10);
  assert.equal(parseArtifactLines([1, 'a'])[0], 'a');
  assert.equal(transcriptFileName('/tmp/my repo!/..x'), 'trial-transcript-x.md');
  assert.match(transcriptFileName(dir), /^trial-transcript-[A-Za-z0-9._-]+\.md$/);
});

// --- route ---
async function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
    s.on('error', rej);
  });
}

test('POST /api/transcript: Markdown attachment, 400 on bad input, nothing created', async () => {
  const port = await freePort();
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1' };
  delete env.HC_PUBLIC; delete env.ANTHROPIC_API_KEY;
  const child = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; ; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch { /* not up yet */ }
      if (i > 100) throw new Error('server did not start');
      await new Promise((r) => setTimeout(r, 100));
    }
    const verdictsBefore = existsSync(join(ROOT, 'verdicts')) ? readdirSync(join(ROOT, 'verdicts')).length : 0;
    const refs = refsState();
    const post = (body) => fetch(base + '/api/transcript', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

    const s = await testimony('Odile');
    const ok = await post({ repo: dir, lang: 'en', sessions: [s], verdict: { lines: ['branch haunted-court/verdict created'] } });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /^text\/markdown/);
    assert.match(ok.headers.get('content-disposition'), /^attachment; filename="trial-transcript-[A-Za-z0-9._-]+\.md"$/);
    const md = await ok.text();
    assert.match(md, /## Verdict: (EXECUTE|UNPLUG)/);
    assert.match(md, /branch haunted-court\/verdict created/);

    const fr = await post({ repo: dir, lang: 'fr', sessions: [s] });
    assert.match(await fr.text(), /## Verdict : (EXÉCUTER|DÉBRANCHER)/);

    for (const bad of [{ repo: dir }, { repo: dir, sessions: [] }, { repo: dir, sessions: [{ witness: 1 }] }]) {
      const r = await post(bad);
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /Invalid transcript request/);
    }
    assert.equal(refsState(), refs);
    const verdictsAfter = existsSync(join(ROOT, 'verdicts')) ? readdirSync(join(ROOT, 'verdicts')).length : 0;
    assert.equal(verdictsAfter, verdictsBefore);
  } finally {
    child.kill();
  }
});