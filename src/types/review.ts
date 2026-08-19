// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Review & Cleanup Planning Types
// ─────────────────────────────────────────────────────────────────────────────

import { FileMetadata, DuplicateGroup } from './scanner';
import { IntelligenceCategory, Recommendation } from './intelligence';

/**
 * User decision recorded during interactive review.
 */
export type UserDecision = 'KEEP' | 'CLEANUP' | 'SKIP';

/**
 * Candidate priority tier for ordering review items.
 */
export type CandidatePriority =
  | 'DUPLICATE_EXTRA'
  | 'INSTALLER'
  | 'LARGE_FILE'
  | 'OTHER_REVIEW';

/**
 * A single item queued for user review.
 */
export interface ReviewItem {
  file: FileMetadata;
  priority: CandidatePriority;
  duplicateGroup?: DuplicateGroup;
  isDuplicateExtra: boolean;
  decision?: UserDecision;
}

/**
 * High-level counts and progress metrics for an active review session.
 */
export interface ReviewSessionState {
  totalCandidates: number;
  currentIndex: number;
  reviewedCount: number;
  keptCount: number;
  cleanupCount: number;
  skippedCount: number;
  remainingCount: number;
  potentialCleanupBytes: number;
}

/**
 * Exported file item in cleanup plan.
 */
export interface ExportedPlanItem {
  path: string;
  name: string;
  size: number;
  classification: IntelligenceCategory;
  recommendation: Recommendation;
  userDecision: UserDecision;
  reasons: string[];
}

/**
 * Schema for exported cleanup plan JSON.
 */
export interface CleanupPlanExport {
  scanPath: string;
  createdAt: string;
  readOnly: true;
  summary: {
    totalReviewed: number;
    keptCount: number;
    cleanupCount: number;
    skippedCount: number;
    totalSelectedBytes: number;
  };
  files: ExportedPlanItem[];
  totalSelectedBytes: number;
}
