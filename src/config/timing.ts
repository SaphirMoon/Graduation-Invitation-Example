/**
 * DURATIONS — in seconds.
 * Prologue phases (3D version) run back to back in the order below.
 * Every step inside a phase is a fraction of that phase's duration,
 * so changing one number stretches or shrinks the whole phase.
 */
export const PROLOGUE_TIMING = {
  /** Curtains gather to the sides; the camera starts its dolly-in */
  curtain: 1.4,
  /** Camera glides through the valley, mountains drift in parallax, white moon brightens */
  flight: 2.4,
  /** Light cone from the moon onto the crystal */
  beam: 1.4,
  /** Crystal flashes, shakes, flies up a curved path; camera tilts up after it */
  crystal: 2.5,
  /**
   * Shatter, shards orbit the moon 2–3 laps then dive in, moon/fog/beams turn sapphire.
   * Must stay longer than the shard choreography (SPIRAL in prologueTimeline.ts) + ~0.4 s.
   */
  shatter: 3.2,
  /** Camera settles on the hill; blue beam; stick figure assembles */
  reveal: 1.6,
  /** Wave, speech bubble types out, Next button */
  greet: 2,
} as const;

export type ProloguePhase = keyof typeof PROLOGUE_TIMING;

/** Total length of the short version used with prefers-reduced-motion. */
export const REDUCED_TOTAL = 2.5;

/* ---- Flat (SVG fallback, no WebGL) version ---- */

export const SCENE1_TIMING = {
  curtain: 1.5,
  sky: 1.5,
  beam: 1.5,
  crystal: 2.5,
  shatter: 1.5,
  reveal: 1.5,
  greet: 2,
} as const;

export type Scene1Phase = keyof typeof SCENE1_TIMING;

export const SCENE1_REDUCED_TOTAL = 2.4;

/** Idle loops after the scene finishes */
export const IDLE_TIMING = {
  /** One half-cycle of the blue moon's "breathing" (a full cycle is twice this) */
  moonBreath: 2.6,
  /** Gap between the figure's blinks (random within this range) */
  blinkMin: 2.5,
  blinkMax: 5,
  /** Gap between gentle bobs (flat version) */
  bobEvery: 3.4,
  /** How long the figure keeps waving after the scene ends before going idle */
  waveHold: 1.6,
} as const;
