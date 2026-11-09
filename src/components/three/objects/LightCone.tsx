"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HILL_TOP, MOON, PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import { CONE_FRAG, CONE_VERT } from "../shaders";
import { radialTexture } from "../textures";
import { useStage } from "../stage";
import { Motes } from "./Motes";

const WHITE = new THREE.Color(PALETTE.moonlight).multiplyScalar(1.15);
const BLUE = new THREE.Color(PALETTE.sapphireBright).multiplyScalar(1.4);
const BASE_RADIUS = 1.5;

/** Volumetric-looking light cone from the moon down to the hill top (+ dust inside, + ground pool). */
export function LightCone({ dust }: { dust: number }) {
  const { state } = useStage();
  const target = useMemo(() => HILL_TOP.clone().add(new THREE.Vector3(0, -0.15, 0)), []);
  const length = useMemo(() => MOON.position.distanceTo(target), [target]);
  const { position, quaternion } = useMemo(() => {
    const dir = MOON.position.clone().sub(target).normalize();
    return {
      position: target.clone().add(dir.clone().multiplyScalar(length / 2)),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    };
  }, [target, length]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: WHITE.clone() } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const uniforms = material.uniforms;

  /** Dust inside the lower part of the cone (in cone-local space: y from -length/2 upward). */
  const dustPositions = useMemo(() => {
    const rnd = seeded(4242);
    const arr = new Float32Array(dust * 3);
    for (let i = 0; i < dust; i++) {
      const h = Math.pow(rnd(), 1.6) * 9; // meters above the hill
      const radius = BASE_RADIUS * (1 - h / length) * Math.sqrt(rnd()) * 0.9;
      const a = rnd() * Math.PI * 2;
      arr.set([Math.cos(a) * radius, -length / 2 + h, Math.sin(a) * radius], i * 3);
    }
    return arr;
  }, [dust, length]);

  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const poolTex = useMemo(() => radialTexture("pool", 0, 1), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uOpacity.value = state.coneOpacity;
    uniforms.uColor.value.copy(WHITE).lerp(BLUE, state.coneBlue);
    if (pool.current) {
      pool.current.opacity = state.coneOpacity * 0.55;
      pool.current.color.copy(uniforms.uColor.value);
    }
  });

  return (
    <>
      <group position={position} quaternion={quaternion}>
        <mesh renderOrder={2} material={material}>
          <coneGeometry args={[BASE_RADIUS, length, 48, 1, true]} />
        </mesh>
        <Motes positions={dustPositions} color={PALETTE.dust} scale={10} drift={0.18} seed={3} opacity={() => Math.min(1, state.coneOpacity)} jitter={() => state.tremble} />
      </group>
      <mesh position={[target.x, target.y + 0.2, target.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[BASE_RADIUS * 3.4, BASE_RADIUS * 3.4]} />
        <meshBasicMaterial
          ref={pool}
          map={poolTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          opacity={0}
        />
      </mesh>
    </>
  );
}
