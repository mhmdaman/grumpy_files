// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Cleanup Plan Exporter
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { ReviewSession } from './session';
import { CleanupPlanExport, ExportedPlanItem } from '../types/review';

/**
 * Generates the structured CleanupPlanExport object from a completed or partial review session.
 *
 * @param session Active or completed ReviewSession.
 * @param scanPath Absolute scanned directory path.
 */
export function buildCleanupPlan(
  session: ReviewSession,
  scanPath: string,
): CleanupPlanExport {
  const state = session.getState();
  const reviewedItems = session.getAllReviewedItems();

  const files: ExportedPlanItem[] = reviewedItems.map((item) => {
    const intel = item.file.intelligence;
    return {
      path: item.file.path,
      name: item.file.name,
      size: item.file.size,
      hash: item.file.hash || undefined,
      classification: intel?.classification.type ?? 'UNKNOWN',
      recommendation: intel?.recommendation.action ?? 'REVIEW',
      userDecision: item.decision ?? 'SKIP',
      reasons: intel?.recommendation.reasons ?? [],
    };
  });

  return {
    scanPath,
    createdAt: new Date().toISOString(),
    readOnly: true,
    summary: {
      totalReviewed: state.reviewedCount,
      keptCount: state.keptCount,
      cleanupCount: state.cleanupCount,
      skippedCount: state.skippedCount,
      totalSelectedBytes: state.potentialCleanupBytes,
    },
    files,
    totalSelectedBytes: state.potentialCleanupBytes,
  };
}

/**
 * Writes the cleanup plan JSON to a file safely.
 *
 * @param plan CleanupPlanExport object.
 * @param outputPath Destination file path.
 */
export async function writeCleanupPlan(
  plan: CleanupPlanExport,
  outputPath: string,
): Promise<void> {
  const resolved = path.resolve(outputPath);
  const dir = path.dirname(resolved);

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(resolved, JSON.stringify(plan, null, 2), 'utf-8');
}
