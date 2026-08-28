// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Pet Position Persistence & Multi-Monitor Bounds Safety
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { screen } from 'electron';

export interface PetPosition {
  x: number;
  y: number;
}

const CONFIG_DIR = path.join(os.homedir(), '.grumpyduck');
const POSITION_FILE = path.join(CONFIG_DIR, 'pet-position.json');

/**
 * Ensures the config directory exists.
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    } catch {
      // Ignore if already created
    }
  }
}

/**
 * Validates whether the given point (x, y) is inside the workArea of any connected display.
 */
export function isPositionInsideAnyDisplay(x: number, y: number, width: number, height: number): boolean {
  const displays = screen.getAllDisplays();
  for (const display of displays) {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    // Check if at least 50% of the window is inside the display workArea
    const isWithinX = x + width * 0.5 >= dx && x + width * 0.5 <= dx + dw;
    const isWithinY = y + height * 0.5 >= dy && y + height * 0.5 <= dy + dh;
    if (isWithinX && isWithinY) {
      return true;
    }
  }
  return false;
}

/**
 * Computes default position: bottom-right area of primary display.
 */
export function getDefaultPosition(windowWidth: number, windowHeight: number): PetPosition {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  // 40px margin from bottom and right
  const posX = Math.round(x + width - windowWidth - 60);
  const posY = Math.round(y + height - windowHeight - 40);

  return { x: posX, y: posY };
}

/**
 * Loads last saved position or returns safe default.
 */
export function loadSavedPosition(windowWidth: number, windowHeight: number): PetPosition {
  try {
    if (fs.existsSync(POSITION_FILE)) {
      const raw = fs.readFileSync(POSITION_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        if (isPositionInsideAnyDisplay(parsed.x, parsed.y, windowWidth, windowHeight)) {
          return { x: parsed.x, y: parsed.y };
        }
      }
    }
  } catch {
    // If corrupted or read failed, fall through to default
  }

  return getDefaultPosition(windowWidth, windowHeight);
}

/**
 * Saves the pet position to local disk.
 */
export function savePetPosition(pos: PetPosition): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(POSITION_FILE, JSON.stringify(pos, null, 2), 'utf-8');
  } catch {
    // Ignore non-fatal write errors
  }
}
