// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Central GIF Animation & Emotion Registry
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { PetState, STATE_PRIORITIES } from '../../pet/PetState';

export interface AnimationConfig {
  name: string;
  relativePath: string;
  loop: boolean;
  type: 'gif';
  priority: number;
  movementAllowed: boolean;
  defaultDurationMs?: number;
  fallbackState?: PetState;
}

export type AnimationState = PetState;

export const SPRITE_CONFIGS: Record<string, AnimationConfig> = {
  HATCHING: {
    name: 'hatching',
    relativePath: 'assets/grumpyduck/hatching.gif',
    loop: false,
    type: 'gif',
    priority: STATE_PRIORITIES.HATCHING,
    movementAllowed: false,
    defaultDurationMs: 5040,
    fallbackState: 'IDLE',
  },
  IDLE: {
    name: 'idle',
    relativePath: 'assets/grumpyduck/idle.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.IDLE,
    movementAllowed: true,
  },
  WALK_LEFT: {
    name: 'walk-left',
    relativePath: 'assets/grumpyduck/walk-left.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.WALK_LEFT,
    movementAllowed: true,
    fallbackState: 'IDLE',
  },
  WALK_RIGHT: {
    name: 'walk-right',
    relativePath: 'assets/grumpyduck/walk-right.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.WALK_RIGHT,
    movementAllowed: true,
    fallbackState: 'IDLE',
  },
  WALKING_LEFT: {
    name: 'walk-left',
    relativePath: 'assets/grumpyduck/walk-left.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.WALKING_LEFT,
    movementAllowed: true,
    fallbackState: 'IDLE',
  },
  WALKING_RIGHT: {
    name: 'walk-right',
    relativePath: 'assets/grumpyduck/walk-right.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.WALKING_RIGHT,
    movementAllowed: true,
    fallbackState: 'IDLE',
  },
  SCANNING: {
    name: 'scan',
    relativePath: 'assets/grumpyduck/scan.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.SCANNING,
    movementAllowed: false,
    fallbackState: 'IDLE',
  },
  HAPPY: {
    name: 'happy',
    relativePath: 'assets/grumpyduck/happy.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.HAPPY,
    movementAllowed: false,
    defaultDurationMs: 3500,
    fallbackState: 'IDLE',
  },
  SURPRISED: {
    name: 'surprised',
    relativePath: 'assets/grumpyduck/surprised.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.SURPRISED,
    movementAllowed: false,
    defaultDurationMs: 2200,
    fallbackState: 'IDLE',
  },
  INTERACTING: {
    name: 'surprised',
    relativePath: 'assets/grumpyduck/surprised.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.INTERACTING,
    movementAllowed: false,
    defaultDurationMs: 2200,
    fallbackState: 'IDLE',
  },
  THINKING: {
    name: 'thinking',
    relativePath: 'assets/grumpyduck/thinking.gif',
    loop: true,
    type: 'gif',
    priority: STATE_PRIORITIES.THINKING,
    movementAllowed: false,
    defaultDurationMs: 4000,
    fallbackState: 'IDLE',
  },
};

/**
 * Resolves the AnimationConfig for a given state, falling back to IDLE
 * with a warning log if the asset or state is unavailable.
 */
export function resolveAnimationConfig(state: string, basePath: string = process.cwd()): AnimationConfig {
  const normalizedKey = (state || 'IDLE').toUpperCase();
  const candidate = SPRITE_CONFIGS[normalizedKey];

  if (candidate) {
    const fullPath = path.resolve(basePath, candidate.relativePath);
    if (fs.existsSync(fullPath)) {
      return candidate;
    }
  }

  console.warn(`Animation unavailable: ${state}, falling back to idle.`);
  return SPRITE_CONFIGS.IDLE;
}

