# Requirements — Haunted Court

A dead git repository is put on trial. The ghosts of its former developers testify. Every sentence a ghost speaks is checked against the real git history. The judge delivers a verdict that produces a real artifact.

## R1 — Open a case
**Story.** As a developer inheriting a repository, I want to open the case file of a local repository to see the facts about it.
- WHEN a valid repository path is given THEN the system SHALL return the commit count, the time span, the facts for the defense and the prosecution, and the three main authors.
- WHEN the path is not a git repository THEN the system SHALL answer with a readable error and execute nothing.
- WHEN two authors differ only by accents THEN the system SHALL summon a single ghost.

## R2 — Summon a witness
- WHEN a witness is summoned THEN the system SHALL produce first-person statements, each resting on one of that witness's commits.
- WHEN `ANTHROPIC_API_KEY` is set THEN the system SHALL generate the statements with an LLM; otherwise it SHALL rebuild them offline from the real commit messages.
- IF the LLM call fails THEN the system SHALL fall back to offline mode without interrupting the trial.

## R3 — Traceability (zero hallucination)
- WHEN a statement cites a hash THEN the system SHALL verify that the hash exists, that the commit belongs to the witness, and that the quote appears in the message or the diff.
- IF any check fails THEN the statement SHALL be marked "rejected" with the reason, and the interface SHALL raise an objection.
- WHEN a hash is not of the expected hexadecimal form THEN the system SHALL reject it without sending it to git.
- Hashes SHALL be matched case-insensitively (uppercase hexadecimal is a valid hash).

## R4 — Executable verdict
- WHEN the verdict is requested THEN the system SHALL compare the defense and prosecution points and return EXECUTE or UNPLUG.
- IF the verdict is EXECUTE THEN the system SHALL create, in a clone, the branch `haunted-court/verdict` with a `MIGRATION_PLAN.md` commit.
- IF the verdict is UNPLUG THEN the system SHALL write a report of what is worth saving.
- The original repository SHALL never be modified.

## R5 — The courtroom
- WHEN a witness is summoned THEN the 3D courtroom SHALL make them appear, the camera SHALL move closer, and every rejection SHALL raise an objection (shake, flash, gavel).
- WHEN `prefers-reduced-motion` is set THEN animations SHALL be shortened.
- IF WebGL is unavailable THEN the trial SHALL remain usable without 3D.

## R6 — The duel
- WHEN a duel is requested THEN the system SHALL pick, among the three main witnesses, the pair and the code file they both touched most.
- WHEN the duel runs THEN the two ghosts SHALL answer each other in turn, each limited to their own commits on that file.
- IF a ghost claims the other's commit THEN the statement SHALL be rejected and that ghost SHALL glitch.
- Translation files, documentation, metadata and trivial version-bump commits SHALL be ignored.

## R7 — Sound and voice
- WHEN the user turns sound on THEN the system SHALL produce an ambience (rain, drone, thunder) and effects (gavel, objection, validation, verdict), with no external audio file.
- WHEN the user turns voice on THEN each ghost SHALL speak its statements with a voice installed on the machine, deep for the first witness and higher for the one answering.
- Sound and voice SHALL be off by default and the trial SHALL run identically without them.
- IF speech synthesis is unavailable THEN the voice button SHALL be hidden.

## R8 — Languages
- The interface and the server's texts SHALL be in English by default and available in French (`?lang=fr` or the language button).
- Verification results SHALL be language-neutral codes, translated at the edge.
