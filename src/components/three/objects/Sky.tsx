"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { CAMERA_FINAL, MOON, PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import { CLOUD_FRAG, CLOUD_VERT, NEBULA_FRAG, SKY_FRAG, SKY_VERT, STAR_FRAG, STAR_VERT } from "../shaders";
import { useStage } from "../stage";

/** Scenes 0, 1 and the invitation use the defaults; the lake passes its own silver-blue look. */
type Look = typeof PALETTE | typeof PALETTE.lake;
type Grade = typeof GRADE | typeof GRADE.lake;

/*
 * Note: shader materials are created with `new THREE.ShaderMaterial` and passed via `material={…}`.
 * Passing `uniforms={…}` as a JSX prop gives the material a copy, so per-frame writes never reach the GPU.
 */

/** Gradient sky dome with a soft glow around the moon. */
function SkyDome({ look, grade }: { look: Look; grade: Grade }) {
  const { state } = useStage();
  // Sky glow around the moon; softer than the moon itself so the sapphire stays on the moon.
  const white = useMemo(() => new THREE.Color(look.moonHalo), [look]);
  const blue = useMemo(() => new THREE.Color(look.skyGlowAfter), [look]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: {
          uTop: { value: new THREE.Color(look.skyTop) },
          uHorizon: { value: new THREE.Color(look.skyHorizon) },
          uMid: { value: new THREE.Color(PALETTE.skyMid) },
          uMidAmt: { value: grade.skyMidAmt },
          uMist: { value: new THREE.Color(look.skyMist) },
          uMistAmt: { value: grade.skyMist },
          uMistHeight: { value: grade.skyMistHeight },
          uMistWarm: { value: new THREE.Color(PALETTE.skyMistWarm) },
          uMistWarmAmt: { value: grade.skyMistWarm },
          uGlow: { value: white.clone() },
          uMoonDir: { value: MOON.position.clone().normalize() },
          uGlowAmt: { value: 0.5 },
          uWave: { value: 0 },
          uWaveColor: { value: new THREE.Color(PALETTE.sapphireBright).multiplyScalar(GRADE.skyWave) },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [look, grade, white],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const u = material.uniforms;
    u.uGlow.value.copy(white).lerp(blue, state.moonBlue);
    u.uGlowAmt.value = grade.skyGlow + state.moonGlow * grade.skyGlowPerMoon + state.bloomBoost * 0.12;
    u.uWave.value = state.burst;
  });
  return (
    <mesh renderOrder={-10} material={material}>
      <sphereGeometry args={[450, 32, 16]} />
    </mesh>
  );
}

/** Star points with random size / brightness; some of them twinkle. */
function Stars({ count, color }: { count: number; color: string }) {
  const { state } = useStage();
  const dpr = useThree((s) => s.viewport.dpr);
  const geometry = useMemo(() => {
    const rnd = seeded(808);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const bright = new Float32Array(count);
    const phase = new Float32Array(count);
    const twinkle = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = rnd() * Math.PI * 2;
      const y = 0.04 + Math.pow(rnd(), 0.8) * 0.96;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(theta) * r * 400, y * 400, Math.sin(theta) * r * 400], i * 3);
      const big = rnd() < 0.06;
      size[i] = big ? 3 + rnd() * 2.5 : 0.8 + rnd() * 1.8;
      bright[i] = big ? 0.9 : 0.25 + rnd() * 0.65;
      phase[i] = rnd();
      twinkle[i] = big || rnd() < 0.25 ? 1 : 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkle, 1));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uBoost: { value: 0 }, uColor: { value: new THREE.Color(color) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPR.value = dpr;
    material.uniforms.uBoost.value = state.starBoost;
  });
  return <points geometry={geometry} material={material} renderOrder={-9} frustumCulled={false} />;
}

