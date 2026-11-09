"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GRADE } from "@/config/theme";
import { CAMERA_FINAL, FLOWER_BEDS, HILL, PALETTE, TERRAIN, terrainHeight } from "@/config/world";
import { fbm, noise2 } from "@/lib/noise";
import { seeded } from "@/lib/random";
import { addRim } from "../rim";
import { useStage } from "../stage";
import { Motes } from "./Motes";
import { Stream } from "./Stream";

/** Give every triangle of a non-indexed geometry one flat color (classic low-poly look). */
function paintFaces(g: THREE.BufferGeometry, colorAt: (cx: number, cy: number, cz: number, i: number) => THREE.Color) {
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const c = colorAt(cx, cy, cz, f / 3);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/* ---------------- Ground ---------------- */

function Ground() {
  const geometry = useMemo(() => {
    const g0 = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.segments, TERRAIN.segments);
    g0.rotateX(-Math.PI / 2);
    g0.translate(0, 0, TERRAIN.centerZ);
    const pos = g0.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    const g = g0.toNonIndexed();
    g0.dispose();
    const low = new THREE.Color(PALETTE.groundLow);
    const high = new THREE.Color(PALETTE.groundHigh);
    const rnd = seeded(31);
    const c = new THREE.Color();
    paintFaces(g, (x, y, z) => {
      // Height sets the tone, soft patches keep the land from reading as one flat color.
      const patch = fbm(x * 0.13 + 11, z * 0.13 - 4, 3);
      const t = THREE.MathUtils.clamp((y + 0.6) / 6 + patch * 0.42, 0, 1);
      return c.copy(low).lerp(high, t).multiplyScalar(0.88 + rnd() * 0.24);
    });
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(
    () => addRim(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }), PALETTE.rim, GRADE.rimGround),
    [],
  );
  return <mesh geometry={geometry} material={material} />;
}

/* ---------------- Mountain layers ---------------- */

const LAYERS = [
  { z: -50, height: 12, seed: 2.1, color: PALETTE.mountains[0], x: 8 },
  { z: -84, height: 20, seed: 7.7, color: PALETTE.mountains[1], x: -20 },
  { z: -124, height: 30, seed: 13.3, color: PALETTE.mountains[2], x: 15 },
  { z: -170, height: 40, seed: 21.9, color: PALETTE.mountains[3], x: -10 },
];

/** Ridge line height at local x of a mountain layer. */
function ridgeTop(x: number, height: number, seed: number) {
  const n = fbm(x * 0.016 + seed, seed * 1.3, 4);
  const sharp = 1 - Math.abs(noise2(x * 0.035 + seed * 3, seed));
  return height * THREE.MathUtils.clamp(0.5 + 0.55 * n + 0.25 * sharp, 0.12, 1.25);
}

export function ridgeGeometry(height: number, seed: number) {
  const width = 380;
  const g0 = new THREE.PlaneGeometry(width, 1, 76, 5);
  const pos = g0.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const v = pos.getY(i) + 0.5; // 0 bottom → 1 ridge line
    const top = ridgeTop(x, height, seed);
    const base = -6;
    const jitter = noise2(x * 0.2, v * 4 + seed) * height * 0.07 * v * (1 - v) * 4;
    pos.setXYZ(i, x, base + v * (top - base) + jitter, noise2(x * 0.08 + seed, v * 3) * 4 * v);
  }
  const g = g0.toNonIndexed();
  g0.dispose();
  g.computeVertexNormals();
  return g;
}

function Mountains() {
  const geos = useMemo(() => LAYERS.map((l) => ridgeGeometry(l.height, l.seed)), []);
  const materials = useMemo(
    () => LAYERS.map((l) => addRim(new THREE.MeshStandardMaterial({ color: l.color, flatShading: true, roughness: 1 }), PALETTE.rim, GRADE.rimGround)),
    [],
  );
  return (
    <>
      {LAYERS.map((l, i) => (
        <mesh key={i} geometry={geos[i]} position={[l.x, 0, l.z]} material={materials[i]} />
      ))}
    </>
  );
}

