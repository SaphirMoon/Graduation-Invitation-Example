"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import { radialTexture } from "../textures";
import { type BridgeState, ISLAND, LAMP, SUMMIT } from "./bridgeState";

const I = PALETTE.bridge.island;
const LIGHT = new THREE.Vector3(-0.5, 0.65, -0.57).normalize();

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const n = new THREE.Vector3();

/** Flat-painted, with the moonlight baked in facet by facet. */
function paint(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.translate(x, y, z);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const out = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    c.fromBufferAttribute(pos, f + 2);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    out.copy(base).multiplyScalar(0.72 + 0.42 * Math.max(0, n.dot(LIGHT)) + 0.1 * n.y);
    for (let v = 0; v < 3; v++) col.set([out.r, out.g, out.b], (f + v) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return g;
}

function jitter(g: THREE.BufferGeometry, seed: number, amount: number) {
  // Same nudge for the same corner, so no cracks open.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const s = Math.sin(pos.getX(i) * 12.3 + pos.getY(i) * 45.1 + pos.getZ(i) * 77.7 + seed) * 43758.5;
    const r = s - Math.floor(s) - 0.5;
    pos.setXYZ(i, pos.getX(i) * (1 + r * amount), pos.getY(i), pos.getZ(i) * (1 + r * amount));
  }
  return g;
}

function islandGeometry() {
  const { radius: R, towerHeight: H } = ISLAND;
  const rnd = seeded(4040);
  const parts: THREE.BufferGeometry[] = [];
  // Rock hanging under the top, in two tiers.
  parts.push(paint(jitter(new THREE.CylinderGeometry(R, R * 0.62, 7, 11, 1), 1, 0.12), I.rockLight, 0, -3.6, 0));
  parts.push(paint(jitter(new THREE.CylinderGeometry(R * 0.62, 2, 15, 9, 2), 2, 0.2), I.rock, 0, -14.6, 0));
  // Grassy top with lighter patches.
  parts.push(paint(jitter(new THREE.CylinderGeometry(R, R, 0.5, 11), 1, 0.12), I.grass, 0, -0.25, 0));
  for (let i = 0; i < 6; i++) {
    const ang = rnd() * 6.28;
    const r = 6 + rnd() * 12;
    parts.push(paint(new THREE.CylinderGeometry(3 + rnd() * 3, 3.6, 0.08, 7), I.grassLight, Math.cos(ang) * r, 0.03, Math.sin(ang) * r));
  }
  // Lighthouse: white with coral bands, a gallery, a lamp room and a roof.
  const body = H - 3.4;
  parts.push(paint(new THREE.CylinderGeometry(2.1, 3.3, body, 8), I.tower, 0, body / 2, 0));
  for (const k of [0.22, 0.52, 0.82]) {
    const r = 3.3 + (2.1 - 3.3) * k;
    parts.push(paint(new THREE.CylinderGeometry(r - 0.06, r + 0.08, body * 0.09, 8), I.band, 0, body * k, 0));
  }
  parts.push(paint(new THREE.CylinderGeometry(2.9, 2.5, 0.4, 8), I.band, 0, body + 0.1, 0));
  parts.push(paint(new THREE.ConeGeometry(2.5, 1.9, 8), I.band, 0, H + 0.95, 0));
  // Base of the lamp room: slim posts around the light.
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * 6.28 + 0.4;
    parts.push(paint(new THREE.BoxGeometry(0.14, 3.2, 0.14), I.tower, Math.cos(ang) * 1.8, H - 1.6, Math.sin(ang) * 1.8));
  }
  // Little houses and trees, left and right of the path to the tower.
  const houses: [number, number, number][] = [
    [-11, 3, 2.3],
    [10, 1, 2.6],
    [12.5, -8, 2],
    [-13, -7, 2.2],
    [-4, 13, 1.9],
    [6, 14, 2.1],
  ];
  for (const [x, z, s] of houses) {
    parts.push(paint(new THREE.BoxGeometry(s * 1.5, s, s * 1.3), I.house, x, s / 2, z));
    const roof = new THREE.ConeGeometry(s * 1.15, s * 0.8, 4);
    roof.rotateY(Math.PI / 4);
    parts.push(paint(roof, I.roof, x, s + s * 0.4, z));
  }
  for (let i = 0; i < 12; i++) {
    const ang = rnd() * 6.28;
    const r = 15 + rnd() * 7;
    const s = 0.9 + rnd() * 0.9;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    // None across the path.
    if (z < -6 && Math.abs(x) < 8) continue;
    parts.push(paint(new THREE.ConeGeometry(s, s * 2.6, 6), I.tree, x, s * 1.3 + 0.3, z));
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Warm windows, lit along with the tower. */
function windowGeometry() {
  const { towerHeight: H } = ISLAND;
  const body = H - 3.4;
  const parts: THREE.BufferGeometry[] = [];
  for (const [k, ang] of [
    [0.34, 4.35],
    [0.65, 5],
    [0.92, 4.7],
  ] as const) {
    const r = 3.3 + (2.1 - 3.3) * k;
    const g = new THREE.BoxGeometry(0.75, 1.1, 0.2);
    g.rotateY(Math.PI / 2 - ang);
    g.translate(Math.cos(ang) * r, body * k, Math.sin(ang) * r);
    parts.push(g);
  }
  const room = new THREE.CylinderGeometry(1.45, 1.45, 3, 8);
  room.translate(0, H - 1.7, 0);
  parts.push(room);
  const houses: [number, number, number][] = [
    [-11, 3, 2.3],
    [10, 1, 2.6],
    [12.5, -8, 2],
    [-13, -7, 2.2],
    [-4, 13, 1.9],
    [6, 14, 2.1],
  ];
  for (const [x, z, s] of houses) {
    for (const off of [-0.34, 0.34]) {
      const g = new THREE.BoxGeometry(s * 0.34, s * 0.4, 0.08);
      g.translate(x + off * s, s * 0.55, z - s * 0.66);
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Lamps around the island's edge. */
const LIGHT_RING = 26;
const TOWARD_BRIDGE = Math.atan2(SUMMIT.z - ISLAND.center.z, SUMMIT.x - ISLAND.center.x);

export function Island({ sp }: { sp: BridgeState }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => islandGeometry(), []);
  const windows = useMemo(() => windowGeometry(), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false, toneMapped: false }), []);
  const windowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: I.windowDark, transparent: true, opacity: 0, fog: false, toneMapped: false }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(I.window).multiplyScalar(1.4), transparent: true, opacity: 0, fog: false, toneMapped: false }), []);
  const ring = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.17, 0);
    const m = new THREE.InstancedMesh(g, ringMat, LIGHT_RING);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < LIGHT_RING; i++) {
      const ang = (i / LIGHT_RING) * Math.PI * 2;
      tmp.position.set(Math.cos(ang) * (ISLAND.radius - 1), 0.75, Math.sin(ang) * (ISLAND.radius - 1));
      // A gap where the bridge lands: the camera stands right there in the last shot.
      const gap = Math.abs(Math.atan2(Math.sin(ang - TOWARD_BRIDGE), Math.cos(ang - TOWARD_BRIDGE))) < 1;
      tmp.scale.setScalar(gap ? 0.0001 : 1);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.frustumCulled = false;
    return m;
  }, [ringMat]);
  const lit = useMemo(() => new THREE.Color(I.window).multiplyScalar(1.3), []);
  const dark = useMemo(() => new THREE.Color(I.windowDark), []);
  useEffect(
    () => () => {
      geometry.dispose();
      windows.dispose();
      material.dispose();
      windowMat.dispose();
      ringMat.dispose();
      ring.geometry.dispose();
      ring.dispose();
    },
    [geometry, windows, material, windowMat, ringMat, ring],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = sp.islandIn > 0.005;
    material.opacity = sp.islandIn;
    material.depthWrite = sp.islandIn > 0.6;
    windowMat.opacity = sp.islandIn;
    windowMat.color.copy(dark).lerp(lit, sp.tower);
    ringMat.opacity = sp.tower;
  });
  return (
    <group ref={group} position={ISLAND.center}>
      <mesh geometry={geometry} material={material} />
      <mesh geometry={windows} material={windowMat} />
      <primitive object={ring} />
    </group>
  );
}

