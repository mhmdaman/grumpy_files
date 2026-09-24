// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Desktop Pet IPC Handlers, File Intelligence & Finder Bridge
// ─────────────────────────────────────────────────────────────────────────────

import { ipcMain, BrowserWindow, dialog, Menu, MenuItemConstructorOptions, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MovementController } from './movement';
import { SPRITE_CONFIGS } from './spriteConfig';
import { savePetPosition } from './positionStore';
import { findNearestPlatform } from './platformDetector';
import { scan } from '../../scanner/scanner';
import { DEFAULT_CONFIG } from '../../scanner/rules';
import { formatBytes } from '../../utils/formatBytes';
import { ScanResult } from '../../types/scanner';
import { extractCleanupCandidates } from '../../scanner/candidates';
import { CleanupDataPayload, CleanupCandidate } from '../../types/candidates';
import { isProtectedPath } from '../../safety/protectedPaths';
import { isBundleDirectory } from '../../scanner/categories';
import { moveToTrash } from '../../cleanup/trash';
import { setCleanupSnapshot } from './cleanupDataStore';

const IDLE_QUIPS = [
  "Quack. Still 0 bytes deleted today.",
  "I'm keeping an eye on your Downloads folder.",
  "Your disk space isn't getting any bigger.",
  "Duplicate files are a duck's natural enemy.",
  "Tidiness is not optional.",
  "Did you know old disk images attract digital dust?",
  "Standing by for file organization duties.",
];

