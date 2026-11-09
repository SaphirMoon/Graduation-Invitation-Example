/**
 * 3D WORLD — layout, palette, camera path and particle budgets for the prologue (scenes 0 + 1).
 * Units are roughly meters. +y is up, the camera flies toward -z.
 */
import * as THREE from "three";
import { THEME } from "@/config/theme";
import { fbm } from "@/lib/noise";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;

/* ---------------- Palette (lives in config/theme.ts) ---------------- */

export const PALETTE = THEME.world;

/* ---------------- Terrain ---------------- */

/** Main hill — where the crystal rests and the stick figure appears. Sits on a terrain grid vertex. */
export const HILL = { x: 6, z: -18, radius: 4.2, height: 3 };

/** Terrain mesh: centered on the hill's z so the hill top is an exact grid vertex. */
export const TERRAIN = { size: 120, segments: 100, centerZ: -18 };

const valleyCenter = (z: number) => Math.sin(z * 0.05) * 2;

/** Ground height at (x, z): a winding valley + noise + the main hill. */
export function terrainHeight(x: number, z: number): number {
  const d = Math.abs(x - valleyCenter(z));
  // Low valley walls so the mountain layers stay visible behind them.
  const walls = Math.min(6, Math.pow(Math.max(0, d - 6), 1.25) * 0.12);
  const n = fbm(x * 0.09 + 3.1, z * 0.09 - 7.4) * 0.7;
  const dx = x - HILL.x;
  const dz = z - HILL.z;
  const hill = HILL.height * Math.exp(-(dx * dx + dz * dz) / (2 * HILL.radius * HILL.radius));
  return walls + n + hill;
}

export const HILL_TOP = V(HILL.x, terrainHeight(HILL.x, HILL.z), HILL.z);

/** Flower clusters placed by hand in the foreground of the final shot (phones see a narrow slice). */
export const FLOWER_BEDS: [number, number][] = [
  [4.2, -15.6],
  [5.2, -16.5],
  [3.4, -16.6],
  [6.5, -15.4],
  [2.6, -15],
];

/** Stream through the valley: [x, z] control points (passes behind the hill's foot, then toward the camera). */
export const STREAM = {
  width: 0.62,
  path: [[-26, -52], [-14, -42], [-5, -34], [1, -28], [3.5, -23.5], [1.5, -19], [-1.5, -15], [-3, -9], [-2, -1], [-1, 8], [1, 20]] as [number, number][],
};

/* ---------------- Camera ---------------- */

export const CAMERA = {
  /** Flight path (CatmullRom). The first point is behind the curtain, the last is the final framing. */
  path: [V(1.8, 2.4, 22), V(0.6, 2.0, 13), V(-0.4, 2.7, 4), V(0.9, 3.8, -4), V(2.2, 4.6, -10.5)],
  lookStart: V(3.5, 4.2, -20),
  /** While the beam hits the crystal: tilted up a little so moon + hill share the frame */
  lookBeam: HILL_TOP.clone().add(V(-0.3, 2.6, 0)),
  /** Final framing: hill sits right of center, moon upper-left */
  lookFinal: HILL_TOP.clone().add(V(-0.9, 1.9, 0)),
  /** Pull back + up while following the crystal */
  crystalOffset: V(-0.4, 0.9, 1.6),
  /** Dutch tilt (radians) — breaks the "perfectly level" look */
  roll: -3 * DEG,
  /** Vertical field of view for portrait / landscape screens */
  fovPortrait: 62,
  fovLandscape: 52,
};

export const CAMERA_FINAL = CAMERA.path[CAMERA.path.length - 1];

/* ---------------- Moon ---------------- */

/** Moon placed relative to the final shot: 8° left of center, 19° up, 150 m away. */
function placeMoon(): THREE.Vector3 {
  const forward = CAMERA.lookFinal.clone().sub(CAMERA_FINAL).normalize();
  const up = V(0, 1, 0);
  forward.applyAxisAngle(up, 8 * DEG);
  const right = forward.clone().cross(up).normalize();
  forward.applyAxisAngle(right, 19 * DEG);
  return CAMERA_FINAL.clone().add(forward.multiplyScalar(150));
}

export const MOON = { position: placeMoon(), radius: 9 };

/* ---------------- Crystal flight ---------------- */

const CRYSTAL_REST = HILL_TOP.clone().add(V(0, 0.75, 0));

/** Where the crystal hits: the moon's surface on the side facing the viewer (visible during hit-stop). */
export const IMPACT_POINT = MOON.position
  .clone()
  .add(CAMERA_FINAL.clone().sub(MOON.position).normalize().multiplyScalar(MOON.radius * 1.02));

/** Curved (not straight) path from the hill to the moon. */
export const CRYSTAL_PATH = new THREE.CubicBezierCurve3(
  CRYSTAL_REST,
  CRYSTAL_REST.clone().add(V(-1.5, 5, 1)),
  CRYSTAL_REST.clone().lerp(MOON.position, 0.45).add(V(9, 7, 0)),
  IMPACT_POINT,
);

/** Crystal draw scale for a flight progress — grows with distance so it stays readable. */
export const crystalScale = (fly: number) => 1 + fly * fly * 6;

/* ---------------- Quality budgets ---------------- */

export type Tier = "high" | "low";

export const BUDGET: Record<
  Tier,
  { stars: number; fireflies: number; grass: number; rocks: number; dust: number; sparks: number; snow: number; ghosts: number; flowers: number }
> = {
  // sparks = glitter shed by the flying crystal, snow = blue dust after the burst,
  // ghosts = trail points per shard
  high: { stars: 1400, fireflies: 260, grass: 900, rocks: 34, dust: 160, sparks: 70, snow: 220, ghosts: 10, flowers: 130 },
  low: { stars: 700, fireflies: 110, grass: 380, rocks: 20, dust: 80, sparks: 36, snow: 110, ghosts: 5, flowers: 64 },
};

export function detectTier(): Tier {
  if (typeof window === "undefined") return "high";
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const weakCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
  return small || weakCpu ? "low" : "high";
}
