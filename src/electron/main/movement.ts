// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Autonomous Desktop Pet Behavior & Movement Controller
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow, screen } from 'electron';
import { AnimationState, resolveAnimationConfig } from './spriteConfig';
import { savePetPosition } from './positionStore';
import { Platform } from './platformDetector';
import { PetState, STATE_PRIORITIES } from '../../pet/PetState';

/** Default activity change interval (approx 5000 ms) */
export const ACTIVITY_INTERVAL_MS = 5000;

/** Passive idle activities that can participate in the automatic 5-second cycle */
export const PASSIVE_ACTIVITIES: readonly PetState[] = [
  'IDLE',
  'HAPPY',
  'THINKING',
  'SURPRISED',
] as const;

/** Movement activities */
export const MOVEMENT_ACTIVITIES: readonly PetState[] = [
  'WALK_LEFT',
  'WALK_RIGHT',
] as const;

/** Real event activities that must NEVER be randomly triggered */
export const REAL_EVENT_ACTIVITIES: readonly PetState[] = [
  'SCANNING',
  'WARNING',
  'INTERACTING',
  'CODING',
  'WATCHING_MOVIE',
  'SLEEPING',
] as const;

export interface MovementOptions {
  activityIntervalMs?: number;
  minIdleSeconds?: number;
  maxIdleSeconds?: number;
  speedPixelsPerSecond?: number;
  onStateChange: (state: AnimationState) => void;
  onPlatformChange?: (platform: Platform | null) => void;
}

export interface SetEmotionOptions {
  durationMs?: number;
  force?: boolean;
}

export class PetBehaviorController {
  private window: BrowserWindow;
  private activityIntervalMs: number;
  private speedPxPerSec: number;
  private onStateChange: (state: AnimationState) => void;
  private onPlatformChange?: (platform: Platform | null) => void;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isEventActive: boolean = false;
  private isWalking: boolean = false;

  private activityTimer: NodeJS.Timeout | null = null;
  private walkInterval: NodeJS.Timeout | null = null;
  private eventDurationTimer: NodeJS.Timeout | null = null;

  private currentState: PetState = 'IDLE';
  private previousState: PetState = 'IDLE';
  private recentActivities: PetState[] = [];

  // Active walking platform
  private currentPlatform: Platform | null = null;

  // Track movement direction history to promote walking in both directions
  private lastWalkDirection: 'LEFT' | 'RIGHT' = 'RIGHT';
  private stationaryCountSinceLastWalk: number = 0;

