// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Review Display & UI Formatting
// ─────────────────────────────────────────────────────────────────────────────

import chalk from 'chalk';
import { ReviewItem, ReviewSessionState } from '../types/review';
import { formatBytes, formatNumber } from '../utils/formatBytes';
import { formatDate, relativeAge } from '../utils/formatDate';

export const REVIEW_DIVIDER = chalk.dim('─'.repeat(52));

/**
 * Renders the introductory summary screen when starting the review command.
 */
export function renderReviewIntro(
  scanPath: string,
  items: ReviewItem[],
  potentialDuplicateBytes: number,
): void {
  const duplicates = items.filter((i) => i.priority === 'DUPLICATE_EXTRA').length;
  const installers = items.filter((i) => i.priority === 'INSTALLER').length;
  const largeFiles = items.filter((i) => i.priority === 'LARGE_FILE').length;
  const others = items.filter((i) => i.priority === 'OTHER_REVIEW').length;

  console.log('');
  console.log(chalk.yellow.bold('🦆  GrumpyDuck — Cleanup Review'));
  console.log('');
  console.log(chalk.dim('Scanning: ') + chalk.cyan(scanPath));
  console.log('');
  console.log(chalk.bold('Found:'));
  console.log('');
  console.log(`  ${chalk.cyan('📋 Duplicate candidates:')}    ${chalk.bold(formatNumber(duplicates))}`);
  console.log(`  ${chalk.cyan('💿 Installer candidates:')}    ${chalk.bold(formatNumber(installers))}`);
  console.log(`  ${chalk.cyan('📦 Large files to review:')}   ${chalk.bold(formatNumber(largeFiles))}`);
  if (others > 0) {
    console.log(`  ${chalk.cyan('🕰️  Other review candidates:')} ${chalk.bold(formatNumber(others))}`);
  }
  console.log('');
  console.log(
    chalk.white('Potential duplicate space: ') +
    chalk.green.bold(formatBytes(potentialDuplicateBytes)),
  );
  console.log('');
  console.log(chalk.dim('⚠️  No files will be modified during this review.'));
  console.log('');
}

/**
 * Returns a conversational Grumpy remark tailored to the candidate item.
 */
function getGrumpyCandidateRemark(item: ReviewItem): string {
  if (item.isDuplicateExtra) {
    return 'I found an extra copy. You probably only need one of these.';
  }
  if (item.priority === 'INSTALLER') {
    return 'This looks like an installer. If you already installed it, it might just be taking up space.';
  }
  if (item.priority === 'LARGE_FILE') {
    return 'This one is pretty heavy. Take a look.';
  }
  return 'I found something worth your attention.';
}

/**
 * Formats user-friendly category name with icon.
 */
function formatCategoryWithIcon(cat: string): string {
  switch (cat) {
    case 'DATASET': return '📊 Dataset';
    case 'INSTALLER': return '💿 Installer';
    case 'DOCUMENT': return '📄 Document';
    case 'DEVELOPMENT_ARTIFACT': return '🧩 Development Artifact';
    case 'APPLICATION': return '📱 Application';
    case 'IMAGE': return '🖼️  Image';
    case 'VIDEO': return '🎬 Video';
    case 'AUDIO': return '🎵 Audio';
    case 'ARCHIVE': return '📦 Archive';
    case 'CODE': return '💻 Code';
    case 'TEMPORARY_FILE': return '🗑️  Temporary File';
    default: return '📄 File';
  }
}

/**
 * Formats recommendation action with appropriate coloring.
 */
function formatAction(action: string): string {
  switch (action) {
    case 'KEEP': return chalk.green.bold('KEEP');
    case 'POTENTIAL_CLEANUP': return chalk.magenta.bold('POTENTIAL CLEANUP');
    case 'IGNORE': return chalk.dim.bold('IGNORE');
    case 'REVIEW':
    default: return chalk.yellow.bold('REVIEW');
  }
}

/**
 * Renders an individual candidate review card.
 */
