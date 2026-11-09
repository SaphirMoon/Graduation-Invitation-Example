"use client";

import type { RefObject } from "react";
import * as THREE from "three";
import { PALETTE } from "@/config/world";

/** The narrator's scarf (coral unless told otherwise); the origin is the neck. */
export function Scarf({ color = PALETTE.scarf }: { color?: string }) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.062, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.8} />
      </mesh>
      <mesh position={[-0.08, -0.1, 0.03]} rotation={[0.2, 0, -0.32]}>
        <capsuleGeometry args={[0.024, 0.16, 3, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.8} />
      </mesh>
    </>
  );
}

/** The narrator's head and eyes; `eyes` is exposed for blinking. */
export function FigureHead({ material, eyes }: { material: THREE.Material; eyes: RefObject<THREE.Group | null> }) {
  return (
    <>
      <mesh material={material}>
        <icosahedronGeometry args={[0.16, 2]} />
      </mesh>
      <group ref={eyes} position={[0, 0.02, 0.14]}>
        <mesh position={[-0.05, 0, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color={PALETTE.figureEyes} />
        </mesh>
        <mesh position={[0.05, 0, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color={PALETTE.figureEyes} />
        </mesh>
      </group>
    </>
  );
}

const point = new THREE.Vector3();

/** Pins the HTML speech-bubble anchor over a 3D point, keeping the bubble inside the screen. */
export function pinBubble(
  anchor: HTMLElement | null,
  target: THREE.Object3D | null,
  camera: THREE.Camera,
  size: { width: number; height: number },
) {
  if (!anchor || !target) return;
  target.getWorldPosition(point).project(camera);
  const x = (point.x * 0.5 + 0.5) * size.width;
  const y = (-point.y * 0.5 + 0.5) * size.height;
  const half = ((anchor.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) / 2;
  const margin = 12;
  const cx = half ? THREE.MathUtils.clamp(x, half + margin, Math.max(half + margin, size.width - half - margin)) : x;
  anchor.style.transform = `translate3d(${cx.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  anchor.style.setProperty("--tail-shift", `${(x - cx).toFixed(1)}px`);
}
