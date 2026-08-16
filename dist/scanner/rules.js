"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NON_USER_EXTENSIONS = exports.BUILD_AND_DEPENDENCY_DIR_NAMES = exports.DEFAULT_CONFIG = void 0;
exports.isLargeFile = isLargeFile;
exports.isBuildOrDependencyPath = isBuildOrDependencyPath;
exports.isUserFacingFile = isUserFacingFile;
exports.isOldFile = isOldFile;
// ─────────────────────────────────────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────────────────────────────────────
const categories_1 = require("./categories");
/** Default thresholds used when the user does not supply custom values via CLI. */
exports.DEFAULT_CONFIG = {
    veryLargeBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    largeBytes: 500 * 1024 * 1024, // 500 MB
    mediumBytes: 100 * 1024 * 1024, // 100 MB
    veryOldDays: 365,
    oldDays: 180,
    followSymlinks: false, // Safe default — never follow symlinks during traversal
    includeHidden: true,
    bundleExtensions: categories_1.DEFAULT_BUNDLE_EXTENSIONS,
};
// ─────────────────────────────────────────────────────────────────────────────
// Size rules
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Determine whether a file's size exceeds a configured threshold.
 *
 * Thresholds are evaluated from largest to smallest so that a 2 GB file
 * is reported as 'Very Large' and not 'Large'.
 *
 * @returns A SizeLabel if the file is large, or null if it is within normal limits.
 */
function isLargeFile(sizeBytes, config) {
    if (sizeBytes > config.veryLargeBytes)
        return 'Very Large';
    if (sizeBytes > config.largeBytes)
        return 'Large';
    if (sizeBytes > config.mediumBytes)
        return 'Medium';
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Age rules & Context awareness
// ─────────────────────────────────────────────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Directory names that contain build output, dependencies, or system artifacts. */
exports.BUILD_AND_DEPENDENCY_DIR_NAMES = new Set([
    'node_modules',
    'publish',
    'bin',
    'obj',
    'dist',
    'build',
    'target',
    'vendor',
    'runtimes',
    '.git',
    '.vs',
    '.idea',
    '__pycache__',
    '.gradle',
    '.deps',
    '.cache',
    '.next',
    '.nuxt',
    'out',
    'pods',
    'deriveddata',
    '.cargo',
]);
/** Extensions for system binaries, build outputs, or metadata that are not personal user files. */
exports.NON_USER_EXTENSIONS = new Set([
    'dll',
    'pdb',
    'dylib',
    'so',
    'a',
    'o',
    'obj',
    'class',
    'pyc',
    'pyo',
    'nupkg',
    'manifest',
    'd.ts',
    'map',
    'lock',
]);
/**
 * Returns true if the file path indicates it is located inside a build, dependency,
 * or project output directory (e.g. "publish/", "node_modules/", "bin/Debug/").
 */
function isBuildOrDependencyPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    for (const part of parts) {
        const lower = part.toLowerCase();
        // Match exact directory names or common build prefixes like "publish 2"
        if (exports.BUILD_AND_DEPENDENCY_DIR_NAMES.has(lower))
            return true;
        if (lower.startsWith('publish') || lower.startsWith('build'))
            return true;
    }
    return false;
}
/**
 * Returns true if the file is a personal user file candidate rather than a system binary or build artifact.
 */
function isUserFacingFile(extension, category) {
    const ext = extension.toLowerCase();
    if (exports.NON_USER_EXTENSIONS.has(ext))
        return false;
    return true;
}
/**
 * Determine whether a file is considered an old user file based on last modification time and context.
 *
 * IMPORTANT: An old file is NOT necessarily unwanted. Build outputs, dependencies,
 * and system binaries are excluded from user-facing old file analysis.
 *
 * @param modifiedAtMs  Last modification time in milliseconds since epoch.
 * @param config        Scan configuration containing age thresholds.
 * @param filePath      Optional file path for context evaluation (build/dependency paths).
 * @param extension     Optional file extension for context evaluation.
 * @param category      Optional file category for context evaluation.
 * @returns             An AgeLabel if the file is an old user file, or null otherwise.
 */
function isOldFile(modifiedAtMs, config, filePath, extension, category) {
    // Context check: exclude build/dependency paths and non-user binary extensions
    if (filePath && isBuildOrDependencyPath(filePath)) {
        return null;
    }
    if (extension !== undefined && category !== undefined && !isUserFacingFile(extension, category)) {
        return null;
    }
    const ageMs = Date.now() - modifiedAtMs;
    const ageDays = ageMs / MS_PER_DAY;
    if (ageDays >= config.veryOldDays)
        return 'Very Old';
    if (ageDays >= config.oldDays)
        return 'Old';
    return null;
}
//# sourceMappingURL=rules.js.map