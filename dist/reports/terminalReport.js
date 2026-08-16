"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printReport = printReport;
const chalk_1 = __importDefault(require("chalk"));
const formatBytes_1 = require("../utils/formatBytes");
const formatDate_1 = require("../utils/formatDate");
// ─────────────────────────────────────────────────────────────────────────────
// Terminal reporter
//
// Renders the scan result as a formatted, coloured terminal report.
// All chalk calls are centralised here so that the scanner engine remains
// completely decoupled from terminal concerns.
// ─────────────────────────────────────────────────────────────────────────────
const DIVIDER = chalk_1.default.dim('─'.repeat(52));
/** Grumpy duck remarks — contextual based on scan findings. */
function getGrumpyRemark(summary) {
    if (summary.duplicateGroupCount > 200) {
        return `I found ${(0, formatBytes_1.formatNumber)(summary.duplicateGroupCount)} duplicate groups. We should probably talk.`;
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
function printReport(result) {
    const { summary, files, duplicateGroups, emptyDirectories, errors } = result;
    // ── Header ─────────────────────────────────────────────────────────────────
    console.log('');
    console.log(chalk_1.default.yellow.bold('🦆  GrumpyDuck — Scan Complete'));
    console.log('');
    console.log(chalk_1.default.dim('Scanned: ') + chalk_1.default.cyan(result.scannedPath));
    console.log('');
    // ── Top-level stats ────────────────────────────────────────────────────────
    console.log(chalk_1.default.white('Logical items scanned: ') + chalk_1.default.bold((0, formatBytes_1.formatNumber)(summary.logicalItemsScanned)));
    if (summary.physicalFilesScanned > summary.logicalItemsScanned) {
        console.log(chalk_1.default.dim(`  (${(0, formatBytes_1.formatNumber)(summary.physicalFilesScanned)} physical files scanned across ${(0, formatBytes_1.formatNumber)(summary.physicalDirectoriesScanned)} directories)`));
    }
    console.log(chalk_1.default.white('Folders scanned:       ') + chalk_1.default.bold((0, formatBytes_1.formatNumber)(summary.totalDirectories)));
    console.log(chalk_1.default.white('Total storage:         ') + chalk_1.default.bold((0, formatBytes_1.formatBytes)(summary.totalBytes)));
    // ── Categories ────────────────────────────────────────────────────────────
    if (summary.categories.length > 0) {
        console.log('');
        console.log(DIVIDER);
        console.log(chalk_1.default.bold('📂  File Categories'));
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
        console.log(chalk_1.default.yellow('⚠️   Scan errors (skipped, not crashes)'));
        const shown = errors.slice(0, 10);
        for (const err of shown) {
            console.log(chalk_1.default.dim(`  [${err.code ?? 'ERR'}] ${err.path}`));
            console.log(chalk_1.default.dim(`        ${err.message}`));
        }
        if (errors.length > 10) {
            console.log(chalk_1.default.dim(`  … and ${errors.length - 10} more (see --json for full list)`));
        }
    }
    // ── Cleanup estimate ──────────────────────────────────────────────────────
    console.log('');
    console.log(DIVIDER);
    console.log(chalk_1.default.bold('🧹  Potential Cleanup'));
    console.log('');
    console.log(chalk_1.default.white('  Large files:      ') + chalk_1.default.bold((0, formatBytes_1.formatBytes)(summary.largeFileBytes)));
    console.log(chalk_1.default.white('  Old files:        ') + chalk_1.default.bold((0, formatBytes_1.formatBytes)(summary.oldFileBytes)));
    console.log(chalk_1.default.white('  Duplicate waste:  ') +
        chalk_1.default.bold((0, formatBytes_1.formatBytes)(summary.duplicateWastedBytes)));
    console.log('');
    const cleanupStr = (0, formatBytes_1.formatBytes)(summary.potentialCleanupBytes);
    console.log(chalk_1.default.cyan.bold(`  Potentially Recoverable: ${cleanupStr}`));
    console.log(chalk_1.default.dim('  (Estimate only. Files may be important and should be reviewed before deletion.)'));
    // ── Grumpy sign-off ────────────────────────────────────────────────────────
    console.log('');
    console.log(DIVIDER);
    console.log('');
    console.log(chalk_1.default.yellow('🦆  GrumpyDuck says:'));
    console.log(chalk_1.default.italic.dim(`   "${getGrumpyRemark(summary)}"`));
    console.log('');
    // ── Safety reminder ────────────────────────────────────────────────────────
    console.log(chalk_1.default.dim('⚠️  GrumpyDuck is read-only. Nothing was deleted, moved, or modified.'));
    console.log(chalk_1.default.dim('   All results are labelled "Potential cleanup candidate" — review before acting.'));
    console.log('');
}
// ─────────────────────────────────────────────────────────────────────────────
// Section printers
// ─────────────────────────────────────────────────────────────────────────────
function printCategories(categories) {
    const maxCount = Math.max(...categories.map((c) => c.count));
    const barWidth = 20;
    for (const cat of categories) {
        const bar = buildBar(cat.count, maxCount, barWidth);
        const countStr = (0, formatBytes_1.formatNumber)(cat.count).padStart(6);
        const sizeStr = (0, formatBytes_1.formatBytes)(cat.totalBytes).padStart(10);
        const unit = cat.category === 'Applications' ? (cat.count === 1 ? 'app ' : 'apps') : 'files';
        console.log(`  ${chalk_1.default.cyan(cat.category.padEnd(12))} ${chalk_1.default.dim(bar)} ${chalk_1.default.white(countStr)} ${unit.padEnd(5)} ${chalk_1.default.dim(sizeStr)}`);
    }
}
function buildBar(value, max, width) {
    const filled = max === 0 ? 0 : Math.round((value / max) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}
function printLargeFiles(largeFiles) {
    console.log('');
    console.log(chalk_1.default.bold('📦  Large Files'));
    if (largeFiles.length === 0) {
        console.log(chalk_1.default.dim('  None detected above threshold.'));
        return;
    }
    console.log(chalk_1.default.dim(`  ${largeFiles.length} files detected`));
    console.log('');
    // Show top 10; the rest are summarised.
    const sorted = [...largeFiles].sort((a, b) => b.size - a.size);
    const shown = sorted.slice(0, 10);
    for (const f of shown) {
        const label = f.sizeLabel ? chalk_1.default.red(`[${f.sizeLabel}]`) : '';
        console.log(`  ${label} ${chalk_1.default.bold(f.name)}`);
        console.log(`       ${chalk_1.default.cyan((0, formatBytes_1.formatBytes)(f.size))}  ${chalk_1.default.dim(f.path)}`);
    }
    if (sorted.length > 10) {
        console.log(chalk_1.default.dim(`  … and ${sorted.length - 10} more (use --json for full list)`));
    }
}
function printOldFiles(oldFiles) {
    console.log('');
    console.log(chalk_1.default.bold('🕰️   Potentially Old Files'));
    if (oldFiles.length === 0) {
        console.log(chalk_1.default.dim('  None detected above age threshold.'));
        return;
    }
    console.log(chalk_1.default.dim(`  ${oldFiles.length} files detected`));
    console.log(chalk_1.default.dim('  Note: Age alone does not mean a file is unwanted.'));
    console.log('');
    const sorted = [...oldFiles].sort((a, b) => a.modifiedAt - b.modifiedAt);
    const shown = sorted.slice(0, 10);
    for (const f of shown) {
        const label = f.ageLabel ? chalk_1.default.yellow(`[${f.ageLabel}]`) : '';
        const age = (0, formatDate_1.relativeAge)(f.modifiedAt);
        console.log(`  ${label} ${chalk_1.default.bold(f.name)}`);
        console.log(`       Last modified: ${chalk_1.default.dim(age)}  ${chalk_1.default.dim(f.path)}`);
    }
    if (sorted.length > 10) {
        console.log(chalk_1.default.dim(`  … and ${sorted.length - 10} more (use --json for full list)`));
    }
}
function printDuplicates(groups) {
    console.log('');
    console.log(chalk_1.default.bold('📋  Duplicate Files'));
    if (groups.length === 0) {
        console.log(chalk_1.default.dim('  No duplicates detected.'));
        return;
    }
    const totalExtraFiles = groups.reduce((sum, g) => sum + g.files.length - 1, 0);
    const wastedBytes = groups.reduce((sum, g) => sum + g.size * (g.files.length - 1), 0);
    console.log(chalk_1.default.dim(`  ${groups.length} duplicate groups (${totalExtraFiles} extra copies, ${(0, formatBytes_1.formatBytes)(wastedBytes)} wasted)`));
    console.log('');
    const shown = groups.slice(0, 5);
    for (const group of shown) {
        console.log(`  ${chalk_1.default.magenta('Duplicate Group')} — ${(0, formatBytes_1.formatBytes)(group.size)} each`);
        console.log(`  ${chalk_1.default.dim('Hash: ' + group.hash.slice(0, 16) + '…')}`);
        for (const f of group.files) {
            console.log(`    ${chalk_1.default.bold(f.name)}  ${chalk_1.default.dim(f.path)}`);
        }
        console.log('');
    }
    if (groups.length > 5) {
        console.log(chalk_1.default.dim(`  … and ${groups.length - 5} more groups (use --json for full list)`));
    }
}
function printEmptyFolders(dirs) {
    console.log('');
    console.log(chalk_1.default.bold('📁  Empty Folders'));
    if (dirs.length === 0) {
        console.log(chalk_1.default.dim('  None detected.'));
        return;
    }
    console.log(chalk_1.default.dim(`  ${dirs.length} empty folders detected`));
    console.log('');
    const shown = dirs.slice(0, 10);
    for (const d of shown) {
        console.log(`  ${chalk_1.default.dim(d)}`);
    }
    if (dirs.length > 10) {
        console.log(chalk_1.default.dim(`  … and ${dirs.length - 10} more (use --json for full list)`));
    }
}
//# sourceMappingURL=terminalReport.js.map