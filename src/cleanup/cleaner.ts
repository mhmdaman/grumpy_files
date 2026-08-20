import chalk from 'chalk';
import * as readline from 'readline';
import { CleanupPlanExport, ExportedPlanItem } from '../types/review';
import { validateCleanupTarget } from './validator';
import { moveToTrash } from './trash';
import { writeHistoryEntry } from './history';
import { formatBytes } from '../utils/formatBytes';

export interface CleanupResult {
  totalAttempted: number;
  successCount: number;
  failureCount: number;
  spaceMovedToTrash: number;
}

export async function runCleanup(
  plan: CleanupPlanExport,
  targets: ExportedPlanItem[],
  isDryRun: boolean
): Promise<void> {
  const totalSpace = targets.reduce((sum, t) => sum + t.size, 0);

  if (isDryRun) {
    console.log('');
    console.log(chalk.yellow.bold('🐥 GrumpyDuck — Cleanup Preview'));
    console.log('');
    console.log(`I found ${chalk.cyan(targets.length)} selected files.`);
    console.log('');
    console.log(chalk.dim('Would move to Trash:'));

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      console.log('');
      console.log(`${i + 1}. ${chalk.cyan(t.name)}`);
      console.log(`   ${chalk.dim(formatBytes(t.size))}`);
    }

    console.log('');
    console.log(`Potential space recovered:`);
    console.log(chalk.green.bold(formatBytes(totalSpace)));
    console.log('');
    console.log(chalk.yellow('⚠️  Dry run.'));
    console.log(chalk.yellow('Nothing was modified.'));
    return;
  }

  console.log('');
  console.log(chalk.yellow.bold('🐥 GrumpyDuck — Cleanup Confirmation'));
  console.log('');
  console.log('You selected:');
  console.log(chalk.cyan(`${targets.length} files`));
  console.log('');
  console.log('Total size:');
  console.log(chalk.green(formatBytes(totalSpace)));
  console.log('');
  console.log('These files will be moved to the macOS Trash.');
  console.log(chalk.yellow('They will NOT be permanently deleted.'));
  console.log('');
  console.log(chalk.dim('Files:'));

  for (let i = 0; i < targets.length; i++) {
    console.log(`${i + 1}. ${targets[i].name}`);
  }

  console.log('');
  console.log('Continue?');
  console.log(`Type: ${chalk.cyan.bold('YES')} to continue.`);
  console.log('Anything else: Cancel');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('> ', (ans) => {
      resolve(ans.trim());
      rl.close();
    });
  });

  if (answer !== 'YES') {
    console.log('');
    console.log(chalk.yellow('🐥 GrumpyDuck:'));
    console.log('Fair enough. Everything stays where it is.');
    return;
  }

  console.log('');
  console.log(chalk.yellow('Moving files to Trash...'));

  let successCount = 0;
  let failureCount = 0;
  let spaceMovedToTrash = 0;
  const historyFiles: any[] = [];

  for (const target of targets) {
    const errorMsg = await validateCleanupTarget(target as any); // cast for now, validator uses similar fields
    
    if (errorMsg) {
      console.log('');
      console.log(chalk.red(`⚠️  Skipped:`));
      console.log(chalk.cyan(target.name));
      console.log(chalk.dim(`Reason: ${errorMsg}`));
      failureCount++;
      historyFiles.push({
        path: target.path,
        size: target.size,
        action: 'MOVED_TO_TRASH',
        status: 'FAILED',
        error: errorMsg,
      });
      continue;
    }

    try {
      await moveToTrash(target.path);
      console.log(chalk.green(`✓ ${target.name}`));
      successCount++;
      spaceMovedToTrash += target.size;
      historyFiles.push({
        path: target.path,
        size: target.size,
        action: 'MOVED_TO_TRASH',
        status: 'SUCCESS',
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.log('');
      console.log(chalk.red(`⚠️  Failed:`));
      console.log(chalk.cyan(target.name));
      console.log(chalk.dim(`Reason: ${error.message}`));
      failureCount++;
      historyFiles.push({
        path: target.path,
        size: target.size,
        action: 'MOVED_TO_TRASH',
        status: 'FAILED',
        error: error.message,
      });
    }
  }

  await writeHistoryEntry({
    timestamp: new Date().toISOString(),
    scanPath: plan.scanPath,
    totalSize: spaceMovedToTrash,
    files: historyFiles,
  });

  console.log('');
  console.log(chalk.yellow.bold('🐥 GrumpyDuck — Cleanup Complete'));
  console.log('');
  console.log(`Moved to Trash: ${chalk.green(successCount + ' files')}`);
  if (failureCount > 0) {
    console.log(`Failed:         ${chalk.red(failureCount + ' file(s)')}`);
  }
  console.log('');
  console.log('Space moved to Trash:');
  console.log(chalk.green(formatBytes(spaceMovedToTrash)));
  console.log('');
  console.log('Potential space reclaimable after Trash is emptied:');
  console.log(chalk.green(formatBytes(spaceMovedToTrash)));
  console.log('');
  console.log(chalk.yellow('Nothing was permanently deleted.'));
  console.log(chalk.dim('The files moved to Trash can be restored using macOS.'));
}
