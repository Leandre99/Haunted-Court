# Requirements Document

## Introduction

After a trial, the user can download the transcript as a Markdown file. The transcript lists each witness, each statement with its commit hash, whether it was verified or rejected, the reason, and the proof lines returned by git. It ends with the verdict.

The transcript is a record of the trial, not a new source of truth: the server re-checks every statement against the real git history before writing it, in line with Requirement 3 (Traceability) of the `haunted-court` spec. Generating a transcript never modifies the repository on trial.

## Glossary

- **System**: the Haunted Court server and interface.
- **Trial record**: the testimonies and duels the user has seen in the current session, exactly as returned by `POST /api/testimony` and `POST /api/duel` (`statements[]`, each with `text`, `hash`, `quote`, `ok`, `code`, `reason` and `proof`).
- **Proof lines**: the `proof.cmd` and `proof.lines` of a statement, taken from what git answers for the cited commit.
- **Transcript**: the Markdown document produced from a trial record and the verdict.

## Requirements

### Requirement 1: Download the transcript

**User Story:** As a user who has just seen a verdict, I want to download the transcript of the trial, so that I can keep or share a written record of what was said and proven.

#### Acceptance Criteria

1. WHEN the verdict is displayed THEN the interface SHALL show a "Download transcript" button.
2. WHEN the user activates the button THEN the interface SHALL send the trial record to `POST /api/transcript` and SHALL save the response as a `.md` file.
3. IF the transcript cannot be produced, including when no Node backend is reachable, THEN the interface SHALL show a readable message and SHALL remain usable.
4. WHEN the transcript is served THEN the response SHALL be marked as a Markdown attachment with a file name derived from the repository name.

### Requirement 2: Witnesses and statements

**User Story:** As a user, I want the transcript to list every witness and every statement with its proof, so that I can check what each ghost claimed and what git answered.

#### Acceptance Criteria

1. WHEN the transcript is generated THEN the System SHALL list each testimony and each duel of the trial record, in the order they took place, naming the witness (or the two duelling witnesses and the contested file).
2. WHEN a statement is listed THEN the System SHALL show its text, its commit hash, its status (verified or rejected), the reason, and its proof lines.
3. WHEN a statement is rejected THEN the System SHALL list it as rejected with its reason, and SHALL NOT omit it.
4. WHEN the transcript is generated THEN the System SHALL show the total number of verified and rejected statements.

### Requirement 3: The verdict closes the transcript

**User Story:** As a user, I want the transcript to end with the verdict, so that the record reads as a complete trial from testimony to judgment.

#### Acceptance Criteria

1. WHEN the transcript is generated THEN the System SHALL end it with the verdict (EXECUTE or UNPLUG) and the defense and prosecution points.
2. WHEN the transcript is generated THEN the System SHALL compute the verdict from the facts of the repository, as `POST /api/verdict` does, and SHALL NOT trust a verdict supplied by the client.
3. WHEN the transcript is generated THEN the System SHALL NOT create a branch, a clone or a report file.
4. WHEN the client supplies the artifact lines of the verdict THEN the System SHALL include them after the verdict as plain text.

### Requirement 4: Traceability preserved

**User Story:** As a user, I want the transcript to contain only what git confirms, so that the written record keeps the zero-hallucination guarantee.

#### Acceptance Criteria

1. WHEN the transcript is generated THEN the System SHALL verify each statement again with the same verification as Requirement 3 of the `haunted-court` spec, and SHALL take the status, the reason and the proof lines from that verification, never from the client's copy.
2. WHEN a statement carries a hash that is not of the expected hexadecimal form THEN the System SHALL list it as rejected without sending it to git.
3. WHEN the transcript is generated THEN the System SHALL NOT modify the repository on trial.

### Requirement 5: Safe input and output

**User Story:** As a user and as an operator, I want invalid requests refused and free text kept inert, so that a transcript request can neither break the server nor corrupt the document.

#### Acceptance Criteria

1. IF the request has no testimony or duel, has wrong types, or exceeds the limits of 20 sessions or 100 statements THEN the System SHALL answer with status 400 and a readable error, and SHALL execute nothing.
2. IF the path is not a git repository THEN the System SHALL answer with the same readable error as the other routes.
3. WHEN statement text, a hash or proof lines contain line breaks or backticks THEN the System SHALL neutralize them so that they cannot alter the structure of the Markdown document.
4. WHERE public mode is enabled THEN the System SHALL only produce transcripts for the default repository.

### Requirement 6: Languages and constraints

**User Story:** As an English or French speaking user, I want the transcript and its button in my language, so that the record matches the interface I used.

#### Acceptance Criteria

1. WHEN `lang` is `fr` THEN the System SHALL write every label of the transcript in French; otherwise it SHALL write them in English.
2. WHEN the System produces a label or a message THEN it SHALL take it from `src/i18n.js` (server) or `public/i18n.js` (interface), with no hard-coded user-facing sentence.
3. WHEN the transcript is produced THEN the System SHALL use only Node and git, with no new server dependency.