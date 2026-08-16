#!/usr/bin/env node
"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck CLI entry point
//
// Defines the `scan` command and routes output to the appropriate reporter.
// The CLI is a thin wrapper around the scanner engine — all business logic
// lives in src/scanner/.
// ─────────────────────────────────────────────────────────────────────────────
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const ora_1 = __importDefault(require("ora"));
const chalk_1 = __importDefault(require("chalk"));
const scanner_1 = require("../scanner/scanner");
const rules_1 = require("../scanner/rules");
const terminalReport_1 = require("../reports/terminalReport");
const jsonReport_1 = require("../reports/jsonReport");
const program = new commander_1.Command();
program
    .name('grumpyduck')
    .description('🦆  GrumpyDuck — a read-only local file-organisation assistant')
    .version('1.0.0');
program
    .command('scan <directory>')
    .description('Scan a directory and generate a file-organisation report')
    .option('--json', 'Output raw JSON instead of the formatted terminal report', false)
    .option('--output <file>', 'Write JSON output to a file instead of stdout (implies --json)')
    .option('--large-threshold <mb>', 'Threshold in MB above which a file is considered "Medium large"', String(rules_1.DEFAULT_CONFIG.mediumBytes / (1024 * 1024)))
    .option('--old-threshold <days>', 'Files not modified in this many days are considered "Old"', String(rules_1.DEFAULT_CONFIG.oldDays))
    .option('--no-hidden', 'Exclude hidden files and directories (dot-files)', false)
    .option('--follow-symlinks', 'Follow symbolic links during traversal (off by default for safety)', false)
    .action(async (directory, options) => {
    // ── Resolve directory (support ~ expansion) ──────────────────────────────
    const resolvedDir = directory.startsWith('~')
        ? path.join(os.homedir(), directory.slice(1))
        : path.resolve(directory);
    // ── Build config from CLI options ────────────────────────────────────────
    const mediumMb = parseFloat(options.largeThreshold);
    const oldDays = parseInt(options.oldThreshold, 10);
    if (isNaN(mediumMb) || mediumMb <= 0) {
        console.error(chalk_1.default.red('Error: --large-threshold must be a positive number (MB)'));
        process.exit(1);
    }
    if (isNaN(oldDays) || oldDays <= 0) {
        console.error(chalk_1.default.red('Error: --old-threshold must be a positive integer (days)'));
        process.exit(1);
    }
    const config = {
        ...rules_1.DEFAULT_CONFIG,
        mediumBytes: mediumMb * 1024 * 1024,
        oldDays,
        includeHidden: !options.noHidden,
        followSymlinks: options.followSymlinks,
    };
    // ── Spinner ───────────────────────────────────────────────────────────────
    const useJSON = options.json || !!options.output;
    let spinner = null;
    if (!useJSON) {
        console.log('');
        console.log(chalk_1.default.yellow.bold('🦆  GrumpyDuck is investigating…'));
        console.log('');
        console.log(chalk_1.default.dim('Scanning: ') + chalk_1.default.cyan(resolvedDir));
        console.log('');
        spinner = (0, ora_1.default)({ text: 'Walking directory tree…', color: 'yellow' }).start();
    }
    // ── Run scan ──────────────────────────────────────────────────────────────
    let result;
    try {
        result = await (0, scanner_1.scan)(resolvedDir, config);
    }
    catch (err) {
        spinner?.fail();
        const error = err;
        console.error(chalk_1.default.red(`\nFailed to scan: ${error.message}`));
        if (error.code === 'ENOENT') {
            console.error(chalk_1.default.dim('The directory does not exist.'));
        }
        else if (error.code === 'EACCES') {
            console.error(chalk_1.default.dim('Permission denied — try running with elevated permissions.'));
        }
        process.exit(1);
    }
    spinner?.succeed(chalk_1.default.green('Scan complete'));
    // ── Output ────────────────────────────────────────────────────────────────
    if (useJSON) {
        await (0, jsonReport_1.writeJSONReport)(result, options.output);
    }
    else {
        (0, terminalReport_1.printReport)(result);
    }
});
// Show help if no command is provided
program.addHelpCommand(true);
program.parse(process.argv);
if (process.argv.length < 3) {
    program.help();
}
//# sourceMappingURL=index.js.map