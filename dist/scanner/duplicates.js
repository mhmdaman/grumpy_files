"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDuplicates = detectDuplicates;
const hash_1 = require("../utils/hash");
/**
 * Detect groups of files that have identical content.
 *
 * The function mutates each FileMetadata object in a confirmed duplicate group
 * to set the `hash` field, so the hash is available in the final report.
 *
 * @param files  All FileMetadata objects from a scan (including non-duplicates).
 * @returns      Duplicate groups and any hashing errors.
 */
async function detectDuplicates(files) {
    const groups = [];
    const hashErrors = [];
    // ── Phase 1: Group by size ─────────────────────────────────────────────────
    const bySize = new Map();
    for (const file of files) {
        // Skip zero-byte files and Applications bundles.
        if (file.size === 0 || file.category === 'Applications')
            continue;
        const existing = bySize.get(file.size);
        if (existing) {
            existing.push(file);
        }
        else {
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
        const byHash = new Map();
        for (const file of sizeGroup) {
            let digest;
            try {
                digest = await (0, hash_1.hashFile)(file.path);
            }
            catch (err) {
                // Record the error and skip this file — do not let one bad file
                // abort the entire duplicate detection pass.
                const error = err;
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
            }
            else {
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
//# sourceMappingURL=duplicates.js.map