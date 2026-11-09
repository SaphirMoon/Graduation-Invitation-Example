"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CRYSTAL_PATH, crystalScale, PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import { GHOST_VERT, MOTE_FRAG, RIM_FRAG, RIM_VERT, SPARK_VERT, TRAIL_FRAG, TRAIL_VERT } from "../shaders";
import { SHARD_COUNT, SHARDS, shardProgress, shardTransform } from "../shards";
import { useStage } from "../stage";

/*
 * Shader materials here are created with `new THREE.ShaderMaterial` and passed via `material={…}`:
 * a JSX `uniforms` prop is copied by R3F, so per-frame writes would never reach the GPU.
 */

const tmpV = new THREE.Vector3();

/** World position of the crystal for a given flight progress (shared with the camera rig). */
export function crystalPosition(t: number, out: THREE.Vector3) {
  return CRYSTAL_PATH.getPoint(THREE.MathUtils.clamp(t, 0, 1), out);
}

/** Elongated, flat-shaded sapphire octahedron with an emissive core and a fresnel rim. */
export function Crystal() {
  const { state } = useStage();
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const rimMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RIM_VERT,
        fragmentShader: RIM_FRAG,
        uniforms: { uColor: { value: new THREE.Color(PALETTE.crystalRim).multiplyScalar(1.6) }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => rimMaterial.dispose(), [rimMaterial]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    const visible = state.crystalOpacity > 0.001;
    g.visible = visible;
    if (!visible) return;

    const fly = state.crystalFly;
    crystalPosition(fly, tmpV);
    // Gentle hover while resting; jitter while shaking.
    const rest = 1 - Math.min(1, fly * 4);
    tmpV.y += Math.sin(t * 1.6) * 0.05 * rest;
    if (state.crystalShake > 0) {
      tmpV.x += (Math.random() - 0.5) * 0.07 * state.crystalShake;
      tmpV.z += (Math.random() - 0.5) * 0.07 * state.crystalShake;
    }
    g.position.copy(tmpV);
    g.scale.setScalar(crystalScale(fly));

    if (spin.current) {
      spin.current.rotation.y += dt * (0.6 + fly * 9);
      spin.current.rotation.z = Math.sin(fly * Math.PI) * 0.7 + Math.sin(t * 0.9) * 0.05;
    }
    // Brighter the higher it climbs (bloom picks this up).
    const heat = state.crystalFlash + fly * 1.6;
    if (mat.current) {
      mat.current.emissiveIntensity = 0.5 + heat * 5;
      mat.current.opacity = state.crystalOpacity;
    }
    rimMaterial.uniforms.uOpacity.value = (0.7 + heat * 1.5) * state.crystalOpacity;
    if (light.current) light.current.intensity = 1.5 + heat * 18;
  });

  return (
    <group ref={group}>
      <group ref={spin} scale={[1, 1.9, 1]}>
        <mesh>
          <octahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial
            ref={mat}
            color={PALETTE.sapphire}
            emissive={PALETTE.sapphireBright}
            flatShading
            roughness={0.25}
            metalness={0.1}
            transparent
            toneMapped={false}
          />
        </mesh>
        <mesh scale={1.1} material={rimMaterial}>
          <octahedronGeometry args={[0.32, 0]} />
        </mesh>
      </group>
      <pointLight ref={light} color={PALETTE.sapphireBright} distance={7} decay={1.6} />
    </group>
  );
}

/* ---------------- Trail (thin glowing ribbon following the curved flight) ---------------- */

const TRAIL_SEGMENTS = 48;
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const camFwd = new THREE.Vector3();
const pA = new THREE.Vector3();
const pB = new THREE.Vector3();
const tangent = new THREE.Vector3();
const side = new THREE.Vector3();
const toCam = new THREE.Vector3();

