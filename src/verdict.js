import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, resolve } from 'node:path';

const run = promisify(execFile);

function report(repoName, facts, tally, verdict) {
  const line = (f) => `- **${f.id}** ${f.text}  \n  _preuve : ${String(f.evidence).replace(/\n/g, ' ')}_`;
  return [
    `# Haunted Court — verdict : ${verdict === 'EXECUTER' ? 'EXÉCUTER' : 'DÉBRANCHER'}`,
    ``,
    `Dépôt jugé : \`${repoName}\``,
    `Points de la défense : ${tally.defense} — Points de l'accusation : ${tally.prosecution}`,
    ``,
    `## Plaidoirie de la défense`,
    ...facts.filter((f) => f.side === 'defense').map(line),
    ``,
    `## Réquisitoire de l'accusation`,
    ...facts.filter((f) => f.side === 'prosecution').map(line),
    ``,
    verdict === 'EXECUTER'
      ? `## Plan\nLe dépôt mérite de vivre. Une branche \`haunted-court/verdict\` contient ce plan de migration ; l'original n'est pas modifié.\n\n1. Mettre à jour les dépendances, une par une, tests à chaque étape.\n2. Fermer ou traiter les TODO/FIXME listés ci-dessus.\n3. Ajouter une intégration continue.`
      : `## Ce qui mérite d'être sauvé\nLe dépôt est débranché. Archivez-le, mais conservez : les tests existants, les messages de commit qui expliquent des décisions, et la liste des TODO ci-dessus.`,
    ``,
  ].join('\n');
}

/**
 * Rend un verdict qui produit un vrai artefact :
 *  - EXECUTER   : clone local, branche haunted-court/verdict avec MIGRATION_PLAN.md (commit réel)
 *  - DEBRANCHER : rapport markdown dans verdicts/
 * Le dépôt d'origine n'est jamais modifié.
 */
export async function render(repo, facts, tally) {
  const name = basename(resolve(repo));
  const md = report(name, facts, tally, tally.verdict);
  const outDir = resolve('verdicts');
  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, `${name}-verdict.md`);
  await writeFile(reportPath, md);

  if (tally.verdict !== 'EXECUTER') return { artifact: 'report', path: reportPath, lines: ['rapport écrit : ' + reportPath] };

  const tmp = await mkdtemp(join(tmpdir(), 'haunted-'));
  try {
    const clone = join(tmp, name);
    await run('git', ['clone', '-q', '--local', resolve(repo), clone]);
    await run('git', ['-C', clone, 'checkout', '-q', '-b', 'haunted-court/verdict']);
    await writeFile(join(clone, 'MIGRATION_PLAN.md'), md);
    await run('git', ['-C', clone, 'add', 'MIGRATION_PLAN.md']);
    await run('git', ['-C', clone, '-c', 'user.name=Haunted Court', '-c', 'user.email=court@haunted.invalid', 'commit', '-q', '-m', 'docs: plan de migration rendu par Haunted Court']);
    const { stdout } = await run('git', ['-C', clone, 'log', '-1', '--format=%h %s']);
    const dest = join(outDir, `${name}-verdict.git`);
    await rm(dest, { recursive: true, force: true });
    await run('git', ['clone', '-q', '--bare', clone, dest]);
    return {
      artifact: 'branch',
      path: dest,
      lines: [`branche haunted-court/verdict créée`, `commit ${stdout.trim()}`, `dépôt : ${dest}`, `rapport : ${reportPath}`],
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
