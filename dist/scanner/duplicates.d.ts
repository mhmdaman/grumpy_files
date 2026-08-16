import { FileMetadata, DuplicateGroup } from '../types/scanner';
export interface DuplicateDetectionResult {
    /** Confirmed duplicate groups (each group has >= 2 identical files). */
    groups: DuplicateGroup[];
    /**
     * Paths of files that could not be hashed (e.g. permission errors).
     * These are recorded but not counted as duplicates.
     */
    hashErrors: Array<{
        path: string;
        message: string;
        code?: string;
    }>;
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
export declare function detectDuplicates(files: FileMetadata[]): Promise<DuplicateDetectionResult>;
//# sourceMappingURL=duplicates.d.ts.map