export function CrystalTrail() {
  const { state } = useStage();
  const camera = useThree((s) => s.camera);
  const { geometry, material } = useMemo(() => {
    const n = (TRAIL_SEGMENTS + 1) * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const aT = new Float32Array(n);
    const aSide = new Float32Array(n);
    const index: number[] = [];
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      aT[i * 2] = aT[i * 2 + 1] = i / TRAIL_SEGMENTS;
      aSide[i * 2] = -1;
      aSide[i * 2 + 1] = 1;
      if (i < TRAIL_SEGMENTS) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    g.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    g.setIndex(index);
    const m = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: { uColor: { value: new THREE.Color(PALETTE.crystalTrail).multiplyScalar(2.6) }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    return { geometry: g, material: m };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const fly = state.crystalFly;
    const on = fly > 0.002 && state.crystalOpacity > 0.001;
    if (mesh.current) mesh.current.visible = on;
    if (!on) return;
    camera.matrixWorld.extractBasis(camRight, camUp, camFwd);
    // Trail window grows as the crystal speeds up.
    const tail = Math.max(0, fly - (0.05 + fly * 0.22));
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
      const k = i / TRAIL_SEGMENTS;
      const t = tail + (fly - tail) * k;
      CRYSTAL_PATH.getPoint(t, pA);
      CRYSTAL_PATH.getPoint(Math.min(1, t + 0.002), pB);
      tangent.copy(pB).sub(pA).normalize();
      toCam.copy(camera.position).sub(pA).normalize();
      side.crossVectors(tangent, toCam).normalize();
      // Thin ribbon, wider near the head. Width grows with distance (≈ constant on screen),
      // otherwise it shrinks to a hairline once the crystal is ~150 m away.
      const w = (0.06 + t * t * 2.2) * (0.2 + 0.8 * k);
      pos.setXYZ(i * 2, pA.x - side.x * w, pA.y - side.y * w, pA.z - side.z * w);
      pos.setXYZ(i * 2 + 1, pA.x + side.x * w, pA.y + side.y * w, pA.z + side.z * w);
    }
    pos.needsUpdate = true;
    geometry.computeBoundingSphere();
    material.uniforms.uOpacity.value = Math.min(1, fly * 12) * state.crystalOpacity;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
}

/* ---------------- Glitter shed from the crystal while it flies ---------------- */

export function CrystalSparks({ count }: { count: number }) {
  const { state } = useStage();
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(2077);
    const pos = new Float32Array(count * 3);
    const spawn = new Float32Array(count);
    const dir = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = 0.02 + (i / count) * 0.96;
      spawn[i] = s;
      CRYSTAL_PATH.getPoint(s, pA);
      CRYSTAL_PATH.getPoint(Math.max(0, s - 0.01), pB);
      // Drift backward along the path, plus a random sideways kick.
      const back = pB.sub(pA).normalize();
      const scale = crystalScale(s) * 0.3;
      pos.set([pA.x + (rnd() - 0.5) * scale, pA.y + (rnd() - 0.5) * scale, pA.z + (rnd() - 0.5) * scale], i * 3);
      dir.set([back.x + (rnd() - 0.5) * 1.4, back.y + (rnd() - 0.5) * 1.4, back.z + (rnd() - 0.5) * 1.4], i * 3);
      size[i] = 0.8 + rnd() * 1.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSpawn", new THREE.BufferAttribute(spawn, 1));
    g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: {
        uFly: { value: 0 },
        uLife: { value: 0.16 },
        uPR: { value: 1 },
        uColor: { value: new THREE.Color(PALETTE.crystalSparks).multiplyScalar(2.8) },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    return { geometry: g, material: m };
  }, [count]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    material.uniforms.uFly.value = state.crystalOpacity > 0.001 ? state.crystalFly : 2;
    material.uniforms.uPR.value = dpr;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

/* ---------------- Shards (+ short glowing trails) ---------------- */

/** Progress gap between consecutive trail ghosts (smaller = tighter, shorter arc) */
const GHOST_LAG = 0.008;

const tmpO = new THREE.Object3D();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const fwd = new THREE.Vector3();

/** 3D shards: burst outward from the impact, orbit the moon 2–3 laps, then dive in, faster and smaller. */
export function Shards({ ghosts }: { ghosts: number }) {
  const { state } = useStage();
  const dpr = useThree((s) => s.viewport.dpr);
  const ref = useRef<THREE.InstancedMesh>(null);
  const points = useRef<THREE.Points>(null);

  // Trail = a few fading "ghost" sprites at slightly earlier progress values.
  const { geometry, material } = useMemo(() => {
    const n = SHARD_COUNT * ghosts;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: GHOST_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: {
        uPR: { value: 1 },
        uColor: { value: new THREE.Color(PALETTE.sapphireBright).multiplyScalar(2.2) },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    return { geometry: g, material: m };
  }, [ghosts]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const p = state.shatter;
    const on = p > 0 && p < 1;
    mesh.visible = on;
    if (points.current) points.current.visible = on;
    if (!on) return;
    camera.matrixWorld.extractBasis(right, up, fwd);
    const gPos = geometry.attributes.position as THREE.BufferAttribute;
    const gSize = geometry.attributes.aSize as THREE.BufferAttribute;
    const gAlpha = geometry.attributes.aAlpha as THREE.BufferAttribute;
    for (let i = 0; i < SHARD_COUNT; i++) {
      const s = SHARDS[i];
      const ps = shardProgress(i, p);
      const scale = ps >= 1 ? 0.0001 : shardTransform(i, ps, right, up, fwd, tmpO.position);
      tmpO.rotation.set(s.spin.x * ps * 7, s.spin.y * ps * 7, s.spin.z * ps * 7);
      tmpO.scale.setScalar(scale);
      tmpO.updateMatrix();
      mesh.setMatrixAt(i, tmpO.matrix);
      for (let k = 0; k < ghosts; k++) {
        const idx = i * ghosts + k;
        const pg = Math.max(0, ps - (k + 1) * GHOST_LAG);
        const live = ps > 0 && ps < 1 && pg > 0;
        const sc = shardTransform(i, pg, right, up, fwd, tmpV);
        gPos.setXYZ(idx, tmpV.x, tmpV.y, tmpV.z);
        gSize.setX(idx, live ? sc * (1 - k / ghosts) * 1.3 : 0);
        gAlpha.setX(idx, live ? 0.75 * (1 - k / ghosts) : 0);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    gPos.needsUpdate = gSize.needsUpdate = gAlpha.needsUpdate = true;
    material.uniforms.uPR.value = dpr;
  });

  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, SHARD_COUNT]} frustumCulled={false}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={PALETTE.sapphire}
          emissive={PALETTE.sapphireBright}
          emissiveIntensity={2.6}
          flatShading
          toneMapped={false}
          fog={false}
        />
      </instancedMesh>
      <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />
    </>
  );
}
