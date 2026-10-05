/**
 * The behaviour states understood by the desktop-pet domain.
 */
export const PET_STATES = [
  'IDLE',
  'HATCHING',
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

/** State priority levels (higher priority overrides lower priority). */
export const STATE_PRIORITIES: Record<PetState, number> = {
  HATCHING: 60,  // birth sequence — cannot be interrupted
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
