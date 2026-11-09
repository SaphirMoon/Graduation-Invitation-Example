/**
 * Year 3: the snow mountain. Layout (height field, path, stations, camera poses) and the controls
 * tweened by the timeline. All pure data: the 3D components read it, the timeline writes the controls.
 */
import * as THREE from "three";
import { fbm } from "@/lib/noise";
import { createStageState } from "../stage";

/* ---------------- Height field ---------------- */

export const PEAK = { x: 0, z: -20, height: 72, radius: 78 };
/** The terrain mesh is this grid: groundY() interpolates exactly the same triangles */
export const GRID = { size: 300, segments: 120 };

const radial = (x: number, z: number) => Math.hypot(x - PEAK.x, z - PEAK.z);

function rawHeight(x: number, z: number) {
  const t = Math.max(0, 1 - radial(x, z) / PEAK.radius);
  const base = PEAK.height * Math.pow(t, 1.15);
  const swell = fbm(x * 0.022 + 4.1, z * 0.022 - 2.7, 2) * 2.2;
  // Rugged on the shoulders, calm at the foot and right at the top.
  const rugged = fbm(x * 0.06 + 9.2, z * 0.06 + 1.3, 3) * (1 + 6.5 * Math.sin(Math.PI * Math.min(t * 1.1, 1)));
  return Math.max(base + swell + rugged, 0);
}

/* ---------------- Path ---------------- */

/** Switchbacks up the face toward the viewer: [distance from the peak, angle from +z]. */
const SWITCHBACKS: [number, number][] = [
  [74, 0.5],
  [62, -0.45],
  [50, 0.55],
  [40, -0.5],
  [30, 0.5],
  [21, -0.4],
  [12, 0.3],
  [4.5, -0.1],
  [1, 0],
];

export const PATH = new THREE.CatmullRomCurve3(
  SWITCHBACKS.map(([r, a]) => new THREE.Vector3(PEAK.x + Math.sin(a) * r, 0, PEAK.z + Math.cos(a) * r)),
  false,
  "centripetal",
);
PATH.arcLengthDivisions = 600;
export const PATH_LENGTH = PATH.getLength();

/* ---------------- Stations ---------------- */

/** Arc fractions where the narrator stops. A year with fewer photos uses the first ones. */
export const STATION_U = [0.2, 0.42, 0.63, 0.82];

export type Station = {
  u: number;
  /** Path point (y = ground) */
  point: THREE.Vector3;
  /** Horizontal unit vector, downhill (toward the camera) */
  out: THREE.Vector3;
  /** Horizontal unit vector, to the right as seen from the camera */
  right: THREE.Vector3;
  /** Ice block base center */
  block: THREE.Vector3;
  /** Group rotation so local +z points downhill */
  yaw: number;
};

/** Flat terraces around the stations and on the summit. */
type Terrace = { x: number; z: number; y: number; inner: number; outer: number };

const TERRACES: Terrace[] = [];

function terraceCenter(u: number) {
  const p = PATH.getPointAt(u);
  const out = new THREE.Vector3(p.x - PEAK.x, 0, p.z - PEAK.z).normalize();
  return { p, out, c: p.clone().addScaledVector(out, -1) };
}
for (const u of STATION_U) {
  const { c } = terraceCenter(u);
  TERRACES.push({ x: c.x, z: c.z, y: rawHeight(c.x, c.z) + 0.2, inner: 4.5, outer: 8.5 });
}
{
  const top = PATH.getPointAt(1);
  TERRACES.push({ x: top.x, z: top.z, y: rawHeight(top.x, top.z), inner: 2.6, outer: 6 });
}

export function terrainHeight(x: number, z: number) {
  let h = rawHeight(x, z);
  for (const t of TERRACES) {
    const k = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - t.x, z - t.z), t.inner, t.outer);
    h += (t.y - h) * k;
  }
  return h;
}

/* ---------------- Exact ground under the low-poly mesh ---------------- */

let grid: Float32Array | null = null;
const CELL = GRID.size / GRID.segments;
const ORIGIN = { x: PEAK.x - GRID.size / 2, z: PEAK.z - GRID.size / 2 };

export function terrainGrid() {
  if (grid) return grid;
  const n = GRID.segments + 1;
  grid = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) grid[j * n + i] = terrainHeight(ORIGIN.x + i * CELL, ORIGIN.z + j * CELL);
  }
  return grid;
}

