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


const WINDOW_WIDTH = 130;
const WINDOW_HEIGHT = 120;

const isDebugInitially = process.argv.includes('--debug') || process.env.GRUMPYDUCK_DEBUG === '1';

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
      // Start autonomous movement cycle
      movementController?.start();
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
