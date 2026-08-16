import chalk from 'chalk';
import { ScanResult, DuplicateGroup, FileMetadata, CategoryStats, ScanSummary } from '../types/scanner';
import { formatBytes, formatNumber } from '../utils/formatBytes';
import { relativeAge } from '../utils/formatDate';

// ─────────────────────────────────────────────────────────────────────────────
// Terminal reporter
//
// Renders the scan result as a formatted, coloured terminal report.
// All chalk calls are centralised here so that the scanner engine remains
// completely decoupled from terminal concerns.
// ─────────────────────────────────────────────────────────────────────────────

const DIVIDER = chalk.dim('─'.repeat(52));

/** Grumpy duck remarks — contextual based on scan findings. */
function getGrumpyRemark(summary: ScanSummary): string {
  if (summary.duplicateGroupCount > 200) {
    return `I found ${formatNumber(summary.duplicateGroupCount)} duplicate groups. We should probably talk.`;
  }
  if (summary.potentialCleanupBytes > 5 * 1024 * 1024 * 1024) {
    return "Okay... you've got some cleaning to do.";
  }
  if (summary.potentialCleanupBytes > 100 * 1024 * 1024) {
    return "Your Downloads folder is getting crowded.";
  }
  if (summary.largeFileCount > 5 || summary.oldFileCount > 20) {
    return "I found a few things worth reviewing.";
  }
  return "Not terrible, but I'm keeping an eye on your storage.";
}

/**
 * Print a formatted terminal report for the given scan result.
 *
 * @param result  The completed ScanResult.
 */
export function printReport(result: ScanResult): void {
  const { summary, files, duplicateGroups, emptyDirectories, errors } = result;

  // ── Header ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.yellow.bold('🦆  GrumpyDuck — Scan Complete'));
  console.log('');
  console.log(chalk.dim('Scanned: ') + chalk.cyan(result.scannedPath));
  console.log('');

  // ── Top-level stats ────────────────────────────────────────────────────────
  console.log(
    chalk.white('Logical items scanned: ') + chalk.bold(formatNumber(summary.logicalItemsScanned)),
  );
  if (summary.physicalFilesScanned > summary.logicalItemsScanned) {
    console.log(
      chalk.dim(
        `  (${formatNumber(summary.physicalFilesScanned)} physical files scanned across ${formatNumber(summary.physicalDirectoriesScanned)} directories)`,
      ),
    );
  }
  console.log(
    chalk.white('Folders scanned:       ') + chalk.bold(formatNumber(summary.totalDirectories)),
  );
  console.log(
    chalk.white('Total storage:         ') + chalk.bold(formatBytes(summary.totalBytes)),
  );

  // ── Categories ────────────────────────────────────────────────────────────
  if (summary.categories.length > 0) {
    console.log('');
    console.log(DIVIDER);
    console.log(chalk.bold('📂  File Categories'));
    console.log('');
    printCategories(summary.categories);
  }

  console.log('');
  console.log(DIVIDER);

  // ── Large files ───────────────────────────────────────────────────────────
  const largeFiles = files.filter((f) => f.sizeLabel !== null);
  printLargeFiles(largeFiles);

  // ── Old files ─────────────────────────────────────────────────────────────
  const oldFiles = files.filter((f) => f.ageLabel !== null);
  printOldFiles(oldFiles);

  // ── Duplicates ────────────────────────────────────────────────────────────
  printDuplicates(duplicateGroups);

  // ── Empty folders ─────────────────────────────────────────────────────────
  printEmptyFolders(emptyDirectories);

  // ── Errors ────────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    console.log('');
    console.log(chalk.yellow('⚠️   Scan errors (skipped, not crashes)'));
    const shown = errors.slice(0, 10);
    for (const err of shown) {
      console.log(chalk.dim(`  [${err.code ?? 'ERR'}] ${err.path}`));
      console.log(chalk.dim(`        ${err.message}`));
    }
    if (errors.length > 10) {
      console.log(chalk.dim(`  … and ${errors.length - 10} more (see --json for full list)`));
    }
  }

  // ── Cleanup estimate ──────────────────────────────────────────────────────
  console.log('');
  console.log(DIVIDER);
  console.log(chalk.bold('🧹  Potential Cleanup'));
  console.log('');
  console.log(
    chalk.white('  Large files:      ') + chalk.bold(formatBytes(summary.largeFileBytes)),
  );
  console.log(
    chalk.white('  Old files:        ') + chalk.bold(formatBytes(summary.oldFileBytes)),
  );
  console.log(
    chalk.white('  Duplicate waste:  ') +
    chalk.bold(formatBytes(summary.duplicateWastedBytes)),
  );
  console.log('');

  const cleanupStr = formatBytes(summary.potentialCleanupBytes);
  console.log(
    chalk.cyan.bold(`  Potentially Recoverable: ${cleanupStr}`),
  );
  console.log(chalk.dim('  (Estimate only. Files may be important and should be reviewed before deletion.)'));

  // ── Grumpy sign-off ────────────────────────────────────────────────────────
  console.log('');
  console.log(DIVIDER);
  console.log('');
  console.log(chalk.yellow('🦆  GrumpyDuck says:'));
  console.log(chalk.italic.dim(`   "${getGrumpyRemark(summary)}"`));
  console.log('');

  // ── Safety reminder ────────────────────────────────────────────────────────
  console.log(
    chalk.dim(
      '⚠️  GrumpyDuck is read-only. Nothing was deleted, moved, or modified.',
    ),
  );
  console.log(
    chalk.dim(
      '   All results are labelled "Potential cleanup candidate" — review before acting.',
    ),
  );
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section printers
// ─────────────────────────────────────────────────────────────────────────────