export function renderCandidateCard(item: ReviewItem, state: ReviewSessionState): void {
  const f = item.file;
  const intel = f.intelligence;
  const typeStr = intel ? formatCategoryWithIcon(intel.classification.type) : f.category;
  const currentNum = state.currentIndex + 1;
  const totalNum = state.totalCandidates;

  console.log(REVIEW_DIVIDER);
  console.log('');
  console.log(chalk.yellow.bold(`🦆  GrumpyDuck: `) + chalk.italic(`"${getGrumpyCandidateRemark(item)}"`) + chalk.dim(`  [${currentNum}/${totalNum}]`));
  console.log('');
  console.log(`  ${chalk.bold.white(f.name)}`);
  console.log('');
  console.log(`  ${chalk.dim('Type:')}        ${typeStr}`);
  console.log(`  ${chalk.dim('Size:')}        ${chalk.cyan(formatBytes(f.size))}`);
  console.log(`  ${chalk.dim('Location:')}    ${chalk.dim(f.path)}`);

  if (item.isDuplicateExtra && item.duplicateGroup) {
    const groupCount = item.duplicateGroup.files.length;
    console.log(`  ${chalk.dim('Status:')}      ${chalk.magenta('DUPLICATE')} (${groupCount} identical copies exist)`);
  } else if (f.ageLabel) {
    console.log(`  ${chalk.dim('Age:')}         ${chalk.yellow(relativeAge(f.modifiedAt))}`);
  }

  const action = intel?.recommendation.action ?? 'REVIEW';
  console.log(`  ${chalk.dim('Suggestion:')}  ${formatAction(action)}`);

  if (intel?.recommendation.reasons && intel.recommendation.reasons.length > 0) {
    console.log(`  ${chalk.dim('Why:')}`);
    for (const r of intel.recommendation.reasons) {
      console.log(`    ${chalk.dim('• ' + r)}`);
    }
  }

  console.log('');
  console.log(chalk.bold('What should I do?'));
  console.log(
    `  ${chalk.green.bold('[K]')} Keep   ` +
    `  ${chalk.magenta.bold('[C]')} Mark for cleanup   ` +
    `  ${chalk.white.bold('[S]')} Skip   ` +
    `  ${chalk.cyan.bold('[D]')} Details   ` +
    `  ${chalk.dim('[Q]')} Quit`,
  );
  console.log('');
}

/**
 * Renders complete file details when the user selects [D].
 */
export function renderCandidateDetails(item: ReviewItem): void {
  const f = item.file;
  const intel = f.intelligence;

  console.log(REVIEW_DIVIDER);
  console.log('');
  console.log(chalk.cyan.bold('📄  File Details'));
  console.log('');
  console.log(`  ${chalk.white('Name:')}           ${chalk.bold(f.name)}`);
  console.log(`  ${chalk.white('Path:')}           ${chalk.dim(f.path)}`);
  console.log(`  ${chalk.white('Type:')}           ${intel ? intel.classification.type : f.category}`);
  console.log(`  ${chalk.white('Size:')}           ${formatBytes(f.size)} (${f.size.toLocaleString()} bytes)`);
  console.log(`  ${chalk.white('Created:')}        ${formatDate(f.createdAt)}`);
  console.log(`  ${chalk.white('Modified:')}       ${formatDate(f.modifiedAt)} (${relativeAge(f.modifiedAt)})`);

  if (intel) {
    console.log(`  ${chalk.white('Classification:')} ${intel.classification.type}`);
    console.log(`  ${chalk.white('Confidence:')}     ${intel.confidenceLevel} (${intel.classification.confidence})`);

    if (intel.observations.length > 0) {
      console.log(`  ${chalk.white('Observations:')}`);
      for (const obs of intel.observations) {
        console.log(`    • ${obs}`);
      }
    }

    console.log(`  ${chalk.white('Recommendation:')} ${intel.recommendation.action}`);
    console.log(`  ${chalk.white('Reason:')}         ${intel.recommendation.reason}`);
  }

  if (item.duplicateGroup && item.duplicateGroup.files.length > 0) {
    console.log('');
    console.log(`  ${chalk.white('Duplicate Group:')} ${item.duplicateGroup.files.length} identical copies`);
    console.log(`  ${chalk.dim('SHA-256: ' + item.duplicateGroup.hash)}`);
    console.log('');
    console.log(chalk.bold('  Identical copies:'));
    item.duplicateGroup.files.forEach((file, index) => {
      const isCurrent = file.path === f.path;
      const marker = isCurrent ? chalk.cyan.bold(' (this file)') : '';
      console.log(`    ${index + 1}. ${chalk.dim(file.path)}${marker}`);
    });
  }

  console.log('');
  console.log(chalk.dim('⚠️  No files have been modified.'));
  console.log('');
  console.log(chalk.yellow('Press any key or Enter to return to review...'));
}

/**
 * Renders the final review summary when review concludes or user quits.
 */
export function renderFinalSummary(
  state: ReviewSessionState,
  exportPath?: string,
): void {
  console.log(REVIEW_DIVIDER);
  console.log('');
  console.log(chalk.yellow.bold('🦆  GrumpyDuck — Review Complete'));
  console.log('');
  console.log(`  ${chalk.white('Files reviewed:')}      ${chalk.bold(state.reviewedCount)} / ${state.totalCandidates}`);
  console.log(`  ${chalk.green('KEEP:')}                ${chalk.bold(state.keptCount)}`);
  console.log(`  ${chalk.magenta('Marked for cleanup:')}  ${chalk.bold(state.cleanupCount)}`);
  console.log(`  ${chalk.white('Skipped:')}             ${chalk.bold(state.skippedCount)}`);
  console.log('');
  console.log(REVIEW_DIVIDER);
  console.log('');
  console.log(
    chalk.white('Potential space from selected files: ') +
    chalk.green.bold(formatBytes(state.potentialCleanupBytes)),
  );
  console.log('');
  console.log(chalk.dim('⚠️  Nothing was deleted.'));
  console.log(chalk.dim('   Your cleanup selections are only a plan. No files have been modified.'));

  if (exportPath) {
    console.log('');
    console.log(chalk.cyan(`📄 Cleanup plan exported to: ${exportPath}`));
  }

  console.log('');
}
