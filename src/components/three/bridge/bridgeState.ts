/**
 * Year 4: the bridge of light from the summit to the floating island.
 * The world continues year 3's: same mountain, same coordinates. The far light seen from the summit
 * is the lighthouse lamp, placed in exactly that direction, just much closer.
 */
import * as THREE from "three";
import { createStageState } from "../stage";
import { createSnowState, OMEN_POS, pathPoint } from "../snow/snowState";

const UP = new THREE.Vector3(0, 1, 0);

export const SUMMIT = pathPoint(1, new THREE.Vector3());
/** How close the lamp is compared with where the far light seemed to be (from the summit camera) */
const LAMP_NEARNESS = 0.22;
const SUMMIT_EYE = SUMMIT.clone().add(new THREE.Vector3(-1, 1.3, -6.5));
export const LAMP = SUMMIT_EYE.clone().lerp(OMEN_POS, LAMP_NEARNESS);

export const ISLAND = {
  radius: 24,
  towerHeight: 20,
  /** Center of the island's top surface, under the lighthouse */
  center: LAMP.clone().add(new THREE.Vector3(0, -18.4, 0)),
};

const heading = LAMP.clone().sub(SUMMIT).setY(0).normalize();
const side = new THREE.Vector3().crossVectors(heading, UP);

/* ---------------- The bridge's curve ---------------- */

const END = ISLAND.center.clone().addScaledVector(heading, -15);
const along = (k: number, bend: number, lift: number) =>
  SUMMIT.clone().lerp(END, k).addScaledVector(side, bend).add(new THREE.Vector3(0, lift, 0));

export const CURVE = new THREE.CatmullRomCurve3(
  [SUMMIT.clone(), along(0.26, 5, 1.6), along(0.52, -2, 2.4), along(0.78, -6, 1.2), along(0.94, -1, 0), END.clone()],
  false,
  "centripetal",
);
CURVE.arcLengthDivisions = 500;
export const LENGTH = CURVE.getLength();

/** Where the planks stop: the edge of the island. */
export const DECK_END = (() => {
  const p = new THREE.Vector3();
  for (let i = 0; i <= 400; i++) {
    CURVE.getPointAt(i / 400, p);
    if (Math.hypot(p.x - ISLAND.center.x, p.z - ISLAND.center.z) < ISLAND.radius - 1) return i / 400;
  }
  return 0.93;
})();

export type Frame = { point: THREE.Vector3; tangent: THREE.Vector3; right: THREE.Vector3 };

export function frameAt(u: number, out: Frame) {
  const k = THREE.MathUtils.clamp(u, 0, 1);
  CURVE.getPointAt(k, out.point);
  CURVE.getTangentAt(k, out.tangent);
  out.right.crossVectors(out.tangent, UP).normalize();
  return out;
}

export const newFrame = (): Frame => ({ point: new THREE.Vector3(), tangent: new THREE.Vector3(), right: new THREE.Vector3() });

/* ---------------- Sizes ---------------- */

export const DECK = { halfWidth: 1.6, plank: 1.05 };

/** The narrator's stride, in meters per step: ties the legs and the lit plank to the distance walked */
export const STRIDE = 1.05;

/* ---------------- Photo boards ---------------- */

/** Arc fractions where the narrator stops. A year with fewer photos uses the first ones. */
export const BOARD_U = [0.2, 0.39, 0.58, 0.76];
export const BOARD = { size: 4.6, centerY: 4.5, lateral: 2.55, ahead: 1.5 };

export type Board = {
  u: number;
  /** Center of the photo */
  center: THREE.Vector3;
  /** Horizontal unit vector the photo faces (across the bridge) */
  normal: THREE.Vector3;
  yaw: number;
  /** Height of the deck here */
  deckY: number;
};

