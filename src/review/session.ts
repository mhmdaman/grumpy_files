// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Review Session Management
// ─────────────────────────────────────────────────────────────────────────────

import { ReviewItem, ReviewSessionState, UserDecision } from '../types/review';

/**
 * Manages in-memory state of an active interactive review session.
 * Does NOT perform any file modifications.
 */
export class ReviewSession {
  private items: ReviewItem[];
  private currentIndex: number;

  constructor(items: ReviewItem[]) {
    this.items = items;
    this.currentIndex = 0;
  }

  /** Gets all candidate items in the session. */
  public getItems(): ReviewItem[] {
    return this.items;
  }

  /** Gets the current item under review, or null if all items reviewed. */
  public getCurrentItem(): ReviewItem | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.items.length) {
      return null;
    }
    return this.items[this.currentIndex];
  }

  /** Gets current 0-indexed position. */
  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Records a user decision for the current item and advances to the next candidate.
   *
   * @param decision 'KEEP' | 'CLEANUP' | 'SKIP'
   */
  public recordDecision(decision: UserDecision): void {
    const current = this.getCurrentItem();
    if (!current) return;

    current.decision = decision;
    this.currentIndex++;
  }

  /**
   * Returns high-level progress statistics for the active session.
   */
  public getState(): ReviewSessionState {
    let keptCount = 0;
    let cleanupCount = 0;
    let skippedCount = 0;
    let potentialCleanupBytes = 0;

    for (const item of this.items) {
      if (item.decision === 'KEEP') keptCount++;
      else if (item.decision === 'CLEANUP') {
        cleanupCount++;
        potentialCleanupBytes += item.file.size;
      } else if (item.decision === 'SKIP') skippedCount++;
    }

    const reviewedCount = keptCount + cleanupCount + skippedCount;
    const remainingCount = this.items.length - reviewedCount;

    return {
      totalCandidates: this.items.length,
      currentIndex: this.currentIndex,
      reviewedCount,
      keptCount,
      cleanupCount,
      skippedCount,
      remainingCount,
      potentialCleanupBytes,
    };
  }

  /**
   * Returns all items marked by the user for CLEANUP.
   */
  public getCleanupItems(): ReviewItem[] {
    return this.items.filter((item) => item.decision === 'CLEANUP');
  }

  /**
   * Returns all items that have received any decision.
   */
  public getAllReviewedItems(): ReviewItem[] {
    return this.items.filter((item) => item.decision !== undefined);
  }
}