function printCategories(categories: CategoryStats[]): void {
  const maxCount = Math.max(...categories.map((c) => c.count));
  const barWidth = 20;

  for (const cat of categories) {
    const bar = buildBar(cat.count, maxCount, barWidth);
    const countStr = formatNumber(cat.count).padStart(6);
    const sizeStr = formatBytes(cat.totalBytes).padStart(10);
    const unit = cat.category === 'Applications' ? (cat.count === 1 ? 'app ' : 'apps') : 'files';
    console.log(
      `  ${chalk.cyan(cat.category.padEnd(12))} ${chalk.dim(bar)} ${chalk.white(countStr)} ${unit.padEnd(5)} ${chalk.dim(sizeStr)}`,
    );
  }
}

function buildBar(value: number, max: number, width: number): string {
  const filled = max === 0 ? 0 : Math.round((value / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function printLargeFiles(largeFiles: FileMetadata[]): void {
  console.log('');
  console.log(chalk.bold('📦  Large Files'));
  if (largeFiles.length === 0) {
    console.log(chalk.dim('  None detected above threshold.'));
    return;
  }
  console.log(chalk.dim(`  ${largeFiles.length} files detected`));
  console.log('');

  // Show top 10; the rest are summarised.
  const sorted = [...largeFiles].sort((a, b) => b.size - a.size);
  const shown = sorted.slice(0, 10);

  for (const f of shown) {
    const label = f.sizeLabel ? chalk.red(`[${f.sizeLabel}]`) : '';
    console.log(`  ${label} ${chalk.bold(f.name)}`);
    console.log(`       ${chalk.cyan(formatBytes(f.size))}  ${chalk.dim(f.path)}`);
  }
  if (sorted.length > 10) {
    console.log(chalk.dim(`  … and ${sorted.length - 10} more (use --json for full list)`));
  }
}

function printOldFiles(oldFiles: FileMetadata[]): void {
  console.log('');
  console.log(chalk.bold('🕰️   Potentially Old Files'));
  if (oldFiles.length === 0) {
    console.log(chalk.dim('  None detected above age threshold.'));
    return;
  }
  console.log(chalk.dim(`  ${oldFiles.length} files detected`));
  console.log(chalk.dim('  Note: Age alone does not mean a file is unwanted.'));
  console.log('');

  const sorted = [...oldFiles].sort((a, b) => a.modifiedAt - b.modifiedAt);
  const shown = sorted.slice(0, 10);

  for (const f of shown) {
    const label = f.ageLabel ? chalk.yellow(`[${f.ageLabel}]`) : '';
    const age = relativeAge(f.modifiedAt);
    console.log(`  ${label} ${chalk.bold(f.name)}`);
    console.log(`       Last modified: ${chalk.dim(age)}  ${chalk.dim(f.path)}`);
  }
  if (sorted.length > 10) {
    console.log(chalk.dim(`  … and ${sorted.length - 10} more (use --json for full list)`));
  }
}

function printDuplicates(groups: DuplicateGroup[]): void {
  console.log('');
  console.log(chalk.bold('📋  Duplicate Files'));
  if (groups.length === 0) {
    console.log(chalk.dim('  No duplicates detected.'));
    return;
  }
  const totalExtraFiles = groups.reduce((sum, g) => sum + g.files.length - 1, 0);
  const wastedBytes = groups.reduce((sum, g) => sum + g.size * (g.files.length - 1), 0);
  console.log(chalk.dim(`  ${groups.length} duplicate groups (${totalExtraFiles} extra copies, ${formatBytes(wastedBytes)} wasted)`));
  console.log('');

  const shown = groups.slice(0, 5);
  for (const group of shown) {
    console.log(`  ${chalk.magenta('Duplicate Group')} — ${formatBytes(group.size)} each`);
    console.log(`  ${chalk.dim('Hash: ' + group.hash.slice(0, 16) + '…')}`);
    for (const f of group.files) {
      console.log(`    ${chalk.bold(f.name)}  ${chalk.dim(f.path)}`);
    }
    console.log('');
  }
  if (groups.length > 5) {
    console.log(chalk.dim(`  … and ${groups.length - 5} more groups (use --json for full list)`));
  }
}

function printEmptyFolders(dirs: string[]): void {
  console.log('');
  console.log(chalk.bold('📁  Empty Folders'));
  if (dirs.length === 0) {
    console.log(chalk.dim('  None detected.'));
    return;
  }
  console.log(chalk.dim(`  ${dirs.length} empty folders detected`));
  console.log('');

  const shown = dirs.slice(0, 10);
  for (const d of shown) {
    console.log(`  ${chalk.dim(d)}`);
  }
  if (dirs.length > 10) {
    console.log(chalk.dim(`  … and ${dirs.length - 10} more (use --json for full list)`));
  }
}
