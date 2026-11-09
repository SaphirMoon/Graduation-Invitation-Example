"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, STREAM, terrainHeight } from "@/config/world";
import { NOISE_GLSL } from "../shaders";
import { useStage } from "../stage";

const VERT = /* glsl */ `
attribute float aS;
attribute float aSide;
varying float vS;
varying float vSide;
varying float vDist;
void main(){
  vS = aS;
  vSide = aSide;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uWater;
uniform vec3 uGlint;
varying float vS;
varying float vSide;
varying float vDist;
void main(){
  // Moonlight breaking up on the moving water: long glints along the flow.
  float n = vnoise(vec2(vS * 1.5 - uTime * 0.7, vSide * 2.2 + uTime * 0.08));
  float m = vnoise(vec2(vS * 4.3 - uTime * 1.3, vSide * 3.1));
  float glint = smoothstep(0.66, 0.9, n) * (0.35 + 0.65 * m);
  float edge = smoothstep(1.0, 0.45, abs(vSide));
  float far = 1.0 - smoothstep(40.0, 85.0, vDist);
  gl_FragColor = vec4(mix(uWater, uGlint, glint), edge * far * (0.75 + 0.25 * glint));
}
`;

/** A thin stream winding through the valley, catching the moon. */
export function Stream() {
  const { state } = useStage();
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(STREAM.path.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
    const length = curve.getLength();
    const n = Math.round(length / 1.1);
    const pos: number[] = [];
    const arc: number[] = [];
    const side: number[] = [];
    const index: number[] = [];
    const across = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      across.set(-t.z, 0, t.x);
      const half = STREAM.width * (0.7 + 0.3 * Math.sin(u * 37));
      // Just above the ground; the low-poly facets may cover its edges, like an uneven bank.
      const y = terrainHeight(p.x, p.z) + 0.1;
      for (const s of [-1, 1]) {
        pos.push(p.x + across.x * half * s, y, p.z + across.z * half * s);
        arc.push(u * length);
        side.push(s);
      }
      if (i < n) {
        const a = i * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aS", new THREE.Float32BufferAttribute(arc, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    g.setIndex(index);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uWater: { value: new THREE.Color(PALETTE.stream.water) },
          uGlint: { value: new THREE.Color(PALETTE.stream.glint) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = state.reduced ? 0 : clock.elapsedTime;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}
