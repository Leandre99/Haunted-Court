# Devpost submission — Haunted Court

Fields below are in the order of the Devpost form. Everything is in English, as the rules require.
Items marked **[TO FILL]** depend on what you actually do in Kiro: write only what is true.

## Project name
Haunted Court

## Category
Frankenstein

## Elevator pitch (350 characters max — 309 used)
Haunted Court puts dead code on trial. Ghosts of a git repo's former developers testify in a gothic 3D courtroom, and every sentence must cite a real commit: we check it against git and strike down liars. The verdict creates a real artifact, a migration branch or a salvage report. Your repo is never touched.

## Links
- Live demo: https://haunted-court.onrender.com (free tier: the first visit can take ~20 s to wake up)
- Source code (MIT, public): https://github.com/Leandre99/Haunted-Court
- Demo video (YouTube, public, < 3 min): **[TO FILL]**

## Inspiration
Every team inherits a repository nobody dares to touch. The knowledge is not gone: it sits in the git history, in the commit messages and diffs of people who left years ago. We wanted to make that history *speak*, and to make it impossible for the speaker to lie.

## What it does
Point Haunted Court at an abandoned git repository and it opens a trial.

- **Case file.** Facts are gathered from the repository itself (age of the last commit, TODO/FIXME markers, tests, dependency files, README) and weigh for the defense or the prosecution.
- **Witnesses.** The main authors are summoned as ghosts. A planchette spells the name on a spirit board, then the ghost appears and testifies in the first person.
- **Proof, not storytelling.** Every sentence must cite a commit. The server checks the hash exists, that the commit belongs to that witness, and that the quote really appears in the commit. The evidence shown in the courtroom is what `git show` really returns. A ghost that claims someone else's commit, or invents a hash or a quote, is struck down with an objection.
- **Ghost duel.** Two developers who both touched the same file cross-examine each other, each limited to their own commits.
- **Verdict.** The judge returns EXECUTE or UNPLUG. EXECUTE creates a real branch (`haunted-court/verdict`, with a migration plan) in a clone; UNPLUG writes a report of what is worth saving. The original repository is never modified.

The interface is English by default with a French option, and sound and ghost voices are synthesized in the browser (off by default).

## How we built it
- **Server:** Node.js with no npm dependency, calling git through `execFile` (never a shell). A central `verifyClaim()` function decides what is accepted; the LLM only proposes.
- **LLM (optional):** with an API key, ghosts' statements are written by a model from their real commits; without a key they are rebuilt offline from real commit messages. The verifier is identical in both modes.
- **Front end:** three.js (WebGL2) with photographic PBR textures and an HDRI from Poly Haven (CC0), real-time shadows, a reflective floor, bloom and film post-processing, a shader-based ghost, and a git tree whose nodes send the proof panels.
- **Tests:** `npm test` covers the verifier (existing / forged / foreign / malformed hashes, invented quotes) and the duel.
- **Hosting:** Dockerfile and `render.yaml`; public mode only ever judges the bundled demo repository.

## Why Frankenstein
It stitches together pieces that do not belong together: a version-control history, a language-model persona, a real-time 3D courtroom, and an action performed on the code.

## Challenges
- Making "no hallucination" a property of the system, not a prompt: the model proposes, git decides, and rejected sentences are shown struck through.
- Keeping the courtroom readable while making ghosts translucent yet visible.
- Running git safely: hashes are validated before they ever reach a command, and the public server is locked to one repository.
- A host without git cannot run the app, so the page falls back to a *recorded* trial (clearly labelled) on static hosting.

## Accomplishments we are proud of
A trial where every line of testimony is traceable to a real commit, and where a lie is caught live on screen, backed by tests.

## What we learned
Showing the proof is more convincing than asserting it: the flying `git show` panel made verification something the audience can *see*.

## What's next
Property-based tests for the verifier, more repositories and witnesses, and an LLM-written cross-examination.

## How Kiro was used (required write-up)

I used the **Kiro IDE** (desktop app, signed in with GitHub) in **supervised mode**: every file change was shown to me and approved or refused by me. I did not use the CLI, Kiro Web, Kiro Crew, MCP servers, powers or custom agents. Across the tasks below Kiro used about **19 of the 4,000 hackathon credits**.

The first version of the game (engine, 3D courtroom, audio, deployment) was written **before Kiro was used on it**, with another AI coding assistant; the `.kiro/` specs and steering existed from the start of the project. Everything listed below was done **in Kiro**, in the Kiro commits of the repository (messages ending "built with Kiro").

