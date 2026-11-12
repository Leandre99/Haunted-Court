import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allCommits, verifyClaim } from '../src/git.js';

// R3 (traceability): property-based tests for verifyClaim.
// Each run spawns git, so the number of runs stays modest.

const HASH = /^[0-9a-f]{4,40}$/i; // R3: hashes are matched case-insensitively
const NO_GIT_DIR = join(tmpdir(), 'hc-prop-no-such-repo');
const RUNS = 40;

function sh(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

let dir;
let commits;
const present = new Set(); // every full hash in the temporary repository

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hc-prop-'));
  sh(dir, 'init', '-q');
  const rows = [
    ['Odile', 'a.py', 'def profile(): pass\n', 'add profile system for every user'],
    ['Raven', 'b.py', 'def signup(): pass\n', 'migrate signup forms to new views'],
    ['Odile', 'c.py', 'def perms(): pass\n', 'fix permission check on profiles'],
    ['Mira Solis', 'd.py', 'def export(): pass\n', 'Remove legacy CSV export, keep JSON'],
    ['Raven', 'e.py', 'def cache(): pass\n', 'cache user lookups (2x faster)'],
  ];
  for (const [name, file, body, msg] of rows) {
    writeFileSync(join(dir, file), body);
    sh(dir, 'add', '.');
    sh(dir, '-c', `user.name=${name}`, '-c', `user.email=x@x.io`, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', msg);
  }
  commits = await allCommits(dir);
  for (const c of commits) present.add(c.hash);
});

after(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''));
const hexString = (min, max) => fc.array(hexChar, { minLength: min, maxLength: max }).map((a) => a.join(''));

// (1) any string outside /^[0-9a-f]{4,40}$/i is rejected as r_bad_hash and never reaches git.
// The repo path does not exist: if git were called, the answer would be r_missing, not r_bad_hash.
const malformedHash = fc
  .oneof(
    fc.string(),
    fc.string({ unit: 'binary' }),
    hexString(0, 3),
    hexString(41, 64),
    fc.tuple(hexString(3, 20), fc.constantFrom('g', 'z', '-', ' ', '\n', '/', '^', '~', ':', '\0'), hexString(0, 20)).map((p) => p.join('')),
    fc.constantFrom('--output=/tmp/x', '-h', '--all', 'HEAD', 'HEAD~1', 'main', 'abcd\n', ' abcd', 'abcd ', '')
  )
  .filter((s) => !HASH.test(s));

test('P1: a malformed hash is rejected with r_bad_hash and never reaches git', async () => {
  await fc.assert(
    fc.asyncProperty(malformedHash, async (hash) => {
      const v = await verifyClaim(NO_GIT_DIR, { hash, author: 'Odile' });
      return v.ok === false && v.code === 'r_bad_hash';
    }),
    { numRuns: 300 }
  );
});

// Uppercase hex is a well-formed hash (git accepts it): it must not be rejected as r_bad_hash.
test('P1: uppercase hex is accepted as a well-formed hash', async () => {
  const upper = hexString(4, 40).filter((s) => /[a-f]/.test(s)).map((s) => s.toUpperCase());
  await fc.assert(
    fc.asyncProperty(upper, async (hash) => {
      const v = await verifyClaim(NO_GIT_DIR, { hash, author: 'Odile' });
      return v.code !== 'r_bad_hash';
    }),
    { numRuns: 100 }
  );
  const c = commits[0];
  const v = await verifyClaim(dir, { hash: c.hash.slice(0, 12).toUpperCase(), author: c.author });
  assert.equal(v.ok, true);
  assert.equal(v.full, c.hash);
});

// (2) real commit + real author + hash prefix of 7..40 chars => accepted; another author => r_other.
const realCommit = fc.constantFrom(...[0, 1, 2, 3, 4]);

test('P2: real author and a 7-40 char prefix are accepted', async () => {
  await fc.assert(
    fc.asyncProperty(realCommit, fc.integer({ min: 7, max: 40 }), async (i, len) => {
      const c = commits[i];
      const v = await verifyClaim(dir, { hash: c.hash.slice(0, len), author: c.author });
      return v.ok === true && v.full === c.hash;
    }),
    { numRuns: RUNS }
  );
});

test('P2: a different author is rejected with r_other', async () => {
  await fc.assert(
    fc.asyncProperty(
      realCommit,
      fc.integer({ min: 7, max: 40 }),
      fc.string({ minLength: 1 }),
      async (i, len, other) => {
        const c = commits[i];
        fc.pre(other !== c.author);
        const v = await verifyClaim(dir, { hash: c.hash.slice(0, len), author: other });
        return v.ok === false && v.code === 'r_other' && v.by === c.author;
      }
    ),
    { numRuns: RUNS }
  );
});

// (3) a random 40-hex hash that is not in the repository => r_missing.
test('P3: an unknown 40-hex hash is rejected with r_missing', async () => {
  await fc.assert(
    fc.asyncProperty(hexString(40, 40), async (hash) => {
      fc.pre(!present.has(hash));
      const v = await verifyClaim(dir, { hash, author: 'Odile' });
      return v.ok === false && v.code === 'r_missing';
    }),
    { numRuns: RUNS }
  );
});

// (4) any substring of the subject is a valid quote; a string found nowhere is r_no_quote.
test('P4: any non-blank substring of the subject is accepted as a quote', async () => {
  await fc.assert(
    fc.asyncProperty(realCommit, fc.nat(), fc.nat(), async (i, a, b) => {
      const c = commits[i];
      const s = a % (c.subject.length + 1);
      const e = s + (b % (c.subject.length - s + 1));
      const quote = c.subject.slice(s, e);
      fc.pre(quote.trim().length > 0);
      const v = await verifyClaim(dir, { hash: c.hash.slice(0, 7), author: c.author, quote });
      return v.ok === true && v.code === 'r_quote_ok';
    }),
    { numRuns: RUNS }
  );
});

test('P4: a string present nowhere in the commit is rejected with r_no_quote', async () => {
  // These characters appear in no message, file name or diff of the temporary repository.
  const absent = fc
    .array(fc.constantFrom(...'§¤¶µ'.split('')), { minLength: 1, maxLength: 12 })
    .map((a) => a.join(''));
  await fc.assert(
    fc.asyncProperty(realCommit, absent, async (i, quote) => {
      const c = commits[i];
      const v = await verifyClaim(dir, { hash: c.hash.slice(0, 7), author: c.author, quote });
      return v.ok === false && v.code === 'r_no_quote';
    }),
    { numRuns: RUNS }
  );
});