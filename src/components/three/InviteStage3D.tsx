"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { INVITATION } from "@/config/invitation";
import { BUDGET, CAMERA, CAMERA_FINAL, detectTier, MOON, PALETTE } from "@/config/world";
import { Atmosphere } from "./Atmosphere";
import { Effects } from "./Effects";
import { Moon } from "./objects/Moon";
import { Sky } from "./objects/Sky";
import { Snow } from "./objects/Snow";
import { Terrain } from "./objects/Terrain";
import { ReadySignal } from "./ReadySignal";
import { StageContext, type StageDom, type StageState } from "./stage";

const MOON_SCREEN = INVITATION.moonScreen;
const UP = new THREE.Vector3(0, 1, 0);
const MOON_DIR = MOON.position.clone().sub(CAMERA_FINAL).normalize();
const pos = new THREE.Vector3();
const dir = new THREE.Vector3();
const right = new THREE.Vector3();
const projected = new THREE.Vector3();

/**
 * Camera for the invitation: from the prologue's final spot, turned so the moon lands at
 * MOON_SCREEN; drifts very slightly (never perfectly still).
 */
function InviteCameraRig({ onMoon, reduced }: { onMoon: (x: number, y: number) => void; reduced: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    camera.fov = size.width < size.height ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    camera.near = 0.05;
    camera.far = 700;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    const portrait = size.width < size.height;
    const target = portrait ? MOON_SCREEN.portrait : MOON_SCREEN.landscape;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const yaw = Math.atan(target.x * tanV * camera.aspect);
    const pitch = Math.atan(target.y * tanV);
    // Look direction = moon direction turned so the moon ends up at the target spot.
    dir.copy(MOON_DIR).applyAxisAngle(UP, yaw);
    right.copy(dir).cross(UP).normalize();
    dir.applyAxisAngle(right, -pitch);

    pos.copy(CAMERA_FINAL);
    pos.x += Math.sin(t * 0.21) * 0.25;
    pos.y += Math.sin(t * 0.17) * 0.12;
    pos.z += Math.sin(t * 0.13) * 0.2;
    camera.position.copy(pos);
    dir.x += Math.sin(t * 0.11) * 0.004;
    camera.lookAt(pos.add(dir));
    camera.rotateZ(-0.012 + Math.sin(t * 0.09) * 0.004);
    camera.updateMatrixWorld();

    // Report the moon's screen position (px) so the HTML light beam can hang from it.
    projected.copy(MOON.position).project(camera);
    onMoon(((projected.x + 1) / 2) * size.width, ((1 - projected.y) / 2) * size.height);
  });

  return null;
}

/** Sparkle columns spread in front of the camera (finale "snow"). */
function frontBottoms(rnd: () => number, out: Float32Array, i: number) {
  const fwd = new THREE.Vector3(MOON_DIR.x, 0, MOON_DIR.z).normalize();
  const side = fwd.clone().cross(UP);
  const d = 5 + rnd() * 22;
  const lateral = (rnd() - 0.5) * d * 1.6;
  const p = CAMERA_FINAL.clone().addScaledVector(fwd, d).addScaledVector(side, lateral);
  out.set([p.x, CAMERA_FINAL.y - 7 + d * 0.3, p.z], i * 3);
}

type Props = {
  state: StageState;
  /** prefers-reduced-motion: camera stays still */
  reduced: boolean;
  onReady: () => void;
  /** Called every frame with the moon's position on screen, in CSS pixels */
  onMoon: (x: number, y: number) => void;
};

/** Night sky + sapphire moon + hills behind the invitation card. */
export default function InviteStage3D({ state, reduced, onReady, onMoon }: Props) {
  const tier = useMemo(() => detectTier(), []);
  const budget = BUDGET[tier];
  const [quality, setQuality] = useState<0 | 1 | 2>(tier === "high" ? 2 : 1);
  // The invitation has no stick figure, so no bubble anchor is needed.
  const dom = useMemo<StageDom>(() => ({ bubbleAnchor: { current: null } }), []);
  const ctx = useMemo(() => ({ state, dom }), [state, dom]);
  const dpr: [number, number] = quality === 2 ? [1, 2] : quality === 1 ? [1, 1.5] : [1, 1];
  const snow = Math.round(budget.snow * (quality === 2 ? 1 : quality === 1 ? 0.7 : 0.4));

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      flat
      camera={{ fov: 60, near: 0.05, far: 700, position: CAMERA_FINAL.toArray() }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(PALETTE.skyTop))}
    >
      <StageContext.Provider value={ctx}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => (q > 0 ? ((q - 1) as 0 | 1) : 0))}
          flipflops={3}
          onFallback={() => setQuality(0)}
        />
        <InviteCameraRig onMoon={onMoon} reduced={reduced} />
        <Atmosphere />
        <Sky stars={budget.stars} />
        <Moon />
        <Terrain grass={Math.round(budget.grass * 0.6)} rocks={budget.rocks} flowers={budget.flowers} />
        <Snow count={snow} bottoms={frontBottoms} height={16} sizeScale={1.5} />
        <Snow count={Math.ceil(snow * 0.1)} bottoms={frontBottoms} height={16} sizeScale={1.5} color={PALETTE.snowAccents[0]} seed={61} />
        <Snow count={Math.ceil(snow * 0.07)} bottoms={frontBottoms} height={16} sizeScale={1.5} color={PALETTE.snowAccents[1]} seed={62} />
        <Effects quality={quality} />
        <ReadySignal onReady={onReady} />
      </StageContext.Provider>
    </Canvas>
  );
}
