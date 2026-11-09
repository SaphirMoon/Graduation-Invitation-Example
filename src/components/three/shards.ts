/**
 * Shard choreography as pure functions of the shatter progress `p` (0..1).
 * Shards, their trails and the moon's reaction (one flash per absorbed shard, color by count)
 * all read from here, so they stay in sync — including when the timeline is scrubbed.
 */
import * as THREE from "three";
import { MOON } from "@/config/world";
import { seeded } from "@/lib/random";

export const SHARD_COUNT = 13;

/** Full laps each shard makes around the moon before diving in (random in this range) */
export const ORBIT_TURNS = { min: 2, max: 3 };
/** Shared orbit plane: tilt toward the camera (rad) and its on-screen roll (rad) */
const ORBIT_TILT = 0.62;
const ORBIT_ROLL = -0.32;

const rnd = seeded(15072004);
export const SHARDS = Array.from({ length: SHARD_COUNT }, (_, i) => {
  const speed = 1 + rnd() * 0.45; // ≥ 1 so every shard lands before p = 1
  const delay = rnd() * 0.05;
  return {
    // Burst biased to one side (the way the crystal came in), not a neat ring.
    angle: (i / SHARD_COUNT) * Math.PI * 1.7 - 0.7 + (rnd() - 0.5) * 1.1,
    radius: MOON.radius * (1.6 + Math.pow(rnd(), 0.7) * 1.7),
    depth: (rnd() - 0.5) * 22,
    size: 0.9 + Math.pow(rnd(), 1.5) * 2.3,
    spin: new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6),
    turns: ORBIT_TURNS.min + rnd() * (ORBIT_TURNS.max - ORBIT_TURNS.min),
    // Roughly one shared plane (an accretion ring), with a little scatter per shard
    tilt: ORBIT_TILT + (rnd() - 0.5) * 0.3,
    roll: ORBIT_ROLL + (rnd() - 0.5) * 0.35,
    /** All shards swirl the same way, like a vortex */
    dir: 1,
    speed,
    delay,
    /** Shatter progress at which this shard reaches the moon's center */
    arrive: delay + (1 - delay) / speed,
  };
});

/** Per-shard progress 0..1. */
export function shardProgress(i: number, p: number) {
  const s = SHARDS[i];
  return THREE.MathUtils.clamp(((p - s.delay) / (1 - s.delay)) * s.speed, 0, 1);
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
/** Burst phase (per-shard progress) — fast out, decelerating */
const BURST = 0.12;
/** Within the orbit phase, the dive into the moon starts here (0..1) */
const DIVE = 0.78;
/** Angle curled during the burst, so it flows into the orbit */
const BURST_CURL = 0.4;

/**
 * Shard position for per-shard progress `ps`, relative to the camera basis.
 * Burst: fast out from the impact point, decelerating.
 * Orbit: `turns` laps on a tilted ring around the moon (the far half passes behind it),
 * speeding up and tightening. Dive: spirals into the moon, shrinking.
 */
export function shardTransform(
  i: number,
  ps: number,
  right: THREE.Vector3,
  up: THREE.Vector3,
  /** Camera +Z axis (points from the scene back toward the camera) */
  back: THREE.Vector3,
  outPos: THREE.Vector3,
): number {
  const s = SHARDS[i];
  // Start at the impact point (front surface), spread outward.
  const start = MOON.radius * 0.35;
  let r: number;
  let a = s.angle;
  let scale = s.size;
  // Base distance in front of the moon's center (toward the camera); the tilted ring adds
  // depth on top, so the far half of each lap goes behind the moon.
  let front = MOON.radius * 1.15 + Math.abs(s.depth) * 0.35;
  if (ps < BURST) {
    const k = easeOutCubic(ps / BURST);
    r = start + (s.radius - start) * k;
    a += s.dir * BURST_CURL * k;
  } else {
    const u = (ps - BURST) / (1 - BURST);
    const w = THREE.MathUtils.clamp((u - DIVE) / (1 - DIVE), 0, 1);
    // Starts slow (matching the end of the burst), keeps accelerating into the dive.
    a += s.dir * (BURST_CURL + s.turns * Math.PI * 2 * Math.pow(u, 1.4));
    r = s.radius * (1 - 0.32 * u) * (1 - w * w);
    scale = s.size * (1 - 0.2 * u) * (1 - w * w * 0.8);
    front *= 1 - Math.pow(w, 2.5);
  }
  // Point on the ring, tilted (upper half recedes: we look up at the moon from below)…
  const ox = Math.cos(a) * r;
  const oy = Math.sin(a) * r;
  const sy = oy * Math.cos(s.tilt);
  const dz = -oy * Math.sin(s.tilt);
  // …then rolled on screen.
  const cr = Math.cos(s.roll);
  const sr = Math.sin(s.roll);
  outPos
    .copy(MOON.position)
    .addScaledVector(right, ox * cr - sy * sr)
    .addScaledVector(up, ox * sr + sy * cr)
    .addScaledVector(back, front + dz);
  return Math.max(scale, 0.0001);
}

/** Fraction of shards already absorbed (stepwise). */
export function absorbedFraction(p: number) {
  if (p <= 0) return 0;
  let n = 0;
  for (const s of SHARDS) if (p >= s.arrive) n++;
  return n / SHARD_COUNT;
}

/** Sum of short flashes, one per absorbed shard (decays over ~0.07 of progress). */
export function absorbPulse(p: number) {
  if (p <= 0 || p >= 1.2) return 0;
  let v = 0;
  for (const s of SHARDS) {
    const dt = p - s.arrive;
    if (dt >= 0 && dt < 0.07) v += 1 - dt / 0.07;
  }
  return Math.min(v, 1.5);
}

/** Progress at which the last shard arrives. */
export const LAST_ARRIVAL = Math.max(...SHARDS.map((s) => s.arrive));
