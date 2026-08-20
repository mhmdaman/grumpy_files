import * as fs from 'fs';
import { ExportedPlanItem } from '../types/review';
import { isProtectedPath } from '../safety/protectedPaths';
import { hashFile } from '../utils/hash';
import { isBundleDirectory } from '../scanner/categories';
import * as path from 'path';

/**
 * Validates a single file against all safety constraints before cleanup.
 *
 * Checks:
 * 1. File exists.
 * 2. Path is not a protected system path.
 * 3. Not an application bundle (.app).
 * 4. File size hasn't changed.
 * 5. Hash matches (if one was collected during scan).
 *
 * @param item The review item from the cleanup plan.
 * @returns An error string if validation fails, or null if it passes.
 */
export async function validateCleanupTarget(item: ExportedPlanItem): Promise<string | null> {
  const filePath = item.path;

  // 1. Protected path check
  if (isProtectedPath(filePath)) {
    return 'Protected system path';
  }

  // 2. Application bundle check (Do not delete .app files in Phase 4)
  if (isBundleDirectory(path.basename(filePath))) {
    return 'Application bundles cannot be removed in this phase';
  }

  // 3. Existence and Stat check
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return 'File is missing or already removed';
    }
    return `Access error: ${error.message}`;
  }

  // 4. Directory check (We only clean files in Phase 4)
  // Even if it's an empty folder that was matched, we skip directories here
  if (stats.isDirectory()) {
    return 'Directories are not supported for cleanup in this phase';
  }

  // 5. Size check (has it changed since the scan?)
  if (stats.size !== item.size) {
    return 'File size changed since review (possible modification)';
  }

  // 6. Hash check (only for duplicates or files that were hashed)
  if (item.hash) {
    try {
      const currentHash = await hashFile(filePath);
      if (currentHash !== item.hash) {
        return 'File content hash changed since review';
      }
    } catch (err: unknown) {
      return `Failed to compute hash: ${(err as Error).message}`;
    }
  }

  return null; // Passed all checks
}
