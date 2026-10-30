# Structure

- `src/git.js` : accès git et `verifyClaim`
- `src/facts.js` : faits et barème
- `src/witness.js` : témoignages (LLM / hors-ligne) + vérification
- `src/verdict.js` : rapport et branche de verdict
- `src/server.js` : HTTP, aucune logique métier
- `public/` : interface (`scene.js` = 3D, `app.js` = déroulé du procès)
- `test/` : tests du vérificateur
- `.kiro/` : specs, steering, hooks
- `demo/` et `verdicts/` : ignorés par git
