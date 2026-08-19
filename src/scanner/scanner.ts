import * as fs from 'fs';
import * as path from 'path';
import {
  ScanConfig,
  ScanResult,
  FileMetadata,
  ScanError,
  CategoryStats,
  ScanSummary,
  FileCategory,
  DuplicateGroup,
} from '../types/scanner';
import { collectFileMetadata } from './fileMetadata';
import { isLargeFile, isOldFile } from './rules';
import { detectDuplicates } from './duplicates';
import { isBundleDirectory } from './categories';
import { analyzeFiles, buildIntelligenceSummary } from '../intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// Main scanner
// ─────────────────────────────────────────────────────────────────────────────

interface WalkState {
  files: FileMetadata[];
  applications: FileMetadata[];
  allDirectories: string[];
  errors: ScanError[];
  physicalFilesCount: number;
  physicalDirectoriesCount: number;
}

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
export async function scan(rootDir: string, config: ScanConfig): Promise<ScanResult> {
  const startedAt = new Date().toISOString();

  // Resolve the root path so that ~ and relative paths are expanded.
  const resolvedRoot = path.resolve(rootDir);

  const state: WalkState = {
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
  const nonEmptyDirs = new Set<string>();

  for (const item of files) {
    let dir = item.parent;
    while (dir.startsWith(resolvedRoot)) {
      nonEmptyDirs.add(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break; // reached filesystem root
      dir = parent;
    }
  }

  const emptyDirectories: string[] = [];
  for (const dir of allDirectories) {
    if (!nonEmptyDirs.has(dir)) {
      emptyDirectories.push(dir);
    }
  }

  // ── Duplicate detection ────────────────────────────────────────────────────
  const { groups: duplicateGroups, hashErrors } = await detectDuplicates(files);

  // Promote hashing errors to the top-level errors array.
  for (const he of hashErrors) {
    errors.push({ path: he.path, message: `Hash error: ${he.message}`, code: he.code });
  }

  // ── File Intelligence Engine ───────────────────────────────────────────────
  analyzeFiles(files, duplicateGroups);

  // ── Build summary ─────────────────────────────────────────────────────────
  const summary = buildSummary(
    files,
    duplicateGroups,
    emptyDirectories,
    allDirectories,
    state.physicalFilesCount,
    state.physicalDirectoriesCount,
  );

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

// ─────────────────────────────────────────────────────────────────────────────
// Bundle analysis helper
// ─────────────────────────────────────────────────────────────────────────────

interface BundleAnalysis {
  totalSize: number;
  physicalFiles: number;
  physicalDirs: number;
}

async function analyzeBundle(
  bundlePath: string,
  config: ScanConfig,
  errors: ScanError[],
): Promise<BundleAnalysis> {
  let totalSize = 0;
  let physicalFiles = 0;
  let physicalDirs = 0;

  const stack: string[] = [bundlePath];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
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
            } catch {
              // ignore broken symlink in bundle
            }
          }
          continue;
        }

        if (lstat.isDirectory()) {
          physicalDirs++;
          stack.push(itemPath);
        } else if (lstat.isFile()) {
          physicalFiles++;
          totalSize += lstat.size;
        }
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
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

async function walkDirectory(
  dir: string,
  config: ScanConfig,
  state: WalkState,
): Promise<void> {
  // If the root directory being scanned itself is a bundle (e.g. VSCode.app directly):
  const rootBasename = path.basename(dir);
  if (isBundleDirectory(rootBasename, config.bundleExtensions)) {
    let lstat: fs.Stats;
    try {
      lstat = await fs.promises.lstat(dir);
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      state.errors.push({ path: dir, message: error.message, code: error.code });
      return;
    }
    const bundleStats = await analyzeBundle(dir, config, state.errors);
    state.physicalFilesCount += bundleStats.physicalFiles;
    state.physicalDirectoriesCount += bundleStats.physicalDirs + 1;

    const dotIndex = rootBasename.lastIndexOf('.');
    const ext = dotIndex > 0 ? rootBasename.slice(dotIndex + 1).toLowerCase() : '';

    const appMeta: FileMetadata = {
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
      sizeLabel: isLargeFile(bundleStats.totalSize, config),
      ageLabel: null,
      hash: null,
    };
    state.applications.push(appMeta);
    state.files.push(appMeta);
    return;
  }

  const stack: string[] = [dir];

  while (stack.length > 0) {
    const currentDir = stack.pop()!;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
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
                const meta = collectFileMetadata(entryPath, statResult);
                applyRules(meta, config);
                state.files.push(meta);
                state.physicalFilesCount++;
              }
            } catch {
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
          if (!config.includeHidden && entry.name.startsWith('.')) continue;

          // Check if this directory is a package/bundle (e.g. .app, .framework, .bundle)
          if (isBundleDirectory(entry.name, config.bundleExtensions)) {
            const bundleStats = await analyzeBundle(entryPath, config, state.errors);
            state.physicalFilesCount += bundleStats.physicalFiles;
            state.physicalDirectoriesCount += bundleStats.physicalDirs + 1;

            const dotIndex = entry.name.lastIndexOf('.');
            const ext = dotIndex > 0 ? entry.name.slice(dotIndex + 1).toLowerCase() : '';

            const appMeta: FileMetadata = {
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
              sizeLabel: isLargeFile(bundleStats.totalSize, config),
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
          if (!config.includeHidden && entry.name.startsWith('.')) continue;

          const meta = collectFileMetadata(entryPath, lstatResult);
          applyRules(meta, config);
          state.files.push(meta);
          state.physicalFilesCount++;
        }
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
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
function applyRules(meta: FileMetadata, config: ScanConfig): void {
  meta.sizeLabel = isLargeFile(meta.size, config);
  // Do NOT classify Applications or build/dependency artifacts as old user files
  if (meta.category !== 'Applications') {
    meta.ageLabel = isOldFile(meta.modifiedAt, config, meta.path, meta.extension, meta.category);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(
  files: FileMetadata[],
  duplicateGroups: DuplicateGroup[],
  emptyDirectories: string[],
  allDirectories: string[],
  physicalFilesScanned: number,
  physicalDirectoriesScanned: number,
): ScanSummary {
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
  const cleanupPaths = new Set<string>();
  for (const f of largeFiles) cleanupPaths.add(f.path);
  for (const f of oldFiles) cleanupPaths.add(f.path);
  for (const group of duplicateGroups) {
    const [, ...extras] = group.files;
    for (const f of extras) cleanupPaths.add(f.path);
  }

  const cleanupFileMap = new Map(files.map((f) => [f.path, f]));
  let potentialCleanupBytes = 0;
  for (const p of cleanupPaths) {
    const f = cleanupFileMap.get(p);
    if (f) potentialCleanupBytes += f.size;
  }

  // Smart potential cleanup — strictly calculated from items with POTENTIAL_CLEANUP recommendation
  let smartCleanupBytes = 0;
  for (const f of files) {
    if (f.intelligence?.recommendation.action === 'POTENTIAL_CLEANUP') {
      smartCleanupBytes += f.size;
    }
  }

  // Per-category breakdown
  const categoryMap = new Map<FileCategory, CategoryStats>();
  for (const file of files) {
    const existing = categoryMap.get(file.category);
    if (existing) {
      existing.count += 1;
      existing.totalBytes += file.size;
    } else {
      categoryMap.set(file.category, {
        category: file.category,
        count: 1,
        totalBytes: file.size,
      });
    }
  }

  const categories = [...categoryMap.values()].sort((a, b) => b.totalBytes - a.totalBytes);
  const intelligenceSummary = buildIntelligenceSummary(files, duplicateGroups);

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
    smartCleanupBytes,
    categories,
    intelligenceSummary,
  };
}

