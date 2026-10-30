import { git } from './git.js';
import { t } from './i18n.js';

const DAY = 86400000;

/**
 * Faits vérifiables sur un dépôt, indépendants de la langue : chacun porte une clé
 * de texte (key) et ses variables (vars). `localizeFacts` produit le texte affiché.
 */
export async function gatherFacts(repo, commits) {
  const facts = [];
  let n = 0;
  const add = (side, weight, key, vars, evidence) =>
    facts.push({ id: 'F-' + String(++n).padStart(2, '0'), side, weight, key, vars, evidence });

  const last = new Date(commits[0].date);
  const first = new Date(commits[commits.length - 1].date);
  const ageYears = (Date.now() - last.getTime()) / (365 * DAY);

  if (ageYears > 2) add('prosecution', 3, 'f_silent', { year: last.getFullYear(), n: Math.floor(ageYears) }, commits[0].hash.slice(0, 7));
  else add('defense', 3, 'f_active', { year: last.getFullYear() }, commits[0].hash.slice(0, 7));

  add('defense', 1, 'f_loved', { n: commits.length, a: first.getFullYear(), b: last.getFullYear() }, `${commits.length} commits`);

  const todoOut = await git(repo, ['grep', '-nIE', 'TODO|FIXME|HACK|XXX', '--', '.', ':(exclude)*.po', ':(exclude)*.min.js'], { allowFail: true });
  const todos = todoOut.split('\n').filter(Boolean);
  if (todos.length >= 5) add('prosecution', 2, 'f_todo_many', { n: todos.length }, todos.slice(0, 3).join(' | '));
  else add('defense', 1, 'f_todo_few', { n: todos.length }, todos.join(' | ') || '-');

  const files = (await git(repo, ['ls-files'])).split('\n').filter(Boolean);
  const tests = files.filter((f) => /(^|\/)(tests?|spec)(\/|_)|test_[^/]*\.py$|\.(test|spec)\.[jt]sx?$/i.test(f));
  if (tests.length >= 3) add('defense', 3, 'f_tests_ok', { n: tests.length }, tests.slice(0, 3).join(', '));
  else add('prosecution', 3, 'f_tests_few', { n: tests.length }, tests.join(', ') || '-');

  for (const dep of ['requirements.txt', 'setup.py', 'package.json', 'Pipfile', 'pyproject.toml', 'Gemfile', 'pom.xml']) {
    if (!files.includes(dep)) continue;
    const log = (await git(repo, ['log', '-1', '--format=%aI|%h', '--', dep])).trim();
    const [iso, h] = log.split('|');
    const depAge = (Date.now() - new Date(iso).getTime()) / (365 * DAY);
    if (depAge > 3) add('prosecution', 2, 'f_deps', { dep, year: new Date(iso).getFullYear(), n: Math.floor(depAge) }, `${dep}@${h}`);
    break;
  }

  const readme = files.find((f) => /^readme/i.test(f));
  if (readme) add('defense', 1, 'f_readme', { file: readme }, readme);
  else add('prosecution', 1, 'f_noreadme', {}, 'ls-files');

  return { facts, todos: todos.slice(0, 10), testFiles: tests.length };
}

export const localizeFacts = (facts, lang) => facts.map((f) => ({ ...f, text: t(lang, f.key, f.vars) }));

export function judge(facts) {
  const d = facts.filter((f) => f.side === 'defense').reduce((s, f) => s + f.weight, 0);
  const p = facts.filter((f) => f.side === 'prosecution').reduce((s, f) => s + f.weight, 0);
  return { defense: d, prosecution: p, verdict: d >= p ? 'EXECUTER' : 'DEBRANCHER' };
}
