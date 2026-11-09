"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IDLE_TIMING } from "@/config/timing";
import { GRADE } from "@/config/theme";
import { CAMERA_FINAL, MOON, PALETTE } from "@/config/world";
import { buildMoonGeometry } from "../moonGeometry";
import { absorbedFraction, absorbPulse } from "../shards";
import { radialTexture } from "../textures";
import { useStage } from "../stage";

const WHITE = new THREE.Color(PALETTE.moonlight);
const BLUE = new THREE.Color(PALETTE.sapphireBright);
const DEEP = new THREE.Color(PALETTE.sapphire);
const HALO = new THREE.Color(PALETTE.moonHalo);

/** Moon surface subdivision (faces = 20 × (detail + 1)²) */
const MOON_DETAIL = 20;
/** Compensates the darker maria/craters so the overall brightness stays as before */
const EMISSIVE_GAIN = 1.12;

/** Faceted moon with craters and maria (bright enough for bloom) + additive halo sprite. */
export function Moon() {
  const { state } = useStage();
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const haloSprite = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => radialTexture("halo", 0.05, 1.4), []);
  const c = useMemo(() => new THREE.Color(), []);
  const geometry = useMemo(
    () => buildMoonGeometry(MOON.radius, MOON_DETAIL, CAMERA_FINAL.clone().sub(MOON.position)),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Vertex colors (albedo + baked relief) also tint the emissive glow, so the surface
  // detail survives even though the moon is mostly self-lit.
  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;",
    );
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const breath = state.idle * Math.sin((t / IDLE_TIMING.moonBreath) * Math.PI);
    // Color steps toward sapphire with every absorbed shard; the final burst completes it.
    const b = Math.max(state.moonBlue, absorbedFraction(state.shatter));
    // One short flash per shard that reaches the moon.
    const pulse = absorbPulse(state.shatter);
    if (mat.current) {
      // sqrt curve: the glow leans blue early, so each absorbed shard reads as a visible step
      // instead of an over-exposed cyan-white (final b = 1 looks exactly as before).
      const eb = Math.sqrt(b);
      c.copy(WHITE).lerp(DEEP, eb);
      mat.current.color.copy(c).multiplyScalar(GRADE.moonAlbedo);
      c.copy(WHITE).lerp(BLUE, eb);
      mat.current.emissive.copy(c);
      // White moon kept just over the bloom threshold (a brighter one washed the whole sky grey);
      // the sapphire moon gets a boost so it still glows after the color change.
      mat.current.emissiveIntensity =
        EMISSIVE_GAIN *
        ((0.5 + state.moonGlow * 0.4) * (1 + b * 0.7) + state.bloomBoost * 0.6 + pulse * 0.55 + breath * 0.12);
    }
    if (halo.current && haloSprite.current) {
      halo.current.color.copy(HALO).lerp(BLUE, b);
      halo.current.opacity =
        0.12 + state.moonGlow * 0.2 + b * 0.12 + state.bloomBoost * 0.18 + pulse * 0.15 + breath * 0.05;
      const s = MOON.radius * (3.4 + state.bloomBoost * 1.2 + pulse * 0.4 + breath * 0.25);
      haloSprite.current.scale.set(s, s, 1);
    }
    // Small throb per absorbed shard; squash right before the final burst.
    if (group.current)
      group.current.scale.setScalar(1 + pulse * 0.035 - state.moonSquash * 0.13 + state.moonPulse * 0.12 + breath * 0.015);
  });

  return (
    <group ref={group} position={MOON.position}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          ref={mat}
          vertexColors
          flatShading
          toneMapped={false}
          fog={false}
          roughness={1}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>
      <sprite ref={haloSprite} renderOrder={-4}>
        <spriteMaterial
          ref={halo}
          map={tex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
    </group>
  );
}
