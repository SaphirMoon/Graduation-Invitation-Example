"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/config/world";
import { TRACK_GLSL, type SpaceState } from "./spaceState";

const SPACE = PALETTE.space;
const HALF_WIDTH = 2;
const dummy = new THREE.Object3D();

/* ---------------- The guideway: one ribbon, bent in the vertex shader ---------------- */

const GUIDE_VERT = /* glsl */ `
${TRACK_GLSL}
attribute float aU;
attribute float aTop;
varying float vS;
varying float vU;
varying float vTop;
varying float vFade;
void main(){
  vec3 p = position;
  float s = p.x + uTravel;
  p.y += trackY(s) + trackClimb(p.x);
  p.z += trackZ(s);
  vS = s;
  vU = aU;
  vTop = aTop;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vFade = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const GUIDE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeck;
uniform vec3 uSide;
uniform vec3 uLine;
uniform vec3 uFar;
varying float vS;
varying float vU;
varying float vTop;
varying float vFade;
void main(){
  float near = 1.0 - smoothstep(30.0, 110.0, vFade);
  // Cross ties flash past; a pulse of light keeps running forward along the edges.
  float tie = smoothstep(0.86, 0.9, fract(vS / 5.0)) * near * 0.5;
  float pulse = pow(0.5 + 0.5 * sin(vS * 0.11 - uTime * 7.0), 10.0);
  float edge = smoothstep(0.84, 0.92, abs(vU));
  vec3 top = uDeck * (1.0 + tie) + uLine * edge * (0.75 + pulse * 1.5);
  top += uLine * smoothstep(0.05, 0.02, abs(vU)) * (0.25 + pulse);
  vec3 col = mix(uSide * (1.0 + tie), top, vTop);
  col = mix(col, uFar, smoothstep(160.0, 900.0, vFade) * 0.75);
  gl_FragColor = vec4(col, 1.0);
}
`;

function guideGeometry() {
  // Dense near the camera, coarse far ahead.
  const xs: number[] = [];
  for (let x = -300; x < 220; x += 3) xs.push(x);
  for (let x = 220; x <= 1200; x += 12) xs.push(x);
  const section: [number, number, number, number][] = [
    // z, y, u, top
    [-HALF_WIDTH, 0, -1, 1],
    [HALF_WIDTH, 0, 1, 1],
    [HALF_WIDTH, 0, 1, 0],
    [HALF_WIDTH * 0.55, -0.42, 0.55, 0],
    [-HALF_WIDTH * 0.55, -0.42, -0.55, 0],
    [-HALF_WIDTH, 0, -1, 0],
  ];
  const faces = [[0, 1], [2, 3], [3, 4], [4, 5]];
  const pos: number[] = [];
  const u: number[] = [];
  const top: number[] = [];
  const index: number[] = [];
  xs.forEach((x) => {
    for (const [z, y, uu, t] of section) {
      pos.push(x, y, z);
      u.push(uu);
      top.push(t);
    }
  });
  const n = section.length;
  for (let i = 0; i < xs.length - 1; i++) {
    for (const [a, b] of faces) {
      const p = i * n + a;
      const q = i * n + b;
      index.push(p, q, p + n, q, q + n, p + n);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aU", new THREE.Float32BufferAttribute(u, 1));
  g.setAttribute("aTop", new THREE.Float32BufferAttribute(top, 1));
  g.setIndex(index);
  return g;
}

function Guideway({ sp }: { sp: SpaceState }) {
  const geometry = useMemo(() => guideGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GUIDE_VERT,
        fragmentShader: GUIDE_FRAG,
        uniforms: {
          uTravel: { value: 0 },
          uClimb: { value: 0 },
          uTime: { value: 0 },
          uDeck: { value: new THREE.Color(SPACE.deck) },
          uSide: { value: new THREE.Color(SPACE.deckSide) },
          uLine: { value: new THREE.Color(SPACE.runLight) },
          uFar: { value: new THREE.Color(SPACE.horizon) },
        },
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
    const u = material.uniforms;
    u.uTravel.value = sp.travel;
    u.uClimb.value = sp.climb;
    u.uTime.value = sp.stage.reduced ? 0 : clock.elapsedTime;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/* ---------------- Instanced details that wrap around the camera ---------------- */

/** Instances keep their spot on the endless track: their x wraps, y and z follow the curve. */
const WRAP = /* glsl */ `
${TRACK_GLSL}
uniform float uSpan;
vec3 wrapped(vec3 local, float at){
  float x = mod(at - uTravel, uSpan) - uSpan * 0.3;
  float s = x + uTravel;
  return vec3(x + local.x, trackY(s) + trackClimb(x) + local.y, trackZ(s) + local.z);
}
`;

const PYLON_VERT = /* glsl */ `
${WRAP}
varying float vH;
varying float vNear;
void main(){
  vH = uv.y;
  vec3 p = wrapped(position, instanceMatrix[3].x);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  // Close to the lens they would read as bars across the frame: only distant ones show.
  vNear = smoothstep(16.0, 55.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const PYLON_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vH;
varying float vNear;
void main(){
  gl_FragColor = vec4(uColor, pow(vH, 3.0) * 0.5 * vNear);
}
`;

const LIGHT_VERT = /* glsl */ `
${WRAP}
void main(){
  vec3 p = wrapped(position + vec3(0.0, 0.09, instanceMatrix[3].z), instanceMatrix[3].x);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const LIGHT_FRAG = /* glsl */ `
uniform vec3 uColor;
void main(){ gl_FragColor = vec4(uColor, 1.0); }
`;

function useWrapMaterial(sp: SpaceState, vert: string, frag: string, color: string, span: number, additive: boolean) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uTravel: { value: 0 },
          uClimb: { value: 0 },
          uSpan: { value: span },
          uColor: { value: new THREE.Color(color) },
        },
        transparent: additive,
        depthWrite: !additive,
        side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
      }),
    [vert, frag, color, span, additive],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uTravel.value = sp.travel;
    material.uniforms.uClimb.value = sp.climb;
  });
  return material;
}

const PYLON_STEP = 30;
const LIGHT_STEP = 8;

/** Slim glowing supports fading down into the clouds. */
function Pylons({ sp, count }: { sp: SpaceState; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useWrapMaterial(sp, PYLON_VERT, PYLON_FRAG, SPACE.pylon, count * PYLON_STEP, true);
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.08, 0.025, 24, 5, 1, true);
    g.translate(0, -12.4, 0);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      dummy.position.set(i * PYLON_STEP, 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count]);
  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
}

/** Small lamps along both edges. */
function EdgeLights({ sp, count }: { sp: SpaceState; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pairs = Math.floor(count / 2);
  const material = useWrapMaterial(sp, LIGHT_VERT, LIGHT_FRAG, SPACE.runLight, pairs * LIGHT_STEP, false);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < pairs * 2; i++) {
      dummy.position.set(Math.floor(i / 2) * LIGHT_STEP, 0, i % 2 ? HALF_WIDTH - 0.08 : -HALF_WIDTH + 0.08);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [pairs]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, pairs * 2]} frustumCulled={false}>
      <boxGeometry args={[0.42, 0.07, 0.07]} />
    </instancedMesh>
  );
}

/** The ribbon of track floating over the clouds. */
export function Track({ sp, pylons, lights }: { sp: SpaceState; pylons: number; lights: number }) {
  return (
    <>
      <Guideway sp={sp} />
      <Pylons sp={sp} count={pylons} />
      <EdgeLights sp={sp} count={lights} />
    </>
  );
}
