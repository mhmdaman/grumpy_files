// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Interactive Review Engine
// ─────────────────────────────────────────────────────────────────────────────

import * as readline from 'readline';
import { ScanResult, DuplicateGroup } from '../types/scanner';
import { ReviewItem } from '../types/review';
import { ReviewSession } from './session';
import {
  renderReviewIntro,
  renderCandidateCard,
  renderCandidateDetails,
  renderFinalSummary,
} from './display';
import { buildCleanupPlan, writeCleanupPlan } from './export';
import { isProtectedPath } from '../safety/protectedPaths';

/**
 * Extracts and prioritizes candidates for user review from a completed ScanResult.
 *
 * Excludes IGNORE items (dev artifacts), active KEEP items (datasets, apps, normal active files),
 * and protected system paths.
 *
 * @param scanResult The scan result populated with intelligence metadata.
 */
export function extractReviewCandidates(scanResult: ScanResult): ReviewItem[] {
  const candidates: ReviewItem[] = [];
  const seenPaths = new Set<string>();

  // Map of file paths to duplicate groups for fast lookup
  const duplicateGroupMap = new Map<string, DuplicateGroup>();
  for (const group of scanResult.duplicateGroups) {
    for (const f of group.files) {
      duplicateGroupMap.set(f.path, group);
    }
  }

  // 1. Redundant duplicate copies (POTENTIAL_CLEANUP)
  for (const group of scanResult.duplicateGroups) {
    if (group.files.length >= 2) {
      const [, ...extras] = group.files;
      for (const extra of extras) {
        if (!seenPaths.has(extra.path) && !isProtectedPath(extra.path)) {
          candidates.push({
            file: extra,
            priority: 'DUPLICATE_EXTRA',
            duplicateGroup: group,
            isDuplicateExtra: true,
          });
          seenPaths.add(extra.path);
        }
      }
    }
  }

  // 2. Installers (REVIEW)
  for (const file of scanResult.files) {
    if (seenPaths.has(file.path) || isProtectedPath(file.path)) continue;
    const intel = file.intelligence;
    if (intel && intel.classification.type === 'INSTALLER' && intel.recommendation.action === 'REVIEW') {
      candidates.push({
        file,
        priority: 'INSTALLER',
        duplicateGroup: duplicateGroupMap.get(file.path),
        isDuplicateExtra: false,
      });
      seenPaths.add(file.path);
    }
  }

  // 3. Large files under review (not datasets, not apps, not dev artifacts)
  for (const file of scanResult.files) {
    if (seenPaths.has(file.path) || isProtectedPath(file.path)) continue;
    const intel = file.intelligence;
    if (file.sizeLabel !== null && intel && intel.recommendation.action === 'REVIEW') {
      candidates.push({
        file,
        priority: 'LARGE_FILE',
        duplicateGroup: duplicateGroupMap.get(file.path),
        isDuplicateExtra: false,
      });
      seenPaths.add(file.path);
    }
  }

  // 4. Other review candidates (e.g. old documents requiring user review)
  for (const file of scanResult.files) {
    if (seenPaths.has(file.path) || isProtectedPath(file.path)) continue;
    const intel = file.intelligence;
    if (intel && intel.recommendation.action === 'REVIEW') {
      candidates.push({
        file,
        priority: 'OTHER_REVIEW',
        duplicateGroup: duplicateGroupMap.get(file.path),
        isDuplicateExtra: false,
      });
      seenPaths.add(file.path);
    }
  }

  return candidates;
}

/**
 * Runs an interactive CLI review session over the scanned candidates.
 *
 * @param scanResult Completed scan result with intelligence metadata.
 * @param exportPath Optional path to export cleanup plan JSON.
 */
export async function runInteractiveReview(
  scanResult: ScanResult,
  exportPath?: string,
): Promise<ReviewSession> {
  const candidates = extractReviewCandidates(scanResult);
  const session = new ReviewSession(candidates);

  // Show intro summary
  const duplicateWaste = scanResult.summary.duplicateWastedBytes;
  renderReviewIntro(scanResult.scannedPath, candidates, duplicateWaste);

  if (candidates.length === 0) {
    console.log('✨ No review candidates found! Your storage looks clean.');
    return session;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const linesIterator = rl[Symbol.asyncIterator]();

  const getNextLine = async (): Promise<string | null> => {
    const next = await linesIterator.next();
    if (next.done) return null;
    return next.value;
  };

  try {
    let viewingDetails = false;

    while (true) {
      const currentItem = session.getCurrentItem();
      if (!currentItem) {
        // Reached end of candidates
        break;
      }

      const state = session.getState();

      if (!viewingDetails) {
        renderCandidateCard(currentItem, state);
      }

      process.stdout.write('> ');
      const rawLine = await getNextLine();

      if (rawLine === null) {
        // Input stream closed
        break;
      }

      const answer = rawLine.trim().toUpperCase();

      if (viewingDetails) {
        // Any key returns from details view
        viewingDetails = false;
        continue;
      }

      if (answer === 'K') {
        session.recordDecision('KEEP');
      } else if (answer === 'C') {
        session.recordDecision('CLEANUP');
      } else if (answer === 'S') {
        session.recordDecision('SKIP');
      } else if (answer === 'D') {
        renderCandidateDetails(currentItem);
        viewingDetails = true;
      } else if (answer === 'Q') {
        break;
      } else {
        console.log('Invalid choice. Please choose [K] Keep, [C] Cleanup, [S] Skip, [D] Details, or [Q] Quit.');
      }
    }
  } finally {
    rl.close();
  }

  const finalState = session.getState();

  // Export plan if requested
  if (exportPath) {
    const plan = buildCleanupPlan(session, scanResult.scannedPath);
    await writeCleanupPlan(plan, exportPath);
  }

  // Render final summary
  renderFinalSummary(finalState, exportPath);

  return session;
}
