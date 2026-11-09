"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "@/config/world";
import { fbm } from "@/lib/noise";
import { seeded } from "@/lib/random";
import { ridgeGeometry } from "../objects/Terrain";
import { GRID, groundNormal, groundY, PATH, PATH_LENGTH, PEAK, pathPoint, terrainGrid, type SnowState } from "./snowState";

const S = PALETTE.snow3;
/** Direction of the moonlight baked into the snow (from the upper left, in front) */
const LIGHT = new THREE.Vector3(-0.72, 0.42, 0.55).normalize();

const c0 = new THREE.Color();
const c1 = new THREE.Color();
const n = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const d = new THREE.Vector3();

/* ---------------- Main mountain ---------------- */

/** Bakes moonlit snow into the colors: silver-white toward the moon, blue-violet in shadow. */
function mountainGeometry() {
  const heights = terrainGrid();
  const row = GRID.segments + 1;
  const plane = new THREE.PlaneGeometry(GRID.size, GRID.size, GRID.segments, GRID.segments);
  plane.rotateX(-Math.PI / 2);
  plane.translate(PEAK.x, 0, PEAK.z);
  const p0 = plane.attributes.position;
  for (let j = 0; j < row; j++) for (let i = 0; i < row; i++) p0.setY(j * row + i, heights[j * row + i]);
  const g = plane.toNonIndexed();
  plane.dispose();
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const rnd = seeded(5150);
  const shadow = new THREE.Color(S.shadow);
  const mid = new THREE.Color(S.mid);
  const lit = new THREE.Color(S.lit);
  const rim = new THREE.Color(S.rim);
  const rock = new THREE.Color(S.rock);
  const plain = new THREE.Color(S.plain);
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    d.fromBufferAttribute(pos, f + 2);
    n.copy(b).sub(a).cross(d.clone().sub(a)).normalize();
    if (n.y < 0) n.negate();
    const cx = (a.x + b.x + d.x) / 3;
    const cz = (a.z + b.z + d.z) / 3;
    const cy = (a.y + b.y + d.y) / 3;
    const facing = n.dot(LIGHT);
    const k = THREE.MathUtils.smoothstep(facing, 0.08, 0.8);
    c0.copy(shadow).lerp(mid, THREE.MathUtils.smoothstep(k, 0, 0.5)).lerp(lit, THREE.MathUtils.smoothstep(k, 0.45, 1));
    // Moonlit rim on the ridges turned toward the moon.
    const glancing = 1 - n.y;
    c0.lerp(rim, THREE.MathUtils.smoothstep(facing, 0.78, 0.95) * THREE.MathUtils.smoothstep(glancing, 0.12, 0.34) * 0.8);
    // Bare rock on the steepest faces.
    if (n.y < 0.62 && cy > 8) c0.lerp(rock, THREE.MathUtils.smoothstep(n.y, 0.62, 0.5) * 0.85);
    // Soft drifts, facet by facet.
    const patch = 0.94 + fbm(cx * 0.05 + 3, cz * 0.05 - 1, 2) * 0.08 + rnd() * 0.05;
    c0.multiplyScalar(patch);
    // The edge of the mesh melts into the snow plain, so it never reads as a square.
    c0.lerp(plain, THREE.MathUtils.smoothstep(Math.hypot(cx - PEAK.x, cz - PEAK.z), 64, 118));
    for (let v = 0; v < 3; v++) col.set([c0.r, c0.g, c0.b], (f + v) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  return g;
}

/* ---------------- Trodden path and footprints ---------------- */

function pathGeometry() {
  const steps = Math.round(PATH_LENGTH / 1.2);
  const pos: number[] = [];
  const index: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    pathPoint(u, p);
    PATH.getTangentAt(u, t);
    const w = 0.46 + 0.1 * Math.sin(u * 83);
    for (const side of [-1, 1]) {
      const x = p.x - t.z * w * side;
      const z = p.z + t.x * w * side;
      pos.push(x, groundY(x, z) + 0.06, z);
    }
    if (i < steps) {
      const v = i * 2;
      index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

const STEP = 0.85;
const dummy = new THREE.Object3D();

/** Prints appear behind the narrator, step by step. */
function Footprints({ sp }: { sp: SnowState }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const total = Math.floor(PATH_LENGTH / STEP);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    for (let i = 0; i < total; i++) {
      const u = i / total;
      pathPoint(u, p);
      PATH.getTangentAt(u, t);
      const side = i % 2 ? 0.13 : -0.13;
      const x = p.x - t.z * side;
      const z = p.z + t.x * side;
      groundNormal(x, z, normal);
      dummy.position.set(x, groundY(x, z) + 0.1, z);
      // Flat on the slope, long side along the walking direction.
      dummy.quaternion.setFromUnitVectors(up, normal);
      q.setFromAxisAngle(up, Math.atan2(t.x, t.z));
      dummy.quaternion.multiply(q);
      dummy.scale.set(0.065, 1, 0.13);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.count = 0;
  }, [total]);
  useFrame(() => {
    if (ref.current) ref.current.count = Math.min(total, Math.floor(sp.u * total));
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, total]} frustumCulled={false} renderOrder={1}>
      <cylinderGeometry args={[1, 1, 0.01, 7]} />
      <meshBasicMaterial color={S.print} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </instancedMesh>
  );
}

/* ---------------- Rocks and pines ---------------- */

/** Paints a geometry face by face: `bright` where it faces the moon, `dark` elsewhere. */
function bake(g: THREE.BufferGeometry, dark: string, bright: string) {
  const geo = g.index ? g.toNonIndexed() : g;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  c0.set(dark);
  c1.set(bright);
  const c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    d.fromBufferAttribute(pos, f + 2);
    n.copy(b).sub(a).cross(d.clone().sub(a)).normalize();
    c.copy(c0).lerp(c1, THREE.MathUtils.smoothstep(n.dot(LIGHT), 0.15, 0.85));
    for (let v = 0; v < 3; v++) col.set([c.r, c.g, c.b], (f + v) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

function offPath(x: number, z: number) {
  for (let i = 0; i <= 60; i++) {
    PATH.getPointAt(i / 60, a);
    if (Math.hypot(a.x - x, a.z - z) < 4) return false;
  }
  return true;
}

function Rocks({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => bake(new THREE.DodecahedronGeometry(1, 0), S.rock, S.rockLit), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(714);
    let placed = 0;
    while (placed < count) {
      const ang = (rnd() - 0.5) * Math.PI * 1.5;
      const r = 8 + rnd() * 72;
      const x = PEAK.x + Math.sin(ang) * r;
      const z = PEAK.z + Math.cos(ang) * r;
      if (!offPath(x, z)) continue;
      const s = 0.4 + Math.pow(rnd(), 2) * 1.5;
      dummy.position.set(x, groundY(x, z) + s * 0.1, z);
      dummy.quaternion.identity();
      dummy.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
      dummy.scale.set(s * (1 + rnd() * 0.6), s * 0.75, s);
      dummy.updateMatrix();
      m.setMatrixAt(placed++, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}

function pineGeometry() {
  const parts = [
    [1, 1.5, 0.75],
    [0.76, 1.3, 1.65],
    [0.5, 1.1, 2.4],
  ].map(([r, h, y]) => {
    const cone = new THREE.ConeGeometry(r, h, 6);
    cone.translate(0, y, 0);
    return bake(cone, S.pine, S.pineSnow);
  });
  const trunk = new THREE.CylinderGeometry(0.1, 0.13, 0.5, 5);
  trunk.translate(0, 0.25, 0);
  parts.push(bake(trunk, S.rock, S.rock));
  for (const p of parts) {
    p.deleteAttribute("uv");
    p.deleteAttribute("normal");
  }
  return mergeGeometries(parts)!;
}

function Pines({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => pineGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(928);
    let placed = 0;
    while (placed < count) {
      const ang = (rnd() - 0.5) * Math.PI * 1.7;
      const r = 40 + rnd() * 80;
      const x = PEAK.x + Math.sin(ang) * r;
      const z = PEAK.z + Math.cos(ang) * r;
      if (!offPath(x, z)) continue;
      const s = 0.8 + rnd() * 1.1;
      dummy.position.set(x, groundY(x, z) - 0.1, z);
      dummy.quaternion.identity();
      dummy.rotation.set(0, rnd() * 6, 0);
      dummy.scale.set(s, s * (0.9 + rnd() * 0.4), s);
      dummy.updateMatrix();
      m.setMatrixAt(placed++, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}

/* ---------------- Far mountains: flat silhouettes fading into the haze ---------------- */

const FAR_RINGS = [
  { distance: 300, height: 60, scale: 1.4, step: 45, color: S.far[0], seed: 3 },
  { distance: 470, height: 95, scale: 2, step: 60, color: S.far[1], seed: 11 },
];

function FarMountains() {
  const group = useRef<THREE.Group>(null);
  // They are upright strips: from high above they'd read as ribbons, and the clouds hide them anyway.
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = camera.position.y < 330;
  });
  const parts = useMemo(
    () =>
      FAR_RINGS.flatMap((ring) => {
        const list = [];
        for (let deg = 0; deg < 360; deg += ring.step) {
          const yaw = (deg * Math.PI) / 180 + ring.seed;
          list.push({
            geometry: ridgeGeometry(ring.height, ring.seed + deg * 0.13),
            x: PEAK.x + Math.sin(yaw) * ring.distance,
            z: PEAK.z + Math.cos(yaw) * ring.distance,
            yaw,
            scale: ring.scale,
            color: ring.color,
          });
        }
        return list;
      }),
    [],
  );
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  return (
    <group ref={group}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} position={[p.x, -4, p.z]} rotation={[0, p.yaw, 0]} scale={[p.scale, 1, 1]}>
          <meshBasicMaterial color={p.color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- All of it ---------------- */

export function Mountain({ sp, rocks, pines }: { sp: SnowState; rocks: number; pines: number }) {
  const geometry = useMemo(() => mountainGeometry(), []);
  const trail = useMemo(() => pathGeometry(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      trail.dispose();
    },
    [geometry, trail],
  );
  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors />
      </mesh>
      <mesh geometry={trail} renderOrder={1}>
        <meshBasicMaterial color={S.trail} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} side={THREE.DoubleSide} />
      </mesh>
      {/* Snow plain reaching the far mountains */}
      <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2600, 40]} />
        <meshBasicMaterial color={S.plain} />
      </mesh>
      <Footprints sp={sp} />
      <Rocks count={rocks} />
      <Pines count={pines} />
      <FarMountains />
    </>
  );
}
