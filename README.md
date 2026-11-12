# Haunted Court

**Dead code on trial.** Point it at an abandoned git repository: the ghosts of its former developers are summoned to a gothic 3D courtroom to testify, or to duel over the same file. **Every sentence a ghost speaks must cite a commit, and is checked against the real git history.** A ghost that claims someone else's commit, cites a hash that does not exist or invents a quote is struck down on the spot with an objection. The judge then weighs the facts and delivers a verdict that produces a real artifact. Your repository is never modified.

Built for Kiroween 2026 — category: **Frankenstein** (git history + an LLM persona + a 3D courtroom + a real action on code).

> Français : l'interface est en anglais par défaut ; ajoutez `?lang=fr` à l'adresse ou cliquez sur le bouton **FR** pour passer en français.

## Run it

Requirements: Node 20+ and git. The server has no dependency, so no npm install is needed to run it; `npm install` is only needed for the tests (`fast-check`, a dev dependency).

```bash
git clone https://github.com/bread-and-pepper/django-userena demo/django-userena   # demo repository to put on trial
npm start        # http://127.0.0.1:3000
npm test         # tests for the verifier, the duel and the transcript
```

Without the demo repository, Haunted Court judges its own repository. To judge another one: `http://127.0.0.1:3000/?repo=/path/to/repo`.

Optional: set `ANTHROPIC_API_KEY` and the ghosts' statements are written by an LLM from their real commits (the verifier still decides what is accepted). Without a key, statements are rebuilt offline from the real commit messages.

## How it works

1. **Facts.** Age of the last commit, TODO/FIXME markers, tests, age of the dependency files, README. Each fact weighs for the defense or the prosecution.
2. **Witnesses.** The three main authors. The LLM proposes, **git decides**.
3. **Verification.** `verifyClaim()` checks that the hash exists, that the commit belongs to the witness, and that the quote appears in the commit message or diff. Hashes are validated before they ever reach git.
4. **Duel.** The engine finds the pair of witnesses and the code file they both touched most; they answer each other, each limited to their own commits.
5. **Verdict.** EXECUTE creates the branch `haunted-court/verdict` (with a `MIGRATION_PLAN.md`) in a clone of the repository; UNPLUG writes a report on what is worth saving. The original repository is never touched.
6. **Transcript.** Once the verdict is displayed, **Download transcript** saves the trial as a Markdown file: each witness, each statement with its commit hash, verified or rejected, the reason, the proof lines returned by git, and the verdict at the end. The server checks every statement against git again before writing it (what the browser sends is never trusted) and does not create a branch or modify the repository. It is served by `POST /api/transcript` (body: `{repo, lang, sessions, verdict: {lines}}` where `sessions` are the `/api/testimony` and `/api/duel` responses; answer: `text/markdown` attachment, `400` if the body is invalid). It needs the Node server, not the recorded-trial fallback.

The sound (rain, thunder, gavel) and the ghosts' voices are synthesized in the browser (Web Audio and Speech Synthesis) and are off by default: use the buttons on the left. The **Lying witness** option is a demo: it adds one false statement so you can watch the verifier work.

## Deploy

A real server is needed (Node + git): static hosts such as Vercel only serve files.

- **Docker** (Render, Railway, Fly.io…): the `Dockerfile` installs git, clones the demonstration repository at build time and starts in **public mode** (`HC_PUBLIC=1`: it only ever judges the demo repository, never an arbitrary path). `render.yaml` is ready for Render.
- **Static hosts**: the page falls back to a **recorded trial** (`public/demo-data.json`, produced by `npm run record` from a real run) so it never shows an error. Verification results in that file were computed against git when recorded.

## Built with Kiro

Specs (`.kiro/specs/`), steering docs (`.kiro/steering/`) and a hook (`.kiro/hooks/`) describe the project.

## Third-party material

The demonstration repository (django-userena, BSD licensed) is third-party code cloned at runtime into `demo/` and is not part of this repository. three.js is loaded from a CDN. Textures (old stone wall, checkered pavement tiles, dark planks) and the interior HDRI (small cathedral) in `public/assets/` come from [Poly Haven](https://polyhaven.com) under the CC0 license; `node scripts/fetch-assets.mjs` re-downloads them.

## License

MIT
