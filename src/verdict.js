import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, resolve, relative } from 'node:path';
import { t, normLang } from './i18n.js';

const run = promisify(execFile);
// Chemins affichés relatifs au dossier courant : on n'expose pas l'arborescence de la machine.
const shown = (p) => relative(process.cwd(), p) || p;

function report(lang, repoName, facts, tally) {
  const line = (f) => `- **${f.id}** ${f.text}  \n  _${t(lang, 'rep_evidence')}: ${String(f.evidence).replace(/\n/g, ' ')}_`;
  return [
    `# ${t(lang, 'rep_title', { verdict: t(lang, tally.verdict) })}`,
    ``,
    t(lang, 'rep_repo', { name: repoName }),
    t(lang, 'rep_points', { d: tally.defense, p: tally.prosecution }),
    ``,
    `## ${t(lang, 'rep_def')}`,
    ...facts.filter((f) => f.side === 'defense').map(line),
    ``,
    `## ${t(lang, 'rep_pro')}`,
    ...facts.filter((f) => f.side === 'prosecution').map(line),
    ``,
    t(lang, tally.verdict === 'EXECUTER' ? 'rep_plan_exec' : 'rep_plan_unplug'),
    ``,
  ].join('\n');
}

/**
 * Rend un verdict qui produit un vrai artefact :
 *  - EXECUTER   : clone local, branche haunted-court/verdict avec MIGRATION_PLAN.md (commit réel)
 *  - DEBRANCHER : rapport markdown dans verdicts/
 * Le dépôt d'origine n'est jamais modifié. `facts` doit déjà être localisé.
 */
export async function render(repo, facts, tally, lang = 'en') {
  lang = normLang(lang);
  const name = basename(resolve(repo));
  const md = report(lang, name, facts, tally);
  const outDir = resolve('verdicts');
  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, `${name}-verdict.md`);
  await writeFile(reportPath, md);

  if (tally.verdict !== 'EXECUTER') return { artifact: 'report', path: reportPath, lines: [t(lang, 'v_report_only', { path: shown(reportPath) })] };

  const tmp = await mkdtemp(join(tmpdir(), 'haunted-'));
  try {
    const clone = join(tmp, name);
    await run('git', ['clone', '-q', '--local', '--no-hardlinks', resolve(repo), clone]);
    await run('git', ['-C', clone, 'checkout', '-q', '-b', 'haunted-court/verdict']);
    await writeFile(join(clone, 'MIGRATION_PLAN.md'), md);
    await run('git', ['-C', clone, 'add', 'MIGRATION_PLAN.md']);
    await run('git', ['-C', clone, '-c', 'user.name=Haunted Court', '-c', 'user.email=court@haunted.invalid', 'commit', '-q', '-m', t(lang, 'v_commit_msg')]);
    const { stdout } = await run('git', ['-C', clone, 'log', '-1', '--format=%h %s']);
    const dest = join(outDir, `${name}-verdict.git`);
    await rm(dest, { recursive: true, force: true });
    await run('git', ['clone', '-q', '--bare', '--no-hardlinks', clone, dest]);
    return {
      artifact: 'branch',
      path: dest,
      lines: [t(lang, 'v_branch'), t(lang, 'v_commit', { commit: stdout.trim() }), t(lang, 'v_repo', { path: shown(dest) }), t(lang, 'v_report', { path: shown(reportPath) })],
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
