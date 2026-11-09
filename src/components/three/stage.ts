/**
 * Shared, mutable "stage state". The GSAP master timeline tweens these plain numbers / vectors,
 * and every 3D component reads them inside useFrame. This keeps one timeline in charge of
 * everything (objects, camera, shaders, post-processing) without React re-renders.
 */
import { createContext, useContext } from "react";
import * as THREE from "three";
import { CAMERA } from "@/config/world";

export function createStageState() {
  return {
    /** Curtain: 0 closed → 1 fully gathered; alpha fades it out entirely */
    curtainOpen: 0,
    curtainAlpha: 1,

    /** Camera: progress along the flight path, extra offset, look target */
    camT: 0,
    camOffset: new THREE.Vector3(),
    lookTarget: CAMERA.lookStart.clone(),
    /** 0..1 blend of the look target toward the flying crystal */
    lookCrystal: 0,
    camShake: 0,

    /** Moon */
    moonGlow: 0.45,
    moonBlue: 0,
    moonPulse: 0,

    /** Light cone (white → blue) */
    coneOpacity: 0,
    coneBlue: 0,

    /** Crystal */
    crystalOpacity: 1,
    crystalFlash: 0,
    crystalShake: 0,
    crystalFly: 0,
    /** 0 = intact, (0..1) = shards exploding / spiralling into the moon, 1 = done */
    shatter: 0,

    /** Stick figure: assembly progress and wave weight */
    figure: 0,
    wave: 0,

    /** Post / atmosphere */
    bloomBoost: 0,
    fogBlue: 0,
    /** Chromatic aberration spike (0..1) */
    aberration: 0,

    /* ---- VFX: crystal lift-off ---- */
    /** Light ring spreading on the ground as the crystal leaves (0 → 1 progress) */
    liftRing: 0,
    /** Grass / dust tremble around the hill (0..1) */
    tremble: 0,

    /* ---- VFX: impact & absorption ---- */
    /** Blue shockwave ring at the moon on impact (0 → 1 progress) */
    impactRing: 0,
    /** Moon squash right before the final burst (0..1) */
    moonSquash: 0,
    /** Big ring + sweeping wave across the sky after the last shard (0 → 1 progress) */
    burst: 0,
    /** Falling blue "snow" dust after the burst (opacity 0..1) */
    snow: 0,
    /** Extra star twinkle after the burst (0..1) */
    starBoost: 0,

    /** Idle loops (moon breathing, figure bob) fade in after the timeline ends */
    idle: 0,
    reduced: false,
  };
}

export type StageState = ReturnType<typeof createStageState>;

export type StageDom = {
  /** HTML element positioned every frame above the stick figure's head */
  bubbleAnchor: React.RefObject<HTMLDivElement | null>;
};

export const StageContext = createContext<{ state: StageState; dom: StageDom } | null>(null);

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStage must be used inside <StageContext>");
  return ctx;
}
