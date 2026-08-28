// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Autonomous Desktop Movement Controller
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow, screen } from 'electron';
import { AnimationState } from './spriteConfig';
import { savePetPosition } from './positionStore';
import { SurfaceLedge } from './surfaceDetector';

export interface MovementOptions {
  minIdleSeconds?: number;
  maxIdleSeconds?: number;
  speedPixelsPerSecond?: number; // Walking speed
  onStateChange: (state: AnimationState) => void;
}

export class MovementController {
  private window: BrowserWindow;
  private minIdleTimeMs: number;
  private maxIdleTimeMs: number;
  private speedPxPerSec: number;
  private onStateChange: (state: AnimationState) => void;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private idleTimer: NodeJS.Timeout | null = null;
  private walkInterval: NodeJS.Timeout | null = null;
  private currentState: AnimationState = 'IDLE';

  // Active walking surface / ledge
  private currentLedge: SurfaceLedge | null = null;

  constructor(window: BrowserWindow, options: MovementOptions) {
    this.window = window;
    this.minIdleTimeMs = (options.minIdleSeconds ?? 4) * 1000;
    this.maxIdleTimeMs = (options.maxIdleSeconds ?? 10) * 1000;
    this.speedPxPerSec = options.speedPixelsPerSecond ?? 60;
    this.onStateChange = options.onStateChange;
  }

  public setLedge(ledge: SurfaceLedge): void {
    this.currentLedge = ledge;
  }

  public getLedge(): SurfaceLedge | null {
    return this.currentLedge;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setState('IDLE');
    this.scheduleNextWalk();
  }

  public stop(): void {
    this.isRunning = false;
    this.clearTimers();
    this.setState('IDLE');
  }

  public pause(durationMs?: number): void {
    this.isPaused = true;
    this.clearTimers();
    this.setState('IDLE');

    if (durationMs && durationMs > 0) {
      setTimeout(() => {
        if (this.isPaused && this.isRunning) {
          this.resume();
        }
      }, durationMs);
    }
  }

  public resume(): void {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.clearTimers();
    this.setState('IDLE');
    this.scheduleNextWalk();
  }

  public getCurrentState(): AnimationState {
    return this.currentState;
  }

  public setState(state: AnimationState): void {
    this.currentState = state;
    this.onStateChange(state);
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.walkInterval) {
      clearInterval(this.walkInterval);
      this.walkInterval = null;
    }
  }

  private scheduleNextWalk(): void {
    if (!this.isRunning || this.isPaused) return;

    this.clearTimers();
    // Variable lifelike idle pause duration (3s to 8s)
    const waitTime = Math.floor(
      Math.random() * (this.maxIdleTimeMs - this.minIdleTimeMs + 1) + this.minIdleTimeMs
    );

    this.idleTimer = setTimeout(() => {
      this.performWalk();
    }, waitTime);
  }

  private performWalk(): void {
    if (!this.isRunning || this.isPaused || this.window.isDestroyed()) return;

    const bounds = this.window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;

    // Horizontal bounds: constrained by current surface/widget ledge, or screen floor
    let minX = workArea.x + 15;
    let maxX = workArea.x + workArea.width - bounds.width - 15;

    if (this.currentLedge) {
      minX = Math.max(workArea.x + 10, this.currentLedge.minX);
      maxX = Math.min(workArea.x + workArea.width - bounds.width - 10, this.currentLedge.maxX - bounds.width);
    }

    // If ledge is too narrow, clamp to screen width
    if (maxX <= minX + 20) {
      minX = workArea.x + 15;
      maxX = workArea.x + workArea.width - bounds.width - 15;
    }

    const currentX = bounds.x;
    // Strict horizontal walking: maintain constant Y altitude on the surface
    const currentY = bounds.y;

    // Decide travel distance based on available surface width
    const ledgeWidth = maxX - minX;
    const maxStepDist = Math.min(ledgeWidth * 0.75, 260);

    const rand = Math.random();
    const walkDist = Math.max(35, Math.min(maxStepDist, rand < 0.6 ? 45 + Math.random() * 65 : 120 + Math.random() * 120));

    // Choose direction, turning around if close to ledge edges
    let direction = Math.random() < 0.5 ? 1 : -1;
    if (currentX <= minX + 30) {
      direction = 1; // Must walk right
    } else if (currentX >= maxX - 30) {
      direction = -1; // Must walk left
    }

    let targetX = Math.round(currentX + direction * walkDist);
    targetX = Math.max(minX, Math.min(maxX, targetX));

    const deltaX = targetX - currentX;
    const distance = Math.abs(deltaX);

    if (distance < 20) {
      this.scheduleNextWalk();
      return;
    }

    // Set walking direction
    const walkState: AnimationState = deltaX >= 0 ? 'WALK_RIGHT' : 'WALK_LEFT';
    this.setState(walkState);

    const stepIntervalMs = 16; // ~60 FPS smooth updates
    const speed = this.speedPxPerSec;
    const durationMs = (distance / speed) * 1000;
    const totalSteps = Math.max(12, Math.ceil(durationMs / stepIntervalMs));
    let step = 0;

    const startX = currentX;

    this.walkInterval = setInterval(() => {
      if (!this.isRunning || this.isPaused || this.window.isDestroyed()) {
        this.clearTimers();
        return;
      }

      step++;
      const progress = Math.min(1, step / totalSteps);

      // Smooth kinematic ease for realistic duck waddling start and stop
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newX = Math.round(startX + deltaX * eased);
      // Strictly horizontal: newY stays identical to currentY on the ledge
      const newY = currentY;

      try {
        this.window.setPosition(newX, newY);
      } catch {
        this.clearTimers();
        return;
      }

      if (progress >= 1) {
        this.clearTimers();
        savePetPosition({ x: newX, y: newY });
        this.setState('IDLE');
        this.scheduleNextWalk();
      }
    }, stepIntervalMs);
  }
}
