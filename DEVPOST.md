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

## How Kiro was used (required write-up) — **[TO FILL, truthfully]**
Judges check *how effectively* Kiro was used. Write only what you did. Suggested structure, with what is true today:

- **Spec-driven development:** the repository contains `requirements.md`, `design.md` and `tasks.md` under `.kiro/specs/haunted-court/`. **[TO FILL: which tasks Kiro implemented from these specs, and how it compared with free-form prompting.]**
- **Steering docs:** `.kiro/steering/` (`product.md`, `tech.md`, `structure.md`) hold product rules (e.g. "no sentence without a commit hash"), technical rules (e.g. "never use a shell for git") and the layout. **[TO FILL: which rule changed Kiro's output most.]**
- **Agent hooks:** `.kiro/hooks/` has a hook that reruns the verifier tests when the verifier changes. **[TO FILL: whether it fired and what it caught.]**
- **MCP / powers / custom agents / property-based testing:** **[TO FILL or leave out if not used.]**
- **Which Kiro app** (IDE, CLI, Web, Crew) and how they differed: **[TO FILL.]**

Disclosure: the first version of this codebase was written with another AI coding assistant (Claude Code) before Kiro was used on it, and `.kiro/` was created at the start of the project. Say so plainly rather than implying Kiro wrote everything.

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
