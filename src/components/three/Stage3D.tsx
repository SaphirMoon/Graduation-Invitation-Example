"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { BUDGET, detectTier, HILL, PALETTE, terrainHeight } from "@/config/world";
import { seeded } from "@/lib/random";
import { Atmosphere } from "./Atmosphere";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Crystal, CrystalSparks, CrystalTrail, Shards } from "./objects/Crystal";
import { Curtain3D } from "./objects/Curtain3D";
import { LightCone } from "./objects/LightCone";
import { Moon } from "./objects/Moon";
import { Rings } from "./objects/Rings";
import { Snow } from "./objects/Snow";
import { Motes } from "./objects/Motes";
import { Sky } from "./objects/Sky";
import { StickFigure3D } from "./objects/StickFigure3D";
import { Terrain } from "./objects/Terrain";
import { ReadySignal } from "./ReadySignal";
import { StageContext, type StageDom, type StageState } from "./stage";

type Props = {
  state: StageState;
  dom: StageDom;
  onReady: () => void;
};

function Fireflies({ count }: { count: number }) {
  const positions = useMemo(() => {
    const rnd = seeded(99);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const near = rnd() < 0.4;
      const x = near ? HILL.x + (rnd() - 0.5) * 9 : -11 + rnd() * 25;
      const z = near ? HILL.z + (rnd() - 0.5) * 9 : -26 + rnd() * 44;
      arr.set([x, terrainHeight(x, z) + 0.3 + rnd() * 2.8, z], i * 3);
    }
    return arr;
  }, [count]);
  // Mostly warm gold, a few mint ones.
  const split = Math.floor(count * 0.8) * 3;
  return (
    <>
      <Motes positions={positions.subarray(0, split)} color={PALETTE.firefly} scale={16} drift={0.4} seed={7} />
      <Motes positions={positions.subarray(split)} color={PALETTE.fireflyAlt} scale={14} drift={0.4} seed={11} />
    </>
  );
}

export default function Stage3D({ state, dom, onReady }: Props) {
  const tier = useMemo(() => detectTier(), []);
  const budget = BUDGET[tier];
  // 2 = full post-processing, 1 = no film grain + lower dpr, 0 = no post-processing at all
  const [quality, setQuality] = useState<0 | 1 | 2>(tier === "high" ? 2 : 1);
  const ctx = useMemo(() => ({ state, dom }), [state, dom]);
  const dpr: [number, number] = quality === 2 ? [1, 2] : quality === 1 ? [1, 1.5] : [1, 1];
  // Particle budget also shrinks when the performance monitor lowers quality.
  const pScale = quality === 2 ? 1 : quality === 1 ? 0.7 : 0.4;
  const n = (v: number) => Math.max(1, Math.round(v * pScale));

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      flat
      camera={{ fov: 60, near: 0.05, far: 700, position: [1.8, 2.1, 22] }}
      onCreated={({ gl, scene, camera }) => {
        gl.setClearColor(new THREE.Color(PALETTE.skyTop));
        // Debug hook for automated screenshots (?t=…): expose the scene for inspection.
        if (new URLSearchParams(window.location.search).has("t")) {
          Object.assign(window, { __three: { scene, camera, gl, state } });
        }
      }}
    >
      <StageContext.Provider value={ctx}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => (q > 0 ? ((q - 1) as 0 | 1) : 0))}
          flipflops={3}
          onFallback={() => setQuality(0)}
        />
        <CameraRig />
        <Atmosphere />
        <Sky stars={budget.stars} />
        <Moon />
        <Terrain grass={budget.grass} rocks={budget.rocks} flowers={budget.flowers} />
        <LightCone dust={budget.dust} />
        <Crystal />
        <CrystalTrail />
        <CrystalSparks count={n(budget.sparks)} />
        <Shards ghosts={quality === 0 ? 2 : budget.ghosts} />
        <Rings />
        <Fireflies count={n(budget.fireflies)} />
        <Snow count={n(budget.snow)} />
        <Snow count={n(budget.snow * 0.1)} color={PALETTE.snowAccents[0]} seed={61} />
        <Snow count={n(budget.snow * 0.07)} color={PALETTE.snowAccents[1]} seed={62} />
        <StickFigure3D />
        <Curtain3D />
        <Effects quality={quality} />
        <ReadySignal onReady={onReady} />
      </StageContext.Provider>
    </Canvas>
  );
}
