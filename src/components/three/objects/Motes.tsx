"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MOTE_FRAG, MOTE_VERT } from "../shaders";

type Props = {
  positions: Float32Array;
  color: THREE.ColorRepresentation;
  /** Point size multiplier (world-ish units) */
  scale?: number;
  /** How far each mote wanders */
  drift?: number;
  /** Called every frame to get the current opacity (0..1) */
  opacity?: () => number;
  /** Called every frame to get a fast tremble amount (0..1) */
  jitter?: () => number;
  seed?: number;
};

/** Glowing particles (fireflies / dust) drifting with per-particle phase. */
export function Motes({ positions, color, scale = 14, drift = 0.35, opacity, jitter, seed = 1 }: Props) {
  const dpr = useThree((s) => s.viewport.dpr);
  const geometry = useMemo(() => {
    const n = positions.length / 3;
    const phase = new Float32Array(n);
    const size = new Float32Array(n);
    let s = seed * 9301;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) {
      phase[i] = r();
      size[i] = 1.2 + r() * 2.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [positions, seed]);

  // Created imperatively: a JSX `uniforms` prop would be copied and per-frame writes would be lost.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uPR: { value: 1 },
          uDrift: { value: drift },
          uScale: { value: scale },
          uColor: { value: new THREE.Color(color).multiplyScalar(1.6) },
          uOpacity: { value: 1 },
          uJitter: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [drift, scale, color],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const u = material.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uPR.value = dpr;
    if (opacity) u.uOpacity.value = opacity();
    if (jitter) u.uJitter.value = jitter();
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
