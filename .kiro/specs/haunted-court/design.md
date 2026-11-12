# Design — Haunted Court

## Overview
```
browser (three.js + UI) ──HTTP──▶ src/server.js ──▶ git (execFile, no shell)
                                    ├─ facts.js       defense / prosecution facts + score
                                    ├─ witness.js     statements (LLM or offline) + verification
                                    ├─ duel.js        contested file, two witnesses answering
                                    ├─ git.js         history access, verifyClaim(), proofOf()
                                    ├─ verdict.js     report + branch in a clone
                                    ├─ transcript.js  Markdown transcript, statements re-verified
                                    └─ i18n.js        server-side texts (en, fr)
```

## Decisions
- **Zero dependencies.** Node 20+ and git are enough: `npm start`. No build step.
- **`execFile`, never a shell.** Hashes are validated with `^[0-9a-f]{4,40}$` (case-insensitive) before they reach git.
- **The verifier is the centerpiece.** The LLM proposes, `verifyClaim()` disposes. An unverified sentence is struck through on screen.
- **Language-neutral results.** `verifyClaim()` returns a code (`r_missing`, `r_other`…); `i18n.reason()` translates it. Facts carry a key and variables and are localized at the edge.
- **Server bound to 127.0.0.1.** The repository on trial is local. With `HC_PUBLIC=1` the server listens on all interfaces and only judges the default (demo) repository; any repository path sent by the client is ignored.

## API
Every route accepts an optional `repo` (a path to a local repository; ignored in public mode) and `lang` (`en` or `fr`, English by default).

| Route | Role |
|---|---|
| `GET /api/case?repo=&lang=` | facts, witnesses, metadata |
| `POST /api/testimony` `{repo, author, perjury, lang}` | statements, already verified |
| `POST /api/duel` `{repo, a, b, perjury, lang}` | the pair, the contested file, the exchange. `a` and `b` are optional: when either is missing, the server picks the best pair among the three main witnesses |
| `POST /api/verdict` `{repo, lang}` | verdict + artifact |
| `POST /api/transcript` `{repo, lang, sessions, verdict: {lines}}` | Markdown attachment of the trial, statements re-verified (see the `trial-transcript` spec) |

## Verdict scoring
Each fact carries a weight (1 to 3) for the defense or the prosecution. The heavier side wins; a tie means EXECUTE.

## "Lying witness" mode
A demo option: offline mode slips in one statement that claims another author's commit, to show the verifier at work. It is labelled as such in the interface.

## Error Handling

| Case | Result |
|---|---|
| Path is not a git repository, or `repo` is not a string | readable error (`err_repo` or equivalent), nothing executed |
| Malformed hash in a statement | rejected with `r_bad_hash`, git not called |
| Hash not found in the history | rejected with `r_missing` |
| Commit belongs to another author | rejected with `r_other` (a glitch for the ghost in a duel) |
| Quote absent from the message and the diff | rejected with `r_no_quote` |
| LLM call fails | offline statements rebuilt from real commit messages, the trial goes on |
| Duel with two authors who share no code file | readable error (`err_pair`) |
| Public mode, client sends another repository | ignored, the default repository is judged |
| Unknown `/api/` route | `404 { error }` |
| Any other failure in a route | `500 { error }` with a readable message; the transcript route answers `400 { error }` for an invalid body |
| WebGL or speech synthesis unavailable | the trial stays usable without 3D; the voice button is hidden |

## Testing Strategy

Tests run with `npm test` (`node --test test/*.test.js`) on a temporary git repository, with no network.

- `test/verify.test.js`: `verifyClaim()` on a real commit, an unknown hash, another author's commit, an invented quote and a malformed hash (no git call); offline testimony is fully verified and the demo perjury is caught (R2, R3).
- `test/verify.property.test.js`: property-based tests of `verifyClaim()` with `fast-check`, a devDependency (R3, Correctness Properties below).
- `test/duel.test.js`: the contested file is the one both authors touched, an honest duel is fully verified and alternates the two sides, a ghost's perjury is caught, and two authors with no common file give a clear error (R6).
- `test/security.test.js`: public mode never falls back to the project repository, ignores a client repository path, `HC_PUBLIC=1` judges only the default repository, and a non-string `repo` is refused with a readable error (public deployment).
- `test/transcript.test.js`: covered by the `trial-transcript` spec.

## Correctness Properties

These are the properties behind `test/verify.property.test.js`. The tests use a generated repository of five commits.

### Property 1: A malformed hash never reaches git

*For any* hash that does not match `^[0-9a-f]{4,40}$` (random strings, binary strings, a non-hex character inside a hex string, option-like values such as `--output=/tmp/x`, `HEAD`, a trailing newline or space, the empty string), `verifyClaim()` returns `r_bad_hash` and git is not called. *For any* well-formed hash written in uppercase hexadecimal, the hash is treated as well formed and is not rejected as malformed.

**Validates: Requirements 3.3, 3.4**

### Property 2: Only the author's own commit is accepted

*For any* real commit and any prefix of 7 to 40 characters of its hash, a claim by the real author is accepted. *For any* other author name, the claim is rejected with `r_other`.

**Validates: Requirements 3.1, 3.2**

### Property 3: An unknown hash is rejected

*For any* well-formed 40-character hash that is not in the repository, `verifyClaim()` returns `r_missing`.

**Validates: Requirements 3.1, 3.2**

### Property 4: The quote must be in the commit

*For any* real commit, any non-blank substring of its subject is accepted as a quote. *For any* string present nowhere in the commit (message or diff), the claim is rejected with `r_no_quote`.

**Validates: Requirements 3.1, 3.2**