export function setupIpcHandlers(
  window: BrowserWindow,
  movement: MovementController,
  initialDebug: boolean = false,
  openCleanupWindow?: () => BrowserWindow,
  getCleanupWindow?: () => BrowserWindow | null
): { triggerScan: (dir: string) => Promise<void> } {
  let isDebugMode = initialDebug;
  let latestCleanupData: CleanupDataPayload | null = null;
  let totalReclaimedBytes = 0;


  // Handlers for renderer initialization
  ipcMain.handle('pet:get-sprite-configs', () => {
    return SPRITE_CONFIGS;
  });

  ipcMain.handle('pet:get-state', () => {
    return movement.getCurrentState();
  });

  ipcMain.handle('pet:set-emotion', (_event, emotion: string, options?: { durationMs?: number; force?: boolean }) => {
    return movement.setEmotion(emotion as any, options);
  });

  ipcMain.handle('pet:get-debug-state', () => {
    const pos = window.getPosition();
    return {
      isDebug: isDebugMode,
      state: movement.getCurrentState(),
      previousState: movement.getPreviousState(),
      priority: movement.getStatePriority(),
      currentGif: movement.getCurrentGif(),
      platform: movement.getPlatform(),
      position: { x: pos[0], y: pos[1] },
    };
  });

  // Renderer click interaction
  ipcMain.on('pet:on-click', () => {
    movement.setEmotion('SURPRISED', { durationMs: 2200 });

    if (latestCleanupData && latestCleanupData.candidates.length > 0) {
      const dupCount = latestCleanupData.summary.duplicateGroupCount;
      const totalCandidates = latestCleanupData.candidates.length;
      const text = dupCount > 0
        ? `🐥 Found ${dupCount} duplicate groups! Want to review?`
        : `🐥 I have ${totalCandidates} cleanup candidates ready.`;

      window.webContents.send('pet:show-speech', {
        text,
        buttonText: 'View Cleanup Candidates',
        action: 'open-candidates',
        duration: 5000,
      });
      return;
    }

    const quip = IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)];
    window.webContents.send('pet:show-speech', { text: quip, duration: 3200 });
  });

  // Drag start / move / end
  ipcMain.on('pet:drag-start', () => {
    movement.pause();
  });

  ipcMain.on('pet:drag-move', (_event, pos: { x: number; y: number }) => {
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      window.setPosition(Math.round(pos.x), Math.round(pos.y));
    }
  });

  ipcMain.on('pet:drag-end', (_event, pos: { x: number; y: number }) => {
    const [w, h] = window.getSize();
    const rawX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : window.getPosition()[0];
    const rawY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : window.getPosition()[1];

    try {
      const snap = findNearestPlatform(rawX, rawY, w, h, 60);
      window.setPosition(snap.snappedX, snap.snappedY);
      savePetPosition({ x: snap.snappedX, y: snap.snappedY });
      movement.setPlatform(snap.platform);

      if (snap.platform.type === 'DOCK') {
        window.webContents.send('pet:show-speech', {
          text: '🐥 Docked on macOS Dock.',
          duration: 3000,
        });
      } else if (snap.platform.type === 'MANUAL') {
        window.webContents.send('pet:show-speech', {
          text: `🐥 On ${snap.platform.name}.`,
          duration: 3000,
        });
      }
    } catch {
      window.setPosition(rawX, rawY);
      savePetPosition({ x: rawX, y: rawY });
    }

    movement.pause(3000);
  });

  // Context menu
  ipcMain.on('pet:show-context-menu', () => {
    const defaultDownloads = path.join(os.homedir(), 'Downloads');
    const defaultHome = os.homedir();

    const template: MenuItemConstructorOptions[] = [
      {
        label: '🐥 GrumpyDuck Desktop Pet',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '📋 View Cleanup Candidates',
        click: () => {
          if (openCleanupWindow) {
            openCleanupWindow();
            window.webContents.send('pet:show-speech', {
              text: '🐥 Here are my suspects.',
              duration: 3500,
            });
          }
        },
      },
      ...(latestCleanupData ? [
        {
          label: `Reveal Scanned Folder (${path.basename(latestCleanupData.scannedPath)})`,
          click: () => {
            shell.openPath(latestCleanupData!.scannedPath);
          },
        } as MenuItemConstructorOptions,
      ] : []),
      { type: 'separator' },
      {
        label: 'Scan ~/Downloads',
        click: () => triggerScan(defaultDownloads),
      },
      {
        label: 'Scan Home Directory (~)',
        click: () => triggerScan(defaultHome),
      },
      {
        label: 'Choose Folder to Scan…',
        click: async () => {
          const result = await dialog.showOpenDialog(window, {
            properties: ['openDirectory'],
            title: 'Select Directory for GrumpyDuck to Scan',
          });
          if (!result.canceled && result.filePaths.length > 0) {
            await triggerScan(result.filePaths[0]);
          }
        },
      },
      { type: 'separator' },
      ...(isDebugMode ? [
        {
          label: '🎭 Debug: Test Animations',
          submenu: [
            {
              label: '🔄 Run Full Cycle Test',
              click: () => {
                const cycle: { state: any; label: string; durationMs: number }[] = [
                  { state: 'IDLE', label: 'IDLE (idle.gif)', durationMs: 3000 },
                  { state: 'WALK_RIGHT', label: 'WALK_RIGHT (walk-right.gif)', durationMs: 3000 },
                  { state: 'WALK_LEFT', label: 'WALK_LEFT (walk-left.gif)', durationMs: 3000 },
                  { state: 'SCANNING', label: 'SCANNING (scan.gif)', durationMs: 3500 },
                  { state: 'HAPPY', label: 'HAPPY (happy.gif)', durationMs: 3500 },
                  { state: 'THINKING', label: 'THINKING (thinking.gif)', durationMs: 3500 },
                  { state: 'SURPRISED', label: 'SURPRISED (surprised.gif)', durationMs: 3500 },
                  { state: 'IDLE', label: 'IDLE', durationMs: 3000 },
                ];

                let delay = 0;
                for (const step of cycle) {
                  setTimeout(() => {
                    if (window && !window.isDestroyed()) {
                      movement.setEmotion(step.state, { durationMs: step.durationMs, force: true });
                      window.webContents.send('pet:show-speech', { text: `[Debug] ${step.label}`, duration: step.durationMs - 300 });
                    }
                  }, delay);
                  delay += step.durationMs;
                }
              },
            },
            { type: 'separator' },
            { label: '🐥 Idle', click: () => movement.setEmotion('IDLE', { force: true }) },
            { label: '🎉 Happy', click: () => movement.setEmotion('HAPPY', { durationMs: 4000, force: true }) },
            { label: '🤔 Thinking', click: () => movement.setEmotion('THINKING', { durationMs: 4000, force: true }) },
            { label: '😲 Surprised', click: () => movement.setEmotion('SURPRISED', { durationMs: 3000, force: true }) },
            { label: '🔍 Scanning', click: () => movement.setEmotion('SCANNING', { durationMs: 4000, force: true }) },
            { label: '⬅️ Walk Left', click: () => movement.setEmotion('WALK_LEFT', { durationMs: 3000, force: true }) },
            { label: '➡️ Walk Right', click: () => movement.setEmotion('WALK_RIGHT', { durationMs: 3000, force: true }) },
          ],
        } as MenuItemConstructorOptions,
        { type: 'separator' } as MenuItemConstructorOptions,
      ] : []),
      {
        label: isDebugMode ? '✓ Debug Mode Enabled' : 'Enable Debug Overlay',
        click: () => {
          isDebugMode = !isDebugMode;
          const pos = window.getPosition();
          window.webContents.send('pet:debug-changed', {
            isDebug: isDebugMode,
            state: movement.getCurrentState(),
            previousState: movement.getPreviousState(),
            priority: movement.getStatePriority(),
            currentGif: movement.getCurrentGif(),
            platform: movement.getPlatform(),
            position: { x: pos[0], y: pos[1] },
          });
        },
      },
      {
        label: 'Random Thought',
        click: () => {
          const quip = IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)];
          window.webContents.send('pet:show-speech', { text: quip, duration: 3500 });
        },
      },
      {
        label: 'Reset Position (Bottom Right)',
        click: () => {
          const { getDefaultPosition } = require('./positionStore');
          const [w, h] = window.getSize();
          const pos = getDefaultPosition(w, h);
          const snap = findNearestPlatform(pos.x, pos.y, w, h, 60);
          window.setPosition(snap.snappedX, snap.snappedY);
          savePetPosition({ x: snap.snappedX, y: snap.snappedY });
          movement.setPlatform(snap.platform);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Pet',
        role: 'quit',
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window });
  });

  // Custom speech relay
  ipcMain.on('pet:custom-speech', (_event, data: { text: string; duration?: number }) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('pet:show-speech', data);
    }
  });

  // Open Cleanup Candidates window handler
  ipcMain.handle('pet:open-cleanup-window', () => {
    if (openCleanupWindow) {
      openCleanupWindow();
      window.webContents.send('pet:show-speech', {
        text: '🐥 Here are my suspects.',
        duration: 3500,
      });
    }
  });

  // Return cached cleanup candidates data
  ipcMain.handle('pet:get-cleanup-data', () => {
    return {
      cleanupData: latestCleanupData,
      totalReclaimedBytes,
    };
  });

  // Reveal file in macOS Finder
  ipcMain.handle('pet:reveal-in-finder', async (_event, filePath: string) => {
    if (!filePath) return false;
    try {
      shell.showItemInFolder(filePath);
      window.webContents.send('pet:show-speech', {
        text: '🐥 There. Go inspect it.',
        duration: 3200,
      });
      return true;
    } catch {
      return false;
    }
  });

  // Safe Deletion: Move item to Trash
  ipcMain.handle('pet:trash-item', async (_event, filePath: string) => {
    if (!filePath) {
      return { success: false, error: 'No path specified.' };
    }

    const resolved = path.resolve(filePath);

    // Safety checks
    if (isProtectedPath(resolved)) {
      return { success: false, error: `Safety violation: Protected system path (${resolved})` };
    }

    if (isBundleDirectory(path.basename(resolved))) {
      return { success: false, error: 'Application bundles (.app) cannot be deleted.' };
    }

    if (!fs.existsSync(resolved)) {
      return { success: false, error: 'File no longer exists on disk.' };
    }

    let fileSize = 0;
    try {
      const stats = fs.statSync(resolved);
      fileSize = stats.size;
    } catch {}

    try {
      // Safely move to macOS Trash using native Trash mechanism
      await moveToTrash(resolved);

      totalReclaimedBytes += fileSize;

      // Celebrate successful trash with Happy emotion
      movement.setEmotion('HAPPY', { durationMs: 3500 });

      // Update in-memory latestCleanupData
      if (latestCleanupData) {
        // Remove trashed candidate
        latestCleanupData.candidates = latestCleanupData.candidates.filter(
          (c) => path.resolve(c.path) !== resolved
        );

        // Update duplicate groups if affected
        for (const group of latestCleanupData.duplicateGroups) {
          const originalDupLen = group.duplicates.length;
          group.duplicates = group.duplicates.filter(
            (d) => path.resolve(d.path) !== resolved
          );
          if (group.duplicates.length < originalDupLen) {
            group.wastedBytes = group.size * group.duplicates.length;
          }
        }

        // Recalculate summary
        let potentialCleanupCount = 0;
        let reviewCount = 0;
        let keepCount = 0;
        let totalWasted = 0;

        for (const c of latestCleanupData.candidates) {
          if (c.recommendation === 'POTENTIAL_CLEANUP') potentialCleanupCount++;
          else if (c.recommendation === 'REVIEW') reviewCount++;
          else if (c.recommendation === 'KEEP') keepCount++;
        }

        for (const g of latestCleanupData.duplicateGroups) {
          totalWasted += g.wastedBytes;
        }

        latestCleanupData.summary.totalCandidates = latestCleanupData.candidates.length;
        latestCleanupData.summary.potentialCleanupCount = potentialCleanupCount;
        latestCleanupData.summary.reviewCount = reviewCount;
        latestCleanupData.summary.keepCount = keepCount;
        latestCleanupData.summary.totalDuplicateWastedBytes = totalWasted;

        // Keep the shared store in sync for future window opens
        setCleanupSnapshot({ cleanupData: latestCleanupData, totalReclaimedBytes });

        // Broadcast updated data to cleanupWindow
        const cw = getCleanupWindow ? getCleanupWindow() : null;
        if (cw && !cw.isDestroyed()) {
          cw.webContents.send('cleanup:data-updated', {
            cleanupData: latestCleanupData,
            totalReclaimedBytes,
          });
        }
      }

      // Desktop Pet reaction
      const quips = [
        '🐥 One less thing cluttering the nest.',
        '🐥 Gone to the Trash. Probably deserved it.',
      ];
      const selectedQuip = quips[Math.floor(Math.random() * quips.length)];
      window.webContents.send('pet:show-speech', {
        text: selectedQuip,
        duration: 4000,
      });

      return {
        success: true,
        size: fileSize,
        reclaimedBytes: totalReclaimedBytes,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return { success: false, error: error.message || 'Failed to move to Trash' };
    }
  });

  // Safe Batch Deletion: Move multiple items to Trash
  ipcMain.handle('pet:trash-batch', async (_event, filePaths: string[]) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { successCount: 0, failureCount: 0, reclaimedBytes: totalReclaimedBytes };
    }

    let successCount = 0;
    let failureCount = 0;
    const trashedSet = new Set<string>();

    for (const filePath of filePaths) {
      const resolved = path.resolve(filePath);

      // Safety checks
      if (isProtectedPath(resolved) || isBundleDirectory(path.basename(resolved)) || !fs.existsSync(resolved)) {
        failureCount++;
        continue;
      }

      let fileSize = 0;
      try {
        const stats = fs.statSync(resolved);
        fileSize = stats.size;
      } catch {}

      try {
        await moveToTrash(resolved);
        totalReclaimedBytes += fileSize;
        successCount++;
        trashedSet.add(resolved);
      } catch {
        failureCount++;
      }
    }

    if (successCount > 0) {
      movement.setEmotion('HAPPY', { durationMs: 4000 });
    }

    // Update in-memory latestCleanupData
    if (latestCleanupData && successCount > 0) {
      latestCleanupData.candidates = latestCleanupData.candidates.filter(
        (c) => !trashedSet.has(path.resolve(c.path))
      );

      for (const group of latestCleanupData.duplicateGroups) {
        const originalDupLen = group.duplicates.length;
        group.duplicates = group.duplicates.filter(
          (d) => !trashedSet.has(path.resolve(d.path))
        );
        if (group.duplicates.length < originalDupLen) {
          group.wastedBytes = group.size * group.duplicates.length;
        }
      }

      let potentialCleanupCount = 0;
      let reviewCount = 0;
      let keepCount = 0;
      let totalWasted = 0;

      for (const c of latestCleanupData.candidates) {
        if (c.recommendation === 'POTENTIAL_CLEANUP') potentialCleanupCount++;
        else if (c.recommendation === 'REVIEW') reviewCount++;
        else if (c.recommendation === 'KEEP') keepCount++;
      }

      for (const g of latestCleanupData.duplicateGroups) {
        totalWasted += g.wastedBytes;
      }

      latestCleanupData.summary.totalCandidates = latestCleanupData.candidates.length;
      latestCleanupData.summary.potentialCleanupCount = potentialCleanupCount;
      latestCleanupData.summary.reviewCount = reviewCount;
      latestCleanupData.summary.keepCount = keepCount;
      latestCleanupData.summary.totalDuplicateWastedBytes = totalWasted;

      // Keep the shared store in sync for future window opens
      setCleanupSnapshot({ cleanupData: latestCleanupData, totalReclaimedBytes });

      // Broadcast update to cleanupWindow
      const cw = getCleanupWindow ? getCleanupWindow() : null;
      if (cw && !cw.isDestroyed()) {
        cw.webContents.send('cleanup:data-updated', {
          cleanupData: latestCleanupData,
          totalReclaimedBytes,
        });
      }
    }

    // Desktop pet speech reaction
    if (successCount > 0) {
      const quips = [
        `🐥 Cleaned out ${successCount} items! Space well reclaimed.`,
        `🐥 Dumped ${successCount} files into Trash. Nest feels lighter.`,
      ];
      const selectedQuip = quips[Math.floor(Math.random() * quips.length)];
      window.webContents.send('pet:show-speech', {
        text: selectedQuip,
        duration: 4500,
      });
    }

    return {
      successCount,
      failureCount,
      reclaimedBytes: totalReclaimedBytes,
    };
  });

  // Scanner execution function with full intelligence & Finder integration
  async function triggerScan(directory: string): Promise<void> {
    const resolvedDir = directory.startsWith('~')
      ? path.join(os.homedir(), directory.slice(1))
      : path.resolve(directory);

    // Validate existence
    if (!fs.existsSync(resolvedDir)) {
      window.webContents.send('pet:show-speech', {
        text: `🐥 Folder not found: ${path.basename(resolvedDir)}`,
        duration: 4000,
      });
      return;
    }

    movement.setEmotion('SCANNING', { force: true });

    // 1. Requirement: When scan starts, show "I'm checking this place."
    window.webContents.send('pet:show-speech', {
      text: "I'm checking this place.",
      duration: 4000,
    });

    // 2. Requirement: Automatically open that exact folder in macOS Finder once when scan starts
    try {
      await shell.openPath(resolvedDir);
    } catch (err) {
      console.error(`Failed to open directory in Finder: ${(err as Error).message}`);
    }

    try {
      const result: ScanResult = await scan(resolvedDir, DEFAULT_CONFIG);

      // Extract cleanup candidates and duplicate groups
      latestCleanupData = extractCleanupCandidates(result);
      // Persist to shared store so a freshly opened cleanup window can retrieve it.
      setCleanupSnapshot({ cleanupData: latestCleanupData, totalReclaimedBytes });

      const dupCount = latestCleanupData.summary.duplicateGroupCount;
      const dupWasted = latestCleanupData.summary.totalDuplicateWastedBytes;
      const totalCandidates = latestCleanupData.candidates.length;
      const totalFiles = result.summary.totalFiles;

      let resultMessage = `🐥 Scanned ${totalFiles} files.`;

      // Pet dialogue and emotion reaction requirement:
      if (dupCount > 0) {
        resultMessage = `🐥 I found copies of the same thing. (${formatBytes(dupWasted)} wasted)`;
        movement.setEmotion('THINKING', { durationMs: 6500, force: true });
      } else if (totalCandidates > 0) {
        resultMessage = `🐥 Scanned ${totalFiles} files. Found ${totalCandidates} candidates.`;
        movement.setEmotion('THINKING', { durationMs: 6500, force: true });
      } else {
        resultMessage = `🐥 Scanned ${totalFiles} files. Clean!`;
        movement.setEmotion('HAPPY', { durationMs: 5500, force: true });
      }

      // Show notification / speech bubble with actionable button
      window.webContents.send('pet:show-speech', {
        text: resultMessage,
        buttonText: totalCandidates > 0 ? 'View Cleanup Candidates' : undefined,
        action: totalCandidates > 0 ? 'open-candidates' : undefined,
        duration: 8000,
      });

      window.webContents.send('pet:bounce');

      // Notify open cleanupWindow if exists
      const cw = getCleanupWindow ? getCleanupWindow() : null;
      if (cw && !cw.isDestroyed()) {
        cw.webContents.send('cleanup:data-updated', {
          cleanupData: latestCleanupData,
          totalReclaimedBytes,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      movement.setState('IDLE');
      window.webContents.send('pet:state-changed', 'IDLE');
      window.webContents.send('pet:show-speech', {
        text: `🐥 Scan failed: ${error.message || 'Permission denied'}`,
        duration: 4000,
      });
      setTimeout(() => {
        movement.resume();
      }, 5000);
    }
  }

  ipcMain.handle('pet:scan-directory', async (_event, dir: string) => {
    await triggerScan(dir);
  });

  return { triggerScan };
}
