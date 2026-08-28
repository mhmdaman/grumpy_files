// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Autonomous Desktop Movement Controller
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow, screen } from 'electron';
import { AnimationState } from './spriteConfig';
import { savePetPosition } from './positionStore';

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

  constructor(window: BrowserWindow, options: MovementOptions) {
    this.window = window;
    this.minIdleTimeMs = (options.minIdleSeconds ?? 5) * 1000;
    this.maxIdleTimeMs = (options.maxIdleSeconds ?? 15) * 1000;
    this.speedPxPerSec = options.speedPixelsPerSecond ?? 70;
    this.onStateChange = options.onStateChange;
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
    // Variable lifelike idle pause duration (3.5s to 9s)
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

    // Safety margins from screen edges
    const marginX = 25;
    const minX = workArea.x + marginX;
    const maxX = workArea.x + workArea.width - bounds.width - marginX;

    // Natural desktop "floor" roaming zone: bottom region of display
    const bottomFloorY = workArea.y + workArea.height - bounds.height - 35;
    const minY = Math.max(workArea.y + marginX, bottomFloorY - 140);
    const maxY = bottomFloorY;

    const currentX = bounds.x;
    const currentY = bounds.y;

    // Decide travel distance based on natural duck behavior:
    // 60% short micro-waddle (50-130px), 30% medium explore (140-280px), 10% cross-desk patrol (300-500px)
    const rand = Math.random();
    let walkDist = rand < 0.6
      ? 50 + Math.random() * 80
      : rand < 0.9
      ? 140 + Math.random() * 140
      : 300 + Math.random() * 200;

    // Direction: pick left or right, biasing away from screen edges
    let direction = Math.random() < 0.5 ? 1 : -1;
    if (currentX < minX + 150) {
      direction = 1; // Walk right if too close to left edge
    } else if (currentX > maxX - 150) {
      direction = -1; // Walk left if too close to right edge
    }

    let targetX = Math.round(currentX + direction * walkDist);
    targetX = Math.max(minX, Math.min(maxX, targetX));

    // Ducks primarily stay near the bottom desk floor with gentle micro-hops
    // Target Y stays near ground or shifts slightly by ±15px
    let targetY = Math.round(currentY + (Math.random() * 30 - 15));
    // If pet drifted up, bias it back towards ground floor
    if (currentY < bottomFloorY - 60) {
      targetY += 35;
    }
    targetY = Math.max(minY, Math.min(maxY, targetY));

    const deltaX = targetX - currentX;
    const deltaY = targetY - currentY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 25) {
      this.scheduleNextWalk();
      return;
    }

    // Set walking direction
    const walkState: AnimationState = deltaX >= 0 ? 'WALK_RIGHT' : 'WALK_LEFT';
    this.setState(walkState);

    const stepIntervalMs = 16; // ~60 FPS smooth updates
    // Variable natural walking speed (approx 55-75 px/s with slight variation)
    const speed = this.speedPxPerSec * (0.85 + Math.random() * 0.3);
    const durationMs = (distance / speed) * 1000;
    const totalSteps = Math.max(15, Math.ceil(durationMs / stepIntervalMs));
    let step = 0;

    const startX = currentX;
    const startY = currentY;

    this.walkInterval = setInterval(() => {
      if (!this.isRunning || this.isPaused || this.window.isDestroyed()) {
        this.clearTimers();
        return;
      }

      step++;
      const progress = Math.min(1, step / totalSteps);

      // Organic ease-in-out curve with subtle footstep momentum
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Realistic duck waddle: subtle horizontal footstep modulation
      const footstepWaddle = Math.sin(progress * Math.PI * (distance / 25)) * 0.8;

      const newX = Math.round(startX + deltaX * eased);
      const newY = Math.round(startY + deltaY * eased + footstepWaddle);

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
