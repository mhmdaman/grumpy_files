import { ScanConfig, SizeLabel, AgeLabel } from '../types/scanner';
/** Default thresholds used when the user does not supply custom values via CLI. */
export declare const DEFAULT_CONFIG: ScanConfig;
/**
 * Determine whether a file's size exceeds a configured threshold.
 *
 * Thresholds are evaluated from largest to smallest so that a 2 GB file
 * is reported as 'Very Large' and not 'Large'.
 *
 * @returns A SizeLabel if the file is large, or null if it is within normal limits.
 */
export declare function isLargeFile(sizeBytes: number, config: ScanConfig): SizeLabel | null;
/** Directory names that contain build output, dependencies, or system artifacts. */
export declare const BUILD_AND_DEPENDENCY_DIR_NAMES: Set<string>;
/** Extensions for system binaries, build outputs, or metadata that are not personal user files. */
export declare const NON_USER_EXTENSIONS: Set<string>;
/**
 * Returns true if the file path indicates it is located inside a build, dependency,
 * or project output directory (e.g. "publish/", "node_modules/", "bin/Debug/").
 */
export declare function isBuildOrDependencyPath(filePath: string): boolean;
/**
 * Returns true if the file is a personal user file candidate rather than a system binary or build artifact.
 */
export declare function isUserFacingFile(extension: string, category: string): boolean;
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
export declare function isOldFile(modifiedAtMs: number, config: ScanConfig, filePath?: string, extension?: string, category?: string): AgeLabel | null;
//# sourceMappingURL=rules.d.ts.map