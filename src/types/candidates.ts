// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Cleanup Candidates & Duplicate Review Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CleanupCandidate {
  path: string;
  name: string;
  category:
    | 'DUPLICATE'
    | 'INSTALLER'
    | 'LARGE_FILE'
    | 'OLD_FILE'
    | 'EMPTY_FOLDER';

  recommendation:
    | 'KEEP'
    | 'REVIEW'
    | 'POTENTIAL_CLEANUP';

  reason: string;
  size?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  // Duplicate group specific details
  duplicateHash?: string;
  duplicateGroupId?: string;
  isDuplicateOriginal?: boolean;
  duplicateCopiesCount?: number;
  wastedBytes?: number;
}

export interface DuplicateGroupView {
  hash: string;
  size: number;
  wastedBytes: number;
  original: CleanupCandidate;
  duplicates: CleanupCandidate[];
}

export interface CleanupCandidatesSummary {
  totalCandidates: number;
  potentialCleanupCount: number;
  reviewCount: number;
  keepCount: number;
  duplicateGroupCount: number;
  totalDuplicateWastedBytes: number;
  totalScannedFiles: number;
  totalScannedBytes: number;
}

export interface CleanupDataPayload {
  scannedPath: string;
  scannedAt: string;
  summary: CleanupCandidatesSummary;
  candidates: CleanupCandidate[];
  duplicateGroups: DuplicateGroupView[];
}