/* ---------------- Grass & rocks ---------------- */

const tmp = new THREE.Object3D();

function scatter(count: number, seed: number, avoidTop: boolean) {
  const rnd = seeded(seed);
  const out: { x: number; z: number; r: number }[] = [];
  while (out.length < count) {
    // Bias toward the valley floor and the hill where the camera looks.
    const nearHill = rnd() < 0.35;
    const x = nearHill ? HILL.x + (rnd() - 0.5) * 10 : -13 + rnd() * 28;
    const z = nearHill ? HILL.z + (rnd() - 0.5) * 10 : -28 + rnd() * 48;
    if (avoidTop && Math.hypot(x - HILL.x, z - HILL.z) < 0.9) continue;
    out.push({ x, z, r: rnd() });
  }
  return out;
}

function Grass({ count, time, tremble }: { count: number; time: { value: number }; tremble: { value: number } }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // A tuft = 3 short blades leaning outward (reads as grass, not as a field of spikes).
  const geometry = useMemo(() => {
    const blades = [0, 2.1, 4.2].map((a, i) => {
      const h = [0.26, 0.2, 0.17][i];
      const b = new THREE.ConeGeometry(0.035, h, 3, 1, true);
      b.translate(0, h / 2, 0);
      b.rotateZ(0.35 + i * 0.08);
      b.rotateY(a);
      return b;
    });
    const g = mergeGeometries(blades)!;
    blades.forEach((b) => b.dispose());
    return g;
  }, []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.uniforms.uTremble = tremble;
      shader.vertexShader = "uniform float uTime;\nuniform float uTremble;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float h = max(position.y, 0.0);
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        transformed.x += sin(uTime * 1.3 + ip.x * 0.7 + ip.y * 0.5) * 0.14 * h;
        transformed.z += cos(uTime * 1.05 + ip.y * 0.6) * 0.07 * h;
        // Lift-off tremble, strongest near the hill top and fading with distance.
        float near = 1.0 - smoothstep(1.0, ${HILL.radius * 1.6}, distance(ip, vec2(${HILL.x.toFixed(1)}, ${HILL.z.toFixed(1)})));
        transformed.x += sin(uTime * 38.0 + ip.y * 9.0) * 0.06 * h * uTremble * near;
        transformed.z += cos(uTime * 33.0 + ip.x * 7.0) * 0.06 * h * uTremble * near;`,
      );
    };
    return m;
  }, [time, tremble]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tones = PALETTE.grass.map((c) => new THREE.Color(c));
    const tone = new THREE.Color();
    scatter(count, 77, true).forEach((p, i) => {
      tmp.position.set(p.x, terrainHeight(p.x, p.z) - 0.02, p.z);
      tmp.rotation.set((p.r - 0.5) * 0.3, p.r * 6.28, (p.r - 0.5) * 0.2);
      const s = 0.7 + p.r * 0.8;
      tmp.scale.set(s, s * (0.75 + p.r * 0.5), s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      // Tones come in patches, with a little variation from tuft to tuft.
      const k = THREE.MathUtils.clamp((noise2(p.x * 0.17 + 5, p.z * 0.17) * 0.5 + 0.5) * tones.length - 0.5 + (p.r - 0.5) * 0.9, 0, tones.length - 1);
      const a = Math.floor(k);
      mesh.setColorAt(i, tone.copy(tones[a]).lerp(tones[Math.min(a + 1, tones.length - 1)], k - a));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
}

/** Flower places: small clusters, a good share of them around the hill's foot. */
function flowerSpots(count: number) {
  const rnd = seeded(909);
  const clusters = Math.max(6, Math.round(count / 9));
  const centers = Array.from({ length: clusters }, (_, i) => {
    const near = i % 2 === 0;
    if (i < FLOWER_BEDS.length) return { x: FLOWER_BEDS[i][0], z: FLOWER_BEDS[i][1], color: i % PALETTE.flowers.length };
    return {
      x: near ? HILL.x + (rnd() - 0.5) * 11 : -12 + rnd() * 26,
      z: near ? HILL.z + 1 + rnd() * 7 : -26 + rnd() * 44,
      color: i % PALETTE.flowers.length,
    };
  });
  const out: { x: number; z: number; y: number; r: number; color: number }[] = [];
  while (out.length < count) {
    const c = centers[out.length % clusters];
    const x = c.x + (rnd() - 0.5) * 1.5;
    const z = c.z + (rnd() - 0.5) * 1.5;
    if (Math.hypot(x - HILL.x, z - HILL.z) < 0.9) continue;
    const r = rnd();
    out.push({ x, z, r, y: terrainHeight(x, z) + 0.1 + r * 0.08, color: rnd() < 0.8 ? c.color : (c.color + 1) % PALETTE.flowers.length });
  }
  return out;
}

/** Tiny glowing flowers among the grass: heads plus a soft halo. */
function Flowers({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => flowerSpots(count), [count]);
  const halos = useMemo(
    () =>
      PALETTE.flowers.map((_, c) => {
        const own = spots.filter((s) => s.color === c);
        const pos = new Float32Array(own.length * 3);
        own.forEach((s, i) => pos.set([s.x, s.y, s.z], i * 3));
        return pos;
      }),
    [spots],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    spots.forEach((p, i) => {
      // Smaller close to the camera: a flower right in front of the lens must not turn into a big polygon.
      const near = THREE.MathUtils.clamp(Math.hypot(p.x - CAMERA_FINAL.x, p.z - CAMERA_FINAL.z) / 5, 0.3, 1);
      const s = (0.018 + p.r * 0.02) * near;
      tmp.position.set(p.x, p.y, p.z);
      tmp.rotation.set(p.r * 4, p.r * 7, 0);
      tmp.scale.set(s, s * 0.7, s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, c.set(PALETTE.flowers[p.color]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spots]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {halos.map((pos, c) => (
        <Motes key={c} positions={pos} color={PALETTE.flowers[c]} scale={7} drift={0.015} seed={31 + c} />
      ))}
    </>
  );
}

/** A few lit windows far away on a hill (x is world space, lift = fraction up the slope). */
const WINDOWS = [
  { x: -6.4, lift: 0.7 },
  { x: -5.6, lift: 0.64 },
  { x: -4.5, lift: 0.74 },
  { x: -3.7, lift: 0.66 },
  { x: 1.2, lift: 0.72 },
  { x: 2.3, lift: 0.66 },
];

function Windows() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const layer = LAYERS[0];
    WINDOWS.forEach((w, i) => {
      const lx = w.x - layer.x;
      tmp.position.set(w.x, ridgeTop(lx, layer.height, layer.seed) * w.lift, layer.z + 5);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(0.15, 0.2, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, WINDOWS.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={PALETTE.window} toneMapped={false} fog={false} />
    </instancedMesh>
  );
}

function Rocks({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(
    () => addRim(new THREE.MeshStandardMaterial({ color: PALETTE.rock, flatShading: true, roughness: 0.9 }), PALETTE.rim, GRADE.rimRock),
    [],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    scatter(count, 501, true).forEach((p, i) => {
      const s = 0.12 + p.r * 0.38;
      tmp.position.set(p.x, terrainHeight(p.x, p.z) + s * 0.2, p.z);
      tmp.rotation.set(p.r * 3, p.r * 9, p.r * 5);
      tmp.scale.set(s * (1 + p.r * 0.6), s * 0.7, s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

export function Terrain({ grass, rocks, flowers }: { grass: number; rocks: number; flowers: number }) {
  const { state } = useStage();
  // Shared by reference with the grass shader (assigned in onBeforeCompile), so writes stick.
  const time = useMemo(() => ({ value: 0 }), []);
  const tremble = useMemo(() => ({ value: 0 }), []);
  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
    tremble.value = state.tremble;
  });
  return (
    <>
      <Ground />
      <Mountains />
      <Grass count={grass} time={time} tremble={tremble} />
      <Stream />
      <Rocks count={rocks} />
      <Flowers count={flowers} />
      <Windows />
    </>
  );
}
