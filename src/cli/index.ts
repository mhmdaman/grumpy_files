#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck CLI entry point
//
// Defines the `scan` command and routes output to the appropriate reporter.
// The CLI is a thin wrapper around the scanner engine — all business logic
// lives in src/scanner/.
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import ora from 'ora';
import chalk from 'chalk';
import { scan } from '../scanner/scanner';
import { DEFAULT_CONFIG } from '../scanner/rules';
import { ScanConfig } from '../types/scanner';
import { printReport } from '../reports/terminalReport';
import { writeJSONReport } from '../reports/jsonReport';
import { runInteractiveReview } from '../review/reviewer';
import { readCleanupPlan, getCleanupTargets } from '../cleanup/plan';
import { runCleanup } from '../cleanup/cleaner';
import { getHistory } from '../cleanup/history';
import { formatBytes } from '../utils/formatBytes';

const program = new Command();

program
  .name('grumpyduck')
  .description('🦆  GrumpyDuck — a read-only local file-organisation assistant')
  .version('1.0.0');

program
  .command('scan <directory>')
  .description('Scan a directory and generate a file-organisation report')
  .option(
    '--json',
    'Output raw JSON instead of the formatted terminal report',
    false,
  )
  .option(
    '--output <file>',
    'Write JSON output to a file instead of stdout (implies --json)',
  )
  .option(
    '--large-threshold <mb>',
    'Threshold in MB above which a file is considered "Medium large"',
    String(DEFAULT_CONFIG.mediumBytes / (1024 * 1024)),
  )
  .option(
    '--old-threshold <days>',
    'Files not modified in this many days are considered "Old"',
    String(DEFAULT_CONFIG.oldDays),
  )
  .option(
    '--no-hidden',
    'Exclude hidden files and directories (dot-files)',
    false,
  )
  .option(
    '--follow-symlinks',
    'Follow symbolic links during traversal (off by default for safety)',
    false,
  )
  .action(async (directory: string, options: {
    json: boolean;
    output?: string;
    largeThreshold: string;
    oldThreshold: string;
    noHidden: boolean;
    followSymlinks: boolean;
  }) => {
    // ── Resolve directory (support ~ expansion) ──────────────────────────────
    const resolvedDir = directory.startsWith('~')
      ? path.join(os.homedir(), directory.slice(1))
      : path.resolve(directory);

    // ── Build config from CLI options ────────────────────────────────────────
    const mediumMb = parseFloat(options.largeThreshold);
    const oldDays = parseInt(options.oldThreshold, 10);

    if (isNaN(mediumMb) || mediumMb <= 0) {
      console.error(chalk.red('Error: --large-threshold must be a positive number (MB)'));
      process.exit(1);
    }
    if (isNaN(oldDays) || oldDays <= 0) {
      console.error(chalk.red('Error: --old-threshold must be a positive integer (days)'));
      process.exit(1);
    }

    const config: ScanConfig = {
      ...DEFAULT_CONFIG,
      mediumBytes: mediumMb * 1024 * 1024,
      oldDays,
      includeHidden: !options.noHidden,
      followSymlinks: options.followSymlinks,
    };

    // ── Spinner ───────────────────────────────────────────────────────────────
    const useJSON = options.json || !!options.output;

    let spinner: ReturnType<typeof ora> | null = null;
    if (!useJSON) {
      console.log('');
      console.log(chalk.yellow.bold('🐥 GrumpyDuck is investigating…'));
      console.log('');
      console.log(chalk.dim('Scanning: ') + chalk.cyan(resolvedDir));
      console.log('');
      spinner = ora({ text: 'Walking directory tree…', color: 'yellow' }).start();
    }

    // ── Run scan ──────────────────────────────────────────────────────────────
    let result;
    try {
      result = await scan(resolvedDir, config);
    } catch (err: unknown) {
      spinner?.fail();
      const error = err as NodeJS.ErrnoException;
      console.error(chalk.red(`\nFailed to scan: ${error.message}`));
      if (error.code === 'ENOENT') {
        console.error(chalk.dim('The directory does not exist.'));
      } else if (error.code === 'EACCES') {
        console.error(chalk.dim('Permission denied — try running with elevated permissions.'));
      }
      process.exit(1);
    }

    spinner?.succeed(chalk.green('Scan complete'));

    // ── Output ────────────────────────────────────────────────────────────────
    if (useJSON) {
      await writeJSONReport(result, options.output);
    } else {
      printReport(result);
    }
  });

