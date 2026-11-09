/**
 * Year 2: a high-speed train that never stops.
 * The train stays near the world origin; `travel` (meters) grows every frame and everything else
 * (track waves, stars, clouds) scrolls from it. So the speed is a single number and can't jump.
 *
 * The timeline only tweens the controls in createSpaceState: trainSpeed, cameraTarget, cameraBlend…
 */
import * as THREE from "three";
import { createStageState } from "../stage";

/** Meters per second at trainSpeed = 1 */
export const BASE_SPEED = 46;

/* ---------------- Track shape (shared by JS and GLSL) ---------------- */

export function trackY(s: number) {
  return 2.4 * Math.sin(s * 0.012) + 0.6 * Math.sin(s * 0.037 + 1.3);
}
export function trackZ(s: number) {
  return 6 * Math.sin(s * 0.008 + 0.4) + 1.2 * Math.sin(s * 0.023);
}
/** While leaving, the track climbs into the stars ahead of the camera. */
export function trackClimb(x: number, amount: number) {
  const d = Math.max(x - 40, 0);
  return amount * 0.00035 * d * d;
}

export const TRACK_GLSL = /* glsl */ `
uniform float uTravel;
uniform float uClimb;
float trackY(float s){ return 2.4 * sin(s * 0.012) + 0.6 * sin(s * 0.037 + 1.3); }
float trackZ(float s){ return 6.0 * sin(s * 0.008 + 0.4) + 1.2 * sin(s * 0.023); }
float trackClimb(float x){ float d = max(x - 40.0, 0.0); return uClimb * 0.00035 * d * d; }
`;

/** World point on the track at world x. */
export function trackPoint(x: number, travel: number, climb: number, out: THREE.Vector3) {
  const s = x + travel;
  return out.set(x, trackY(s) + trackClimb(x, climb), trackZ(s));
}

/* ---------------- Train layout (meters, x along the track) ---------------- */

export const TRAIN = {
  /** The locomotive spans -locoBack..locoNose around its origin */
  locoBack: 7,
  locoNose: 10,
  carLength: 11,
  gap: 0.5,
  centerY: 3.2,
  halfHeight: 2.7,
  halfWidth: 1.7,
  /** The photo screen on the car's side */
  photoWidth: 5,
  photoHeight: 4,
  photoY: 3.25,
};

/** Distance from the locomotive's origin back to car i's center. */
export const carOffset = (i: number) => TRAIN.locoBack + TRAIN.gap + TRAIN.carLength / 2 + i * (TRAIN.carLength + TRAIN.gap);

/** Camera target along the train: 0 = locomotive, 1 = first photo car, 2 = second… (fractions blend). */
export function targetOffset(t: number) {
  if (t <= 0) return 0;
  if (t < 1) return carOffset(0) * t;
  const a = Math.floor(t);
  return carOffset(a - 1) + (carOffset(a) - carOffset(a - 1)) * (t - a);
}

/* ---------------- Camera ---------------- */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const SPACE_CAMERA = {
  /** Tracking the locomotive, 3/4 from the front */
  trackPortrait: { pos: V(15, 2, 21), look: V(5.4, 3.3, 0) },
  trackLandscape: { pos: V(11, 1.4, 16), look: V(1.5, 3.2, 0) },
  /** Locked on a car, riding along with it: close and low on phones, wider on landscape */
  lockPortrait: { pos: V(0, 1.9, 12.4), look: V(0, 3, 0) },
  lockLandscape: { pos: V(0, 2, 13.5), look: V(0, 3, 0) },
  /** Released: stays behind while the train runs off into the stars */
  releasePos: V(-24, 5.5, 6.5),
  releaseLook: V(240, 52, -6),
};

/* ---------------- Budgets ---------------- */

export const SPACE_BUDGET = {
  high: { dome: 900, far: 220, mid: 120, near: 44, dust: 36, puffs: 34, pylons: 44, lights: 150, belt: 220 },
  low: { dome: 460, far: 110, mid: 64, near: 24, dust: 18, puffs: 18, pylons: 30, lights: 90, belt: 110 },
};

/* ---------------- Controls ---------------- */

export function createSpaceState(photoCount: number, reduced: boolean) {
  const stage = createStageState();
  // Only the sapphire moon reads this: keep it in its final state.
  Object.assign(stage, { moonBlue: 1, moonGlow: 1, fogBlue: 1, coneBlue: 1, idle: 1, reduced });
  return {
    stage,
    photoCount,

    /* ---- Tweened by the timeline ---- */
    /** Speed multiplier: 1 = cruise, ~1.6 during a transfer */
    trainSpeed: reduced ? 0.4 : 1,
    /** Which part of the train the camera is locked on (see targetOffset) */
    cameraTarget: 0,
    /** 0 = 3/4 tracking shot on the locomotive, 1 = side-on, locked on cameraTarget */
    cameraBlend: 0,
    /** 0 = riding with the train, 1 = let go, watching it leave */
    cameraRelease: 0,
    /** The background's share of the speed: drops when the camera no longer rides with the train */
    flow: 1,
    /** Extra train x: enters from the left (negative), runs off at the end (positive) */
    entry: reduced ? 0 : -80,
    exit: 0,
    /** Track bending up into the stars while leaving (0..1) */
    climb: 0,

    /* ---- Written every frame ---- */
    travel: 0,
  };
}

export type SpaceState = ReturnType<typeof createSpaceState>;
