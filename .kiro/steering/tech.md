# Tech

- Node 20+, ES modules, **no npm dependency** on the server.
- Front end: native HTML/CSS/JS, three.js 0.160 through an import map (jsDelivr CDN).
- Git is only called through `execFile` (never `exec`, never a shell).
- Any input used in a git command is validated (hexadecimal hash).
- Tests: `npm test` (node:test). Any change to `verifyClaim` requires a test.
- The LLM is optional (`ANTHROPIC_API_KEY`) and must never be required for the demo.
- Server texts go through `src/i18n.js`; UI texts through `public/i18n.js`. Never hard-code a user-facing sentence.
