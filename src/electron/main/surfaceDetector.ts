// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — macOS Widget & Window Surface Ledge Detection
// ─────────────────────────────────────────────────────────────────────────────

import { screen } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SurfaceLedge {
  id: string;
  name: string;
  owner: string;
  minX: number;
  maxX: number;
  y: number; // Top Y position of the surface where duck's feet stand
  isWidget: boolean;
}

/**
 * Queries on-screen windows and widgets using macOS Quartz CoreGraphics.
 */
export async function getOnScreenSurfaces(): Promise<SurfaceLedge[]> {
  const surfaces: SurfaceLedge[] = [];

  // 1. Add bottom floor ledges for all connected displays
  for (const display of screen.getAllDisplays()) {
    const { x, y, width, height } = display.workArea;
    surfaces.push({
      id: `display-${display.id}-floor`,
      name: 'Desktop Surface',
      owner: 'Desktop',
      minX: x + 10,
      maxX: x + width - 10,
      y: y + height - 10,
      isWidget: false,
    });
  }

  // 2. Query visible application windows and widgets on macOS
  if (process.platform === 'darwin') {
    try {
      const pythonScript = `
import Quartz, json

options = Quartz.kCGWindowListOptionOnScreenOnly
window_list = Quartz.CGWindowListCopyWindowInfo(options, Quartz.kCGNullWindowID)
results = []

for w in window_list:
    owner = w.get(Quartz.kCGWindowOwnerName, '') or ''
    name = w.get(Quartz.kCGWindowName, '') or ''
    layer = w.get(Quartz.kCGWindowLayer, 0)
    bounds = w.get(Quartz.kCGWindowBounds, {})
    if not bounds:
        continue
        
    width = bounds.get('Width', 0)
    height = bounds.get('Height', 0)
    x = bounds.get('X', 0)
    y = bounds.get('Y', 0)
    
    # Filter out tiny overlays, menubar icons, or full-screen desktop backdrops
    if width >= 120 and height >= 60 and layer == 0 and owner != 'GrumpyDuck' and owner != 'Window Server':
        is_widget = 'widget' in owner.lower() or 'widget' in name.lower() or 'notification' in owner.lower()
        results.append({
            'owner': owner,
            'name': name,
            'x': x,
            'y': y,
            'width': width,
            'height': height,
            'isWidget': is_widget
        })

print(json.dumps(results))
`;
      const { stdout } = await execFileAsync('python3', ['-c', pythonScript], { timeout: 1500 });
      if (stdout && stdout.trim()) {
        const rawWindows = JSON.parse(stdout.trim());
        for (let i = 0; i < rawWindows.length; i++) {
          const w = rawWindows[i];
          surfaces.push({
            id: `window-${w.owner}-${i}`,
            name: w.name || w.owner,
            owner: w.owner,
            minX: Math.round(w.x),
            maxX: Math.round(w.x + w.width),
            y: Math.round(w.y), // Top edge of the window/widget
            isWidget: w.isWidget,
          });
        }
      }
    } catch {
      // Quartz query fallback is safe; display floor ledges are already present
    }
  }

  return surfaces;
}

/**
 * Finds the closest walkable surface ledge for a given pet drop position.
 * Returns the snapped position and the matching surface ledge.
 */
export async function findNearestLedge(
  dropX: number,
  dropY: number,
  petWidth: number,
  petHeight: number,
  snapTolerance: number = 45
): Promise<{ snappedX: number; snappedY: number; ledge: SurfaceLedge }> {
  const surfaces = await getOnScreenSurfaces();
  const petBottomY = dropY + petHeight;
  const petCenterX = dropX + petWidth / 2;

  let bestLedge: SurfaceLedge | null = null;
  let minDistance = Infinity;

  for (const surface of surfaces) {
    // Check if pet horizontal position is within surface horizontal span (with slight margin)
    const isWithinX = petCenterX >= surface.minX - 25 && petCenterX <= surface.maxX + 25;
    if (!isWithinX) continue;

    // Vertical distance from pet feet to surface top edge
    const distY = Math.abs(petBottomY - surface.y);
    if (distY <= snapTolerance && distY < minDistance) {
      minDistance = distY;
      bestLedge = surface;
    }
  }

  // If snapped to a surface
  if (bestLedge && minDistance <= snapTolerance) {
    const clampedX = Math.max(bestLedge.minX, Math.min(bestLedge.maxX - petWidth, dropX));
    const snappedY = Math.round(bestLedge.y - petHeight);
    return {
      snappedX: clampedX,
      snappedY,
      ledge: bestLedge,
    };
  }

  // Fallback: use current position as an arbitrary custom surface plane
  const currentDisplay = screen.getDisplayMatching({
    x: dropX,
    y: dropY,
    width: petWidth,
    height: petHeight,
  });
  const fallbackLedge: SurfaceLedge = {
    id: 'custom-plane',
    name: 'Current Surface',
    owner: 'Custom',
    minX: currentDisplay.workArea.x + 15,
    maxX: currentDisplay.workArea.x + currentDisplay.workArea.width - 15,
    y: petBottomY,
    isWidget: false,
  };

  return {
    snappedX: dropX,
    snappedY: dropY,
    ledge: fallbackLedge,
  };
}
