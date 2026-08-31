// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Cleanup Candidates Extractor Engine
// ─────────────────────────────────────────────────────────────────────────────

import * as path from 'path';
import { ScanResult, FileMetadata, DuplicateGroup } from '../types/scanner';
import {
  CleanupCandidate,
  DuplicateGroupView,
  CleanupCandidatesSummary,
  CleanupDataPayload,
} from '../types/candidates';
import { formatBytes } from '../utils/formatBytes';
import { isProtectedPath } from '../safety/protectedPaths';

/**
 * Extracts structured cleanup candidates and duplicate groups from a ScanResult.
 * Strictly adheres to conservative recommendations:
 * - Redundant duplicate copies -> POTENTIAL_CLEANUP
 * - Duplicate primary copy -> KEEP
 * - Installers, Large Files, Old Files, Empty Folders -> REVIEW (or KEEP if active dataset/app)
 *
 * @param scanResult Completed scan result populated with file intelligence.
 * @returns Full CleanupDataPayload with structured candidates and duplicate groups.
 */
export function extractCleanupCandidates(scanResult: ScanResult): CleanupDataPayload {
  const candidates: CleanupCandidate[] = [];
  const duplicateGroups: DuplicateGroupView[] = [];
  const seenPaths = new Set<string>();

  // 1. Process Duplicate Groups (Strongest cleanup recommendations)
  for (const group of scanResult.duplicateGroups) {
    const validGroupFiles = group.files.filter((f) => !isProtectedPath(f.path));
    if (validGroupFiles.length < 2) continue;

    const [firstFile, ...duplicateFiles] = validGroupFiles;
    const wastedBytes = group.size * duplicateFiles.length;

    // Primary original copy to KEEP
    const originalCandidate: CleanupCandidate = {
      path: firstFile.path,
      name: firstFile.name,
      category: 'DUPLICATE',
      recommendation: 'KEEP',
      reason: 'Original / primary copy to keep',
      size: firstFile.size,
      confidence: 'HIGH',
      duplicateHash: group.hash,
      isDuplicateOriginal: true,
      duplicateCopiesCount: validGroupFiles.length,
      wastedBytes,
    };

    const duplicateCandidates: CleanupCandidate[] = [];

    // Redundant copies (POTENTIAL_CLEANUP)
    for (let i = 0; i < duplicateFiles.length; i++) {
      const dupFile = duplicateFiles[i];

      const dupCandidate: CleanupCandidate = {
        path: dupFile.path,
        name: dupFile.name,
        category: 'DUPLICATE',
        recommendation: 'POTENTIAL_CLEANUP',
        reason: `Identical copy of ${firstFile.name} (${formatBytes(dupFile.size)})`,
        size: dupFile.size,
        confidence: 'HIGH',
        duplicateHash: group.hash,
        isDuplicateOriginal: false,
        duplicateCopiesCount: validGroupFiles.length,
        wastedBytes: dupFile.size,
      };

      duplicateCandidates.push(dupCandidate);
      candidates.push(dupCandidate);
      seenPaths.add(dupFile.path);
    }

    // Add original to candidate list as well (for visibility and KEEP record)
    if (!seenPaths.has(firstFile.path)) {
      candidates.push(originalCandidate);
      seenPaths.add(firstFile.path);
    }

    duplicateGroups.push({
      hash: group.hash,
      size: group.size,
      wastedBytes,
      original: originalCandidate,
      duplicates: duplicateCandidates,
    });
  }

  // 2. Process Installers (.dmg, .pkg, .iso, .exe, .msi, etc.)
  for (const file of scanResult.files) {
    if (seenPaths.has(file.path) || isProtectedPath(file.path)) continue;

    const intel = file.intelligence;
    const isInstaller =
      (intel && intel.classification.type === 'INSTALLER') ||
      file.category === 'Installers' ||
      ['dmg', 'pkg', 'iso', 'exe', 'msi'].includes(file.extension.toLowerCase());

    if (isInstaller) {
      candidates.push({
        path: file.path,
        name: file.name,
        category: 'INSTALLER',
        recommendation: 'REVIEW',
        reason: `Installer package (${formatBytes(file.size)}) — verify if still needed`,
        size: file.size,
        confidence: 'HIGH',
      });
      seenPaths.add(file.path);
    }
  }

  // 3. Process Large Files (conservative review)
  for (const file of scanResult.files) {
    if (seenPaths.has(file.path) || isProtectedPath(file.path)) continue;

    const intel = file.intelligence;
    // Skip if it's explicitly an active dataset or application bundle
    if (intel && (intel.classification.type === 'DATASET' || intel.classification.type === 'APPLICATION')) {
      continue;
    }

    if (file.sizeLabel !== null) {
      candidates.push({
        path: file.path,
        name: file.name,
        category: 'LARGE_FILE',
        recommendation: 'REVIEW',
        reason: `Large file (${formatBytes(file.size)}) — ${file.sizeLabel}`,
        size: file.size,
        confidence: file.size >= 1024 * 1024 * 1024 ? 'HIGH' : 'MEDIUM',
      });
      seenPaths.add(file.path);
    }
  }

  // 4. Process Old Files (conservative review)
  for (const file of scanResult.files) {
    if (seenPaths.has(file.path) || isProtectedPath(file.path)) continue;

    const intel = file.intelligence;
    if (intel && (intel.classification.type === 'DATASET' || intel.classification.type === 'DEVELOPMENT_ARTIFACT' || intel.classification.type === 'APPLICATION')) {
      continue;
    }

    if (file.ageLabel !== null) {
      const daysOld = Math.max(1, Math.round((Date.now() - file.modifiedAt) / (1000 * 60 * 60 * 24)));
      candidates.push({
        path: file.path,
        name: file.name,
        category: 'OLD_FILE',
        recommendation: 'REVIEW',
        reason: `Not modified in ${daysOld} days (${file.ageLabel})`,
        size: file.size,
        confidence: 'MEDIUM',
      });
      seenPaths.add(file.path);
    }
  }

  // 5. Process Empty Folders
  for (const emptyDir of scanResult.emptyDirectories) {
    if (seenPaths.has(emptyDir) || isProtectedPath(emptyDir)) continue;

    candidates.push({
      path: emptyDir,
      name: path.basename(emptyDir) || emptyDir,
      category: 'EMPTY_FOLDER',
      recommendation: 'REVIEW',
      reason: 'Empty directory with 0 files',
      size: 0,
      confidence: 'HIGH',
    });
    seenPaths.add(emptyDir);
  }

  // Summary calculation
  let potentialCleanupCount = 0;
  let reviewCount = 0;
  let keepCount = 0;

  for (const c of candidates) {
    if (c.recommendation === 'POTENTIAL_CLEANUP') potentialCleanupCount++;
    else if (c.recommendation === 'REVIEW') reviewCount++;
    else if (c.recommendation === 'KEEP') keepCount++;
  }

  const summary: CleanupCandidatesSummary = {
    totalCandidates: candidates.length,
    potentialCleanupCount,
    reviewCount,
    keepCount,
    duplicateGroupCount: duplicateGroups.length,
    totalDuplicateWastedBytes: scanResult.summary.duplicateWastedBytes,
    totalScannedFiles: scanResult.summary.totalFiles,
    totalScannedBytes: scanResult.summary.totalBytes,
  };

  return {
    scannedPath: scanResult.scannedPath,
    scannedAt: scanResult.completedAt,
    summary,
    candidates,
    duplicateGroups,
  };
}
