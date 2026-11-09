"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { CAMERA, detectTier, PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { Effects } from "../Effects";
import { ReadySignal } from "../ReadySignal";
import { StageContext, type StageDom } from "../stage";
import { Cosmos } from "./Cosmos";
import { BASE_SPEED, SPACE_BUDGET, SPACE_CAMERA, targetOffset, trackY, trackZ, type SpaceState } from "./spaceState";
import { Track } from "./Track";
import { Train } from "./Train";

const point = new THREE.Vector3();
const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const lockPos = new THREE.Vector3();
const lockLook = new THREE.Vector3();

/**
 * Advances the world and drives the camera from three controls:
 * cameraBlend (tracking → locked), cameraTarget (which car), cameraRelease (let go at the end).
 */
function SpaceCamera({ sp }: { sp: SpaceState }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    camera.fov = size.width < size.height ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    camera.near = 0.3;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }, delta) => {
    // The train never stops: only this line moves it.
    sp.travel += BASE_SPEED * sp.trainSpeed * sp.flow * Math.min(delta, 0.1);

    const portrait = size.width < size.height;
    const tracking = portrait ? SPACE_CAMERA.trackPortrait : SPACE_CAMERA.trackLandscape;
    const lock = portrait ? SPACE_CAMERA.lockPortrait : SPACE_CAMERA.lockLandscape;
    const t = sp.stage.reduced ? 0 : clock.elapsedTime;

    // Riding with the locomotive (the camera doesn't wait for `entry`: the train drives into frame).
    point.set(0, trackY(sp.travel), trackZ(sp.travel));
    pos.copy(point).add(tracking.pos);
    look.copy(point).add(tracking.look);

    // Riding with the target car.
    const x = -targetOffset(sp.cameraTarget);
    point.set(x, trackY(x + sp.travel), trackZ(x + sp.travel));
    const s = x + sp.travel;
    // Stay square to the car: the camera turns with the track's bends, so the photo never looks skewed.
    const bend = (trackZ(s + 3) - trackZ(s - 3)) / 6;
    const slope = (trackY(s + 3) - trackY(s - 3)) / 6;
    lockPos.copy(point).add(lock.pos);
    lockPos.x -= bend * lock.pos.z;
    lockLook.copy(point).add(lock.look);
    pos.lerp(lockPos, sp.cameraBlend);
    look.lerp(lockLook, sp.cameraBlend);

    // Let go: stay behind and watch the train run off.
    if (sp.cameraRelease > 0) {
      pos.lerp(lockPos.copy(point).add(SPACE_CAMERA.releasePos), sp.cameraRelease);
      look.lerp(lockLook.copy(point).add(SPACE_CAMERA.releaseLook), sp.cameraRelease);
    }

    pos.x += Math.sin(t * 0.31) * 0.03;
    pos.y += Math.sin(t * 0.43) * 0.025;
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.rotateZ(Math.atan(slope) * sp.cameraBlend * (1 - sp.cameraRelease));
  });
  return null;
}

type Props = {
  sp: SpaceState;
  photos: MemoryPhoto[];
  dom: StageDom;
  onReady: () => void;
  onOpenPhoto: (i: number) => void;
};

/** Open space above a sea of clouds, the floating track and the high-speed train. */
export default function SpaceStage3D({ sp, photos, dom, onReady, onOpenPhoto }: Props) {
  const tier = useMemo(() => detectTier(), []);
  const base = SPACE_BUDGET[tier];
  const [quality, setQuality] = useState<0 | 1 | 2>(tier === "high" ? 2 : 1);
  const ctx = useMemo(() => ({ state: sp.stage, dom }), [sp, dom]);
  const dpr: [number, number] = quality === 2 ? [1, 2] : quality === 1 ? [1, 1.5] : [1, 1];
  // Fewer particles when the frame rate drops.
  const k = quality === 2 ? 1 : quality === 1 ? 0.75 : 0.45;
  const budget = useMemo(
    () => ({
      dome: Math.round(base.dome * k),
      far: Math.round(base.far * k),
      mid: Math.round(base.mid * k),
      near: Math.round(base.near * k),
      dust: Math.round(base.dust * k),
      puffs: Math.round(base.puffs * k),
      belt: Math.round(base.belt * k),
    }),
    [base, k],
  );

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      flat
      camera={{ fov: 60, near: 0.3, far: 2200, position: [8, 2, 15] }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(PALETTE.space.skyTop))}
    >
      <StageContext.Provider value={ctx}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => (q > 0 ? ((q - 1) as 0 | 1) : 0))}
          flipflops={3}
          onFallback={() => setQuality(0)}
        />
        <SpaceCamera sp={sp} />
        <hemisphereLight args={[PALETTE.space.lightSky, PALETTE.space.lightGround, GRADE.spaceHemi]} />
        <directionalLight position={[-20, 30, 40]} intensity={GRADE.spaceFill} color={PALETTE.space.lightFill} />
        <Cosmos sp={sp} budget={budget} />
        <Track sp={sp} pylons={base.pylons} lights={base.lights} />
        <Train sp={sp} photos={photos} onOpen={onOpenPhoto} />
        <Effects quality={quality} threshold={GRADE.spaceBloomThreshold} />
        <ReadySignal onReady={onReady} />
      </StageContext.Provider>
    </Canvas>
  );
}
