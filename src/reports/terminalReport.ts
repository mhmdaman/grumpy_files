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

/** Grumpy duck remarks — contextual based on scan findings and file intelligence. */
function getGrumpyRemark(summary: ScanSummary): string {
  const intel = summary.intelligenceSummary;

  if (summary.duplicateGroupCount > 20 || (intel && intel.duplicateGroupCount > 20)) {
    return `I found ${formatNumber(summary.duplicateGroupCount)} duplicate groups. We should probably talk.`;
  }
  if (intel && intel.installerCount >= 3) {
    return "You've been collecting installers like they're Pokémon.";
  }
  if (intel && intel.datasetCount > 0) {
    return "I found some datasets. I'm not touching those. You might actually need them.";
  }
  if (intel && intel.devArtifactCount > 100 && intel.devArtifactCount > summary.totalFiles * 0.4) {
    return "A lot of this looks like developer-generated stuff. I'll leave it alone.";
  }
  if (summary.potentialCleanupBytes > 5 * 1024 * 1024 * 1024) {
    return "Okay... you've got some cleaning to do.";
  }
  if (summary.potentialCleanupBytes > 100 * 1024 * 1024) {
    return "Your storage is getting crowded.";
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

  // ── File Intelligence ──────────────────────────────────────────────────────
  if (summary.intelligenceSummary) {
    console.log('');
    console.log(DIVIDER);
    console.log(chalk.bold('🧠  File Intelligence'));
    console.log('');
    printIntelligenceOverview(summary);
  }

  // ── GrumpyDuck Noticed (Examples) ──────────────────────────────────────────
  printGrumpyNoticed(files, duplicateGroups);

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

  // ── Old files (Grouped by Intelligence) ────────────────────────────────────
  const oldFiles = files.filter((f) => f.ageLabel !== null);
  printOldFiles(oldFiles, summary);

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
    chalk.white('  Large files:          ') + chalk.bold(formatBytes(summary.largeFileBytes)),
  );
  console.log(
    chalk.white('  Old files:            ') + chalk.bold(formatBytes(summary.oldFileBytes)),
  );
  console.log(
    chalk.white('  Duplicate waste:      ') +
    chalk.bold(formatBytes(summary.duplicateWastedBytes)),
  );

  if (summary.smartCleanupBytes !== undefined && summary.smartCleanupBytes > 0) {
    console.log('');
    console.log(
      chalk.green.bold(`  Conservative Cleanup (Duplicates): ${formatBytes(summary.smartCleanupBytes)}`),
    );
  }

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
      '   All recommendations are conservative — review before taking action.',
    ),
  );
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section printers
// ─────────────────────────────────────────────────────────────────────────────

function printIntelligenceOverview(summary: ScanSummary): void {
  const intel = summary.intelligenceSummary;
  if (!intel) return;

  const cats = intel.categories;

  if (cats.DATASET > 0) {
    console.log(`  ${chalk.cyan('📊 Datasets')}`);
    console.log(`     ${cats.DATASET} ${cats.DATASET === 1 ? 'file' : 'files'}`);
    console.log(`     Recommendation: ${chalk.green.bold('KEEP')}`);
    console.log('');
  }

  if (cats.INSTALLER > 0) {
    console.log(`  ${chalk.cyan('💿 Installers')}`);
    console.log(`     ${cats.INSTALLER} ${cats.INSTALLER === 1 ? 'file' : 'files'}`);
    console.log(`     Recommendation: ${chalk.yellow.bold('REVIEW')}`);
    console.log('');
  }

  if (summary.duplicateGroupCount > 0) {
    console.log(`  ${chalk.cyan('📋 Duplicates')}`);
    console.log(`     ${summary.duplicateGroupCount} duplicate ${summary.duplicateGroupCount === 1 ? 'group' : 'groups'}`);
    console.log(`     Recommendation: ${chalk.magenta.bold('POTENTIAL CLEANUP')}`);
    console.log('');
  }

  if (cats.DEVELOPMENT_ARTIFACT > 0) {
    console.log(`  ${chalk.cyan('🧩 Development Artifacts')}`);
    console.log(`     ${cats.DEVELOPMENT_ARTIFACT} ${cats.DEVELOPMENT_ARTIFACT === 1 ? 'file' : 'files'}`);
    console.log(`     Recommendation: ${chalk.dim.bold('IGNORE')}`);
    console.log('');
  }

  if (cats.DOCUMENT > 0) {
    console.log(`  ${chalk.cyan('📄 Documents')}`);
    console.log(`     ${cats.DOCUMENT} ${cats.DOCUMENT === 1 ? 'file' : 'files'}`);
    console.log(`     Recommendation: ${chalk.white.bold('REVIEW where appropriate')}`);
    console.log('');
  }
}

