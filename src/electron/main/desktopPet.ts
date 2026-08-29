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

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let petWindow: BrowserWindow | null = null;
let movementController: MovementController | null = null;

const WINDOW_WIDTH = 130;
const WINDOW_HEIGHT = 120;

const isDebugInitially = process.argv.includes('--debug') || process.env.GRUMPYDUCK_DEBUG === '1';

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
  setupIpcHandlers(petWindow, movementController, isDebugInitially);

  // Load renderer HTML
  let rendererPath = path.resolve(__dirname, '../renderer/pet.html');
  if (!fs.existsSync(rendererPath)) {
    rendererPath = path.resolve(__dirname, '../../../src/electron/renderer/pet.html');
  }
  if (!fs.existsSync(rendererPath)) {
    rendererPath = path.join(app.getAppPath(), 'src/electron/renderer/pet.html');
  }
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