/** Height of the terrain mesh at (x, z), matching PlaneGeometry's triangulation. */
export function groundY(x: number, z: number) {
  const g = terrainGrid();
  const n = GRID.segments + 1;
  const fx = THREE.MathUtils.clamp((x - ORIGIN.x) / CELL, 0, GRID.segments - 0.001);
  const fz = THREE.MathUtils.clamp((z - ORIGIN.z) / CELL, 0, GRID.segments - 0.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const a = fx - i;
  const b = fz - j;
  const h00 = g[j * n + i];
  const h10 = g[j * n + i + 1];
  const h01 = g[(j + 1) * n + i];
  const h11 = g[(j + 1) * n + i + 1];
  // PlaneGeometry's cells split along the h10-h01 diagonal.
  return a + b < 1 ? h00 + (h10 - h00) * a + (h01 - h00) * b : h11 + (h01 - h11) * (1 - a) + (h10 - h11) * (1 - b);
}

/** Ground normal, from the same surface. */
export function groundNormal(x: number, z: number, out: THREE.Vector3) {
  const e = 0.6;
  return out.set(groundY(x - e, z) - groundY(x + e, z), 2 * e, groundY(x, z - e) - groundY(x, z + e)).normalize();
}

export function pathPoint(u: number, out: THREE.Vector3) {
  PATH.getPointAt(THREE.MathUtils.clamp(u, 0, 1), out);
  out.y = groundY(out.x, out.z);
  return out;
}

export const STATIONS: Station[] = STATION_U.map((u) => {
  const { p, out } = terraceCenter(u);
  const point = p.clone();
  point.y = groundY(p.x, p.z);
  const right = new THREE.Vector3(out.z, 0, -out.x);
  const block = p.clone().addScaledVector(out, -2.5);
  block.y = groundY(block.x, block.z);
  return { u, point, out, right, block, yaw: Math.atan2(out.x, out.z) };
});

/** Where the narrator sits at a station: in front of the block, right of center. */
export function seatPoint(s: Station, target: THREE.Vector3) {
  target.copy(s.block).addScaledVector(s.out, 1.25).addScaledVector(s.right, 0.92);
  target.y = groundY(target.x, target.z);
  return target;
}

/* ---------------- Camera ---------------- */

export const SNOW_CAMERA = {
  /** Following the narrator: downhill of them, a little below, looking up */
  followPortrait: { distance: 8, below: 0.6, up: 3.8, footUp: 0 },
  followLandscape: { distance: 20, below: 0, up: 3.5, footUp: 3.6 },
  /** Locked on an ice block */
  lockPortrait: { distance: 7.4, height: 2.2, look: 2.2 },
  lockLandscape: { distance: 7.7, height: 2.3, look: 2.55 },
  /** On the summit: behind the narrator, looking out over the sea of clouds */
  summitPortrait: { back: 6.2, height: 1.2, side: -0.75, lookOut: 30, lookUp: 6.5 },
  summitLandscape: { back: 7.5, height: 1.5, side: -2.8, lookOut: 30, lookUp: 3.5 },
  /** Height above the foot where the fall from the previous scene begins */
  fallFrom: 1000,
};

/** Cloud layers crossed during the fall (absolute heights). */
export const FALL_LAYERS = [930, 790, 660, 520, 400];

/** The little light far away, seen from the summit (it is year 4's lighthouse) */
export const OMEN_POS = new THREE.Vector3(-62, 108, 620);

/* ---------------- Budgets ---------------- */

export const SNOW_BUDGET = {
  high: { dome: 900, snow: 300, rocks: 46, pines: 44 },
  low: { dome: 460, snow: 150, rocks: 26, pines: 24 },
};

/* ---------------- Controls ---------------- */

export function createSnowState(photoCount: number, reduced: boolean) {
  const stage = createStageState();
  // Only the sapphire moon reads this: keep it in its final state.
  Object.assign(stage, { moonBlue: 1, moonGlow: 1, fogBlue: 1, coneBlue: 1, idle: 1, reduced });
  return {
    stage,
    photoCount,

    /* ---- Tweened by the timeline ---- */
    /** Transition: camera pitch (0 level → 1 straight down), height above its landing pose, landing blend */
    tilt: 0,
    fall: reduced ? 0 : SNOW_CAMERA.fallFrom,
    land: reduced ? 1 : 0,
    /** Leftover speed of the train's stars (m/s): stretches the particles sideways */
    streakX: reduced ? 0 : 46,
    /** Position along the path (0 foot → 1 summit) */
    u: 0,
    /** Pose weights: walking, sitting at a station */
    walk: 0,
    sit: 0,
    /** Looking around (head) while resting */
    look: 0,
    /** Camera: locked on station `station` (0..1), and on the summit (0..1) */
    lock: 0,
    station: 0,
    summit: 0,
    /** Gust of snow (0..1) */
    blizzard: 0,
    /** Ice blocks lighting up from the inside */
    ice: Array.from({ length: photoCount }, () => ({ glow: 0 })),
    /** The little light far away, hinting at year 4 */
    omen: 0,

    /* ---- Written every frame ---- */
    /** Altitude fraction of the narrator (0 foot → 1 summit) */
    alt: 0,
    /** Walking distance, for the sound of the steps */
    strides: 0,
  };
}

export type SnowState = ReturnType<typeof createSnowState>;
