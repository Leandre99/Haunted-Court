# Design — Haunted Court

## Vue d'ensemble
```
navigateur (three.js + UI)  ──HTTP──▶  src/server.js ──▶ git (execFile, sans shell)
                                         ├─ facts.js    faits défense / accusation + score
                                         ├─ witness.js  déclarations (LLM ou hors-ligne) + vérification
                                         ├─ git.js      lecture de l'historique, verifyClaim()
                                         └─ verdict.js  rapport + branche dans un clone
```

## Choix
- **Zéro dépendance.** Node 20+ et git suffisent : `npm start`. Pas d'étape de build.
- **`execFile`, jamais de shell.** Les hashes sont validés par `^[0-9a-f]{4,40}$` avant d'atteindre git.
- **Le vérificateur est la pièce centrale.** Le LLM propose, `verifyClaim()` dispose. Une phrase non vérifiée est barrée à l'écran.
- **Serveur lié à 127.0.0.1.** Le dépôt jugé est local.

## API
| Route | Rôle |
|---|---|
| `GET /api/case?repo=` | faits, témoins, métadonnées |
| `POST /api/testimony` `{author, perjury}` | déclarations déjà vérifiées |
| `POST /api/verdict` | verdict + artefact |

## Barème du verdict
Chaque fait porte un poids (1 à 3) pour la défense ou l'accusation. Le plus lourd gagne ; égalité = EXÉCUTER.

## Mode « témoin menteur »
Option de démonstration : le mode hors-ligne glisse une déclaration qui s'attribue le commit d'un autre auteur, pour montrer le vérificateur à l'œuvre. Elle est étiquetée comme telle dans l'interface.
