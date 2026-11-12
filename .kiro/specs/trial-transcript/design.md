# Design Document

## Overview

The user downloads the transcript from the verdict overlay. The browser keeps the testimonies and duels it already received and posts them to a new route, `POST /api/transcript`. The server re-verifies every statement against git, computes the verdict from the facts, and returns a Markdown attachment.

```
browser (app.js) ──POST /api/transcript──▶ src/server.js (HTTP only)
   trial record                                   └─▶ src/transcript.js  buildTranscript()
   {lang, repo, sessions[], verdict.lines}              ├─ git.js     verifyClaim(), proofOf()
                                                        ├─ facts.js   judge() (verdict, no side effect)
                                                        └─ i18n.js    labels (en, fr)
◀── text/markdown attachment ──────────────────────────┘
```

## Architecture

### Reuse of the existing API shape

The request carries the responses the interface already holds, unchanged:

- a testimony session is the body of `POST /api/testimony`: `{ witness, statements[] }`;
- a duel session is the body of `POST /api/duel`: `{ file, witnesses[2], statements[] }`, where each statement also has `witness`;
- each statement keeps the existing shape `{ text, hash, quote, ok, code, reason, proof: { cmd, lines[] } }`.

The server only reads `text`, `hash`, `quote` and the witness from a statement. `ok`, `code`, `reason` and `proof` in the request are ignored and recomputed (Requirement 4). The output proof has the same `{ cmd, lines[] }` shape, produced by `proofOf()`.

### Module `src/transcript.js`

`src/server.js` stays HTTP only (steering: `structure.md`). The business logic lives in a new module:

```js
parseSessions(raw)                      // validates and normalizes; throws an error with status 400
buildTranscript({ repo, lang, sessions, tally, artifactLines }) // returns the Markdown string
transcriptFileName(repo)                // safe file name, e.g. trial-transcript-<repo>.md
parseArtifactLines(raw)                 // artifact lines only: strings, capped at 10 lines of 200 characters
class BadRequest extends Error          // carries status 400; thrown by parseSessions, mapped to a 400 by the route
```

`buildTranscript` calls `verifyClaim()` and `proofOf()` for every statement, then `reason(lang, v)` for the text of the reason.

### Route

`POST /api/transcript` with body `{ repo, lang, sessions, verdict: { lines } }`:

1. `normLang`, then `parseSessions(body.sessions)` first: the body is parsed and validated before anything else, so invalid input answers `400 { error }` (message from `src/i18n.js`) before git is touched.
2. `repoOf`, `load()` as for the other routes (same errors for a bad repository, same public mode behaviour).
3. `tally = judge(c.facts)`. The route never calls `render()`, so no branch, clone or report is created.
4. Respond `200` with `content-type: text/markdown; charset=utf-8` and `content-disposition: attachment; filename="..."`.

`send()` gets an optional headers argument; its existing callers are unchanged.

### Interface

- `public/index.html`: a `Download transcript` button (`#vTranscript`, `data-i18n="transcript_btn"`) and a status line (`#tNote`, `aria-live="polite"`) inside the verdict box.
- `public/app.js`: `current.sessions` collects each successful testimony and duel response. On click, `fetch('/api/transcript', ...)` returns a blob that is saved with a temporary `<a download>`. On failure the message `transcript_err` is shown in `#tNote`. The recorded-trial fallback is not used: with no backend the user sees the message.
- `public/i18n.js`: `transcript_btn`, `transcript_err` in `en` and `fr`.

## Components and Interfaces

### Markdown layout

```
# Haunted Court — trial transcript
Repository on trial: `name`

## Witness: Odile
### 1. Statement
> I added this, in 2012: ‹ add profile system ›
- Commit: `a1b2c3d`
- Status: VERIFIED
- Reason: commit found, author correct
- Proof:
```text
$ git show a1b2c3d
Author: Odile
...
```

## Duel: Odile vs Raven
Contested file: `models.py`
(statements, each prefixed with the speaking witness)

## Summary
Verified: 5 — Rejected: 1

## Verdict: EXECUTE
Defense points: 7 — Prosecution points: 4
(artifact lines, plain text block)
```

All labels come from keys prefixed `tr_` in `src/i18n.js` (en and fr). Existing keys are reused: `rep_repo`, `rep_points`, `EXECUTER`, `DEBRANCHER`, `err_repo`.

### Neutralizing free text

- Statement text, hash and witness names: line breaks collapsed to spaces, length capped, backticks replaced; text is written as a Markdown blockquote and the hash inside inline code.
- Proof lines and artifact lines: written inside a fenced block whose content has backticks replaced, so a line cannot close the fence.

## Data Models

Request body (after parsing):

```js
{
  repo?: string, lang?: 'en'|'fr',
  sessions: [
    { witness: string, statements: [{ text, hash, quote }] },                       // testimony
    { witnesses: [string, string], file: string, statements: [{ witness, text, hash, quote }] } // duel
  ],
  verdict?: { lines?: string[] }   // artifact lines only, capped at 10 lines of 200 characters
}
```

Limits: at most 20 sessions and 100 statements in total. The existing `readJson` limit (100,000 characters) also applies.

## Error Handling

| Case | Result |
|---|---|
| Not a git repository / empty repository | existing errors, status 500 as for the other routes |
| Missing, malformed or oversized `sessions` | `400 { error }`, nothing executed |
| Malformed hash in a statement | statement listed as rejected (`r_bad_hash`), git not called |
| Cited commit missing or by another author | statement listed as rejected with the git-based reason |
| Network or backend unreachable (browser) | `transcript_err` in `#tNote`, interface stays usable |

## Testing Strategy

`test/transcript.test.js` (node:test, temporary repository, no network):

- honest testimony: every statement verified, hash and proof lines present, the last section is the verdict;
- forged `ok: true`/`reason` on a statement citing another author's commit: listed as rejected with the git-based reason;
- malformed hash (`--output=/tmp/x`): rejected without throwing;
- duel session: contested file and speaking witnesses are listed;
- backticks and line breaks in text and proof lines cannot close a fence or start a heading;
- French output uses the French labels and none of the English `tr_` labels;
- the repository's refs and `HEAD` are identical before and after;
- route: starts `src/server.js` on a free port; `200` with Markdown headers, `400` on invalid body, no `haunted-court/verdict` branch created.

## Correctness Properties

### Property 1: Statuses come from git

*For any* trial record, every statement in the transcript has the status that `verifyClaim()` returns for its hash, witness and quote, whatever `ok`, `code`, `reason` or `proof` the request carried.

**Validates: Requirements 4.1, 4.2**

### Property 2: Free text cannot change the structure

*For any* statement text, hash or proof line, the generated document keeps the same section structure: no extra heading and no closed fence.

**Validates: Requirements 5.3**

### Property 3: The repository is untouched

*For any* transcript request, every ref of the repository on trial is identical before and after, and no `haunted-court/verdict` branch exists.

**Validates: Requirements 3.3, 4.3**

### Property 4: The verdict closes the transcript

*For any* valid request, the last section of the transcript is the verdict.

**Validates: Requirements 3.1**

## Decisions

- **Server re-verification** keeps the guarantee "no sentence without proof in git". A forged request cannot produce a transcript that says something git does not confirm.
- **No client trust for the verdict**: `judge()` recomputes it. Only the artifact lines are taken from the client, as inert text, because the clone path is only known when the verdict was rendered.
- **No Markdown library**: string building is enough and keeps the server dependency-free.
- **Button in the verdict overlay**: the transcript must end with the verdict, so it is only offered once the verdict exists.