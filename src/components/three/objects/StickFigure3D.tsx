"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IDLE_TIMING } from "@/config/timing";
import { GRADE } from "@/config/theme";
import { CAMERA_FINAL, HILL_TOP, PALETTE } from "@/config/world";
import { radialTexture } from "../textures";
import { useStage } from "../stage";

const headPos = new THREE.Vector3();

/**
 * Narrator stick figure built from capsules (still a stick figure, but with volume).
 * Feet at the origin, ~1.45 m tall. Joints are groups so limbs rotate around shoulders / hips.
 * Driven by stage state: `figure` (0..1 assembly), `wave` (0..1), `idle` (bob + blink).
 * Also pins the HTML speech-bubble anchor (dom.bubbleAnchor) above its head every frame.
 */
export function StickFigure3D() {
  const { state, dom } = useStage();
  const head = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const parts = useRef<(THREE.Group | null)[]>([]);
  const armR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.MeshBasicMaterial>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.figure,
        emissive: PALETTE.moonlight,
        emissiveIntensity: GRADE.figureGlow,
        roughness: 0.55,
      }),
    [],
  );
  const shadowTex = useMemo(() => radialTexture("shadow", 0.1, 1.2), []);
  const nextBlink = useRef(2);
  const blinkStart = useRef(-1);

  // Face the final camera position.
  const facing = Math.atan2(CAMERA_FINAL.x - HILL_TOP.x, CAMERA_FINAL.z - HILL_TOP.z);

  useFrame(({ clock, camera, size }) => {
    const t = clock.elapsedTime;
    const f = state.figure;

    // Pin the HTML speech bubble anchor just above the head (screen space).
    const anchor = dom.bubbleAnchor.current;
    if (anchor && head.current) {
      head.current.getWorldPosition(headPos).project(camera);
      const x = (headPos.x * 0.5 + 0.5) * size.width;
      const y = (-headPos.y * 0.5 + 0.5) * size.height;
      // Keep the bubble inside the screen; shift its tail so it still points at the head.
      const half = ((anchor.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) / 2;
      const margin = 12;
      const cx = half ? THREE.MathUtils.clamp(x, half + margin, Math.max(half + margin, size.width - half - margin)) : x;
      anchor.style.transform = `translate3d(${cx.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      anchor.style.setProperty("--tail-shift", `${(x - cx).toFixed(1)}px`);
    }
    if (root.current) root.current.visible = f > 0.001;
    if (f <= 0.001) return;

    // Limbs grow out of their joints one after another.
    parts.current.forEach((g, i) => {
      if (!g) return;
      const p = THREE.MathUtils.clamp(f * 1.7 - i * 0.12, 0, 1);
      const s = p < 1 ? 1 - Math.pow(1 - p, 3) + Math.sin(p * Math.PI) * 0.12 : 1;
      g.scale.setScalar(Math.max(s, 0.0001));
    });
    mat.emissiveIntensity = GRADE.figureGlow + Math.sin(Math.min(f, 1) * Math.PI) * 1.6;

    // Wave with the right arm.
    if (armR.current) {
      const rest = 0.45;
      const up = 2.45 + Math.sin(t * 9) * 0.35;
      armR.current.rotation.z = THREE.MathUtils.lerp(rest, up, state.wave);
    }

    // Gentle bob + occasional little knee dip.
    if (body.current) {
      const dip = Math.pow(Math.max(0, Math.sin(t * 1.85)), 10) * 0.045;
      body.current.position.y = state.idle * (Math.sin(t * 2.1) * 0.008 - dip);
    }

    // Blink every few seconds.
    if (eyes.current) {
      if (t > nextBlink.current) {
        blinkStart.current = t;
        nextBlink.current = t + IDLE_TIMING.blinkMin + Math.random() * (IDLE_TIMING.blinkMax - IDLE_TIMING.blinkMin);
      }
      eyes.current.scale.y = f >= 1 && t - blinkStart.current < 0.13 ? 0.12 : 1;
    }
    if (shadow.current) shadow.current.opacity = 0.55 * Math.min(1, f * 1.5);
  });

  const setPart = (i: number) => (g: THREE.Group | null) => {
    parts.current[i] = g;
  };

  return (
    <group position={HILL_TOP} rotation={[0, facing, 0]}>
      {/* Soft contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={1}>
        <planeGeometry args={[1.1, 0.8]} />
        <meshBasicMaterial ref={shadow} map={shadowTex} color={PALETTE.figureShadow} transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={root}>
        <group ref={body}>
          {/* Legs (pivot at hips) */}
          <group ref={setPart(0)} position={[-0.06, 0.62, 0]} rotation={[0, 0, -0.16]}>
            <mesh position={[0, -0.29, 0]} material={mat}>
              <capsuleGeometry args={[0.045, 0.5, 4, 10]} />
            </mesh>
          </group>
          <group ref={setPart(1)} position={[0.06, 0.62, 0]} rotation={[0, 0, 0.16]}>
            <mesh position={[0, -0.29, 0]} material={mat}>
              <capsuleGeometry args={[0.045, 0.5, 4, 10]} />
            </mesh>
          </group>
          {/* Torso (grows upward from the hips) */}
          <group ref={setPart(2)} position={[0, 0.6, 0]}>
            <mesh position={[0, 0.24, 0]} material={mat}>
              <capsuleGeometry args={[0.052, 0.4, 4, 10]} />
            </mesh>
            {/* Scarf: one small warm accent */}
            <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.062, 0.03, 8, 16]} />
              <meshStandardMaterial color={PALETTE.scarf} emissive={PALETTE.scarf} emissiveIntensity={0.35} roughness={0.8} />
            </mesh>
            <mesh position={[0.05, 0.4, 0.055]} rotation={[0.1, 0, 0.22]}>
              <capsuleGeometry args={[0.024, 0.16, 3, 8]} />
              <meshStandardMaterial color={PALETTE.scarf} emissive={PALETTE.scarf} emissiveIntensity={0.35} roughness={0.8} />
            </mesh>
          </group>
          {/* Arms (pivot at shoulders) */}
          <group ref={setPart(3)} position={[-0.07, 1.02, 0]} rotation={[0, 0, -0.45]}>
            <mesh position={[0, -0.23, 0]} material={mat}>
              <capsuleGeometry args={[0.04, 0.4, 4, 10]} />
            </mesh>
          </group>
          <group position={[0.07, 1.02, 0]}>
            <group ref={armR} rotation={[0, 0, 0.45]}>
              <group ref={setPart(4)}>
                <mesh position={[0, -0.23, 0]} material={mat}>
                  <capsuleGeometry args={[0.04, 0.4, 4, 10]} />
                </mesh>
              </group>
            </group>
          </group>
          {/* Head + face */}
          <group ref={setPart(5)} position={[0, 1.28, 0]}>
            <mesh material={mat}>
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
          </group>
        </group>
      </group>

      <group ref={head} position={[0, 1.66, 0]} />
    </group>
  );
}
