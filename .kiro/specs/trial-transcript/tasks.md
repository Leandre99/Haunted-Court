# Implementation Plan

## Overview

Add a downloadable Markdown transcript of the trial. Server logic goes in a new module, the route stays thin, and the interface gets one button.

## Tasks

- [x] 1. Add server-side texts for the transcript
  - Add the `tr_*` keys and `err_transcript` to `src/i18n.js` (en and fr)
  - _Requirements: 6.1, 6.2_

- [x] 2. Implement `src/transcript.js`
  - [x] 2.1 `parseSessions()` with type checks and limits (20 sessions, 100 statements), error with status 400
    - _Requirements: 5.1_
  - [x] 2.2 `buildTranscript()`: re-verify with `verifyClaim()`, proof from `proofOf()`, labels from `i18n.js`, neutralize free text, end with the verdict
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.4, 4.1, 4.2, 4.3, 5.3, 6.1_
  - [x] 2.3 `transcriptFileName()` safe file name
    - _Requirements: 1.4_

- [x] 3. Add `POST /api/transcript` to `src/server.js`
  - Validate, compute the verdict with `judge()` only, respond with Markdown attachment headers; extend `send()` with optional headers
  - _Requirements: 1.4, 3.2, 3.3, 5.1, 5.2, 5.4_

- [x] 4. Interface: "Download transcript" button
  - [x] 4.1 Add `#vTranscript` and `#tNote` to `public/index.html`, texts in `public/i18n.js` (en and fr), small style rule
    - _Requirements: 1.1, 6.2_
  - [x] 4.2 In `public/app.js`, collect `current.sessions`, post to `/api/transcript`, save the blob, show `transcript_err` on failure
    - _Requirements: 1.2, 1.3_

- [x] 5. Tests in `test/transcript.test.js`
  - Cases listed in the design (content, forged input, malformed hash, duel, neutralization, French, repository untouched, route)
  - _Requirements: 2, 3, 4, 5, 6_

- [x] 6. Documentation
  - Update `README.md` (feature, API route, `npm test` description) and the structure steering doc (`src/transcript.js`)
  - _Requirements: 6.3_

## Notes

- The server must stay dependency-free; `fast-check` remains a test-only devDependency.
- Run `npm test` after each task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5"] },
    { "id": 4, "tasks": ["6"] }
  ]
}
```