**1. Spec-driven development: property-based tests (task 12 of the spec).**
I gave Kiro a requirement (R3, traceability) and four properties to check for `verifyClaim()`. Kiro read the code, then **stopped to ask a question**: my property said uppercase hexadecimal hashes must be rejected, but the implementation accepts them. I decided the implementation was right, because git accepts uppercase hashes and my wording was imprecise. Kiro first recorded the mismatch as a "bug" and a `todo` test; I told it to correct that. It then changed the property, turned the `todo` into a normal test, and added a case-insensitivity rule to requirement R3. Result: tests with `fast-check` (devDependency only; the server stays dependency-free), 17 of 17 passing, no change to `src/`. Cost: about 2.9 credits.

**2. Native spec format.**
Kiro's `validate_spec_format` flagged my hand-written `requirements.md`. I asked Kiro to reformat it without losing content. It produced a standard document (Introduction, Glossary, eight requirements with user stories and numbered WHEN/THEN/SHALL criteria) and the validator reported no issues. Kiro wrote seven user stories that did not exist; I reviewed them. Cost: 0.2 credit.

**3. A new feature built spec-first: `trial-transcript`.**
Kiro wrote a complete spec in `.kiro/specs/trial-transcript/` (six requirements, a design, six tasks) before any code, then implemented it: a "Download transcript" button, `POST /api/transcript`, English and French labels, and 12 tests (including a fast-check property). A design decision I would highlight: the server **re-verifies every statement against git and ignores what the browser sends**, so a forged request cannot make the transcript say something git does not confirm. The route was tested with such a forged request (everything marked "verified", a fake command): none of it reached the document, while the real perjuries stayed rejected. Total: 29 of 29 tests, no new server dependency. Cost: about 9.5 credits.

**4. Steering: a security document that changed Kiro's review.**
I asked Kiro to create `.kiro/steering/security.md` with four rules (no string-built git commands, validate every user-controlled value, the public deployment only ever judges the bundled demo repository, never log secrets) and then review five source files against it. It found **two real violations** that I had not noticed: in public mode the server could fall back to judging its own project directory if the demo was missing, and a non-string `repo` crashed with an internal `TypeError`. It fixed both in a small new module (`src/repo.js`) with five regression tests (34 of 34 passing) and listed, without changing them, other weaknesses outside my rules (information disclosure of absolute paths and raw error messages). Honest caveat: Kiro did not run the new tests against the old code to see them fail. Cost: about 3.9 credits.

**5. Kiro reviewing its own specs against the code.**
I asked Kiro to check the design and tasks files of both specs against the requirements and the code. It found drift (an API table missing the `repo` parameter and the transcript route, a route-order description that did not match the code, missing error-handling, testing and correctness sections, an open task that was actually done) and, when I approved, updated the documents without touching any source file. Honest caveat: Kiro's spec-format validator was not available in that session, so this was a manual check by Kiro, not an automated validation. Cost: about 2.6 credits.

**What I would do next with Kiro:** fix the information-disclosure items it listed, and use hooks and MCP more.

**Agent hooks:** the repository contains a hook, "Verifier tests" (`.kiro/hooks/`), that reruns `npm test` when the verifier files change (`src/git.js`, `src/witness.js`, `src/duel.js` or a test file). I checked it works: saving a one-character edit to `src/duel.js` in Kiro made it run the test suite on its own and report the result. I only confirmed this in a separate check; I did not track whether it fired during each of the tasks above, so I do not claim it caught anything.

## Third-party material and disclosures (required)
- **Pre-existing work:** the visual concept of the courtroom (layout, ritual, git-tree proofs) comes from an earlier prototype made *before* the submission period. The code in this repository was written during the submission period (first commit: 30 Oct 2026).
- **django-userena** (BSD): third-party repository used as the demonstration case; cloned at runtime into `demo/`, not part of this repository.
- **Poly Haven** (CC0): wall, floor and wood textures and the interior HDRI in `public/assets/`.
- **three.js** (MIT): loaded from a CDN.
- **Voice-over** in the video: Windows speech synthesis; **ambient sound** synthesized with ffmpeg. No third-party music.

## Built with
Node.js · git · three.js · WebGL · Web Audio · Speech Synthesis · Docker · Render · Kiro

## Bonus categories
- **Best Demo / Blog / Social Blitz:** optional. Blog post and social post must be published during the submission period and linked in the form (hashtag **#KiroweenHackathon26** at the start of the social post).
- **Best Ghost of Kiroween Past:** only if you registered for Kiroween 2025.
