"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { CAMERA, detectTier, PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { seeded } from "@/lib/random";
import { Effects } from "../Effects";
import { Motes } from "../objects/Motes";
import { ReadySignal } from "../ReadySignal";
import { Mountain } from "../snow/Mountain";
import { ClimbMoon, CloudSea } from "../snow/SnowStage3D";
import { SNOW_CAMERA } from "../snow/snowState";
import { Snowfall } from "../snow/Snowfall";
import { Stations } from "../snow/Stations";
import { DomeStars, SkyDome } from "../space/Cosmos";
import { StageContext, type StageDom } from "../stage";
import { Beam, Bridge } from "./Bridge";
import { Boards } from "./Boards";
import { BOARDS, BRIDGE_BUDGET, BRIDGE_CAMERA, type BridgeState, frameAt, ISLAND, newFrame, SUMMIT } from "./bridgeState";
import { Island, Lamp } from "./Island";
import { Traveler } from "./Traveler";

const S = PALETTE.snow3;
const SPACE = PALETTE.space;
const B = PALETTE.bridge;

/* ---------------- Camera ---------------- */

const frame = newFrame();
const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const target = new THREE.Vector3();
const targetLook = new THREE.Vector3();
const summitPos = new THREE.Vector3();
const summitLook = new THREE.Vector3();

function BridgeCamera({ sp }: { sp: BridgeState }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog(S.fog, 130, 1250), []);

  useLayoutEffect(() => {
    camera.fov = size.width < size.height ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    camera.near = 0.2;
    camera.far = 3200;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }) => {
    if (scene.fog !== fog) scene.fog = fog;
    const portrait = size.width < size.height;
    const summit = portrait ? SNOW_CAMERA.summitPortrait : SNOW_CAMERA.summitLandscape;
    const behind = portrait ? BRIDGE_CAMERA.behindPortrait : BRIDGE_CAMERA.behindLandscape;
    const back = portrait ? BRIDGE_CAMERA.backShotPortrait : BRIDGE_CAMERA.backShotLandscape;
    const lock = portrait ? BRIDGE_CAMERA.lockPortrait : BRIDGE_CAMERA.lockLandscape;
    const end = portrait ? BRIDGE_CAMERA.endPortrait : BRIDGE_CAMERA.endLandscape;
    const t = sp.stage.reduced ? 0 : clock.elapsedTime;

    frameAt(sp.u, frame);
    const { point: p, tangent: tan, right: r } = frame;

    // Following: behind the narrator.
    pos.copy(p).addScaledVector(tan, -behind.back).addScaledVector(r, behind.side);
    pos.y = p.y + behind.up;
    look.copy(p).addScaledVector(tan, behind.ahead);
    look.y = p.y + behind.lookUp;

    // First shot: exactly where year 3 ended.
    if (sp.follow < 1) {
      summitPos.set(SUMMIT.x + summit.side, SUMMIT.y + summit.height, SUMMIT.z - summit.back);
      summitLook.set(SUMMIT.x, SUMMIT.y + summit.lookUp, SUMMIT.z + summit.lookOut);
      pos.lerp(summitPos, 1 - sp.follow);
      look.lerp(summitLook, 1 - sp.follow);
      // Rising a little on the way.
      pos.y += Math.sin(sp.follow * Math.PI) * 3;
    }

    // Looking back: the narrator walking toward us, the mountain shrinking behind.
    if (sp.backShot > 0) {
      target.copy(p).addScaledVector(tan, back.ahead).addScaledVector(r, back.side);
      target.y = p.y + back.up;
      targetLook.copy(p);
      targetLook.y = p.y + back.lookUp;
      pos.lerp(target, sp.backShot);
      look.lerp(targetLook, sp.backShot);
      // Swing around the narrator instead of through them.
      pos.addScaledVector(r, Math.sin(sp.backShot * Math.PI) * 9);
    }

    // Locked on a photo board, from across the bridge.
    if (sp.lock > 0) {
      const b = BOARDS[Math.min(sp.station, BOARDS.length - 1)];
      target.copy(b.center).addScaledVector(b.normal, lock.distance);
      target.y = b.deckY + lock.height;
      targetLook.copy(b.center);
      targetLook.y = b.deckY + lock.lookUp;
      pos.lerp(target, sp.lock);
      look.lerp(targetLook, sp.lock);
    }

    // Last shot: lower, with the lighthouse above the narrator.
    if (sp.end > 0) {
      target.copy(p).addScaledVector(tan, -end.back);
      target.y = p.y + end.up;
      targetLook.copy(p);
      targetLook.y = p.y + end.lookUp;
      pos.lerp(target, sp.end);
      look.lerp(targetLook, sp.end);
    }

    pos.x += Math.sin(t * 0.37) * 0.04;
    pos.y += Math.sin(t * 0.53) * 0.03;
    camera.position.copy(pos);
    camera.lookAt(look);

    // The moon behind us keeps growing a little on the way.
    sp.snow.alt = 1 + sp.u * 0.6;
  });
  return null;
}

/* ---------------- Sky lanterns ---------------- */

