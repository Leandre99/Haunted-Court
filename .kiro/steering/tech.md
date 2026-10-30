# Technique

- Node 20+, modules ES, **aucune dépendance npm** côté serveur.
- Front : HTML/CSS/JS natif, three.js 0.160 via import map (CDN jsDelivr).
- Git est appelé uniquement via `execFile` (jamais `exec`, jamais de shell).
- Toute entrée utilisée dans une commande git est validée (hash hexadécimal).
- Tests : `npm test` (node:test). Toute modification de `verifyClaim` exige un test.
- Le LLM est optionnel (`ANTHROPIC_API_KEY`) et ne doit jamais être indispensable à la démo.