function printGrumpyNoticed(files: FileMetadata[], duplicateGroups: DuplicateGroup[]): void {
  // Pick a few notable items across diverse categories: Installers, Datasets, Duplicates, Large
  const notable: FileMetadata[] = [];
  const seen = new Set<string>();

  // 1. Pick a dataset if present
  const dataset = files.find((f) => f.intelligence?.classification.type === 'DATASET');
  if (dataset) { notable.push(dataset); seen.add(dataset.path); }

  // 2. Pick an installer if present
  const installer = files.find((f) => f.intelligence?.classification.type === 'INSTALLER' && !seen.has(f.path));
  if (installer) { notable.push(installer); seen.add(installer.path); }

  // 3. Pick a duplicate if present
  if (duplicateGroups.length > 0 && duplicateGroups[0].files.length >= 2) {
    const dup = duplicateGroups[0].files[1]; // Pick duplicate extra copy
    if (dup && !seen.has(dup.path)) { notable.push(dup); seen.add(dup.path); }
  }

  // 4. Pick a large or interesting file if needed to have 2-4 examples
  for (const f of files) {
    if (notable.length >= 4) break;
    if (!seen.has(f.path) && (f.sizeLabel === 'Very Large' || f.sizeLabel === 'Large')) {
      notable.push(f);
      seen.add(f.path);
    }
  }

  if (notable.length === 0) return;

  console.log(DIVIDER);
  console.log(chalk.bold('🦆  GrumpyDuck noticed:'));
  console.log('');

  for (const f of notable) {
    const intel = f.intelligence;
    const typeStr = intel ? formatCategoryName(intel.classification.type) : f.category;
    const icon = getCategoryIcon(intel?.classification.type ?? 'UNKNOWN');
    const confStr = intel ? `Confidence: ${intel.confidenceLevel}` : '';
    const action = intel?.recommendation.action ?? 'REVIEW';
    const actionColor = getActionColor(action);

    console.log(`  ${icon} ${chalk.bold(f.name)}`);
    console.log(`     ${chalk.cyan(typeStr)} • ${formatBytes(f.size)} ${confStr ? `• ${chalk.dim(confStr)}` : ''}`);
    console.log(`     → ${actionColor(formatActionName(action))}`);
    if (intel?.recommendation.reasons && intel.recommendation.reasons.length > 0) {
      for (const r of intel.recommendation.reasons.slice(0, 2)) {
        console.log(`       ${chalk.dim('• ' + r)}`);
      }
    }
    console.log('');
  }
}

function formatCategoryName(cat: string): string {
  switch (cat) {
    case 'DATASET': return 'Dataset';
    case 'INSTALLER': return 'Installer';
    case 'DOCUMENT': return 'Document';
    case 'DEVELOPMENT_ARTIFACT': return 'Development Artifact';
    case 'APPLICATION': return 'Application';
    case 'IMAGE': return 'Image';
    case 'VIDEO': return 'Video';
    case 'AUDIO': return 'Audio';
    case 'ARCHIVE': return 'Archive';
    case 'CODE': return 'Code';
    case 'TEMPORARY_FILE': return 'Temporary File';
    default: return 'File';
  }
}

function getCategoryIcon(cat: string): string {
  switch (cat) {
    case 'DATASET': return '📊';
    case 'INSTALLER': return '💿';
    case 'DOCUMENT': return '📄';
    case 'DEVELOPMENT_ARTIFACT': return '🧩';
    case 'APPLICATION': return '📱';
    case 'IMAGE': return '🖼️ ';
    case 'VIDEO': return '🎬';
    case 'AUDIO': return '🎵';
    case 'ARCHIVE': return '📦';
    case 'CODE': return '💻';
    case 'TEMPORARY_FILE': return '🗑️ ';
    default: return '📄';
  }
}

function getActionColor(action: string): (text: string) => string {
  switch (action) {
    case 'KEEP': return chalk.green.bold;
    case 'POTENTIAL_CLEANUP': return chalk.magenta.bold;
    case 'IGNORE': return chalk.dim.bold;
    case 'REVIEW':
    default: return chalk.yellow.bold;
  }
}

function formatActionName(action: string): string {
  switch (action) {
    case 'KEEP': return 'Keep';
    case 'POTENTIAL_CLEANUP': return 'Potential cleanup';
    case 'IGNORE': return 'Ignore';
    case 'REVIEW':
    default: return 'Review';
  }
}

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

function printOldFiles(oldFiles: FileMetadata[], summary: ScanSummary): void {
  console.log('');
  console.log(chalk.bold('🕰️   Old Files'));
  if (oldFiles.length === 0) {
    console.log(chalk.dim('  None detected above age threshold.'));
    return;
  }

  console.log(chalk.dim(`  ${oldFiles.length} old files detected`));
  console.log('');

  const intelSummary = summary.intelligenceSummary?.oldFilesByIntelligence;
  if (intelSummary && (intelSummary.useful.count > 0 || intelSummary.review.count > 0 || intelSummary.development.count > 0)) {
    if (intelSummary.useful.count > 0) {
      console.log(`  ${chalk.green('Potentially useful:')}`);
      if (intelSummary.useful.documents > 0) console.log(`    ${intelSummary.useful.documents} documents`);
      if (intelSummary.useful.datasets > 0) console.log(`    ${intelSummary.useful.datasets} datasets`);
      if (intelSummary.useful.archives > 0) console.log(`    ${intelSummary.useful.archives} archives`);
    }

    if (intelSummary.review.count > 0) {
      console.log(`  ${chalk.yellow('Worth reviewing:')}`);
      if (intelSummary.review.installers > 0) console.log(`    ${intelSummary.review.installers} installers`);
      if (intelSummary.review.duplicates > 0) console.log(`    ${intelSummary.review.duplicates} duplicate files`);
      if (intelSummary.review.others > 0) console.log(`    ${intelSummary.review.others} other files`);
    }

    if (intelSummary.development.count > 0) {
      console.log(`  ${chalk.dim('Development/generated:')}`);
      console.log(`    ${intelSummary.development.count} files`);
    }

    if (intelSummary.ignored.count > 0) {
      console.log(`  ${chalk.dim('Ignored:')}`);
      console.log(`    ${intelSummary.ignored.count} files`);
    }
    console.log('');
  }

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