  constructor(window: BrowserWindow, options: MovementOptions) {
    this.window = window;
    this.activityIntervalMs = options.activityIntervalMs ?? ACTIVITY_INTERVAL_MS;
    this.speedPxPerSec = options.speedPixelsPerSecond ?? 45;
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
    this.isPaused = false;
    this.isEventActive = false;
    this.setState('IDLE');
    this.scheduleNextActivity(this.activityIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    this.clearAllTimers();
    this.setState('IDLE');
  }

  public pause(durationMs?: number): void {
    this.isPaused = true;
    this.clearAllTimers();
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
    this.isEventActive = false;
    this.clearAllTimers();
    this.setState('IDLE');
    this.scheduleNextActivity(this.activityIntervalMs);
  }

  public getCurrentState(): PetState {
    return this.currentState;
  }

  public getPreviousState(): PetState {
    return this.previousState;
  }

  public getStatePriority(state: PetState = this.currentState): number {
    return STATE_PRIORITIES[state] ?? 0;
  }

  public getCurrentGif(): string {
    const config = resolveAnimationConfig(this.currentState);
    return config.name;
  }

  public setState(state: PetState): void {
    this.previousState = this.currentState;
    this.currentState = state;
    this.recordActivity(state);
    this.onStateChange(state);
  }

  /**
   * Sets a prioritized emotion / real-event state on GrumpyDuck.
   * Real events (SCANNING, WARNING, etc.) will pause the 5-second automatic scheduler.
   * If a walking state is requested, physical movement is always initiated.
   */
  public setEmotion(emotion: PetState, options?: SetEmotionOptions): boolean {
    const targetPriority = STATE_PRIORITIES[emotion] ?? 0;
    const currentPriority = STATE_PRIORITIES[this.currentState] ?? 0;

    if (!options?.force && targetPriority < currentPriority) {
      return false;
    }

    // Walking states must always perform active physical movement
    if (emotion === 'WALK_LEFT' || emotion === 'WALKING_LEFT') {
      this.clearAllTimers();
      return this.startWalkMovement('LEFT', options?.durationMs);
    }
    if (emotion === 'WALK_RIGHT' || emotion === 'WALKING_RIGHT') {
      this.clearAllTimers();
      return this.startWalkMovement('RIGHT', options?.durationMs);
    }

    const isRealEvent = (REAL_EVENT_ACTIVITIES as readonly string[]).includes(emotion) || targetPriority >= 30;

    this.clearAllTimers();

    if (isRealEvent) {
      this.isEventActive = true;
    }

    this.setState(emotion);

    const config = resolveAnimationConfig(emotion);
    const duration = options?.durationMs ?? config.defaultDurationMs;

    if (duration && duration > 0) {
      this.eventDurationTimer = setTimeout(() => {
        this.isEventActive = false;
        const returnState = config.fallbackState || 'IDLE';
        this.setState(returnState);
        if (this.isRunning && !this.isPaused) {
          this.scheduleNextActivity(this.activityIntervalMs);
        }
      }, duration);
    } else if (!isRealEvent && this.isRunning && !this.isPaused) {
      this.scheduleNextActivity(this.activityIntervalMs);
    }

    return true;
  }

  /**
   * Clears all running intervals, timeouts, and active walks.
   * Guarantees that if a walk is aborted, the state never remains in WALK_LEFT or WALK_RIGHT.
   */
  private clearAllTimers(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.walkInterval) {
      clearInterval(this.walkInterval);
      this.walkInterval = null;
      this.isWalking = false;
      if (this.currentState === 'WALK_LEFT' || this.currentState === 'WALK_RIGHT' || this.currentState === 'WALKING_LEFT' || this.currentState === 'WALKING_RIGHT') {
        this.setState('IDLE');
      }
    }
    if (this.eventDurationTimer) {
      clearTimeout(this.eventDurationTimer);
      this.eventDurationTimer = null;
    }
  }

  /**
   * Schedules the next automatic activity after the given delay (default ~5000 ms).
   */
  private scheduleNextActivity(delayMs: number = this.activityIntervalMs): void {
    if (!this.isRunning || this.isPaused || this.isEventActive) return;

    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }

    // Add slight natural variation (4700ms - 5300ms) around the 5000ms target
    const jitter = Math.floor((Math.random() - 0.5) * 600);
    const finalDelay = Math.max(3000, delayMs + jitter);

