import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allCommits, verifyClaim } from '../src/git.js';
import { summon } from '../src/witness.js';

function sh(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'hc-test-'));
  sh(dir, 'init', '-q');
  const commit = (name, file, body, msg) => {
    writeFileSync(join(dir, file), body);
    sh(dir, 'add', '.');
    sh(dir, '-c', `user.name=${name}`, '-c', `user.email=${name}@x.io`, 'commit', '-q', '-m', msg);
  };
  commit('Odile', 'a.py', 'def profile(): pass\n', 'add profile system for every user');
  commit('Raven', 'b.py', 'def signup(): pass\n', 'migrate signup forms to new views');
  commit('Odile', 'c.py', 'def perms(): pass\n', 'fix permission check on profiles');
  return dir;
}

test('un vrai commit du bon auteur est vérifié', async () => {
  const dir = makeRepo();
  const [c] = (await allCommits(dir)).filter((x) => x.author === 'Odile');
  const v = await verifyClaim(dir, { hash: c.hash.slice(0, 7), author: 'Odile', quote: c.subject });
  assert.equal(v.ok, true);
});

test('un hash inexistant est rejeté', async () => {
  const dir = makeRepo();
  const v = await verifyClaim(dir, { hash: 'deadbee', author: 'Odile' });
  assert.equal(v.ok, false);
  assert.match(v.reason, /n’existe pas/);
});

test('le commit de quelqu’un d’autre est rejeté', async () => {
  const dir = makeRepo();
  const raven = (await allCommits(dir)).find((x) => x.author === 'Raven');
  const v = await verifyClaim(dir, { hash: raven.hash.slice(0, 7), author: 'Odile' });
  assert.equal(v.ok, false);
  assert.match(v.reason, /Raven/);
});

test('une citation inventée est rejetée', async () => {
  const dir = makeRepo();
  const c = (await allCommits(dir)).find((x) => x.author === 'Odile');
  const v = await verifyClaim(dir, { hash: c.hash.slice(0, 7), author: 'Odile', quote: 'paiement en ligne' });
  assert.equal(v.ok, false);
});

test('un hash mal formé (injection) est rejeté sans exécuter git', async () => {
  const dir = makeRepo();
  const v = await verifyClaim(dir, { hash: '--output=/tmp/x', author: 'Odile' });
  assert.equal(v.ok, false);
});

test('le témoignage hors-ligne honnête est 100 % vérifié, le parjure est attrapé', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const dir = makeRepo();
  const commits = await allCommits(dir);
  const honest = await summon(dir, 'Odile', commits);
  assert.ok(honest.statements.length > 0);
  assert.ok(honest.statements.every((s) => s.ok));
  const liar = await summon(dir, 'Odile', commits, { perjury: true });
  assert.ok(liar.statements.some((s) => !s.ok));
});