/** The far light from year 3, which turns out to be the lighthouse lamp. It answers the lantern. */
export function Lamp({ sp }: { sp: BridgeState }) {
  const sprite = useRef<THREE.Sprite>(null);
  const flare = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => radialTexture("far-lamp", 0.04, 1.2), []);
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: tex, color: I.window, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), [tex]);
  const flareMat = useMemo(() => new THREE.SpriteMaterial({ map: tex, color: I.flash, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), [tex]);
  useEffect(
    () => () => {
      haloMat.dispose();
      flareMat.dispose();
    },
    [haloMat, flareMat],
  );
  useFrame(({ clock, camera }) => {
    const pulse = sp.stage.reduced ? 0.85 : 0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.7);
    const far = camera.position.distanceTo(LAMP) / 142;
    haloMat.opacity = 0.8 * pulse;
    sprite.current?.scale.setScalar((9 + 2 * pulse + sp.tower * 3) * far);
    flareMat.opacity = sp.answer;
    flare.current?.scale.setScalar((12 + sp.answer * 42) * far);
  });
  return (
    <group position={LAMP}>
      <sprite ref={sprite} material={haloMat} renderOrder={9} />
      <sprite ref={flare} material={flareMat} renderOrder={10} />
      <mesh>
        <sphereGeometry args={[0.55, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(I.flash).multiplyScalar(1.6)} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