    this.activityTimer = setTimeout(() => {
      this.executeNextAutomaticActivity();
    }, finalDelay);
  }

  /**
   * Executes the next automatic passive activity or walk.
   */
  private executeNextAutomaticActivity(): void {
    if (!this.isRunning || this.isPaused || this.isEventActive || this.window.isDestroyed()) return;

    // If a walk is currently in progress, wait for it to complete
    if (this.isWalking) {
      this.scheduleNextActivity(1000);
      return;
    }

    // Decide whether to perform movement or a stationary passive emotion.
    // Ensure duck walks regularly so it doesn't remain stationary indefinitely.
    const shouldWalk =
      this.stationaryCountSinceLastWalk >= 2 ||
      (this.stationaryCountSinceLastWalk >= 1 && Math.random() < 0.6) ||
      Math.random() < 0.45;

    if (shouldWalk) {
      const walkSuccess = this.performAutomaticWalk();
      if (walkSuccess) {
        this.stationaryCountSinceLastWalk = 0;
        return;
      }
    }

    // Select a passive stationary activity avoiding recent repetition
    this.performPassiveEmotion();
  }

  /**
   * Selects and plays a passive stationary emotion.
   */
  private performPassiveEmotion(): void {
    const candidatePool = PASSIVE_ACTIVITIES.filter(
      (act) => act !== this.currentState && !this.recentActivities.slice(-2).includes(act)
    );

    const pool = candidatePool.length > 0 ? candidatePool : PASSIVE_ACTIVITIES.filter((act) => act !== this.currentState);
    const chosen = pool[Math.floor(Math.random() * pool.length)] || 'IDLE';

    this.stationaryCountSinceLastWalk++;
    this.setState(chosen);
    this.scheduleNextActivity(this.activityIntervalMs);
  }

  /**
   * Performs automatic kinematic walking movement across the current platform.
   * Returns true if walking successfully started.
   */
  private performAutomaticWalk(): boolean {
    if (this.window.isDestroyed()) return false;

    const bounds = this.window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;

    let minX = workArea.x + 10;
    let maxX = workArea.x + workArea.width - bounds.width - 10;

    if (this.currentPlatform) {
      minX = Math.max(workArea.x + 10, this.currentPlatform.minX);
      maxX = Math.min(
        workArea.x + workArea.width - bounds.width - 10,
        this.currentPlatform.maxX - bounds.width
      );
    }

    if (maxX <= minX + 25) {
      minX = workArea.x + 10;
      maxX = workArea.x + workArea.width - bounds.width - 10;
    }

    const currentX = bounds.x;
    const availableLeft = currentX - minX;
    const availableRight = maxX - currentX;

    // Pick direction: reverse if near edges, otherwise balance left and right
    let direction: 'LEFT' | 'RIGHT';
    if (availableRight < 35) {
      direction = 'LEFT';
    } else if (availableLeft < 35) {
      direction = 'RIGHT';
    } else {
      direction = this.lastWalkDirection === 'RIGHT' ? 'LEFT' : 'RIGHT';
      if (Math.random() < 0.25) {
        direction = direction === 'LEFT' ? 'RIGHT' : 'LEFT';
      }
    }

    const availableInDirection = direction === 'RIGHT' ? availableRight : availableLeft;
    if (availableInDirection < 25) {
      return false; // Insufficient room to walk safely
    }

    this.lastWalkDirection = direction;
    return this.startWalkMovement(direction);
  }

  /**
   * Starts physical window movement in the specified direction while showing walk GIF.
   * Guarantees that while showing walk-left.gif or walk-right.gif, the pet is ALWAYS moving.
   * When movement finishes, state transitions immediately to IDLE / next activity.
   */
  public startWalkMovement(direction: 'LEFT' | 'RIGHT', requestedDurationMs?: number): boolean {
    if (this.window.isDestroyed()) return false;

    this.clearAllTimers();

    const bounds = this.window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;

    let minX = workArea.x + 10;
    let maxX = workArea.x + workArea.width - bounds.width - 10;

    if (this.currentPlatform) {
      minX = Math.max(workArea.x + 10, this.currentPlatform.minX);
      maxX = Math.min(
        workArea.x + workArea.width - bounds.width - 10,
        this.currentPlatform.maxX - bounds.width
      );
    }

    if (maxX <= minX + 25) {
      minX = workArea.x + 10;
      maxX = workArea.x + workArea.width - bounds.width - 10;
    }

    const currentX = bounds.x;
    const currentY = bounds.y;
    let availableLeft = currentX - minX;
    let availableRight = maxX - currentX;

    let finalDirection = direction;

    // Reversal if edge is reached
    if (finalDirection === 'RIGHT' && availableRight < 25) {
      if (availableLeft >= 25) {
        finalDirection = 'LEFT';
      } else {
        // Nowhere to move, remain stationary as IDLE (never show walk GIF while stationary)
        this.setState('IDLE');
        if (this.isRunning && !this.isPaused) {
          this.scheduleNextActivity(this.activityIntervalMs);
        }
        return false;
      }
    } else if (finalDirection === 'LEFT' && availableLeft < 25) {
      if (availableRight >= 25) {
        finalDirection = 'RIGHT';
      } else {
        this.setState('IDLE');
        if (this.isRunning && !this.isPaused) {
          this.scheduleNextActivity(this.activityIntervalMs);
        }
        return false;
      }
    }

    const available = finalDirection === 'RIGHT' ? (maxX - currentX) : (currentX - minX);
    if (available < 20) {
      this.setState('IDLE');
      if (this.isRunning && !this.isPaused) {
        this.scheduleNextActivity(this.activityIntervalMs);
      }
      return false;
    }

    // Calculate travel distance
    const targetTravel = Math.min(available * 0.85, 45 * 4.5);
    const distance = Math.max(25, Math.min(available, targetTravel));

    const targetX = finalDirection === 'RIGHT'
      ? Math.round(currentX + distance)
      : Math.round(currentX - distance);

    const deltaX = targetX - currentX;
    const actualDistance = Math.abs(deltaX);

    if (actualDistance < 15) {
      this.setState('IDLE');
      if (this.isRunning && !this.isPaused) {
        this.scheduleNextActivity(this.activityIntervalMs);
      }
      return false;
    }

    // Set walking state and begin kinematic motion
    const walkState: PetState = finalDirection === 'RIGHT' ? 'WALK_RIGHT' : 'WALK_LEFT';
    this.isWalking = true;
    this.setState(walkState);

    const walkDurationMs = requestedDurationMs
      ? Math.max(1000, requestedDurationMs)
      : Math.min(4600, Math.max(2500, (actualDistance / this.speedPxPerSec) * 1000));

    const stepIntervalMs = 16;
    const totalSteps = Math.max(15, Math.ceil(walkDurationMs / stepIntervalMs));
    let step = 0;
    const startX = currentX;

    this.walkInterval = setInterval(() => {
      if (!this.isRunning || this.isPaused || this.isEventActive || this.window.isDestroyed()) {
        if (this.walkInterval) clearInterval(this.walkInterval);
        this.walkInterval = null;
        this.isWalking = false;
        if (this.currentState === 'WALK_LEFT' || this.currentState === 'WALK_RIGHT') {
          this.setState('IDLE');
        }
        return;
      }

      step++;
      const progress = Math.min(1, step / totalSteps);

      // Smooth kinematic easing (easeInOutQuad)
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newX = Math.round(startX + deltaX * eased);
      const newY = currentY;

      try {
        this.window.setPosition(newX, newY);
      } catch {
        if (this.walkInterval) clearInterval(this.walkInterval);
        this.walkInterval = null;
        this.isWalking = false;
        this.setState('IDLE');
        return;
      }

      if (progress >= 1) {
        if (this.walkInterval) clearInterval(this.walkInterval);
        this.walkInterval = null;
        this.isWalking = false;
        savePetPosition({ x: newX, y: newY });

        // Walk completed: immediately transition to IDLE so the duck is never stationary with walk GIF
        this.setState('IDLE');

        // Schedule next activity
        const remainingDelay = Math.max(600, this.activityIntervalMs - walkDurationMs);
        this.scheduleNextActivity(remainingDelay);
      }
    }, stepIntervalMs);

    return true;
  }

  /**
   * Tracks recent activities to prevent immediate repetition.
   */
  private recordActivity(activity: PetState): void {
    this.recentActivities.push(activity);
    if (this.recentActivities.length > 6) {
      this.recentActivities.shift();
    }
  }
}

/** Export alias for backward compatibility across all imports */
export const MovementController = PetBehaviorController;
export type MovementController = PetBehaviorController;
