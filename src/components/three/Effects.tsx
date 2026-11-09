"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, type BloomEffect, type ChromaticAberrationEffect } from "postprocessing";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { useStage } from "./stage";

/** Resting chromatic aberration — barely visible, only at the frame edges. */
const CA_BASE = 0.0004;
/** Extra offset at a full spike (impact / burst). */
const CA_SPIKE = 0.0045;

/**
 * Bloom (moon, crystal, beams) + light chromatic aberration + vignette + film grain.
 * `quality` drops effects on slow devices: 2 = all, 1 = no grain / no CA, 0 = no post-processing.
 */
export function Effects({ quality, threshold = GRADE.bloomThreshold }: { quality: 0 | 1 | 2; threshold?: number }) {
  const { state } = useStage();
  const bloom = useRef<BloomEffect>(null);
  const ca = useRef<ChromaticAberrationEffect>(null);
  const caOffset = useMemo(() => new THREE.Vector2(CA_BASE, CA_BASE * 0.6), []);

  useFrame(() => {
    // Softer bloom while the moon is white (it veils the sky), fuller once it is sapphire.
    if (bloom.current) bloom.current.intensity = GRADE.bloom + state.moonBlue * GRADE.bloomMoonBlue + state.bloomBoost * GRADE.bloomBoost;
    if (ca.current) {
      const o = CA_BASE + state.aberration * CA_SPIKE;
      ca.current.offset.set(o, o * 0.6);
    }
  });

  if (quality === 0) return null;

  const bloomEl = (
    <Bloom ref={bloom} mipmapBlur luminanceThreshold={threshold} luminanceSmoothing={0.2} intensity={GRADE.bloom} radius={0.5} />
  );

  // EffectComposer only accepts effect elements as children, so branch instead of conditional children.
  return quality === 2 ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloomEl}
      <ChromaticAberration ref={ca} offset={caOffset} radialModulation modulationOffset={0.25} />
      <Vignette offset={GRADE.vignetteOffset} darkness={GRADE.vignetteDarkness} />
      {/* OVERLAY keeps blacks black (SCREEN lifted the whole night sky to grey) */}
      <Noise blendFunction={BlendFunction.OVERLAY} opacity={GRADE.grain} />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloomEl}
      <Vignette offset={GRADE.vignetteOffset} darkness={GRADE.vignetteDarkness} />
    </EffectComposer>
  );
}
