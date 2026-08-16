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
      console.log(chalk.yellow.bold('🦆  GrumpyDuck is investigating…'));
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

// Show help if no command is provided
program.addHelpCommand(true);
program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
