import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contestedFile, duel } from '../src/duel.js';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'hc-duel-'));
  const sh = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  sh('init', '-q');
  let n = 0;
  const commit = (name, file, msg) => {
    writeFileSync(join(dir, file), `v${++n}\n`);
    sh('add', '.');
    sh('-c', `user.name=${name}`, '-c', `user.email=${name}@x.io`, '-c', `commit.gpgsign=false`, 'commit', '-q', '-m', msg, `--date=${2010 + n}-01-01T00:00:00`);
  };
  commit('Odile', 'models.py', 'add profile model for users');
  commit('Raven', 'models.py', 'rename profile fields to new scheme');
  commit('Odile', 'models.py', 'fix profile permissions check');
  commit('Raven', 'models.py', 'drop legacy profile columns');
  commit('Odile', 'solo.py', 'add a file only odile touched');
  return dir;
}

test('le fichier contesté est celui que les deux ont touché', async () => {
  const dir = makeRepo();
  const c = await contestedFile(dir, 'Odile', 'Raven');
  assert.equal(c.file, 'models.py');
  assert.equal(c.a.length, 2);
  assert.equal(c.b.length, 2);
});

test('un duel honnête est entièrement vérifié et alterne les deux côtés', async () => {
  const dir = makeRepo();
  const d = await duel(dir, 'Odile', 'Raven', { rounds: 2 });
  assert.equal(d.file, 'models.py');
  assert.deepEqual(d.statements.map((s) => s.side), [0, 1, 0, 1]);
  assert.ok(d.statements.every((s) => s.ok), JSON.stringify(d.statements));
});

test('le parjure d’un fantôme dans le duel est attrapé', async () => {
  const dir = makeRepo();
  const d = await duel(dir, 'Odile', 'Raven', { rounds: 2, perjury: true });
  const bad = d.statements.filter((s) => !s.ok);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].side, 1);
  assert.match(bad[0].reason, /Odile/);
  assert.equal(bad[0].code, 'r_other');
});

test('deux auteurs sans fichier commun : erreur claire', async () => {
  const dir = makeRepo();
  await assert.rejects(() => duel(dir, 'Odile', 'Inconnu'), /same file/);
});
