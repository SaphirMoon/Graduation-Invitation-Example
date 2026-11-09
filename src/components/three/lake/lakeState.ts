/**
 * Lake scene layout and shared state. Everything lives in "lake space": the origin is on the water
 * below the camera and -z points straight at the moon, so the moon's reflection runs along x = 0.
 * The GSAP timeline tweens plain values here; the 3D components read them every frame.
 */
import * as THREE from "three";
import { CAMERA_FINAL, MOON } from "@/config/world";
import { createStageState } from "../stage";

/* ---------------- Lake space ---------------- */

const toMoon = MOON.position.clone().sub(CAMERA_FINAL);
const flat = new THREE.Vector3(toMoon.x, 0, toMoon.z).normalize();

export const LAKE_ORIGIN = new THREE.Vector3(CAMERA_FINAL.x, 0, CAMERA_FINAL.z);
export const LAKE_YAW = Math.atan2(-flat.x, -flat.z);
/** Direction to the moon in lake space */
export const LAKE_MOON_DIR = new THREE.Vector3(0, toMoon.y, -toMoon.setY(0).length()).normalize();

/** Camera height and downward look (rad), so the photos on the water fill the frame. */
export const LAKE_CAMERA = {
  portrait: { height: 4.2, pitch: -0.065 },
  landscape: { height: 3.6, pitch: 0 },
  /** Where the camera starts: high up, looking at the moon (it drifts down to the lake) */
  introHeight: 17,
  introPitch: 0.38,
};

/* ---------------- Boat ---------------- */

export const BOAT_SCALE = 1.25;
/** Where the boat stops while the photos are released */
export const BOAT_SPOT = { x: 0, z: -18 };
/** Hand position (boat space) when a photo is let go */
export const TOSS_HAND = new THREE.Vector3(0.45, 1.25, 0.55);

/* ---------------- Photos ---------------- */

export const PHOTO = { width: 1.9, height: 2.24, heroScale: 1.15, lean: 0.3 };

/** Final resting places, far → near. A year with n photos uses the last n. */
const SLOTS: [number, number][] = [
  [-3.9, -22],
  [3.9, -21.5],
  [-3.2, -16.5],
  [3.2, -16],
  [-2.3, -12.4],
  [2.3, -12.7],
  [-1.04, -8.1],
  [1.08, -7.9],
];

/** Wider screens spread the photos sideways and keep them past the bottom edge of the frame. */
function spread(aspect: number) {
  return THREE.MathUtils.clamp(aspect / 0.46, 1, 3.2);
}

export function photoSlot(i: number, count: number, aspect: number, out: THREE.Vector3) {
  const [x, z] = SLOTS[SLOTS.length - count + i];
  return out.set(x * spread(aspect), 0, aspect > 1 ? Math.min(z, -8.4) : z);
}

/** The big landing spot: near the camera on phones; beside the boat on wide screens. */
export function heroSpot(i: number, aspect: number, out: THREE.Vector3) {
  return aspect > 1 ? out.set(i % 2 ? 4.3 : -4.3, 0, -8.6) : out.set(0, 0, -7.6);
}

/* ---------------- State ---------------- */

export type Ripple = { x: number; z: number; age: number };

export function createLakeState(photoCount: number, reduced: boolean) {
  const stage = createStageState();
  // The prologue's end state: sapphire moon, slate fog, no crystal / curtain / cone.
  Object.assign(stage, { camT: 1, moonBlue: 1, moonGlow: 1, fogBlue: 1, coneBlue: 1, crystalOpacity: 0, curtainAlpha: 0, idle: 1, reduced });
  return {
    stage,
    /** Rowing weight (0 = paddle at rest, 1 = rowing) and stroke count (one unit = one stroke) */
    row: 0,
    rowPhase: 0,
    boat: { x: -8, z: BOAT_SPOT.z, yaw: 0 },
    /** Head turned toward the camera (talking) */
    face: 0,
    /** Right arm: reaches into the boat, then lifts a photo */
    reach: 0,
    toss: 0,
    camera: { intro: 1, z: 0 },
    /** Silver fog closing in at the end of the year (0..1) */
    mist: 0,
    photos: Array.from({ length: photoCount }, () => ({ show: 0, fly: 0, drift: 0 })),
    ripples: [] as Ripple[],
    /** Written by the boat every frame, in lake space */
    hand: new THREE.Vector3(),
    lantern: new THREE.Vector3(),
  };
}

export type LakeState = ReturnType<typeof createLakeState>;