const LANTERN_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute float aPhase;
uniform float uTime;
uniform float uAmount;
uniform float uHeight;
varying float vY;
varying float vA;
void main(){
  float life = fract(aPhase * 7.3 + uTime * (0.016 + aPhase * 0.014));
  vec3 c = aOffset;
  c.y += life * uHeight;
  c.x += sin(uTime * 0.3 + aPhase * 30.0) * 1.6;
  c.z += cos(uTime * 0.26 + aPhase * 20.0) * 1.6;
  // More of them appear as the party grows; each fades in and out at the ends of its rise.
  float on = step(aPhase, uAmount);
  vA = on * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.82, 1.0, life));
  vY = uv.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(position + c, 1.0);
}
`;
const LANTERN_FRAG = /* glsl */ `
uniform vec3 uLow;
uniform vec3 uHigh;
varying float vY;
varying float vA;
void main(){
  if (vA < 0.01) discard;
  gl_FragColor = vec4(mix(uLow, uHigh, vY), vA);
  #include <colorspace_fragment>
}
`;

function SkyLanterns({ sp, count }: { sp: BridgeState; count: number }) {
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(2610);
    const cyl = new THREE.CylinderGeometry(0.6, 0.4, 1.1, 6, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", cyl.attributes.position);
    g.setAttribute("uv", cyl.attributes.uv);
    g.setIndex(cyl.index);
    g.instanceCount = count;
    const off = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const cz = ISLAND.center.z;
    for (let i = 0; i < count; i++) {
      // Thicker around the island, a few along the way.
      const k = Math.pow(rnd(), 0.6);
      const z = THREE.MathUtils.lerp(SUMMIT.z + 24, cz + 30, k);
      const side = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 30);
      off.set([ISLAND.center.x * k + side, 28 + rnd() * 8, z], i * 3);
      phase[i] = rnd();
    }
    g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: LANTERN_VERT,
      fragmentShader: LANTERN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uHeight: { value: 95 },
        uLow: { value: new THREE.Color(B.skyLanternLow).multiplyScalar(1.3) },
        uHigh: { value: new THREE.Color(B.skyLanternHigh) },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
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
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime + 200;
    material.uniforms.uAmount.value = sp.festival;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}

/** Fireflies drifting over the deck. */
function Fireflies({ count }: { count: number }) {
  const sets = useMemo(() => {
    const rnd = seeded(77);
    const make = (n: number) => {
      const out = new Float32Array(n * 3);
      const f = newFrame();
      for (let i = 0; i < n; i++) {
        frameAt(rnd(), f);
        out.set([f.point.x + (rnd() - 0.5) * 16, f.point.y - 1.5 + rnd() * 6, f.point.z + (rnd() - 0.5) * 8], i * 3);
      }
      return out;
    };
    return { gold: make(Math.ceil(count * 0.7)), mint: make(Math.ceil(count * 0.3)) };
  }, [count]);
  return (
    <>
      <Motes positions={sets.gold} color={B.fireflyWarm} scale={10} drift={0.5} seed={13} />
      <Motes positions={sets.mint} color={B.fireflyMint} scale={9} drift={0.5} seed={17} />
    </>
  );
}

/* ---------------- Stage ---------------- */

type Props = {
  sp: BridgeState;
  photos: MemoryPhoto[];
  pastPhotos: MemoryPhoto[];
  dom: StageDom;
  onReady: () => void;
  onOpenPhoto: (i: number) => void;
};

const noop = () => {};

export default function BridgeStage3D({ sp, photos, pastPhotos, dom, onReady, onOpenPhoto }: Props) {
  const tier = useMemo(() => detectTier(), []);
  const base = BRIDGE_BUDGET[tier];
  const [quality, setQuality] = useState<0 | 1 | 2>(tier === "high" ? 2 : 1);
  const ctx = useMemo(() => ({ state: sp.stage, dom }), [sp, dom]);
  const dpr: [number, number] = quality === 2 ? [1, 2] : quality === 1 ? [1, 1.5] : [1, 1];
  const k = quality === 2 ? 1 : quality === 1 ? 0.75 : 0.45;
  const stars = useMemo(() => () => 1, []);
  const drift = useMemo(() => () => 0.25, []);
  const aurora = useMemo(() => () => 1.02 - sp.u * 0.2, [sp]);
  const sea = useMemo(() => () => 1, []);
  // Year 3's snow thins out as soon as the narrator leaves the mountain.
  const flakes = useMemo(() => () => 1 - THREE.MathUtils.smoothstep(sp.u, 0.02, 0.3), [sp]);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      flat
      camera={{ fov: 60, near: 0.2, far: 3200, position: [SUMMIT.x, SUMMIT.y + 2, SUMMIT.z - 6] }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(SPACE.skyTop))}
    >
      <StageContext.Provider value={ctx}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => (q > 0 ? ((q - 1) as 0 | 1) : 0))}
          flipflops={3}
          onFallback={() => setQuality(0)}
        />
        <BridgeCamera sp={sp} />
        <hemisphereLight args={[S.lightSky, S.lightGround, 2.6]} />
        <directionalLight position={[-30, 40, 40]} intensity={1.6} color={PALETTE.moonlight} />
        <SkyDome drift={drift} aurora={aurora} />
        <DomeStars count={Math.round(base.dome * k)} fade={stars} />
        <ClimbMoon sp={sp.snow} />
        <Mountain sp={sp.snow} rocks={base.rocks} pines={base.pines} />
        <Stations sp={sp.snow} photos={pastPhotos} onOpen={noop} />
        <CloudSea sp={sp.snow} y={26} seed={0.31} fade={sea} />
        <CloudSea sp={sp.snow} y={35} seed={0.62} fade={sea} />
        <Bridge sp={sp} railStep={base.railStep} />
        <Beam sp={sp} />
        <Island sp={sp} />
        <Lamp sp={sp} />
        <Boards sp={sp} photos={photos} onOpen={onOpenPhoto} />
        <Traveler sp={sp} />
        <SkyLanterns sp={sp} count={Math.round(base.lanterns * k)} />
        <Fireflies count={Math.round(base.fireflies * k)} />
        <Snowfall sp={sp.snow} count={Math.round(base.snow * k)} opacity={flakes} />
        <Effects quality={quality} threshold={GRADE.snowBloomThreshold} />
        <ReadySignal onReady={onReady} />
      </StageContext.Provider>
    </Canvas>
  );
}

