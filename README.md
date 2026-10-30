# Haunted Court

Le procès du code mort. Un dépôt git abandonné est jugé : les fantômes de ses anciens développeurs témoignent, et **chaque phrase est vérifiée contre le vrai historique git**. Un témoin qui s'attribue le commit d'un autre, cite un hash inexistant ou invente une citation est rejeté sur-le-champ. Le juge rend ensuite un verdict qui produit un vrai artefact.

Projet pour Kiroween 2026 (catégorie Frankenstein : Git + IA + théâtre judiciaire en 3D + action réelle sur le code).

## Lancer

Prérequis : Node 20+ et git. Aucune installation npm.

```bash
git clone https://github.com/bread-and-pepper/django-userena demo/django-userena   # dépôt de démonstration
npm start        # http://127.0.0.1:3000
npm test         # tests du vérificateur
```

Sans dépôt de démonstration, Haunted Court juge son propre dépôt. Pour en juger un autre : `http://127.0.0.1:3000/?repo=/chemin/vers/depot`.

## Comment ça marche

1. **Faits.** Âge du dernier commit, TODO/FIXME, tests, ancienneté des dépendances, README : chaque fait pèse pour la défense ou l'accusation.
2. **Témoins.** Les trois principaux auteurs. Avec `ANTHROPIC_API_KEY`, un LLM écrit leurs déclarations à partir de leurs vrais commits ; sans clé, elles sont reconstituées hors-ligne.
3. **Vérification.** `verifyClaim()` contrôle le hash, l'auteur et la citation. Le LLM propose, git tranche.
4. **Verdict.** EXÉCUTER crée la branche `haunted-court/verdict` (avec `MIGRATION_PLAN.md`) dans un clone ; DÉBRANCHER écrit un rapport. Le dépôt d'origine n'est jamais modifié.

Le son (pluie, tonnerre, marteau) et la voix des fantômes sont synthétisés dans le navigateur et désactivés par défaut : activez-les avec les boutons de gauche.

L’option « témoin menteur » est une démonstration : elle ajoute une fausse déclaration pour montrer le vérificateur en action.

## Construit avec Kiro

Specs (`.kiro/specs/`), steering (`.kiro/steering/`) et hook (`.kiro/hooks/`) décrivent le projet.

## Licence

MIT
