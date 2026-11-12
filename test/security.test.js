import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultRepo, demoRepo, pickRepo } from '../src/repo.js';
import { t } from '../src/i18n.js';

// .kiro/steering/security.md: user-controlled values are validated; HC_PUBLIC=1 only judges the demo repository.

const ROOT = join(import.meta.dirname, '..');
let other; // a real repository that is NOT the demo

before(() => {
  other = mkdtempSync(join(tmpdir(), 'hc-sec-'));
  const sh = (...a) => execFileSync('git', a, { cwd: other, encoding: 'utf8' });
  sh('init', '-q');
  writeFileSync(join(other, 'a.py'), 'x\n');
  sh('add', '.');
  sh('-c', 'user.name=Odile', '-c', 'user.email=x@x.io', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'add something meaningful');
});

after(() => {
  if (other) rmSync(other, { recursive: true, force: true });
});

test('public mode never falls back to the project repository when the demo is missing', () => {
  const missing = () => false;
  assert.equal(defaultRepo(ROOT, true, missing), demoRepo(ROOT));
  assert.notEqual(defaultRepo(ROOT, true, missing), ROOT);
  // local mode keeps the convenient fallback
  assert.equal(defaultRepo(ROOT, false, missing), ROOT);
  assert.equal(defaultRepo(ROOT, false, () => true), demoRepo(ROOT));
});

test('public mode ignores any repository path sent by the client', () => {
  const fallback = demoRepo(ROOT);
  for (const wanted of [other, '/etc', '..', 12, {}, ['x'], undefined]) {
    assert.equal(pickRepo({ wanted, publicMode: true, fallback, lang: 'en' }), fallback);
  }
});

test('local mode refuses a repository path that is not a string', () => {
  const args = { publicMode: false, fallback: ROOT, lang: 'fr' };
  for (const wanted of [12, true, {}, ['x']]) {
    assert.throws(() => pickRepo({ ...args, wanted }), (e) => e.message.startsWith(t('fr', 'err_repo', { repo: '' }).split(':')[0]));
  }
  assert.equal(pickRepo({ ...args, wanted: undefined }), ROOT);
  assert.equal(pickRepo({ ...args, wanted: '' }), ROOT);
  assert.equal(pickRepo({ ...args, wanted: other }), other);
});

async function withServer(extraEnv, fn) {
  const port = await new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  });
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...extraEnv };
  delete env.ANTHROPIC_API_KEY;
  if (!extraEnv.HC_PUBLIC) delete env.HC_PUBLIC;
  const child = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; ; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch { /* not up yet */ }
      if (i > 100) throw new Error('server did not start');
      await new Promise((r) => setTimeout(r, 100));
    }
    await fn(base);
  } finally {
    child.kill();
  }
}

const post = (base, path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('HC_PUBLIC=1: a client-supplied repository is never judged', async () => {
  await withServer({ HC_PUBLIC: '1' }, async (base) => {
    const c = await (await fetch(`${base}/api/case?repo=${encodeURIComponent(other)}`)).json();
    assert.notEqual(c.repo, other);
    assert.ok(!JSON.stringify(c).includes('Odile'));
    const v = await post(base, '/api/testimony', { repo: other, author: 'Odile' });
    assert.notEqual(v.status, 200);
  });
});

test('a non-string repo is refused with a readable error, not a runtime TypeError', async () => {
  await withServer({}, async (base) => {
    for (const repo of [12345, ['x'], { a: 1 }]) {
      const r = await post(base, '/api/testimony', { repo, author: 'Odile' });
      const { error } = await r.json();
      assert.match(error, /Git repository not found/);
      assert.doesNotMatch(error, /paths|argument|ERR_/i);
    }
  });
});