export const BOARDS: Board[] = BOARD_U.map((u, i) => {
  const f = frameAt(u, newFrame());
  const dir = i % 2 ? -1 : 1;
  const center = f.point
    .clone()
    .addScaledVector(f.right, dir * BOARD.lateral)
    .addScaledVector(f.tangent, BOARD.ahead);
  center.y = f.point.y + BOARD.centerY;
  const normal = f.right.clone().multiplyScalar(-dir).setY(0).normalize();
  return { u, center, normal, yaw: Math.atan2(normal.x, normal.z), deckY: f.point.y };
});

/* ---------------- Camera ---------------- */

export const BRIDGE_CAMERA = {
  /** Behind the narrator, a little above and to the side */
  behindPortrait: { back: 8, up: 3.2, side: 1.1, ahead: 12, lookUp: 1.4 },
  behindLandscape: { back: 8.5, up: 3, side: 2.4, ahead: 12, lookUp: 2.6 },
  /** Ahead and to the side, looking back at the narrator and the shrinking mountain */
  backShotPortrait: { ahead: 13, side: 4, up: 7.5, lookUp: -1.5 },
  backShotLandscape: { ahead: 13, side: 7, up: 7, lookUp: -1 },
  /** Across the bridge from a photo board */
  lockPortrait: { distance: 10.6, height: 3.2, lookUp: 3.75 },
  lockLandscape: { distance: 11.5, height: 3.4, lookUp: 3.7 },
  /** Last shot: the narrator turned toward us, the lighthouse behind */
  endPortrait: { back: 12, up: 1.6, lookUp: 5 },
  endLandscape: { back: 13.5, up: 1.6, lookUp: 5 },
};

/* ---------------- Budgets ---------------- */

export const BRIDGE_BUDGET = {
  high: { dome: 1000, snow: 150, railStep: 3, lanterns: 72, fireflies: 56, rocks: 30, pines: 24 },
  low: { dome: 500, snow: 70, railStep: 5, lanterns: 34, fireflies: 26, rocks: 16, pines: 12 },
};

/* ---------------- Controls ---------------- */

export function createBridgeState(photoCount: number, pastPhotoCount: number, reduced: boolean) {
  const stage = createStageState();
  // Only the sapphire moon and the bloom read this.
  Object.assign(stage, { moonBlue: 1, moonGlow: 1, fogBlue: 1, coneBlue: 1, idle: 1, reduced });
  // The mountain behind us, exactly as year 3 left it.
  const snow = createSnowState(pastPhotoCount, reduced);
  Object.assign(snow, { u: 1, alt: 1, summit: 1, land: 1, fall: 0, tilt: 0, streakX: 0 });
  snow.ice.forEach((c) => (c.glow = 1));
  return {
    stage,
    snow,
    photoCount,

    /* ---- Tweened by the timeline ---- */
    /** The lantern: 0 not in hand, 0.35 carried, 1 held high */
    raise: 0,
    /** The far light answering (0..1) */
    answer: 0,
    /** Ray of light from the lantern to the lamp: head position 0..1, overall strength */
    beam: 0,
    beamFade: 1,
    /** How much of the bridge exists (0..1 of DECK_END) */
    build: reduced ? 1 : 0,
    /** Island fading in */
    islandIn: reduced ? 1 : 0,
    /** Narrator's position along the curve */
    u: 0,
    walk: 0,
    /** Camera: 0 summit shot → 1 following; look-back shot; lock on board `station`; last shot */
    follow: reduced ? 1 : 0,
    backShot: 0,
    lock: 0,
    station: 0,
    end: 0,
    /** Boards lighting up */
    boards: Array.from({ length: photoCount }, () => ({ glow: 0 })),
    /** Lighthouse lit (0..1) and the festive sky (0..1) */
    tower: 0,
    festival: 0.2,

    /* ---- Written every frame ---- */
    /** Step count, for the sound and the lit plank */
    steps: 0,
    /** World position of the lantern */
    lantern: new THREE.Vector3().copy(SUMMIT),
  };
}

export type BridgeState = ReturnType<typeof createBridgeState>;
