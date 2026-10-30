# Design — Haunted Court

## Overview
```
browser (three.js + UI) ──HTTP──▶ src/server.js ──▶ git (execFile, no shell)
                                    ├─ facts.js    defense / prosecution facts + score
                                    ├─ witness.js  statements (LLM or offline) + verification
                                    ├─ duel.js     contested file, two witnesses answering
                                    ├─ git.js      history access, verifyClaim()
                                    ├─ verdict.js  report + branch in a clone
                                    └─ i18n.js     server-side texts (en, fr)
```

## Decisions
- **Zero dependencies.** Node 20+ and git are enough: `npm start`. No build step.
- **`execFile`, never a shell.** Hashes are validated with `^[0-9a-f]{4,40}$` before they reach git.
- **The verifier is the centerpiece.** The LLM proposes, `verifyClaim()` disposes. An unverified sentence is struck through on screen.
- **Language-neutral results.** `verifyClaim()` returns a code (`r_missing`, `r_other`…); `i18n.reason()` translates it. Facts carry a key and variables and are localized at the edge.
- **Server bound to 127.0.0.1.** The repository on trial is local.

## API
| Route | Role |
|---|---|
| `GET /api/case?repo=&lang=` | facts, witnesses, metadata |
| `POST /api/testimony` `{author, perjury, lang}` | statements, already verified |
| `POST /api/duel` `{perjury, lang}` | the pair, the contested file, the exchange |
| `POST /api/verdict` `{lang}` | verdict + artifact |

## Verdict scoring
Each fact carries a weight (1 to 3) for the defense or the prosecution. The heavier side wins; a tie means EXECUTE.

## "Lying witness" mode
A demo option: offline mode slips in one statement that claims another author's commit, to show the verifier at work. It is labelled as such in the interface.
