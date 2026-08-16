import { FileMetadata, DuplicateGroup } from '../types/scanner';
import { hashFile } from '../utils/hash';

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate detection
//
// Algorithm:
//   1. Group all files by size — files with unique sizes cannot be duplicates.
//   2. For each size-group with >= 2 files, compute SHA-256 for each file.
//   3. Group those files by hash — files with the same hash are duplicates.
//   4. Return groups with >= 2 members.
//
// This two-phase approach means we only hash files that have a size-match,
// which dramatically reduces I/O for large directories.
// ─────────────────────────────────────────────────────────────────────────────

export interface DuplicateDetectionResult {
  /** Confirmed duplicate groups (each group has >= 2 identical files). */
  groups: DuplicateGroup[];

  /**
   * Paths of files that could not be hashed (e.g. permission errors).
   * These are recorded but not counted as duplicates.
   */
  hashErrors: Array<{ path: string; message: string; code?: string }>;
}

/**
 * Detect groups of files that have identical content.
 *
 * The function mutates each FileMetadata object in a confirmed duplicate group
 * to set the `hash` field, so the hash is available in the final report.
 *
 * @param files  All FileMetadata objects from a scan (including non-duplicates).
 * @returns      Duplicate groups and any hashing errors.
 */
export async function detectDuplicates(
  files: FileMetadata[],
): Promise<DuplicateDetectionResult> {
  const groups: DuplicateGroup[] = [];
  const hashErrors: DuplicateDetectionResult['hashErrors'] = [];

  // ── Phase 1: Group by size ─────────────────────────────────────────────────
  const bySize = new Map<number, FileMetadata[]>();

  for (const file of files) {
    // Skip zero-byte files and Applications bundles.
    if (file.size === 0 || file.category === 'Applications') continue;

    const existing = bySize.get(file.size);
    if (existing) {
      existing.push(file);
    } else {
      bySize.set(file.size, [file]);
    }
  }

  // Discard size-groups with only one file — they cannot be duplicates.
  const candidates = [...bySize.values()].filter((group) => group.length >= 2);

  if (candidates.length === 0) {
    return { groups, hashErrors };
  }

  // ── Phase 2: Hash candidates and group by hash ────────────────────────────
  for (const sizeGroup of candidates) {
    const byHash = new Map<string, FileMetadata[]>();

    for (const file of sizeGroup) {
      let digest: string;
      try {
        digest = await hashFile(file.path);
      } catch (err: unknown) {
        // Record the error and skip this file — do not let one bad file
        // abort the entire duplicate detection pass.
        const error = err as NodeJS.ErrnoException;
        hashErrors.push({
          path: file.path,
          message: error.message ?? String(err),
          code: error.code,
        });
        continue;
      }

      // Attach the hash to the metadata object for use in reports.
      file.hash = digest;

      const existing = byHash.get(digest);
      if (existing) {
        existing.push(file);
      } else {
        byHash.set(digest, [file]);
      }
    }

    // Collect hash-groups that are genuine duplicates (>= 2 members).
    for (const [hash, hashGroup] of byHash.entries()) {
      if (hashGroup.length >= 2) {
        groups.push({
          hash,
          size: hashGroup[0].size,
          files: hashGroup,
        });
      }
    }
  }

  return { groups, hashErrors };
}
