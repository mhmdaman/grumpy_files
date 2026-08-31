// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Cleanup Data Store
// A tiny shared module that breaks the circular-import between ipc.ts and
// desktopPet.ts. ipc.ts writes the latest scan result here; desktopPet.ts
// reads from it when a new cleanup window opens.
// ─────────────────────────────────────────────────────────────────────────────

export interface CleanupDataSnapshot {
  cleanupData: any;
  totalReclaimedBytes: number;
}

let _snapshot: CleanupDataSnapshot | null = null;

/** Called by ipc.ts after every successful scan. */
export function setCleanupSnapshot(snapshot: CleanupDataSnapshot | null): void {
  _snapshot = snapshot;
}

/** Called by desktopPet.ts when a fresh cleanup window is created. */
export function getCleanupSnapshot(): CleanupDataSnapshot | null {
  return _snapshot;
}
