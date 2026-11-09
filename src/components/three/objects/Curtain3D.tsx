"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA, PALETTE } from "@/config/world";
import { CURTAIN_FRAG, CURTAIN_VERT } from "../shaders";
import { useStage } from "../stage";

/** Distance in front of the camera at which the curtain hangs. */
const DIST = 1;
const fwd = new THREE.Vector3();

/**
 * Two velvet panels that always cover the view (they ride along with the camera, so the dolly-in
 * can never slide them out of frame). A vertex shader waves and gathers them.
 */
export function Curtain3D() {
  const { state } = useStage();
  const aspect = useThree((s) => s.size.width / s.size.height);
  const group = useRef<THREE.Group>(null);

  // One material shared by both panels (created imperatively so per-frame uniform writes stick).
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CURTAIN_VERT,
        fragmentShader: CURTAIN_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uOpen: { value: 0 },
          uAlpha: { value: 1 },
          uDark: { value: new THREE.Color(PALETTE.velvet.dark) },
          uMid: { value: new THREE.Color(PALETTE.velvet.mid) },
          uLight: { value: new THREE.Color(PALETTE.velvet.light) },
          uHem: { value: new THREE.Color(PALETTE.hem) },
        },
        side: THREE.DoubleSide,
        transparent: true,
        // Depth-tested so overlapping folds sort correctly (no saw-tooth); it is 1 m from the
        // camera, closer than anything else, so it still covers the scene.
        depthTest: true,
        depthWrite: true,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const uniforms = material.uniforms;

  // Size from the same FOV the camera rig uses (portrait / landscape).
  const fov = aspect < 1 ? CAMERA.fovPortrait : CAMERA.fovLandscape;
  const hVis = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const h = hVis * 1.15;
  // Only a small horizontal margin, so the gathered bunches stay visible at the screen edges.
  const w = hVis * aspect * 1.06;
  const panelW = (w / 2) * 1.02;

  useFrame(({ clock, camera }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uOpen.value = state.curtainOpen;
    uniforms.uAlpha.value = state.curtainAlpha;
    const g = group.current;
    if (!g) return;
    g.visible = state.curtainAlpha > 0.001 && state.curtainOpen < 0.999;
    if (!g.visible) return;
    // Ride along with the camera (CameraRig has already updated it this frame).
    camera.getWorldDirection(fwd);
    g.position.copy(camera.position).addScaledVector(fwd, DIST);
    g.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group}>
      {/* Left panel: inner edge just past center */}
      <mesh position={[-w / 2 + panelW / 2 - 0.004, 0, 0]} scale={[panelW, h, 1]} renderOrder={20} material={material}>
        <planeGeometry args={[1, 1, 64, 24]} />
      </mesh>
      {/* Right panel: mirrored */}
      <mesh position={[w / 2 - panelW / 2 + 0.004, 0, 0.002]} scale={[-panelW, h, 1]} renderOrder={21} material={material}>
        <planeGeometry args={[1, 1, 64, 24]} />
      </mesh>
    </group>
  );
}
