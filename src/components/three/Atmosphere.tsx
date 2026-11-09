"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { HILL_TOP, MOON, PALETTE } from "@/config/world";
import { useStage } from "./stage";

type Look = typeof PALETTE | typeof PALETTE.lake;
type Grade = typeof GRADE | typeof GRADE.lake;

/** Fog + lights. Moonlight comes from the moon; a cool fill from the camera side reveals facets. */
export function Atmosphere({ look = PALETTE, grade = GRADE }: { look?: Look; grade?: Grade }) {
  const { state } = useStage();
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog(look.fog, grade.fogNear, grade.fogFar), [look, grade]);
  const [FOG_A, FOG_B, MOON_A, MOON_B] = useMemo(
    () => [look.fog, look.fogAfter, look.moonlight, look.moonLightAfter].map((c) => new THREE.Color(c)),
    [look],
  );
  const moonLight = useRef<THREE.DirectionalLight>(null);
  const figureLight = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (scene.fog !== fog) scene.fog = fog;
    fog.color.copy(FOG_A).lerp(FOG_B, state.fogBlue);
    if (moonLight.current) {
      moonLight.current.color.copy(MOON_A).lerp(MOON_B, state.moonBlue);
      moonLight.current.intensity = grade.moonLight + state.moonGlow * grade.moonLightPerGlow + state.bloomBoost * 0.4;
    }
    if (figureLight.current) figureLight.current.intensity = state.coneOpacity * state.coneBlue * 6;
  });

  return (
    <>
      <hemisphereLight args={[look.hemiSky, look.hemiGround, grade.hemi]} />
      <directionalLight ref={moonLight} position={MOON.position} />
      {/* Cool fill from the camera's left so low-poly facets read on slopes facing us */}
      <directionalLight position={[-30, 18, 40]} intensity={grade.fill} color={look.fill} />
      <pointLight
        ref={figureLight}
        position={[HILL_TOP.x, HILL_TOP.y + 2.2, HILL_TOP.z + 0.6]}
        color={PALETTE.sapphireBright}
        distance={7}
        decay={1.5}
        intensity={0}
      />
    </>
  );
}
