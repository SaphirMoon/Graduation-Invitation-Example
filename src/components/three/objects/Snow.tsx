"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_FINAL, HILL, PALETTE, terrainHeight } from "@/config/world";
import { seeded } from "@/lib/random";
import { MOTE_FRAG, SNOW_VERT } from "../shaders";
import { useStage } from "../stage";

const HEIGHT = 7;

type Props = {
  count: number;
  /** Writes the bottom of flake i's fall column (x, y, z) into `out`; default = around the hill */
  bottoms?: (rnd: () => number, out: Float32Array, i: number) => void;
  /** Fall height of each column */
  height?: number;
  /** Point size multiplier */
  sizeScale?: number;
  color?: string;
  /** Different seeds give different flakes */
  seed?: number;
};

function hillBottoms(rnd: () => number, out: Float32Array, i: number) {
  // Fill the prologue's final framing: from the hill back toward the camera.
  const x = HILL.x - 9 + rnd() * 14;
  const z = HILL.z - 6 + rnd() * (CAMERA_FINAL.z + 1 - (HILL.z - 6));
  out.set([x, terrainHeight(x, z) - 0.5, z], i * 3);
}

/** Glowing dust drifting down like snow (prologue aftermath, invitation finale). */
export function Snow({ count, bottoms = hillBottoms, height = HEIGHT, sizeScale = 1, color = PALETTE.snow, seed = 5150 }: Props) {
  const { state } = useStage();
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(seed);
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      bottoms(rnd, pos, i);
      phase[i] = rnd();
      size[i] = (0.8 + rnd() * 1.8) * sizeScale;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: SNOW_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: 1 },
        uHeight: { value: height },
        uColor: { value: new THREE.Color(color).multiplyScalar(1.5) },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry: g, material: m };
  }, [count, bottoms, height, sizeScale, color, seed]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPR.value = dpr;
    material.uniforms.uOpacity.value = state.snow;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} visible />;
}
