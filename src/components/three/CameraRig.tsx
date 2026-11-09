"use client";

import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA } from "@/config/world";
import { crystalPosition } from "./objects/Crystal";
import { useStage } from "./stage";

const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const crystal = new THREE.Vector3();
const dirA = new THREE.Vector3();
const dirB = new THREE.Vector3();

/**
 * Drives the camera from stage state: progress along a CatmullRom flight path + offset,
 * a look target (optionally following the crystal), dutch tilt, and an always-on gentle sway
 * so the camera is never perfectly still.
 */
export function CameraRig() {
  const { state } = useStage();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(CAMERA.path, false, "centripetal"), []);

  useLayoutEffect(() => {
    camera.fov = size.width < size.height ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    camera.near = 0.05;
    camera.far = 700;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    curve.getPointAt(THREE.MathUtils.clamp(state.camT, 0, 1), pos).add(state.camOffset);
    look.copy(state.lookTarget);
    if (state.lookCrystal > 0) {
      // Blend look *directions*, not points: the crystal ends up 150 m away, so a point lerp
      // would swing the camera almost straight at the moon even at small weights.
      crystalPosition(state.crystalFly, crystal);
      dirA.copy(look).sub(pos).normalize();
      dirB.copy(crystal).sub(pos).normalize();
      dirA.lerp(dirB, state.lookCrystal).normalize();
      look.copy(pos).addScaledVector(dirA, 10);
    }

    if (!state.reduced) {
      // Hand-held drift: tiny, slow, never zero.
      pos.x += Math.sin(t * 0.37) * 0.06 + Math.sin(t * 0.91) * 0.015;
      pos.y += Math.sin(t * 0.53) * 0.04;
      look.x += Math.sin(t * 0.29) * 0.08;
      look.y += Math.sin(t * 0.41) * 0.05;
      if (state.camShake > 0) {
        pos.x += (Math.random() - 0.5) * 0.12 * state.camShake;
        pos.y += (Math.random() - 0.5) * 0.12 * state.camShake;
      }
    }

    camera.position.copy(pos);
    camera.lookAt(look);
    camera.rotateZ(CAMERA.roll + (state.reduced ? 0 : Math.sin(t * 0.23) * 0.006));
  });

  return null;
}
