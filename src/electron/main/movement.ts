// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Autonomous Desktop Movement Controller
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow, screen } from 'electron';
import { AnimationState } from './spriteConfig';
import { savePetPosition } from './positionStore';
import { Platform } from './platformDetector';

export interface MovementOptions {
  minIdleSeconds?: number;
  maxIdleSeconds?: number;
  speedPixelsPerSecond?: number;
  onStateChange: (state: AnimationState) => void;
  onPlatformChange?: (platform: Platform | null) => void;
}

export class MovementController {
  private window: BrowserWindow;
  private minIdleTimeMs: number;
  private maxIdleTimeMs: number;
  private speedPxPerSec: number;
  private onStateChange: (state: AnimationState) => void;
  private onPlatformChange?: (platform: Platform | null) => void;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private idleTimer: NodeJS.Timeout | null = null;
  private walkInterval: NodeJS.Timeout | null = null;
  private currentState: AnimationState = 'IDLE';

  // Active walking platform
  private currentPlatform: Platform | null = null;

  constructor(window: BrowserWindow, options: MovementOptions) {
    this.window = window;
    this.minIdleTimeMs = (options.minIdleSeconds ?? 5) * 1000;
    this.maxIdleTimeMs = (options.maxIdleSeconds ?? 12) * 1000;
    this.speedPxPerSec = options.speedPixelsPerSecond ?? 60;
    this.onStateChange = options.onStateChange;
    this.onPlatformChange = options.onPlatformChange;
  }

  public setPlatform(platform: Platform): void {
    this.currentPlatform = platform;
    this.onPlatformChange?.(platform);
  }

  public getPlatform(): Platform | null {
    return this.currentPlatform;
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

    let minX = workArea.x + 15;
    let maxX = workArea.x + workArea.width - bounds.width - 15;

    if (this.currentPlatform) {
      minX = Math.max(workArea.x + 10, this.currentPlatform.minX);
      maxX = Math.min(
        workArea.x + workArea.width - bounds.width - 10,
        this.currentPlatform.maxX - bounds.width
      );
    }

    // Safety fallback if platform bounds are inverted
    if (maxX <= minX + 20) {
      minX = workArea.x + 15;
      maxX = workArea.x + workArea.width - bounds.width - 15;
    }

    const currentX = bounds.x;
    const currentY = bounds.y;

    const platformWidth = maxX - minX;
    const maxTravel = Math.min(platformWidth * 0.7, 240);

    const rand = Math.random();
    const travelDist = Math.max(
      35,
      Math.min(maxTravel, rand < 0.6 ? 50 + Math.random() * 60 : 110 + Math.random() * 110)
    );

    // Pick direction, reversing if close to edges
    let direction = Math.random() < 0.5 ? 1 : -1;
    if (currentX <= minX + 25) {
      direction = 1;
    } else if (currentX >= maxX - 25) {
      direction = -1;
    }

    let targetX = Math.round(currentX + direction * travelDist);
    targetX = Math.max(minX, Math.min(maxX, targetX));

    const deltaX = targetX - currentX;
    const distance = Math.abs(deltaX);

    if (distance < 15) {
      this.scheduleNextWalk();
      return;
    }

    // Set walking direction
    const walkState: AnimationState = deltaX >= 0 ? 'WALK_RIGHT' : 'WALK_LEFT';
    this.setState(walkState);

    const stepIntervalMs = 16;
    const durationMs = (distance / this.speedPxPerSec) * 1000;
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

      // Smooth kinematic easing
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newX = Math.round(startX + deltaX * eased);
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
