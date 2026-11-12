# Requirements Document

## Introduction

A dead git repository is put on trial. The ghosts of its former developers testify. Every sentence a ghost speaks is checked against the real git history. The judge delivers a verdict that produces a real artifact.

Requirements 1 to 8 below correspond to R1 to R8 in the steering documents, tasks and tests (for example, "R3" is Requirement 3, Traceability).

## Glossary

- **System**: the Haunted Court server and interface.
- **Witness / ghost**: a former developer of the repository, identified by commit author, who gives statements.
- **Statement**: a first-person sentence spoken by a ghost, citing a commit hash.
- **Verification**: the check of a statement against the real git history (hash, author, quote), producing a language-neutral code.

## Requirements

### Requirement 1: Open a case

**User Story:** As a developer inheriting a repository, I want to open the case file of a local repository to see the facts about it, so that I understand its history before the trial.

#### Acceptance Criteria

1. WHEN a valid repository path is given THEN the System SHALL return the commit count, the time span, the facts for the defense and the prosecution, and the three main authors.
2. WHEN the path is not a git repository THEN the System SHALL answer with a readable error and execute nothing.
3. WHEN two authors differ only by accents THEN the System SHALL summon a single ghost.

### Requirement 2: Summon a witness

**User Story:** As a user, I want to summon the ghost of a developer to testify, so that I hear the history of the code in their own voice.

#### Acceptance Criteria

1. WHEN a witness is summoned THEN the System SHALL produce first-person statements, each resting on one of that witness's commits.
2. WHEN `ANTHROPIC_API_KEY` is set THEN the System SHALL generate the statements with an LLM; otherwise it SHALL rebuild them offline from the real commit messages.
3. IF the LLM call fails THEN the System SHALL fall back to offline mode without interrupting the trial.

### Requirement 3: Traceability (zero hallucination)

**User Story:** As a user, I want every sentence a ghost speaks to be proven in git, so that nothing in the trial is invented.

#### Acceptance Criteria

1. WHEN a statement cites a hash THEN the System SHALL verify that the hash exists, that the commit belongs to the witness, and that the quote appears in the message or the diff.
2. IF any check fails THEN the statement SHALL be marked "rejected" with the reason, and the interface SHALL raise an objection.
3. WHEN a hash is not of the expected hexadecimal form THEN the System SHALL reject it without sending it to git.
4. WHEN a hash is checked THEN the System SHALL match it case-insensitively (uppercase hexadecimal is a valid hash).

### Requirement 4: Executable verdict

**User Story:** As a user, I want the judge's verdict to produce a real artifact, so that the trial has a concrete outcome.

#### Acceptance Criteria

1. WHEN the verdict is requested THEN the System SHALL compare the defense and prosecution points and return EXECUTE or UNPLUG.
2. IF the verdict is EXECUTE THEN the System SHALL create, in a clone, the branch `haunted-court/verdict` with a `MIGRATION_PLAN.md` commit.
3. IF the verdict is UNPLUG THEN the System SHALL write a report of what is worth saving.
4. WHEN any verdict is produced THEN the System SHALL never modify the original repository.

### Requirement 5: The courtroom

**User Story:** As a user, I want a gothic 3D courtroom that reacts to the trial, so that the proceedings feel dramatic and the rejections are impossible to miss.

#### Acceptance Criteria

1. WHEN a witness is summoned THEN the 3D courtroom SHALL make them appear, the camera SHALL move closer, and every rejection SHALL raise an objection (shake, flash, gavel).
2. WHEN `prefers-reduced-motion` is set THEN animations SHALL be shortened.
3. IF WebGL is unavailable THEN the trial SHALL remain usable without 3D.

### Requirement 6: The duel

**User Story:** As a user, I want two ghosts to cross-examine each other on the same file, so that contradictions between developers come to light.

#### Acceptance Criteria

1. WHEN a duel is requested THEN the System SHALL pick, among the three main witnesses, the pair and the code file they both touched most.
2. WHEN the duel runs THEN the two ghosts SHALL answer each other in turn, each limited to their own commits on that file.
3. IF a ghost claims the other's commit THEN the statement SHALL be rejected and that ghost SHALL glitch.
4. WHEN the duel selects commits THEN the System SHALL ignore translation files, documentation, metadata and trivial version-bump commits.

### Requirement 7: Sound and voice

**User Story:** As a user, I want optional ambient sound and spoken voices, so that the trial is immersive without being required.

#### Acceptance Criteria

1. WHEN the user turns sound on THEN the System SHALL produce an ambience (rain, drone, thunder) and effects (gavel, objection, validation, verdict), with no external audio file.
2. WHEN the user turns voice on THEN each ghost SHALL speak its statements with a voice installed on the machine, deep for the first witness and higher for the one answering.
3. WHEN the trial starts THEN sound and voice SHALL be off by default, and the trial SHALL run identically without them.
4. IF speech synthesis is unavailable THEN the voice button SHALL be hidden.

### Requirement 8: Languages

**User Story:** As a user, I want the interface in English or French, so that I can follow the trial in my language.

#### Acceptance Criteria

1. WHEN the interface or the server produces text THEN it SHALL be in English by default and available in French (`?lang=fr` or the language button).
2. WHEN a verification result is produced THEN it SHALL be a language-neutral code, translated at the edge.