"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scan = scan;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fileMetadata_1 = require("./fileMetadata");
const rules_1 = require("./rules");
const duplicates_1 = require("./duplicates");
const categories_1 = require("./categories");
/**
 * Scan a directory recursively, collecting file metadata and running all
 * analysis rules.
 *
 * SAFETY: This function is strictly read-only. It calls fs.readdir and
 * fs.stat — no write operations are ever performed.
 *
 * @param rootDir  Absolute path to the directory to scan.
 * @param config   Scan configuration (thresholds, symlink behaviour, etc.).
 * @returns        Complete ScanResult ready for any reporter.
 */
async function scan(rootDir, config) {
    const startedAt = new Date().toISOString();
    // Resolve the root path so that ~ and relative paths are expanded.
    const resolvedRoot = path.resolve(rootDir);
    const state = {
        files: [],
        applications: [],
        allDirectories: [],
        errors: [],
        physicalFilesCount: 0,
        physicalDirectoriesCount: 0,
    };
    // Recursive directory walk — depth-first via an explicit stack.
    await walkDirectory(resolvedRoot, config, state);
    const { files, applications, allDirectories, errors } = state;
    // ── Empty directory detection ─────────────────────────────────────────────
    // A user directory is empty if no scanned logical item has it as an ancestor
    // and it has no sub-directories that were visited either.
    const nonEmptyDirs = new Set();
    for (const item of files) {
        let dir = item.parent;
        while (dir.startsWith(resolvedRoot)) {
            nonEmptyDirs.add(dir);
            const parent = path.dirname(dir);
            if (parent === dir)
                break; // reached filesystem root
            dir = parent;
        }
    }
    const emptyDirectories = [];
    for (const dir of allDirectories) {
        if (!nonEmptyDirs.has(dir)) {
            emptyDirectories.push(dir);
        }
    }
    // ── Duplicate detection ────────────────────────────────────────────────────
    const { groups: duplicateGroups, hashErrors } = await (0, duplicates_1.detectDuplicates)(files);
    // Promote hashing errors to the top-level errors array.
    for (const he of hashErrors) {
        errors.push({ path: he.path, message: `Hash error: ${he.message}`, code: he.code });
    }
    // ── Build summary ─────────────────────────────────────────────────────────
    const summary = buildSummary(files, duplicateGroups, emptyDirectories, allDirectories, state.physicalFilesCount, state.physicalDirectoriesCount);
    const completedAt = new Date().toISOString();
    return {
        schemaVersion: '1.0.0',
        startedAt,
        completedAt,
        scannedPath: resolvedRoot,
        config,
        files,
        applications,
        emptyDirectories,
        duplicateGroups,
        errors,
        summary,
    };
}
async function analyzeBundle(bundlePath, config, errors) {
    let totalSize = 0;
    let physicalFiles = 0;
    let physicalDirs = 0;
    const stack = [bundlePath];
    while (stack.length > 0) {
        const current = stack.pop();
        let entries;
        try {
            entries = await fs.promises.readdir(current, { withFileTypes: true });
        }
        catch (err) {
            const error = err;
            errors.push({
                path: current,
                message: `Cannot read bundle contents: ${error.message}`,
                code: error.code,
            });
            continue;
        }
        for (const entry of entries) {
            const itemPath = path.join(current, entry.name);
            try {
                const lstat = await fs.promises.lstat(itemPath);
                if (lstat.isSymbolicLink()) {
                    if (config.followSymlinks) {
                        try {
                            const stat = await fs.promises.stat(itemPath);
                            if (stat.isFile()) {
                                physicalFiles++;
                                totalSize += stat.size;
                            }
                        }
                        catch {
                            // ignore broken symlink in bundle
                        }
                    }
                    continue;
                }
                if (lstat.isDirectory()) {
                    physicalDirs++;
                    stack.push(itemPath);
                }
                else if (lstat.isFile()) {
                    physicalFiles++;
                    totalSize += lstat.size;
                }
            }
            catch (err) {
                const error = err;
                errors.push({
                    path: itemPath,
                    message: error.message,
                    code: error.code,
                });
            }
        }
    }
    return { totalSize, physicalFiles, physicalDirs };
}
// ─────────────────────────────────────────────────────────────────────────────
// Recursive walk (depth-first, non-recursive implementation to avoid stack overflow)
// ─────────────────────────────────────────────────────────────────────────────
async function walkDirectory(dir, config, state) {
    // If the root directory being scanned itself is a bundle (e.g. VSCode.app directly):
    const rootBasename = path.basename(dir);
    if ((0, categories_1.isBundleDirectory)(rootBasename, config.bundleExtensions)) {
        let lstat;
        try {
            lstat = await fs.promises.lstat(dir);
        }
        catch (err) {
            const error = err;
            state.errors.push({ path: dir, message: error.message, code: error.code });
            return;
        }
        const bundleStats = await analyzeBundle(dir, config, state.errors);
        state.physicalFilesCount += bundleStats.physicalFiles;
        state.physicalDirectoriesCount += bundleStats.physicalDirs + 1;
        const dotIndex = rootBasename.lastIndexOf('.');
        const ext = dotIndex > 0 ? rootBasename.slice(dotIndex + 1).toLowerCase() : '';
        const appMeta = {
            name: rootBasename,
            path: dir,
            extension: ext,
            size: bundleStats.totalSize,
            createdAt: lstat.birthtimeMs,
            modifiedAt: lstat.mtimeMs,
            accessedAt: lstat.atimeMs,
            category: 'Applications',
            isHidden: rootBasename.startsWith('.'),
            parent: path.dirname(dir),
            sizeLabel: (0, rules_1.isLargeFile)(bundleStats.totalSize, config),
            ageLabel: null,
            hash: null,
        };
        state.applications.push(appMeta);
        state.files.push(appMeta);
        return;
    }
    const stack = [dir];
    while (stack.length > 0) {
        const currentDir = stack.pop();
        let entries;
        try {
            entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        }
        catch (err) {
            const error = err;
            state.errors.push({
                path: currentDir,
                message: `Cannot read directory: ${error.message}`,
                code: error.code,
            });
            continue;
        }
        for (const entry of entries) {
            const entryPath = path.join(currentDir, entry.name);
            try {
                const lstatResult = await fs.promises.lstat(entryPath);
                if (lstatResult.isSymbolicLink()) {
                    if (config.followSymlinks) {
                        try {
                            const statResult = await fs.promises.stat(entryPath);
                            if (statResult.isFile()) {
                                const meta = (0, fileMetadata_1.collectFileMetadata)(entryPath, statResult);
                                applyRules(meta, config);
                                state.files.push(meta);
                                state.physicalFilesCount++;
                            }
                        }
                        catch {
                            state.errors.push({
                                path: entryPath,
                                message: 'Broken symbolic link (target not accessible)',
                                code: 'ENOENT',
                            });
                        }
                    }
                    continue;
                }
                if (lstatResult.isDirectory()) {
                    if (!config.includeHidden && entry.name.startsWith('.'))
                        continue;
                    // Check if this directory is a package/bundle (e.g. .app, .framework, .bundle)
                    if ((0, categories_1.isBundleDirectory)(entry.name, config.bundleExtensions)) {
                        const bundleStats = await analyzeBundle(entryPath, config, state.errors);
                        state.physicalFilesCount += bundleStats.physicalFiles;
                        state.physicalDirectoriesCount += bundleStats.physicalDirs + 1;
                        const dotIndex = entry.name.lastIndexOf('.');
                        const ext = dotIndex > 0 ? entry.name.slice(dotIndex + 1).toLowerCase() : '';
                        const appMeta = {
                            name: entry.name,
                            path: entryPath,
                            extension: ext,
                            size: bundleStats.totalSize,
                            createdAt: lstatResult.birthtimeMs,
                            modifiedAt: lstatResult.mtimeMs,
                            accessedAt: lstatResult.atimeMs,
                            category: 'Applications',
                            isHidden: entry.name.startsWith('.'),
                            parent: currentDir,
                            sizeLabel: (0, rules_1.isLargeFile)(bundleStats.totalSize, config),
                            ageLabel: null, // Application bundles & internals are never treated as old user files
                            hash: null,
                        };
                        state.applications.push(appMeta);
                        state.files.push(appMeta);
                        continue; // Do NOT traverse into bundle subdirectories
                    }
                    state.allDirectories.push(entryPath);
                    state.physicalDirectoriesCount++;
                    stack.push(entryPath);
                    continue;
                }
                if (lstatResult.isFile()) {
                    if (!config.includeHidden && entry.name.startsWith('.'))
                        continue;
                    const meta = (0, fileMetadata_1.collectFileMetadata)(entryPath, lstatResult);
                    applyRules(meta, config);
                    state.files.push(meta);
                    state.physicalFilesCount++;
                }
            }
            catch (err) {
                const error = err;
                state.errors.push({
                    path: entryPath,
                    message: error.message,
                    code: error.code,
                });
            }
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Rule application
// ─────────────────────────────────────────────────────────────────────────────
/** Apply size and age rules to a FileMetadata object in-place. */
function applyRules(meta, config) {
    meta.sizeLabel = (0, rules_1.isLargeFile)(meta.size, config);
    // Do NOT classify Applications or build/dependency artifacts as old user files
    if (meta.category !== 'Applications') {
        meta.ageLabel = (0, rules_1.isOldFile)(meta.modifiedAt, config, meta.path, meta.extension, meta.category);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Summary builder
// ─────────────────────────────────────────────────────────────────────────────
function buildSummary(files, duplicateGroups, emptyDirectories, allDirectories, physicalFilesScanned, physicalDirectoriesScanned) {
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    // Applications
    const applications = files.filter((f) => f.category === 'Applications');
    const applicationCount = applications.length;
    const applicationBytes = applications.reduce((sum, f) => sum + f.size, 0);
    // Large files
    const largeFiles = files.filter((f) => f.sizeLabel !== null);
    const largeFileBytes = largeFiles.reduce((sum, f) => sum + f.size, 0);
    // Old files
    const oldFiles = files.filter((f) => f.ageLabel !== null);
    const oldFileBytes = oldFiles.reduce((sum, f) => sum + f.size, 0);
    // Duplicates — wasted bytes = (copies - 1) * size for each group
    let duplicateWastedBytes = 0;
    for (const group of duplicateGroups) {
        duplicateWastedBytes += group.size * (group.files.length - 1);
    }
    // Potential cleanup — deduplicated union of large files + old files + extra duplicate copies
    const cleanupPaths = new Set();
    for (const f of largeFiles)
        cleanupPaths.add(f.path);
    for (const f of oldFiles)
        cleanupPaths.add(f.path);
    for (const group of duplicateGroups) {
        const [, ...extras] = group.files;
        for (const f of extras)
            cleanupPaths.add(f.path);
    }
    const cleanupFileMap = new Map(files.map((f) => [f.path, f]));
    let potentialCleanupBytes = 0;
    for (const p of cleanupPaths) {
        const f = cleanupFileMap.get(p);
        if (f)
            potentialCleanupBytes += f.size;
    }
    // Per-category breakdown
    const categoryMap = new Map();
    for (const file of files) {
        const existing = categoryMap.get(file.category);
        if (existing) {
            existing.count += 1;
            existing.totalBytes += file.size;
        }
        else {
            categoryMap.set(file.category, {
                category: file.category,
                count: 1,
                totalBytes: file.size,
            });
        }
    }
    const categories = [...categoryMap.values()].sort((a, b) => b.totalBytes - a.totalBytes);
    return {
        totalFiles: files.length,
        logicalItemsScanned: files.length,
        physicalFilesScanned,
        physicalDirectoriesScanned,
        totalDirectories: allDirectories.length,
        totalBytes,
        applicationCount,
        applicationBytes,
        largeFileCount: largeFiles.length,
        largeFileBytes,
        oldFileCount: oldFiles.length,
        oldFileBytes,
        duplicateGroupCount: duplicateGroups.length,
        duplicateWastedBytes,
        emptyDirectoryCount: emptyDirectories.length,
        potentialCleanupBytes,
        categories,
    };
}
//# sourceMappingURL=scanner.js.map