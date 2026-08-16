import * as path from 'path';
import { Stats } from 'fs';
import { FileMetadata } from '../types/scanner';
import { getCategory } from './categories';

/**
 * Build a FileMetadata object from a file path and its fs.Stats.
 *
 * This function is deliberately pure (no filesystem calls) so that it can
 * be called with mock stats in tests.
 *
 * @param filePath  Absolute path to the file.
 * @param stats     fs.Stats returned by fs.stat() — never lstat, so symlinks
 *                  are resolved to their targets. The caller controls whether
 *                  symlinks are followed.
 * @returns         Populated FileMetadata with analysis flags initialised to null.
 */
export function collectFileMetadata(filePath: string, stats: Stats): FileMetadata {
  const name = path.basename(filePath);
  const parent = path.dirname(filePath);

  // Extract extension: take everything after the last dot, excluding the dot
  // itself. Files like ".gitignore" have no real extension; treat them as
  // hidden files with an empty extension.
  const dotIndex = name.lastIndexOf('.');
  const extension =
    dotIndex > 0 // > 0 excludes dot-files like ".bashrc"
      ? name.slice(dotIndex + 1).toLowerCase()
      : '';

  // A file is hidden on Unix/macOS if its name starts with a dot.
  const isHidden = name.startsWith('.');

  return {
    name,
    path: filePath,
    extension,
    size: stats.size,
    // birthtime may be 0 on Linux ext4; that is fine — callers should treat 0 as unavailable.
    createdAt: stats.birthtimeMs,
    modifiedAt: stats.mtimeMs,
    accessedAt: stats.atimeMs,
    category: getCategory(extension),
    isHidden,
    parent,
    // Analysis flags are set later by rules.ts and duplicates.ts
    sizeLabel: null,
    ageLabel: null,
    hash: null,
  };
}
