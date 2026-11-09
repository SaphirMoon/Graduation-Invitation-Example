"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HILL_TOP, IMPACT_POINT, MOON, PALETTE } from "@/config/world";
import { ringTexture } from "../textures";
import { useStage, type StageState } from "../stage";

type RingKey = "liftRing" | "impactRing" | "burst";

type Props = {
  /** Stage value driving this ring (0 → 1 progress; 0 or 1 = hidden) */
  value: RingKey;
  position: THREE.Vector3;
  /** Radius at progress 0 and 1 (world units) */
  from: number;
  to: number;
  color: THREE.ColorRepresentation;
  /** Peak brightness multiplier (> 1 feeds bloom) */
  intensity?: number;
  /** Lie flat on the ground instead of facing the camera */
  flat?: boolean;
};

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/** Additive ring that expands and fades with a stage value. */
function Ring({ value, position, from, to, color, intensity = 1.6, flat = false }: Props) {
  const { state } = useStage();
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => ringTexture(), []);
  const base = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity]);

  useFrame(({ camera }) => {
    const p = (state as StageState)[value] as number;
    const m = mesh.current;
    if (!m || !mat.current) return;
    m.visible = p > 0 && p < 1;
    if (!m.visible) return;
    const r = from + (to - from) * easeOut(p);
    m.scale.set(r * 2, r * 2, 1);
    if (!flat) m.quaternion.copy(camera.quaternion);
    mat.current.opacity = Math.pow(1 - p, 1.4);
    mat.current.color.copy(base);
  });

  return (
    <mesh ref={mesh} position={position} rotation={flat ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} renderOrder={7}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={mat}
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function Rings() {
  const ground = useMemo(() => HILL_TOP.clone().add(new THREE.Vector3(0, 0.12, 0)), []);
  return (
    <>
      {/* Lift-off: light wave spreading over the hill */}
      <Ring value="liftRing" position={ground} from={0.3} to={4.2} color={PALETTE.liftRing} intensity={1.3} flat />
      {/* Impact: blue shockwave at the moon */}
      <Ring value="impactRing" position={IMPACT_POINT} from={MOON.radius * 0.6} to={MOON.radius * 3.4} color={PALETTE.impactRing} intensity={2.4} />
      {/* Final burst: a much larger, slower wave */}
      <Ring value="burst" position={MOON.position} from={MOON.radius * 1.1} to={MOON.radius * 9} color={PALETTE.sapphireBright} intensity={2} />
    </>
  );
}
