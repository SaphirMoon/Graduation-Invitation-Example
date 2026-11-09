"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { BUDGET, CAMERA, detectTier, PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { Atmosphere } from "../Atmosphere";
import { Effects } from "../Effects";
import { Moon } from "../objects/Moon";
import { Sky } from "../objects/Sky";
import { ridgeGeometry } from "../objects/Terrain";
import { ReadySignal } from "../ReadySignal";
import { CLOUD_FRAG, CLOUD_VERT } from "../shaders";
import { StageContext, type StageDom } from "../stage";
import { Boat } from "./Boat";
import { LAKE_CAMERA, LAKE_ORIGIN, LAKE_YAW, type LakeState } from "./lakeState";
import { Photos } from "./Photos";
import { Water } from "./Water";

const UP = new THREE.Vector3(0, 1, 0);
const local = new THREE.Vector3();
const look = new THREE.Vector3();

/** Lake-space camera: drifts down from the moon, then floats; moves ahead when the year ends. */
function LakeCamera({ lake }: { lake: LakeState }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    camera.fov = size.width < size.height ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    camera.near = 0.05;
    camera.far = 900;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }) => {
    const t = lake.stage.reduced ? 0 : clock.elapsedTime;
    const frame = size.width < size.height ? LAKE_CAMERA.portrait : LAKE_CAMERA.landscape;
    const intro = lake.camera.intro;
    const height = THREE.MathUtils.lerp(frame.height, LAKE_CAMERA.introHeight, intro);
    const pitch = THREE.MathUtils.lerp(frame.pitch, LAKE_CAMERA.introPitch, intro);

    local.set(Math.sin(t * 0.21) * 0.12, height + Math.sin(t * 0.33) * 0.05, lake.camera.z + Math.sin(t * 0.17) * 0.1);
    look.set(local.x + Math.sin(t * 0.13) * 0.03, local.y + Math.tan(pitch), local.z - 1);
    camera.position.copy(local).applyAxisAngle(UP, LAKE_YAW).add(LAKE_ORIGIN);
    camera.lookAt(look.applyAxisAngle(UP, LAKE_YAW).add(LAKE_ORIGIN));

    // Silver fog closing in at the end of the year.
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = THREE.MathUtils.lerp(GRADE.lake.fogNear, 1, lake.mist);
      fog.far = THREE.MathUtils.lerp(GRADE.lake.fogFar, 24, lake.mist);
    }
  });
  return null;
}

/* ---------------- Banks ---------------- */

const BANKS = [
  { x: -128, z: -96, yaw: 0.72, height: 15, seed: 3.3, color: PALETTE.lake.mountains[0] },
  { x: 128, z: -104, yaw: -0.72, height: 17, seed: 9.1, color: PALETTE.lake.mountains[1] },
  { x: 8, z: -210, yaw: 0, height: 22, seed: 15.7, color: PALETTE.lake.mountains[3] },
];

function Banks() {
  const geos = useMemo(() => BANKS.map((b) => ridgeGeometry(b.height, b.seed)), []);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <>
      {BANKS.map((b, i) => (
        <mesh key={i} geometry={geos[i]} position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
          <meshStandardMaterial color={b.color} flatShading roughness={1} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------- Mist over the water ---------------- */

function MistBand({ lake, z, width, height, y, seed, base }: { lake: LakeState; z: number; width: number; height: number; y: number; seed: number; base: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uOpacity: { value: base },
          uColor: { value: new THREE.Color(PALETTE.lake.fog) },
        },
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [seed, base],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime * 3;
    material.uniforms.uOpacity.value = base + lake.mist * (1 - base);
  });
  return (
    <mesh position={[0, y, z]} scale={[width, height, 1]} material={material} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/* ---------------- Stage ---------------- */

type Props = {
  lake: LakeState;
  photos: MemoryPhoto[];
  dom: StageDom;
  onReady: () => void;
  onOpenPhoto: (i: number) => void;
};

/** A moonlit lake: water, banks, thin mist, the boat and the photos. */
export default function LakeStage3D({ lake, photos, dom, onReady, onOpenPhoto }: Props) {
  const tier = useMemo(() => detectTier(), []);
  const budget = BUDGET[tier];
  const [quality, setQuality] = useState<0 | 1 | 2>(tier === "high" ? 2 : 1);
  const ctx = useMemo(() => ({ state: lake.stage, dom }), [lake, dom]);
  const dpr: [number, number] = quality === 2 ? [1, 2] : quality === 1 ? [1, 1.5] : [1, 1];

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      flat
      camera={{ fov: 60, near: 0.05, far: 900, position: [0, 17, 0] }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(PALETTE.lake.skyTop))}
    >
      <StageContext.Provider value={ctx}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => (q > 0 ? ((q - 1) as 0 | 1) : 0))}
          flipflops={3}
          onFallback={() => setQuality(0)}
        />
        <LakeCamera lake={lake} />
        <Atmosphere look={PALETTE.lake} grade={GRADE.lake} />
        <Sky stars={budget.stars} look={PALETTE.lake} grade={GRADE.lake} />
        <Moon />
        <group position={LAKE_ORIGIN} rotation={[0, LAKE_YAW, 0]}>
          <Water lake={lake} />
          <Banks />
          <MistBand lake={lake} z={-24} width={110} height={5} y={2.5} seed={2.2} base={0.2} />
          <MistBand lake={lake} z={-46} width={170} height={7} y={3.5} seed={6.1} base={0.24} />
          <MistBand lake={lake} z={-80} width={260} height={11} y={5.5} seed={9.4} base={0.3} />
          <Boat lake={lake} photoCount={photos.length} />
          <Photos lake={lake} photos={photos} onOpen={onOpenPhoto} />
        </group>
        <Effects quality={quality} threshold={GRADE.lakeBloomThreshold} />
        <ReadySignal onReady={onReady} />
      </StageContext.Provider>
    </Canvas>
  );
}
