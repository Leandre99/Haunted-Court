# Requirements — Haunted Court

Un dépôt git mort est jugé. Les fantômes de ses anciens développeurs témoignent. Chaque phrase d'un fantôme est vérifiée contre le vrai historique git. Le juge rend un verdict qui produit un vrai artefact.

## R1 — Ouvrir une affaire
**Story.** En tant que développeur qui hérite d'un dépôt, je veux ouvrir le dossier d'un dépôt local pour voir les faits qui le concernent.
- WHEN un chemin de dépôt valide est fourni THEN le système SHALL retourner le nombre de commits, la période, les faits de la défense et de l'accusation, et les trois principaux auteurs.
- WHEN le chemin n'est pas un dépôt git THEN le système SHALL répondre par une erreur lisible et ne rien exécuter.
- WHEN deux auteurs ne diffèrent que par des accents THEN le système SHALL ne convoquer qu'un seul fantôme.

## R2 — Convoquer un témoin
- WHEN un témoin est convoqué THEN le système SHALL produire des déclarations à la première personne, chacune appuyée sur un commit de ce témoin.
- WHEN la clé `ANTHROPIC_API_KEY` est présente THEN le système SHALL générer les déclarations avec un LLM ; sinon il SHALL les reconstituer hors-ligne à partir des vrais messages de commit.
- IF l'appel LLM échoue THEN le système SHALL se replier sur le mode hors-ligne sans interrompre le procès.

## R3 — Traçabilité (zéro hallucination)
- WHEN une déclaration cite un hash THEN le système SHALL vérifier : le hash existe, le commit appartient bien au témoin, et la citation figure dans le message ou le diff.
- IF une de ces vérifications échoue THEN la déclaration SHALL être marquée « rejetée » avec la raison, et l'interface SHALL déclencher une objection.
- WHEN un hash n'a pas la forme hexadécimale attendue THEN le système SHALL le rejeter sans l'envoyer à git.

## R4 — Verdict exécutable
- WHEN le verdict est demandé THEN le système SHALL comparer les points de la défense et de l'accusation et rendre EXÉCUTER ou DÉBRANCHER.
- IF le verdict est EXÉCUTER THEN le système SHALL créer, dans un clone, la branche `haunted-court/verdict` avec un commit `MIGRATION_PLAN.md`.
- IF le verdict est DÉBRANCHER THEN le système SHALL écrire un rapport de ce qui mérite d'être sauvé.
- Le dépôt d'origine SHALL ne jamais être modifié.

## R5 — La salle
- WHEN un témoin est convoqué THEN la salle 3D SHALL le faire apparaître, la caméra SHALL se rapprocher, et chaque rejet SHALL produire une objection (secousse, flash, marteau).
- WHEN `prefers-reduced-motion` est actif THEN les animations SHALL être raccourcies.
- IF WebGL est indisponible THEN le procès SHALL rester utilisable sans la 3D.
