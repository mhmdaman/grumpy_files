// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Reliable Platform Detection & Modeling
// ─────────────────────────────────────────────────────────────────────────────

import { screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export type PlatformType = 'DOCK' | 'MANUAL' | 'SCREEN_BOTTOM';

export interface Platform {
  id: string;
  name: string;
  type: PlatformType;
  minX: number;
  maxX: number;
  y: number; // Top Y position of the surface where duck's feet stand
  displayId: number;
  isDock: boolean;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  platform: Platform;
}

/**
 * Reads manual development platforms from ~/.grumpyduck/platforms.json if configured.
 */
export function loadManualPlatforms(): Platform[] {
  const manualFile = path.join(os.homedir(), '.grumpyduck', 'platforms.json');
  if (!fs.existsSync(manualFile)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(manualFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) => ({
      id: item.id || `manual-platform-${index + 1}`,
      name: item.name || `Manual Platform ${index + 1}`,
      type: 'MANUAL' as PlatformType,
      minX: Number(item.minX ?? item.x ?? 0),
      maxX: Number(item.maxX ?? (item.x ?? 0) + (item.width ?? 300)),
      y: Number(item.y ?? item.top ?? 500),
      displayId: Number(item.displayId ?? 0),
      isDock: false,
    }));
  } catch {
    return [];
  }
}

/**
 * Detects macOS Dock platform using real screen metrics and macOS preferences.
 */
export function detectMacOSDock(display: Electron.Display): Platform | null {
  const { bounds, workArea } = display;

  // On macOS, the difference between bounds and workArea reveals the Dock and Menu Bar.
  const topBarHeight = workArea.y - bounds.y;
  const bottomDockHeight = bounds.height - (workArea.height + topBarHeight);
  const leftDockWidth = workArea.x - bounds.x;
  const rightDockWidth = bounds.width - (workArea.width + leftDockWidth);

  // Check if Dock is at the bottom (most common macOS setup)
  if (bottomDockHeight > 10) {
    const dockTopY = workArea.y + workArea.height;
    
    // Estimate Dock width: Dock is centered at bottom
    // We can read the actual tile size if available, or use the middle 60-80% span
    let dockSpanWidth = Math.round(workArea.width * 0.7);
    try {
      if (process.platform === 'darwin') {
        const orientation = execSync('defaults read com.apple.dock orientation 2>/dev/null', { timeout: 400 })
          .toString()
          .trim();
        if (orientation && orientation !== 'bottom') {
          // Dock is pinned to left or right, not bottom
          return null;
        }
      }
    } catch {}

    const centerX = workArea.x + workArea.width / 2;
    const minX = Math.round(centerX - dockSpanWidth / 2);
    const maxX = Math.round(centerX + dockSpanWidth / 2);

    return {
      id: `display-${display.id}-dock`,
      name: 'macOS Dock',
      type: 'DOCK',
      minX,
      maxX,
      y: dockTopY,
      displayId: display.id,
      isDock: true,
    };
  }

  return null;
}

/**
 * Discovers all verified, reliable platforms (macOS Dock, configured manual platforms, and screen floor).
 * Strictly avoids fake/invented surfaces or guessing window positions.
 */
export function getAvailablePlatforms(): Platform[] {
  const platforms: Platform[] = [];
  const displays = screen.getAllDisplays();

  // 1. Detect macOS Dock on displays
  for (const display of displays) {
    const dock = detectMacOSDock(display);
    if (dock) {
      platforms.push(dock);
    }
  }

  // 2. Load explicitly configured manual platforms (for development / power users)
  const manualPlatforms = loadManualPlatforms();
  platforms.push(...manualPlatforms);

  // 3. Add reliable display work-area floor for every screen
  for (const display of displays) {
    const { x, y, width, height } = display.workArea;
    platforms.push({
      id: `display-${display.id}-floor`,
      name: `Display Floor (${display.id})`,
      type: 'SCREEN_BOTTOM',
      minX: x + 15,
      maxX: x + width - 15,
      y: y + height,
      displayId: display.id,
      isDock: false,
    });
  }

  return platforms;
}

/**
 * Finds the nearest reliable platform to a given pet drop position.
 */
export function findNearestPlatform(
  dropX: number,
  dropY: number,
  petWidth: number,
  petHeight: number,
  snapTolerance: number = 60
): SnapResult {
  const platforms = getAvailablePlatforms();
  const petFeetY = dropY + petHeight;
  const petCenterX = dropX + petWidth / 2;

  let bestPlatform: Platform | null = null;
  let minDistance = Infinity;

  // Prefer Dock or manual platforms over base screen floor if both are within snap tolerance
  for (const platform of platforms) {
    // Check horizontal overlap
    const isWithinX = petCenterX >= platform.minX - 30 && petCenterX <= platform.maxX + 30;
    if (!isWithinX) continue;

    const distY = Math.abs(petFeetY - platform.y);
    // Give slight priority bonus to Dock and Manual platforms
    const priorityBonus = platform.type === 'DOCK' ? -15 : platform.type === 'MANUAL' ? -10 : 0;
    const effectiveDistance = distY + priorityBonus;

    if (distY <= snapTolerance && effectiveDistance < minDistance) {
      minDistance = effectiveDistance;
      bestPlatform = platform;
    }
  }

  // If a platform is in snap range
  if (bestPlatform) {
    const clampedX = Math.max(
      bestPlatform.minX,
      Math.min(bestPlatform.maxX - petWidth, dropX)
    );
    const snappedY = Math.round(bestPlatform.y - petHeight);
    return {
      snappedX: clampedX,
      snappedY,
      platform: bestPlatform,
    };
  }

  // Default fallback: snap to the screen work area floor of the display containing the drop point
  const currentDisplay = screen.getDisplayMatching({
    x: dropX,
    y: dropY,
    width: petWidth,
    height: petHeight,
  });

  const floorY = currentDisplay.workArea.y + currentDisplay.workArea.height;
  const fallbackPlatform: Platform = {
    id: `display-${currentDisplay.id}-floor`,
    name: `Display Floor (${currentDisplay.id})`,
    type: 'SCREEN_BOTTOM',
    minX: currentDisplay.workArea.x + 15,
    maxX: currentDisplay.workArea.x + currentDisplay.workArea.width - 15,
    y: floorY,
    displayId: currentDisplay.id,
    isDock: false,
  };

  const clampedX = Math.max(
    fallbackPlatform.minX,
    Math.min(fallbackPlatform.maxX - petWidth, dropX)
  );
  const snappedY = Math.round(floorY - petHeight);

  return {
    snappedX: clampedX,
    snappedY,
    platform: fallbackPlatform,
  };
}