program
  .command('review <directory>')
  .description('Interactively review file recommendations and curate a cleanup plan')
  .option(
    '--export <file>',
    'Export the cleanup review decisions to a JSON plan file',
  )
  .option(
    '--large-threshold <mb>',
    'Threshold in MB above which a file is considered "Medium large"',
    String(DEFAULT_CONFIG.mediumBytes / (1024 * 1024)),
  )
  .option(
    '--old-threshold <days>',
    'Files not modified in this many days are considered "Old"',
    String(DEFAULT_CONFIG.oldDays),
  )
  .option(
    '--no-hidden',
    'Exclude hidden files and directories (dot-files)',
    false,
  )
  .option(
    '--follow-symlinks',
    'Follow symbolic links during traversal (off by default for safety)',
    false,
  )
  .action(async (directory: string, options: {
    export?: string;
    largeThreshold: string;
    oldThreshold: string;
    noHidden: boolean;
    followSymlinks: boolean;
  }) => {
    // ── Resolve directory (support ~ expansion) ──────────────────────────────
    const resolvedDir = directory.startsWith('~')
      ? path.join(os.homedir(), directory.slice(1))
      : path.resolve(directory);

    // ── Build config from CLI options ────────────────────────────────────────
    const mediumMb = parseFloat(options.largeThreshold);
    const oldDays = parseInt(options.oldThreshold, 10);

    if (isNaN(mediumMb) || mediumMb <= 0) {
      console.error(chalk.red('Error: --large-threshold must be a positive number (MB)'));
      process.exit(1);
    }
    if (isNaN(oldDays) || oldDays <= 0) {
      console.error(chalk.red('Error: --old-threshold must be a positive integer (days)'));
      process.exit(1);
    }

    const config: ScanConfig = {
      ...DEFAULT_CONFIG,
      mediumBytes: mediumMb * 1024 * 1024,
      oldDays,
      includeHidden: !options.noHidden,
      followSymlinks: options.followSymlinks,
    };

    // ── Spinner ───────────────────────────────────────────────────────────────
    console.log('');
    console.log(chalk.yellow.bold('🦆  GrumpyDuck is analyzing candidates for review…'));
    console.log('');
    console.log(chalk.dim('Target: ') + chalk.cyan(resolvedDir));
    console.log('');
    const spinner = ora({ text: 'Walking directory & running intelligence rules…', color: 'yellow' }).start();

    // ── Run scan & intelligence ───────────────────────────────────────────────
    let result;
    try {
      result = await scan(resolvedDir, config);
    } catch (err: unknown) {
      spinner.fail();
      const error = err as NodeJS.ErrnoException;
      console.error(chalk.red(`\nFailed to scan: ${error.message}`));
      if (error.code === 'ENOENT') {
        console.error(chalk.dim('The directory does not exist.'));
      } else if (error.code === 'EACCES') {
        console.error(chalk.dim('Permission denied — try running with elevated permissions.'));
      }
      process.exit(1);
    }

    spinner.succeed(chalk.green('Analysis complete'));

    // ── Interactive Review ────────────────────────────────────────────────────
    await runInteractiveReview(result, options.export);
  });

program
  .command('clean <directory>')
  .description('Safely move explicitly marked files from a cleanup plan to the macOS Trash')
  .requiredOption(
    '--plan <file>',
    'The cleanup plan JSON file generated by the review command',
  )
  .option(
    '--dry-run',
    'Preview the cleanup operation without modifying the filesystem',
    false,
  )
  .action(async (directory: string, options: { plan: string; dryRun: boolean }) => {
    const resolvedDir = directory.startsWith('~')
      ? path.join(os.homedir(), directory.slice(1))
      : path.resolve(directory);

    let plan;
    try {
      plan = await readCleanupPlan(options.plan);
    } catch (err: unknown) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }

    // Validate that the plan belongs to the requested directory
    if (plan.scanPath !== resolvedDir) {
      console.error(chalk.red(`Error: The cleanup plan was created for ${plan.scanPath}, not ${resolvedDir}`));
      process.exit(1);
    }

    const targets = getCleanupTargets(plan);
    if (targets.length === 0) {
      console.log('');
      console.log(chalk.yellow('🐥 GrumpyDuck:'));
      console.log('I don\'t have a cleanup plan yet, or nothing was marked for cleanup.');
      console.log('');
      console.log(`Run:\n  npm start -- review ${directory}\nand mark files for cleanup first.`);
      process.exit(0);
    }

    await runCleanup(plan, targets, options.dryRun);
  });

program
  .command('history')
  .description('View the history of cleanup operations')
  .action(async () => {
    const history = await getHistory();
    console.log('');
    console.log(chalk.yellow.bold('🐥 GrumpyDuck — Cleanup History'));
    console.log('');
    
    if (history.length === 0) {
      console.log(chalk.dim('No cleanup history found.'));
      return;
    }

    history.reverse().forEach((entry, idx) => {
      console.log(`${idx + 1}. ${chalk.cyan(new Date(entry.timestamp).toLocaleString())}`);
      console.log(`   ${entry.files.length} files`);
      console.log(`   ${formatBytes(entry.totalSize)}`);
      console.log(`   Moved to Trash`);
      console.log('');
    });
  });

program
  .command('undo')
  .description('Get instructions to recover the most recent cleanup operation')
  .action(async () => {
    const history = await getHistory();
    if (history.length === 0) {
      console.log('');
      console.log(chalk.yellow('🐥 GrumpyDuck:'));
      console.log('No cleanup history found to undo.');
      return;
    }

    const lastEntry = history[history.length - 1];
    
    console.log('');
    console.log(chalk.yellow.bold('🐥 GrumpyDuck — Undo Instructions'));
    console.log('');
    console.log('I do not permanently manipulate the macOS Trash programmatically to avoid data loss risks.');
    console.log('');
    console.log(`To restore the ${lastEntry.files.length} files from the last cleanup (${new Date(lastEntry.timestamp).toLocaleString()}):`);
    console.log('');
    console.log('1. Open the ' + chalk.cyan('Trash') + ' icon in your Dock.');
    console.log('2. Select the following files:');
    
    lastEntry.files.forEach((f) => {
      console.log(`   - ${chalk.dim(path.basename(f.path))}`);
    });

    console.log('');
    console.log('3. Right-click and choose ' + chalk.cyan('"Put Back"'));
    console.log('');
  });

// Show help if no command is provided
program.addHelpCommand(true);
program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}

