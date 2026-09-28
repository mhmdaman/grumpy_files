// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Desktop Pet Electron Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadSavedPosition, savePetPosition } from './positionStore';
import { MovementController } from './movement';
import { setupIpcHandlers } from './ipc';
import { findNearestPlatform } from './platformDetector';
import { getCleanupSnapshot } from './cleanupDataStore';

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let petWindow: BrowserWindow | null = null;
let cleanupWindow: BrowserWindow | null = null;
let movementController: MovementController | null = null;


const WINDOW_WIDTH = 160;
const WINDOW_HEIGHT = 120;

const isDebugInitially = process.argv.includes('--debug') || process.env.GRUMPYDUCK_DEBUG === '1' || process.argv.includes('--cycle-test');

function resolveRendererHtml(filename: string): string {
  let p = path.resolve(__dirname, `../renderer/${filename}`);
  if (!fs.existsSync(p)) {
    p = path.resolve(__dirname, `../../../src/electron/renderer/${filename}`);
  }
  if (!fs.existsSync(p)) {
    p = path.join(app.getAppPath(), `src/electron/renderer/${filename}`);
  }
  return p;
}

export function openOrCreateCleanupWindow(): BrowserWindow {
  if (cleanupWindow && !cleanupWindow.isDestroyed()) {
    if (cleanupWindow.isMinimized()) cleanupWindow.restore();
    cleanupWindow.show();
    cleanupWindow.focus();
    return cleanupWindow;
  }

  cleanupWindow = new BrowserWindow({
    width: 940,
    height: 700,
    minWidth: 780,
    minHeight: 520,
    title: 'GrumpyDuck — Cleanup Candidates',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#e0e5ec',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const cleanupHtmlPath = resolveRendererHtml('cleanup.html');
  cleanupWindow.loadFile(cleanupHtmlPath);

  // Once the page has fully loaded, push any cached scan data so the renderer
  // never shows an empty dashboard due to the IPC race at DOMContentLoaded.
  cleanupWindow.webContents.once('did-finish-load', () => {
    if (cleanupWindow && !cleanupWindow.isDestroyed()) {
      const payload = getCleanupSnapshot();
      if (payload && payload.cleanupData) {
        cleanupWindow.webContents.send('cleanup:data-updated', payload);
      }
    }
  });

  // DevTools: Cmd+Option+I to inspect the cleanup window
  cleanupWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.meta && input.alt && input.key === 'i') {
      cleanupWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Log any renderer load failures to the main process console
  cleanupWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc) => {
    console.error(`[cleanup-window] did-fail-load: ${errorCode} — ${errorDesc}`);
  });

  cleanupWindow.once('ready-to-show', () => {
    if (cleanupWindow && !cleanupWindow.isDestroyed()) {
      cleanupWindow.show();
      cleanupWindow.focus();
    }
  });

  cleanupWindow.on('closed', () => {
    cleanupWindow = null;
  });

  return cleanupWindow;
}

function createPetWindow(): void {
  // Hide macOS dock icon so GrumpyDuck behaves as a true desktop pet
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  const initialPos = loadSavedPosition(WINDOW_WIDTH, WINDOW_HEIGHT);

  petWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: initialPos.x,
    y: initialPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    focusable: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Keep floating above other standard windows on macOS
  petWindow.setAlwaysOnTop(true, 'floating', 1);
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Initialize movement controller
  movementController = new MovementController(petWindow, {
    minIdleSeconds: 6,
    maxIdleSeconds: 14,
    speedPixelsPerSecond: 65,
    onStateChange: (state) => {
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send('pet:state-changed', state);
      }
    },
    onPlatformChange: (platform) => {
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send('pet:platform-changed', platform);
      }
    },
  });

  // Setup IPC, scanner bridge, and context menu
  setupIpcHandlers(
    petWindow,
    movementController,
    isDebugInitially,
    openOrCreateCleanupWindow,
    () => cleanupWindow
  );

  // Load renderer HTML
  const rendererPath = resolveRendererHtml('pet.html');
  petWindow.loadFile(rendererPath);

  petWindow.once('ready-to-show', () => {
    if (petWindow) {
      // Find initial nearest platform (e.g. Dock or screen floor)
      const [curX, curY] = petWindow.getPosition();
      const snap = findNearestPlatform(curX, curY, WINDOW_WIDTH, WINDOW_HEIGHT);
      petWindow.setPosition(snap.snappedX, snap.snappedY);
      savePetPosition({ x: snap.snappedX, y: snap.snappedY });
      movementController?.setPlatform(snap.platform);

      petWindow.show();

      // ── Hatching birth sequence ─────────────────────────────────────────────
      // Play hatching.gif once (5040 ms, matching canonical GIF timing).
      // The BrowserWindow dimensions stay fixed at 110×88 throughout.
      // hatching.gif shares the same canvas size as idle.gif — no resize occurs.
      const HATCHING_DURATION_MS = 5040;

      movementController?.pause();
      petWindow.webContents.send('pet:state-changed', 'HATCHING');

      setTimeout(() => {
        if (petWindow && !petWindow.isDestroyed()) {
          // Seamless cut to IDLE — same 110×88 canvas, same baseline, same duck size
          petWindow.webContents.send('pet:state-changed', 'IDLE');
          movementController?.start();
        }
      }, HATCHING_DURATION_MS);
      // ───────────────────────────────────────────────────────────────────────

      if (process.argv.includes('--cycle-test')) {
        const cycle: { state: any; label: string; durationMs: number }[] = [
          { state: 'HATCHING', label: '0/8: HATCHING (hatching.gif)', durationMs: 5040 },
          { state: 'IDLE', label: '1/8: IDLE (idle.gif)', durationMs: 3000 },
          { state: 'WALK_RIGHT', label: '2/8: WALK_RIGHT (walk-right.gif)', durationMs: 3000 },
          { state: 'WALK_LEFT', label: '3/8: WALK_LEFT (walk-left.gif)', durationMs: 3000 },
          { state: 'SCANNING', label: '4/8: SCANNING (scan.gif)', durationMs: 3500 },
          { state: 'HAPPY', label: '5/8: HAPPY (happy.gif)', durationMs: 3500 },
          { state: 'THINKING', label: '6/8: THINKING (thinking.gif)', durationMs: 3500 },
          { state: 'SURPRISED', label: '7/8: SURPRISED (surprised.gif)', durationMs: 3500 },
          { state: 'IDLE', label: '✓ Cycle Complete: IDLE', durationMs: 3000 },
        ];

        let delay = 1000;
        for (const step of cycle) {
          setTimeout(() => {
            if (petWindow && !petWindow.isDestroyed() && movementController) {
              movementController.setEmotion(step.state, { durationMs: step.durationMs, force: true });
              petWindow.webContents.send('pet:show-speech', { text: `[Auto-Cycle] ${step.label}`, duration: step.durationMs - 300 });
            }
          }, delay);
          delay += step.durationMs;
        }
      }
    }
  });

  // Handle window drag/move events from OS
  petWindow.on('moved', () => {
    if (petWindow) {
      const [x, y] = petWindow.getPosition();
      savePetPosition({ x, y });
    }
  });

  petWindow.on('closed', () => {
    movementController?.stop();
    petWindow = null;
    if (cleanupWindow && !cleanupWindow.isDestroyed()) {
      cleanupWindow.close();
    }
  });
}

app.whenReady().then(() => {
  createPetWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
