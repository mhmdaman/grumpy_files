// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Shared TypeScript types
//
// This file defines all core interfaces used throughout the scanner engine,
// reporters, and CLI. It is intentionally stable: changing these interfaces
// is a breaking change for any Tauri UI that consumes the JSON output.
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// File Categories
// ---------------------------------------------------------------------------

/** High-level category assigned to a file based on its extension or bundle status. */
export type FileCategory =
  | 'Images'
  | 'Videos'
  | 'Audio'
  | 'Documents'
  | 'Archives'
  | 'Installers'
  | 'Applications'
  | 'Code'
  | 'Other';

// ---------------------------------------------------------------------------
// Size / Age Labels
// ---------------------------------------------------------------------------

/** Human-readable size bucket assigned to large files. */
export type SizeLabel = 'Very Large' | 'Large' | 'Medium';

/** Human-readable age bucket assigned to old files. */
export type AgeLabel = 'Very Old' | 'Old';

// ---------------------------------------------------------------------------
// Per-file metadata
// ---------------------------------------------------------------------------

/**
 * All metadata collected for a single file during a scan.
 * This is the core unit of data that flows through the entire system.
 */
export interface FileMetadata {
  /** Base filename including extension. */
  name: string;

  /** Absolute path to the file. */
  path: string;

  /** File extension, lower-cased, without the leading dot. Empty string for no extension. */
  extension: string;

  /** File size in bytes. */
  size: number;

  /**
   * Creation time (birthtime) in milliseconds since epoch.
   * May be 0 on systems that don't support it (e.g. Linux ext4).
   */
  createdAt: number;

  /** Last modification time in milliseconds since epoch. */
  modifiedAt: number;

  /**
   * Last access time in milliseconds since epoch.
   * May be unreliable if noatime is set on the filesystem.
   */
  accessedAt: number;

  /** Inferred file category based on extension. */
  category: FileCategory;

  /** True when the filename starts with a dot. */
  isHidden: boolean;

  /** Absolute path of the immediate parent directory. */
  parent: string;

  // ── Analysis flags ────────────────────────────────────────────────────────

  /**
   * Set when the file exceeds a size threshold.
   * 'null' means it is not large by any configured threshold.
   */
  sizeLabel: SizeLabel | null;

  /**
   * Set when the file has not been modified for a configured period.
   * 'null' means it is not considered old.
   */
  ageLabel: AgeLabel | null;

  /**
   * SHA-256 hex digest.
   * Only populated for files that are candidates for duplicate detection
   * (i.e. their size matches at least one other file).
   * 'null' if not computed.
   */
  hash: string | null;
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** A group of files that have identical content (same size + same hash). */
export interface DuplicateGroup {
  /** SHA-256 hex digest shared by all files in this group. */
  hash: string;

  /** Size in bytes shared by all files in this group. */
  size: number;

  /** All files with this hash. Length is always >= 2. */
  files: FileMetadata[];
}

// ---------------------------------------------------------------------------
// Scan configuration
// ---------------------------------------------------------------------------

/** Configurable thresholds and behaviour flags for a scan. */
export interface ScanConfig {
  /** Threshold in bytes above which a file is 'Very Large'. Default: 1 GB. */
  veryLargeBytes: number;

  /** Threshold in bytes above which a file is 'Large'. Default: 500 MB. */
  largeBytes: number;

  /** Threshold in bytes above which a file is 'Medium'. Default: 100 MB. */
  mediumBytes: number;

  /** Files not modified in this many days are labelled 'Very Old'. Default: 365. */
  veryOldDays: number;

  /** Files not modified in this many days are labelled 'Old'. Default: 180. */
  oldDays: number;

  /**
   * When true, symbolic links are stat'd but never followed into traversal.
   * This is always the safe default.
   */
  followSymlinks: boolean;

  /** When true, include hidden files (dot-files) in the scan. Default: true. */
  includeHidden: boolean;

  /** Package/bundle directory extensions to treat as single logical items. Default: ['app', 'bundle', 'framework', 'plugin', 'kext', 'xpc']. */
  bundleExtensions: string[];
}

// ---------------------------------------------------------------------------
// Scan errors
// ---------------------------------------------------------------------------

/** A non-fatal error encountered while scanning a single path. */
export interface ScanError {
  /** The file or directory path that caused the error. */
  path: string;

  /** Human-readable description of the error. */
  message: string;

  /** The Node.js error code if available (e.g. 'EACCES', 'ENOENT'). */
  code?: string;
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

/** Aggregated statistics for one file category. */
export interface CategoryStats {
  category: FileCategory;
  count: number;
  totalBytes: number;
}

// ---------------------------------------------------------------------------
// Scan summary
// ---------------------------------------------------------------------------

/**
 * High-level summary numbers derived from a completed scan.
 * Used for both terminal and JSON output.
 */
export interface ScanSummary {
  /** Total number of logical user items successfully scanned (files + application bundles). */
  totalFiles: number;

  /** Alias for totalFiles for logical item reporting. */
  logicalItemsScanned: number;

  /** Total physical files scanned on disk (including files inside application bundles). */
  physicalFilesScanned: number;

  /** Total physical directories encountered on disk (including inside bundles). */
  physicalDirectoriesScanned: number;

  /** Total number of user-facing directories encountered (excluding bundle internals). */
  totalDirectories: number;

  /** Combined size in bytes of all scanned items. */
  totalBytes: number;

  /** Total application bundles scanned. */
  applicationCount: number;

  /** Combined size in bytes of application bundles. */
  applicationBytes: number;

  /** Number of large files detected. */
  largeFileCount: number;

  /** Combined size in bytes of large files. */
  largeFileBytes: number;

  /** Number of old files detected. */
  oldFileCount: number;

  /** Combined size in bytes of old files. */
  oldFileBytes: number;

  /** Number of distinct duplicate groups found. */
  duplicateGroupCount: number;

  /** Total wasted bytes from duplicates (all copies minus one per group). */
  duplicateWastedBytes: number;

  /** Number of empty directories found. */
  emptyDirectoryCount: number;

  /**
   * Potential cleanup bytes.
   * = large + old + duplicate-wasted (deduplicated — a file counted in
   * multiple categories is only counted once here).
   */
  potentialCleanupBytes: number;

  /** Per-category breakdown. */
  categories: CategoryStats[];
}

// ---------------------------------------------------------------------------
// Full scan result
// ---------------------------------------------------------------------------

/**
 * The complete output of a scan operation.
 * This is the top-level type consumed by all reporters and eventually by
 * the Tauri desktop UI.
 */
export interface ScanResult {
  /**
   * JSON schema version. Increment when the shape of this interface changes
   * in a breaking way so that consumers can handle migrations.
   */
  schemaVersion: '1.0.0';

  /** ISO-8601 timestamp of when the scan started. */
  startedAt: string;

  /** ISO-8601 timestamp of when the scan completed. */
  completedAt: string;

  /** Resolved absolute path that was scanned. */
  scannedPath: string;

  /** Configuration used for this scan. */
  config: ScanConfig;

  /** All logical files that were successfully scanned. */
  files: FileMetadata[];

  /** All application bundles that were scanned as logical items. */
  applications: FileMetadata[];

  /** All directories found to be empty. */
  emptyDirectories: string[];

  /** All duplicate groups found. */
  duplicateGroups: DuplicateGroup[];

  /** Non-fatal errors encountered during the scan. */
  errors: ScanError[];

  /** Aggregated summary numbers. */
  summary: ScanSummary;
}
