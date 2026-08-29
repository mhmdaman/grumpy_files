// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Central GIF Animation Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimationConfig {
  name: string;
  relativePath: string;
  loop: boolean;
  type: 'gif';
}

export type AnimationState = 'IDLE' | 'WALK_LEFT' | 'WALK_RIGHT' | 'SCANNING';

export const SPRITE_CONFIGS: Record<AnimationState, AnimationConfig> = {
  IDLE: {
    name: 'idle',
    relativePath: 'assets/grumpyduck/idle.gif',
    loop: true,
    type: 'gif',
  },
  WALK_LEFT: {
    name: 'walk-left',
    relativePath: 'assets/grumpyduck/walk-left.gif',
    loop: true,
    type: 'gif',
  },
  WALK_RIGHT: {
    name: 'walk-right',
    relativePath: 'assets/grumpyduck/walk-right.gif',
    loop: true,
    type: 'gif',
  },
  SCANNING: {
    name: 'scan',
    relativePath: 'assets/grumpyduck/scan.gif',
    loop: true,
    type: 'gif',
  },
};
