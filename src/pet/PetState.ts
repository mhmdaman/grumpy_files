/**
 * The behaviour states understood by the desktop-pet domain.
 *
 * These are deliberately independent from renderer asset names. For example,
 * a renderer may choose to display its idle animation while the pet is in a
 * `THINKING` state until a dedicated animation is available.
 */
export const PET_STATES = [
  'IDLE',
  'WALKING_LEFT',
  'WALKING_RIGHT',
  'SCANNING',
  'THINKING',
  'INTERACTING',
] as const;

/** A valid behaviour state for GrumpyDuck. */
export type PetState = (typeof PET_STATES)[number];

/** Horizontal direction used by the two walking states. */
export type WalkingDirection = 'LEFT' | 'RIGHT';

/**
 * Returns whether an arbitrary value is one of the supported pet states.
 * Useful at IPC and persistence boundaries where values are not statically
 * typed.
 */
export function isPetState(value: unknown): value is PetState {
  return typeof value === 'string' && (PET_STATES as readonly string[]).includes(value);
}

/** Returns true only while the pet is actively walking. */
export function isWalkingState(state: PetState): boolean {
  return state === 'WALKING_LEFT' || state === 'WALKING_RIGHT';
}

/**
 * Gets the walking direction represented by a state, if it has one.
 */
export function getWalkingDirection(state: PetState): WalkingDirection | null {
  switch (state) {
    case 'WALKING_LEFT':
      return 'LEFT';
    case 'WALKING_RIGHT':
      return 'RIGHT';
    default:
      return null;
  }
}

/** Selects the walking state for a horizontal direction. */
export function getWalkingState(direction: WalkingDirection): PetState {
  return direction === 'LEFT' ? 'WALKING_LEFT' : 'WALKING_RIGHT';
}
