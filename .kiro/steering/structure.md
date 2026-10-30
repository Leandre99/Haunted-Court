# Structure

- `src/git.js`: git access and `verifyClaim`
- `src/facts.js`: facts and scoring
- `src/witness.js`: testimony (LLM / offline) + verification
- `src/duel.js`: contested file and two-witness exchange
- `src/verdict.js`: report and verdict branch
- `src/i18n.js`: server-side texts (en, fr)
- `src/server.js`: HTTP only, no business logic
- `public/`: interface (`scene.js` = 3D, `app.js` = the trial, `audio.js` = sound and voice, `i18n.js` = UI texts)
- `test/`: verifier and duel tests
- `.kiro/`: specs, steering, hooks
- `demo/` and `verdicts/`: ignored by git
