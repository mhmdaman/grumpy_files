// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — IPC Handlers & Scanner Bridge
// ─────────────────────────────────────────────────────────────────────────────

import { ipcMain, BrowserWindow, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { MovementController } from './movement';
import { SPRITE_CONFIGS, AnimationState } from './spriteConfig';
import { savePetPosition } from './positionStore';
import { scan } from '../../scanner/scanner';
import { DEFAULT_CONFIG } from '../../scanner/rules';
import { formatBytes } from '../../utils/formatBytes';
import { ScanResult } from '../../types/scanner';

import { findNearestLedge } from './surfaceDetector';

const CLICK_MESSAGES = [
  '🐥 What?',
  '🐥 You clicked me.',
  '🐥 I\'m working.',
  '🐥 Stop disturbing me.',
  '🐥 Do you mind?',
  '🐥 I am keeping an eye on your storage.',
  '🐥 Quack. Need something scanned?',
];

const IDLE_QUIPS = [
  '🐥 Hmm…',
  '🐥 So much clutter in the world…',
  '🐥 I wonder how many duplicate files you have…',
  '🐥 Just patrolling the desktop.',
  '🐥 *grumpy sigh*',
];

export function setupIpcHandlers(
  window: BrowserWindow,
  movement: MovementController
): { triggerScan: (dir: string) => Promise<void> } {
  // Renderer requests initial sprite configuration
  ipcMain.handle('pet:get-sprite-configs', () => {
    return SPRITE_CONFIGS;
  });

  // Renderer requests current state
  ipcMain.handle('pet:get-state', () => {
    return movement.getCurrentState();
  });

  // Renderer signals a click on the duck
  ipcMain.on('pet:on-click', () => {
    // Pause movement for 5 seconds on click
    movement.pause(5000);

    const message = CLICK_MESSAGES[Math.floor(Math.random() * CLICK_MESSAGES.length)];
    window.webContents.send('pet:show-speech', { text: message, duration: 3500 });
  });

  // Drag handling
  ipcMain.on('pet:drag-start', () => {
    movement.pause();
  });

  ipcMain.on('pet:drag-move', (_event, pos: { x: number; y: number }) => {
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      window.setPosition(Math.round(pos.x), Math.round(pos.y));
    }
  });

  ipcMain.on('pet:drag-end', async (_event, pos: { x: number; y: number }) => {
    const [w, h] = window.getSize();
    const rawX = pos && typeof pos.x === 'number' ? Math.round(pos.x) : window.getPosition()[0];
    const rawY = pos && typeof pos.y === 'number' ? Math.round(pos.y) : window.getPosition()[1];

    try {
      // Find nearest walkable surface ledge (widget header, window top, or desktop floor)
      const { snappedX, snappedY, ledge } = await findNearestLedge(rawX, rawY, w, h, 40);
      window.setPosition(snappedX, snappedY);
      savePetPosition({ x: snappedX, y: snappedY });
      movement.setLedge(ledge);

      if (ledge.isWidget) {
        window.webContents.send('pet:show-speech', {
          text: `🐥 Standing on ${ledge.owner || 'widget'}.`,
          duration: 3000,
        });
      }
    } catch {
      window.setPosition(rawX, rawY);
      savePetPosition({ x: rawX, y: rawY });
    }

    // Resume autonomous horizontal roaming after 3.5 seconds of stillness
    movement.pause(3500);
  });

  // Context menu triggered from renderer right-click
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
          window.setPosition(pos.x, pos.y);
          savePetPosition(pos);
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

  // Scanner execution function
  async function triggerScan(directory: string): Promise<void> {
    const resolvedDir = directory.startsWith('~')
      ? path.join(os.homedir(), directory.slice(1))
      : path.resolve(directory);

    // Pause roaming movement while scanning
    movement.pause();
    movement.setState('SCANNING');

    // Notify renderer
    window.webContents.send('pet:state-changed', 'SCANNING');
    window.webContents.send('pet:show-speech', {
      text: `🐥 I'm investigating ${path.basename(resolvedDir)}…`,
      duration: 5000,
    });

    try {
      const result: ScanResult = await scan(resolvedDir, DEFAULT_CONFIG);

      // Analyze real results
      const dupCount = result.summary.duplicateGroupCount;
      const dupWasted = result.summary.duplicateWastedBytes;
      const totalFiles = result.summary.totalFiles;
      const largeCount = result.summary.largeFileCount;

      let resultMessage = `🐥 Scanned ${totalFiles} files.`;

      if (dupCount > 0) {
        resultMessage = `🐥 I found ${dupCount} duplicate group${dupCount === 1 ? '' : 's'} (${formatBytes(dupWasted)} wasted).`;
      } else if (largeCount > 0) {
        resultMessage = `🐥 Scanned ${totalFiles} files. Found ${largeCount} large files.`;
      } else {
        resultMessage = `🐥 Scanned ${totalFiles} files. Everything looks clean.`;
      }

      // Return to IDLE
      movement.setState('IDLE');
      window.webContents.send('pet:state-changed', 'IDLE');
      window.webContents.send('pet:show-speech', {
        text: resultMessage,
        duration: 6000,
      });

      // Small celebration/acknowledgment window bounce
      window.webContents.send('pet:bounce');

      // Resume roaming after 8 seconds
      setTimeout(() => {
        movement.resume();
      }, 8000);
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

  // Handle scan start from renderer if invoked
  ipcMain.handle('pet:scan-directory', async (_event, dir: string) => {
    await triggerScan(dir);
  });

  return { triggerScan };
}
