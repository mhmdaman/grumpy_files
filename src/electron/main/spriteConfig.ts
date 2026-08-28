// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Central Sprite Animation Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface SpriteAnimationConfig {
  name: string;
  relativePath: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
}

export type AnimationState = 'IDLE' | 'WALK_LEFT' | 'WALK_RIGHT' | 'SCANNING';

export const SPRITE_CONFIGS: Record<AnimationState, SpriteAnimationConfig> = {
  IDLE: {
    name: 'idle',
    relativePath: 'assets/grumpyduck/idle.png',
    frameCount: 8,
    frameWidth: 347,
    frameHeight: 368,
    fps: 6,
    loop: true,
  },
  WALK_LEFT: {
    name: 'walk-left',
    relativePath: 'assets/grumpyduck/walk-left.png',
    frameCount: 8,
    frameWidth: 366,
    frameHeight: 352,
    fps: 8,
    loop: true,
  },
  WALK_RIGHT: {
    name: 'walk-right',
    relativePath: 'assets/grumpyduck/walk-right.png',
    frameCount: 8,
    frameWidth: 366,
    frameHeight: 352,
    fps: 8,
    loop: true,
  },
  SCANNING: {
    name: 'scan',
    relativePath: 'assets/grumpyduck/scan.png',
    frameCount: 8,
    frameWidth: 366,
    frameHeight: 352,
    fps: 6,
    loop: true,
  },
};
