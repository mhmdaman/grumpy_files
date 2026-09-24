/**
 * The behaviour states understood by the desktop-pet domain.
 */
export const PET_STATES = [
  'IDLE',
  'WALK_LEFT',
  'WALK_RIGHT',
  'WALKING_LEFT',
  'WALKING_RIGHT',
  'SCANNING',
  'HAPPY',
  'SURPRISED',
  'THINKING',
  'INTERACTING',
  'SLEEPING',
  'CODING',
  'WATCHING_MOVIE',
  'WARNING',
] as const;

/** A valid behaviour state for GrumpyDuck. */
export type PetState = (typeof PET_STATES)[number];

/** Horizontal direction used by the walking states. */
export type WalkingDirection = 'LEFT' | 'RIGHT';

/** State priority levels (higher priority overrides lower priority). */
export const STATE_PRIORITIES: Record<PetState, number> = {
  WARNING: 50,
  INTERACTING: 40,
  SURPRISED: 40,
  SCANNING: 30,
  HAPPY: 20,
  THINKING: 20,
  WALK_LEFT: 10,
  WALK_RIGHT: 10,
  WALKING_LEFT: 10,
  WALKING_RIGHT: 10,
  CODING: 5,
  WATCHING_MOVIE: 5,
  IDLE: 0,
  SLEEPING: 0,
};

/**
 * Returns whether an arbitrary value is one of the supported pet states.
 */
export function isPetState(value: unknown): value is PetState {
  return typeof value === 'string' && (PET_STATES as readonly string[]).includes(value as PetState);
}

/** Returns true only while the pet is actively walking. */
export function isWalkingState(state: PetState): boolean {
  return (
    state === 'WALK_LEFT' ||
    state === 'WALK_RIGHT' ||
    state === 'WALKING_LEFT' ||
    state === 'WALKING_RIGHT'
  );
}

/**
 * Gets the walking direction represented by a state, if it has one.
 */
export function getWalkingDirection(state: PetState): WalkingDirection | null {
  switch (state) {
    case 'WALK_LEFT':
    case 'WALKING_LEFT':
      return 'LEFT';
    case 'WALK_RIGHT':
    case 'WALKING_RIGHT':
      return 'RIGHT';
    default:
      return null;
  }
}

/** Selects the walking state for a horizontal direction. */
export function getWalkingState(direction: WalkingDirection): PetState {
  return direction === 'LEFT' ? 'WALK_LEFT' : 'WALK_RIGHT';
}

