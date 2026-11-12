import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { t } from './i18n.js';

// Choix du dépôt jugé. Sécurité : en mode public (HC_PUBLIC=1) on ne juge QUE le dépôt de démonstration.

export const demoRepo = (root) => join(root, 'demo', 'django-userena');

/**
 * Dépôt jugé par défaut. En mode public c'est toujours la démo (jamais le dépôt du projet),
 * même si elle manque : la requête échoue alors au lieu de juger autre chose.
 */
export function defaultRepo(root, publicMode, exists = existsSync) {
  const demo = demoRepo(root);
  return publicMode || exists(join(demo, '.git')) ? demo : root;
}

/** Valide le chemin demandé par le client. En mode public il est ignoré. */
export function pickRepo({ wanted, publicMode, fallback, lang }) {
  if (publicMode) return fallback;
  if (wanted === undefined || wanted === null || wanted === '') return fallback;
  if (typeof wanted !== 'string') throw new Error(t(lang, 'err_repo', { repo: typeof wanted }));
  return resolve(wanted);
}