"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/config/world";
import { type BridgeState, DECK, DECK_END, type Frame, frameAt, ISLAND, LENGTH, LAMP, newFrame } from "./bridgeState";

const B = PALETTE.bridge;

/* ---------------- Parts appear as the head of the build passes them ---------------- */

const REVEAL_VERT = /* glsl */ `
attribute float aS;
uniform float uBuild;
varying vec2 vUv;
varying float vS;
varying float vFront;
void main(){
  float k = clamp((uBuild - aS) / 2.6, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec4 w = modelMatrix * instanceMatrix * vec4(position * k, 1.0);
  w.y -= (1.0 - k) * 1.8;
  vUv = uv;
  vS = aS;
  float d = (uBuild - aS) / 5.0;
  vFront = exp(-d * d) * step(0.001, k);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const PLANK_FRAG = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uEdge;
uniform vec3 uGold;
uniform float uWalker;
uniform float uStep;
uniform float uFinished;
varying vec2 vUv;
varying float vS;
varying float vFront;
void main(){
  vec2 c = abs(vUv - 0.5) * 2.0;
  float line = smoothstep(0.84, 0.95, max(c.x, c.y));
  // The plank underfoot lights up with each step; the walked ones keep a faint warmth.
  float d = (vS - uWalker) / 1.0;
  float under = exp(-d * d) * uStep;
  float walked = step(vS, uWalker) * 0.14;
  vec3 col = mix(uBody, uEdge, line);
  col = mix(col, uGold, clamp(under + walked, 0.0, 1.0));
  col += uEdge * vFront * (1.0 - uFinished) * 1.1;
  gl_FragColor = vec4(col, mix(0.62, 1.0, max(line, under)));
  #include <colorspace_fragment>
}
`;

const SOLID_FRAG = /* glsl */ `
uniform vec3 uBody;
varying float vFront;
void main(){
  gl_FragColor = vec4(uBody + uBody * vFront, 1.0);
  #include <colorspace_fragment>
}
`;

type Item = { matrix: THREE.Matrix4; s: number };

const RAIL_FROM = 9;
/** The rail also stops short of the island, where the last shot's camera stands. */
const RAIL_CLEAR = 31;

function railHere(s: number, f: Frame) {
  return s >= RAIL_FROM && Math.hypot(f.point.x - ISLAND.center.x, f.point.z - ISLAND.center.z) > RAIL_CLEAR;
}