/** A thin band of cloud drifting slowly, partly crossing in front of the moon. */
function CloudBand({ position, scale, seed, opacity, look }: { position: THREE.Vector3; scale: [number, number]; seed: number; opacity: number; look: Look }) {
  const { state } = useStage();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uOpacity: { value: opacity },
          uColor: { value: new THREE.Color(look.cloud) },
        },
        transparent: true,
        depthWrite: false,
        fog: false,
        // lookAt() points the plane's front away from the camera; the lake keeps its clear sky.
        side: look === PALETTE ? THREE.DoubleSide : THREE.FrontSide,
      }),
    [seed, opacity, look],
  );
  useEffect(() => () => material.dispose(), [material]);
  const quaternion = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(position, CAMERA_FINAL, new THREE.Vector3(0, 1, 0));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, [position]);
  const base = useMemo(() => new THREE.Color(look.cloud), [look]);
  const tint = useMemo(() => new THREE.Color(look.cloudAfter), [look]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uColor.value.copy(base).lerp(tint, state.moonBlue * 0.7);
  });
  return (
    <mesh position={position} quaternion={quaternion} scale={[scale[0], scale[1], 1]} renderOrder={-5} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/** Offsets of the nebula patches from the moon, in the final shot's camera plane (m at 300 m). */
const NEBULAE = [
  { x: 70, y: -8, w: 240, h: 170, seed: 3.1 },
  { x: -95, y: 55, w: 210, h: 150, seed: 7.4 },
  { x: 150, y: -48, w: 250, h: 120, seed: 11.8 },
];

/** Faint colored clouds behind the moon and stars. */
function Nebula() {
  const { placed, materials } = useMemo(() => {
    const dir = MOON.position.clone().sub(CAMERA_FINAL).normalize();
    const right = dir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(dir);
    const center = CAMERA_FINAL.clone().addScaledVector(dir, 300);
    const placed = NEBULAE.map((n) => {
      const position = center.clone().addScaledVector(right, n.x).addScaledVector(up, n.y);
      const m = new THREE.Matrix4().lookAt(position, CAMERA_FINAL, new THREE.Vector3(0, 1, 0));
      return { ...n, position, quaternion: new THREE.Quaternion().setFromRotationMatrix(m) };
    });
    const materials = NEBULAE.map(
      (n, i) =>
        new THREE.ShaderMaterial({
          vertexShader: CLOUD_VERT,
          fragmentShader: NEBULA_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uSeed: { value: n.seed },
            uOpacity: { value: PALETTE.nebula[i][1] },
            uColor: { value: new THREE.Color(PALETTE.nebula[i][0]) },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
          fog: false,
          // lookAt() points the plane's front away from the camera.
          side: THREE.DoubleSide,
        }),
    );
    return { placed, materials };
  }, []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useFrame(({ clock }) => {
    materials.forEach((m) => (m.uniforms.uTime.value = clock.elapsedTime));
  });
  return (
    <>
      {placed.map((n, i) => (
        <mesh key={i} position={n.position} quaternion={n.quaternion} scale={[n.w, n.h, 1]} material={materials[i]} renderOrder={-8}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  );
}

export function Sky({ stars, look = PALETTE, grade = GRADE }: { stars: number; look?: Look; grade?: Grade }) {
  const cloudA = useMemo(
    () => CAMERA_FINAL.clone().lerp(MOON.position, 0.78).add(new THREE.Vector3(6, -9, 0)),
    [],
  );
  const cloudB = useMemo(
    () => CAMERA_FINAL.clone().lerp(MOON.position, 1.25).add(new THREE.Vector3(-60, -30, 0)),
    [],
  );
  return (
    <>
      <SkyDome look={look} grade={grade} />
      {look === PALETTE && <Nebula />}
      <Stars count={stars} color={look.star} />
      <CloudBand position={cloudA} scale={[150, 16]} seed={1.7} opacity={0.38} look={look} />
      <CloudBand position={cloudB} scale={[320, 34]} seed={5.3} opacity={0.26} look={look} />
    </>
  );
}
