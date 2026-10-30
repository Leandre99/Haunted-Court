import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './git.js';

const DAY = 86400000;

/**
 * Faits vérifiables sur un dépôt. Chaque fait a un identifiant (F-xx),
 * un camp (defense | prosecution), un poids, et la preuve brute.
 */
export async function gatherFacts(repo, commits) {
  const facts = [];
  let n = 0;
  const add = (side, weight, text, evidence) =>
    facts.push({ id: 'F-' + String(++n).padStart(2, '0'), side, weight, text, evidence });

  const last = new Date(commits[0].date);
  const first = new Date(commits[commits.length - 1].date);
  const ageYears = (Date.now() - last.getTime()) / (365 * DAY);

  if (ageYears > 2) {
    add('prosecution', 3, `Le dernier commit date de ${last.getFullYear()} : plus de ${Math.floor(ageYears)} ans de silence.`, commits[0].hash.slice(0, 7));
  } else {
    add('defense', 3, `Le dépôt est encore actif : dernier commit en ${last.getFullYear()}.`, commits[0].hash.slice(0, 7));
  }

  add('defense', 1, `${commits.length} commits de ${first.getFullYear()} à ${last.getFullYear()} : un projet qui a été aimé.`, `${commits.length} commits`);

  const todoOut = await git(repo, ['grep', '-nIE', 'TODO|FIXME|HACK|XXX', '--', '.', ':(exclude)*.po', ':(exclude)*.min.js'], { allowFail: true });
  const todos = todoOut.split('\n').filter(Boolean);
  if (todos.length >= 5) {
    add('prosecution', 2, `${todos.length} marqueurs TODO/FIXME/HACK restent ouverts.`, todos.slice(0, 3).join(' | '));
  } else {
    add('defense', 1, `Seulement ${todos.length} marqueur(s) TODO/FIXME/HACK : le code est propre.`, todos.join(' | ') || 'aucun');
  }

  const files = (await git(repo, ['ls-files'])).split('\n').filter(Boolean);
  const tests = files.filter((f) => /(^|\/)(tests?|spec)(\/|_)|test_[^/]*\.py$|\.(test|spec)\.[jt]sx?$/i.test(f));
  if (tests.length >= 3) {
    add('defense', 3, `${tests.length} fichiers de tests : le code a été défendu par des tests.`, tests.slice(0, 3).join(', '));
  } else {
    add('prosecution', 3, `Seulement ${tests.length} fichier(s) de test.`, tests.join(', ') || 'aucun');
  }

  for (const dep of ['requirements.txt', 'setup.py', 'package.json', 'Pipfile', 'pyproject.toml', 'Gemfile', 'pom.xml']) {
    if (!files.includes(dep)) continue;
    const log = (await git(repo, ['log', '-1', '--format=%aI|%h', '--', dep])).trim();
    const [iso, h] = log.split('|');
    const depAge = (Date.now() - new Date(iso).getTime()) / (365 * DAY);
    if (depAge > 3) {
      add('prosecution', 2, `${dep} n'a pas bougé depuis ${new Date(iso).getFullYear()} : les dépendances ont ${Math.floor(depAge)} ans.`, `${dep}@${h}`);
    }
    break;
  }

  const readme = files.find((f) => /^readme/i.test(f));
  if (readme) add('defense', 1, `Un ${readme} explique le projet aux nouveaux venus.`, readme);
  else add('prosecution', 1, `Aucun README : le projet ne se présente pas.`, 'ls-files');

  return { facts, todos: todos.slice(0, 10), testFiles: tests.length };
}

export function judge(facts) {
  const d = facts.filter((f) => f.side === 'defense').reduce((s, f) => s + f.weight, 0);
  const p = facts.filter((f) => f.side === 'prosecution').reduce((s, f) => s + f.weight, 0);
  return { defense: d, prosecution: p, verdict: d >= p ? 'EXECUTER' : 'DEBRANCHER' };
}