/** One instanced part of the bridge. */
function Part({ sp, items, geometry, frag, colors }: { sp: BridgeState; items: Item[]; geometry: THREE.BufferGeometry; frag: string; colors: { body: THREE.Color; edge?: THREE.Color; gold?: THREE.Color } }) {
  const mesh = useMemo(() => {
    const g = geometry.clone();
    g.setAttribute("aS", new THREE.InstancedBufferAttribute(Float32Array.from(items.map((i) => i.s)), 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: REVEAL_VERT,
      fragmentShader: frag,
      uniforms: {
        uBuild: { value: 0 },
        uBody: { value: colors.body },
        uEdge: { value: colors.edge ?? colors.body },
        uGold: { value: colors.gold ?? colors.body },
        uWalker: { value: 0 },
        uStep: { value: 0 },
        uFinished: { value: 0 },
      },
      transparent: frag === PLANK_FRAG,
      toneMapped: false,
    });
    const m = new THREE.InstancedMesh(g, material, items.length);
    items.forEach((it, i) => m.setMatrixAt(i, it.matrix));
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [items, geometry, frag, colors]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  useFrame(() => {
    const u = (mesh.material as THREE.ShaderMaterial).uniforms;
    const total = LENGTH * DECK_END + 3;
    u.uBuild.value = sp.build * total;
    u.uFinished.value = sp.build >= 1 ? 1 : 0;
    u.uWalker.value = sp.u * LENGTH;
    // A soft pulse on every step: brightest when the foot lands.
    const reduced = sp.stage.reduced;
    u.uStep.value = sp.walk * (reduced ? 0.5 : 0.45 + 0.55 * Math.abs(Math.cos(sp.steps * Math.PI)));
  });
  return <primitive object={mesh} />;
}

/** Planks, posts, lamps and rope. */
export function Bridge({ sp, railStep }: { sp: BridgeState; railStep: number }) {
  const { planks, posts, lamps, ropes, boxGeometry, lampGeometry, colors } = useMemo(() => {
    const planks: Item[] = [];
    const posts: Item[] = [];
    const lamps: Item[] = [];
    const ropes: Item[] = [];
    const f = newFrame();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const size = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const count = Math.floor((LENGTH * DECK_END) / DECK.plank);
    const up = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const s = i * DECK.plank;
      frameAt(s / LENGTH, f);
      up.crossVectors(f.right, f.tangent);
      basis.makeBasis(f.right, up, f.tangent);
      q.setFromRotationMatrix(basis);
      // Slightly uneven planks: hand-laid, not extruded.
      const wobble = Math.sin(i * 12.9898) * 43758.5453;
      const r = wobble - Math.floor(wobble);
      size.set(DECK.halfWidth * 2 + (r - 0.5) * 0.4, 0.14, DECK.plank - 0.1);
      pos.copy(f.point);
      pos.y -= 0.07;
      planks.push({ matrix: new THREE.Matrix4().compose(pos, q, size), s });
      // No rail right at the start: it would stand in front of the lens on the summit.
      if (i % railStep !== 0 || !railHere(s, f)) continue;
      for (const dir of [-1, 1]) {
        pos.copy(f.point).addScaledVector(f.right, dir * DECK.halfWidth);
        pos.y += 0.55;
        size.set(0.07, 1.1, 0.07);
        posts.push({ matrix: new THREE.Matrix4().compose(pos, q, size), s });
        pos.y += 0.62;
        size.set(0.1, 0.13, 0.1);
        lamps.push({ matrix: new THREE.Matrix4().compose(pos, q, size), s });
      }
    }
    // Rope: straight pieces between neighboring posts.
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dirV = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    const stepLen = railStep * DECK.plank;
    for (let s = 0; s + stepLen < count * DECK.plank; s += stepLen) {
      frameAt((s + stepLen) / LENGTH, f);
      if (s < RAIL_FROM || !railHere(s + stepLen, f)) continue;
      for (const dir of [-1, 1]) {
        frameAt(s / LENGTH, f);
        a.copy(f.point).addScaledVector(f.right, dir * DECK.halfWidth);
        frameAt((s + stepLen) / LENGTH, f);
        b.copy(f.point).addScaledVector(f.right, dir * DECK.halfWidth);
        a.y += 1.05;
        b.y += 1.05;
        dirV.copy(b).sub(a);
        const len = dirV.length();
        q.setFromUnitVectors(Y, dirV.divideScalar(len));
        pos.copy(a).add(b).multiplyScalar(0.5);
        m.compose(pos, q, size.set(0.025, len, 0.025));
        ropes.push({ matrix: m.clone(), s });
      }
    }
    return {
      planks,
      posts,
      lamps,
      ropes,
      boxGeometry: new THREE.BoxGeometry(1, 1, 1),
      lampGeometry: new THREE.IcosahedronGeometry(0.6, 0),
      colors: {
        plank: { body: new THREE.Color(B.plank), edge: new THREE.Color(B.plankEdge), gold: new THREE.Color(B.step) },
        post: { body: new THREE.Color(B.post) },
        rope: { body: new THREE.Color(B.rope) },
        lamp: { body: new THREE.Color(B.lamp).multiplyScalar(1.5) },
      },
    };
  }, [railStep]);
  useEffect(
    () => () => {
      boxGeometry.dispose();
      lampGeometry.dispose();
    },
    [boxGeometry, lampGeometry],
  );
  return (
    <>
      <Part sp={sp} items={planks} geometry={boxGeometry} frag={PLANK_FRAG} colors={colors.plank} />
      <Part sp={sp} items={posts} geometry={boxGeometry} frag={SOLID_FRAG} colors={colors.post} />
      <Part sp={sp} items={ropes} geometry={boxGeometry} frag={SOLID_FRAG} colors={colors.rope} />
      <Part sp={sp} items={lamps} geometry={lampGeometry} frag={SOLID_FRAG} colors={colors.lamp} />
    </>
  );
}

/* ---------------- The ray from the lantern to the far light ---------------- */

const BEAM_VERT = /* glsl */ `
varying float vT;
void main(){
  vT = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uHead;
uniform float uFade;
varying float vT;
void main(){
  // uv.y runs from the far end (0) to the lantern (1): t measures from the lantern.
  float t = 1.0 - vT;
  float a = smoothstep(uHead + 0.002, uHead - 0.05, t);
  gl_FragColor = vec4(uColor, a * uFade);
}
`;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();

export function Beam({ sp }: { sp: BridgeState }) {
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.05, 0.03, 1, 6, 1, true), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: { uColor: { value: new THREE.Color(B.beam).multiplyScalar(1.6) }, uHead: { value: 0 }, uFade: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
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
  const mesh = useMemo(() => new THREE.Mesh(geometry, material), [geometry, material]);
  useFrame(() => {
    mesh.visible = sp.beam > 0 && sp.beamFade > 0;
    if (!mesh.visible) return;
    dir.copy(sp.lantern).sub(LAMP);
    const len = dir.length();
    mesh.position.copy(LAMP).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.divideScalar(len));
    mesh.scale.set(1, len, 1);
    material.uniforms.uHead.value = sp.beam * 1.05;
    material.uniforms.uFade.value = sp.beamFade;
  });
  return <primitive object={mesh} />;
}
