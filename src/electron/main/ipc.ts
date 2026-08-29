// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Desktop Pet IPC Handlers & File Intelligence Bridge
// ─────────────────────────────────────────────────────────────────────────────

import { ipcMain, BrowserWindow, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { MovementController } from './movement';
import { SPRITE_CONFIGS } from './spriteConfig';
import { savePetPosition } from './positionStore';
import { findNearestPlatform, Platform } from './platformDetector';
import { scan } from '../../scanner/scanner';
import { DEFAULT_CONFIG } from '../../scanner/rules';
import { formatBytes } from '../../utils/formatBytes';
import { ScanResult } from '../../types/scanner';

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
  initialDebug: boolean = false
): { triggerScan: (dir: string) => Promise<void> } {
  let isDebugMode = initialDebug;

  // Handlers for renderer initialization
  ipcMain.handle('pet:get-sprite-configs', () => {
    return SPRITE_CONFIGS;
  });

  ipcMain.handle('pet:get-state', () => {
    return movement.getCurrentState();
  });

  ipcMain.handle('pet:get-debug-state', () => {
    const pos = window.getPosition();
    return {
      isDebug: isDebugMode,
      state: movement.getCurrentState(),
      platform: movement.getPlatform(),
      position: { x: pos[0], y: pos[1] },
    };
  });

  // Renderer click interaction
  ipcMain.on('pet:on-click', () => {
    movement.pause(2500);
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
      // Find nearest walkable platform (Dock, manual platform, or screen floor)
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
      {
        label: isDebugMode ? '✓ Debug Mode Enabled' : 'Enable Debug Overlay',
        click: () => {
          isDebugMode = !isDebugMode;
          const pos = window.getPosition();
          window.webContents.send('pet:debug-changed', {
            isDebug: isDebugMode,
            state: movement.getCurrentState(),
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

  // Scanner execution function with full intelligence integration
  async function triggerScan(directory: string): Promise<void> {
    const resolvedDir = directory.startsWith('~')
      ? path.join(os.homedir(), directory.slice(1))
      : path.resolve(directory);

    movement.pause();
    movement.setState('SCANNING');

    window.webContents.send('pet:state-changed', 'SCANNING');
    window.webContents.send('pet:show-speech', {
      text: `🐥 Investigating ${path.basename(resolvedDir)}…`,
      duration: 5000,
    });

    try {
      const result: ScanResult = await scan(resolvedDir, DEFAULT_CONFIG);

      const dupCount = result.summary.duplicateGroupCount;
      const dupWasted = result.summary.duplicateWastedBytes;
      const totalFiles = result.summary.totalFiles;
      const largeCount = result.summary.largeFileCount;

      let resultMessage = `🐥 Scanned ${totalFiles} files.`;

      if (dupCount > 0) {
        resultMessage = `🐥 Found ${dupCount} duplicate group${dupCount === 1 ? '' : 's'} (${formatBytes(dupWasted)} wasted).`;
      } else if (largeCount > 0) {
        resultMessage = `🐥 Scanned ${totalFiles} files. Found ${largeCount} large files.`;
      } else {
        resultMessage = `🐥 Scanned ${totalFiles} files. Clean!`;
      }

      movement.setState('IDLE');
      window.webContents.send('pet:state-changed', 'IDLE');
      window.webContents.send('pet:show-speech', {
        text: resultMessage,
        duration: 6000,
      });

      window.webContents.send('pet:bounce');

      setTimeout(() => {
        movement.resume();
      }, 7000);
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
