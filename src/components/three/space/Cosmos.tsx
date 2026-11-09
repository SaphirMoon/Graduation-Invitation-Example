"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MOON, PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import { Moon } from "../objects/Moon";
import { BASE_SPEED, type SpaceState } from "./spaceState";

const SPACE = PALETTE.space;

const speedOf = (sp: SpaceState) => BASE_SPEED * sp.trainSpeed * sp.flow;

/* ---------------- Tiling noise, baked once and shared ---------------- */

let noiseTex: THREE.DataTexture | null = null;

/** RG = two independent tiling fbm fields (cheap on phones: a texture read instead of procedural noise). */
export function noiseTexture() {
  if (noiseTex) return noiseTex;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const rnd = seeded(7321);
  for (const channel of [0, 1]) {
    const field = new Float32Array(size * size);
    let norm = 0;
    for (const [cells, amp] of [[5, 1], [11, 0.5], [23, 0.27], [47, 0.14]] as const) {
      norm += amp;
      const grid = Float32Array.from({ length: cells * cells }, () => rnd());
      const at = (x: number, y: number) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * cells;
          const fy = (y / size) * cells;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          const sx = THREE.MathUtils.smoothstep(fx - ix, 0, 1);
          const sy = THREE.MathUtils.smoothstep(fy - iy, 0, 1);
          const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
          const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
          field[y * size + x] += (top + (bottom - top) * sy) * amp;
        }
      }
    }
    for (let i = 0; i < size * size; i++) data[i * 4 + channel] = (field[i] / norm) * 255;
  }
  for (let i = 0; i < size * size; i++) data[i * 4 + 3] = 255;
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  noiseTex = tex;
  return tex;
}

/* ---------------- Sky dome: near-black, aurora ribbons, horizon glow ---------------- */

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DOME_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uDrift;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uWarm;
uniform vec3 uAurora[3];
uniform float uAuroraAmt[3];
uniform float uAuroraGain;
varying vec3 vDir;

// One wavy ribbon of light: center line wanders with the angle, intensity breaks into curtains.
float ribbon(float az, float el, float base, float seed){
  // Sampled around a circle, so the ribbons have no seam anywhere in the sky.
  vec2 ring = vec2(cos(az), sin(az));
  float wave = texture2D(uNoise, ring * 0.1 + vec2(seed + uDrift * 0.2, seed + uTime * 0.004)).r - 0.5;
  float center = base + wave * 0.3 + 0.035 * sin(az * 2.0 + seed * 6.0 + uTime * 0.05);
  float h = (el - center) / 0.085;
  float body = exp(-h * h);
  float curtains = texture2D(uNoise, ring * 0.62 + vec2(seed * 3.0 + uDrift, el * 0.25 + uTime * 0.012)).g;
  return body * smoothstep(0.32, 0.72, curtains);
}

void main(){
  vec3 d = normalize(vDir);
  float el = d.y;
  float az = atan(d.x, -d.z);
  vec3 col = mix(mix(uHorizon * 0.32, uMid, smoothstep(0.0, 0.16, el)), uTop, smoothstep(0.12, 0.6, el));
  col += uAurora[0] * ribbon(az, el, 0.36, 0.13) * uAuroraAmt[0] * uAuroraGain;
  col += uAurora[1] * ribbon(az, el, 0.24, 0.47) * uAuroraAmt[1] * uAuroraGain;
  col += uAurora[2] * ribbon(az, el, 0.46, 0.81) * uAuroraAmt[2] * uAuroraGain;
  // The glow between the sky and the sea of clouds.
  float e = max(el, 0.0);
  col = mix(col, uHorizon, exp(-e / 0.032) * 0.85);
  col = mix(col, uWarm, exp(-e / 0.016) * 0.8);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/** `drift` slides the aurora; `aurora` scales its strength (both read every frame). */
export function SkyDome({ drift, aurora }: { drift: () => number; aurora?: () => number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const c = (hex: string) => new THREE.Color(hex);
    return new THREE.ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms: {
        uNoise: { value: noiseTexture() },
        uTime: { value: 0 },
        uDrift: { value: 0 },
        uTop: { value: c(SPACE.skyTop) },
        uMid: { value: c(SPACE.skyMid) },
        uHorizon: { value: c(SPACE.horizon) },
        uWarm: { value: c(SPACE.horizonWarm) },
        uAurora: { value: SPACE.aurora.map(([hex]) => c(hex)) },
        uAuroraAmt: { value: SPACE.aurora.map(([, a]) => a) },
        uAuroraGain: { value: 0.72 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock, camera }) => {
    mesh.current?.position.copy(camera.position);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uDrift.value = drift();
    if (aurora) material.uniforms.uAuroraGain.value = aurora();
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={-10}>
      <sphereGeometry args={[1000, 32, 20]} />
    </mesh>
  );
}

/* ---------------- Fixed far stars (Points) ---------------- */

const FAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPR;
varying float vA;
void main(){
  gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
  vA = 0.45 + 0.55 * step(0.86, aPhase) * (0.5 + 0.5 * sin(uTime * (1.2 + aPhase * 2.0) + aPhase * 50.0)) + 0.25 * aPhase;
  gl_PointSize = aSize * uPR;
}
`;

const FAR_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor, pow(smoothstep(0.5, 0.0, d), 1.6) * vA * uFade);
}
`;

export function DomeStars({ count, fade }: { count: number; fade?: () => number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(611);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const y = 0.02 + rnd() * 0.98;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900], i * 3);
      size[i] = 1 + Math.pow(rnd(), 4) * 3.4;
      phase[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: FAR_VERT,
      fragmentShader: FAR_FRAG,
      uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uFade: { value: 1 }, uColor: { value: new THREE.Color(SPACE.star) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry: g, material: m };
  }, [count]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPR.value = dpr;
    if (fade) material.uniforms.uFade.value = fade();
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-9} />;
}

/* ---------------- Moving stars: instanced quads, stretched into streaks by the speed ---------------- */

const STREAK_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute float aSize;
attribute float aPhase;
uniform float uScroll;
uniform float uWidth;
uniform float uCamX;
uniform float uStreak;
uniform float uTime;
varying vec2 vQ;
varying float vStretch;
varying float vTwinkle;
void main(){
  vec3 c = aOffset;
  c.x = mod(c.x - uScroll, uWidth) - uWidth * 0.5 + uCamX;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  // Stretch along the direction of travel, as seen by this camera.
  vec2 along = (mat3(viewMatrix) * vec3(1.0, 0.0, 0.0)).xy;
  float seen = length(along);
  along = seen > 0.001 ? along / seen : vec2(1.0, 0.0);
  float streak = uStreak * seen * (0.65 + aPhase * 0.7);
  float len = aSize + streak;
  mv.xy += along * (position.x * len + streak * 0.5) + vec2(-along.y, along.x) * position.y * aSize;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy * 2.0;
  vStretch = streak / len;
  vTwinkle = 0.65 + 0.35 * sin(uTime * (1.0 + aPhase * 2.6) + aPhase * 40.0);
}
`;

const STREAK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vQ;
varying float vStretch;
varying float vTwinkle;
void main(){
  float round_ = pow(smoothstep(1.0, 0.0, length(vQ)), 1.8);
  // Streak: bright head on the side the star is moving toward, long fading tail.
  float t = vQ.x * 0.5 + 0.5;
  float line = pow(1.0 - t, 1.5) * smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.0, abs(vQ.y));
  gl_FragColor = vec4(uColor, mix(round_, line, smoothstep(0.1, 0.6, vStretch)) * vTwinkle * uOpacity);
}
`;

type StreakProps = {
  sp: SpaceState;
  count: number;
  /** Scroll rate relative to the train */
  rate: number;
  width: number;
  y: [number, number];
  z: [number, number];
  size: [number, number];
  /** Streak length in meters per (m/s) of speed */
  stretch: number;
  color: string;
  opacity: number;
  seed: number;
};

function StreakLayer({ sp, count, rate, width, y, z, size, stretch, color, opacity, seed }: StreakProps) {
  const [y0, y1] = y;
  const [z0, z1] = z;
  const [s0, s1] = size;
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(seed);
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", plane.attributes.position);
    g.setIndex(plane.index);
    g.instanceCount = count;
    const off = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      off.set([rnd() * width, y0 + rnd() * (y1 - y0), z0 + rnd() * (z1 - z0)], i * 3);
      sizes[i] = s0 + Math.pow(rnd(), 2.5) * (s1 - s0);
      phase[i] = rnd();
    }
    g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: STREAK_VERT,
      fragmentShader: STREAK_FRAG,
      uniforms: {
        uScroll: { value: 0 },
        uWidth: { value: width },
        uCamX: { value: 0 },
        uStreak: { value: 0 },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return { geometry: g, material: m };
  }, [count, width, y0, y1, z0, z1, s0, s1, color, opacity, seed]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(({ clock, camera }) => {
    const u = material.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uScroll.value = sp.travel * rate;
    u.uCamX.value = camera.position.x;
    // Reduced motion: dots, no speed lines.
    u.uStreak.value = sp.stage.reduced ? 0 : speedOf(sp) * stretch;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-6} />;
}

/* ---------------- Sea of clouds ---------------- */

export const CLOUD_VERT = /* glsl */ `
varying vec3 vP;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTravel;
uniform float uSeed;
uniform float uFloor;
uniform float uFade;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uTeal;
uniform vec3 uLavender;
uniform vec3 uPeach;
uniform vec3 uFar;
varying vec3 vP;
void main(){
  // Stretched along the direction of travel: the clouds read as rushing past.
  vec2 p = vec2((vP.x + uTravel) * 0.42, vP.z);
  float big = texture2D(uNoise, p * 0.0034 + uSeed).r;
  float mid = texture2D(uNoise, p * 0.0125 + uSeed * 2.0 + uTime * 0.002).g;
  float fine = texture2D(uNoise, p * 0.041 - uSeed).r;
  float h = big * 0.55 + mid * 0.33 + fine * 0.12;
  // Stepped in flat tiers with soft edges: cut paper, in keeping with the low-poly world.
  float tiers = 6.0;
  float q = h * tiers;
  float stepped = (floor(q) + smoothstep(0.45, 1.0, fract(q))) / tiers;
  float zone = texture2D(uNoise, p * 0.0016 + 0.37).g;
  vec3 col = mix(uLavender, uTeal, smoothstep(0.44, 0.56, zone));
  col = mix(uDeep, col, smoothstep(0.3, 0.46, stepped));
  col = mix(col, uPeach, smoothstep(0.46, 0.62, stepped));
  float dist = length(vP - cameraPosition);
  col = mix(col, uFar, smoothstep(80.0, 900.0, dist));
  float a = mix(smoothstep(0.48, 0.54, stepped), 1.0, uFloor);
  gl_FragColor = vec4(col, a * uFade);
  #include <colorspace_fragment>
}
`;

function CloudLayer({ sp, y, seed, floor }: { sp: SpaceState; y: number; seed: number; floor: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2600, 1800).rotateX(-Math.PI / 2), []);
  const material = useMemo(() => {
    const c = (hex: string) => new THREE.Color(hex);
    return new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uNoise: { value: noiseTexture() },
        uTravel: { value: 0 },
        uSeed: { value: seed },
        uFloor: { value: floor ? 1 : 0 },
        uFade: { value: 1 },
        uTime: { value: 0 },
        uDeep: { value: c(SPACE.cloud.deep) },
        uTeal: { value: c(SPACE.cloud.teal) },
        uLavender: { value: c(SPACE.cloud.lavender) },
        uPeach: { value: c(SPACE.cloud.peach) },
        uFar: { value: c(SPACE.horizon) },
      },
      transparent: !floor,
      depthWrite: floor,
      toneMapped: false,
    });
  }, [seed, floor]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(({ clock, camera }) => {
    const m = mesh.current;
    if (m) m.position.set(camera.position.x, y, camera.position.z);
    material.uniforms.uTravel.value = sp.travel;
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={floor ? -5 : -4} />;
}

/** Low-poly cumulus rising out of the sea of clouds (the floor hides their undersides). */
function CloudPuffs({ sp, count }: { sp: SpaceState; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const WIDTH = 460;
  const items = useMemo(() => {
    const rnd = seeded(2204);
    return Array.from({ length: count }, () => ({
      x: rnd() * WIDTH,
      y: -37 - rnd() * 2,
      z: -30 - Math.pow(rnd(), 1.1) * 210,
      s: 9 + rnd() * 14,
      sq: 0.5 + rnd() * 0.3,
      a: rnd() * 6.28,
      tint: Math.floor(rnd() * 3),
    }));
  }, [count]);
  const geometry = useMemo(() => {
    // A cumulus: several overlapping lumps; each facet is shaded by how much it faces up.
    const lumps = ([[0, 0.1, 0, 1], [1.05, -0.05, 0.1, 0.72], [-1.1, -0.1, -0.1, 0.78], [0.45, 0.42, -0.25, 0.62], [-0.5, 0.3, 0.3, 0.56]] as const).map(([x, y, z, r]) => {
      const lump = new THREE.IcosahedronGeometry(r, 1);
      lump.translate(x, y, z);
      return lump;
    });
    const g = mergeGeometries(lumps)!;
    lumps.forEach((l) => l.dispose());
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const n = new THREE.Vector3();
    for (let f = 0; f < pos.count; f += 3) {
      n.set(
        pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2),
        pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2),
        pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2),
      ).normalize();
      const v = 0.74 + 0.36 * Math.max(n.y, -0.35) + 0.04 * n.z;
      for (let k = 0; k < 3; k++) colors.set([v, v, v], (f + k) * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const tints = [SPACE.cloud.peach, SPACE.cloud.teal, SPACE.cloud.lavender].map((c) => new THREE.Color(c));
    const far = new THREE.Color(SPACE.horizon);
    const top = new THREE.Color(SPACE.cloud.top);
    const c = new THREE.Color();
    items.forEach((p, i) => m.setColorAt(i, c.copy(tints[p.tint]).lerp(top, 0.42).lerp(far, Math.min(0.6, -p.z / 330))));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    items.forEach((p, i) => {
      tmp.position.set(((((p.x - sp.travel) % WIDTH) + WIDTH) % WIDTH) - WIDTH / 2 + camera.position.x, p.y, p.z);
      tmp.rotation.set(0, p.a, 0);
      tmp.scale.set(p.s * 1.25, p.s * p.sq, p.s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false} renderOrder={-3}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

/* ---------------- Columns of light: a far-away city under the clouds ---------------- */

const COLUMN_VERT = /* glsl */ `
uniform float uScroll;
uniform float uWidth;
uniform float uCamX;
varying float vH;
void main(){
  vH = uv.y;
  vec4 w = instanceMatrix * vec4(position, 1.0);
  float cx = instanceMatrix[3].x;
  w.x += mod(cx - uScroll, uWidth) - uWidth * 0.5 + uCamX - cx;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const COLUMN_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vH;
void main(){
  gl_FragColor = vec4(uColor, pow(1.0 - vH, 2.2) * 0.8);
}
`;

const COLUMN_COUNT = 16;
const COLUMN_SPAN = 1100;

function LightColumns({ sp }: { sp: SpaceState }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.5, 1, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: COLUMN_VERT,
        fragmentShader: COLUMN_FRAG,
        uniforms: {
          uScroll: { value: 0 },
          uWidth: { value: COLUMN_SPAN },
          uCamX: { value: 0 },
          uColor: { value: new THREE.Color(SPACE.column) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
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
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(77);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < COLUMN_COUNT; i++) {
      // In small clusters, like districts.
      const cluster = Math.floor(i / 4);
      tmp.position.set(((cluster * 271 + 80) % COLUMN_SPAN) + rnd() * 34, -30, -260 - cluster * 44 - rnd() * 40);
      tmp.scale.set(0.5 + rnd() * 0.7, 26 + rnd() * 48, 0.5 + rnd() * 0.7);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({ camera }) => {
    material.uniforms.uScroll.value = sp.travel;
    material.uniforms.uCamX.value = camera.position.x;
  });
  return <instancedMesh ref={ref} args={[geometry, material, COLUMN_COUNT]} frustumCulled={false} renderOrder={-2} />;
}

/* ---------------- Planets and the little moon (very far: barely any parallax) ---------------- */

const PLANETS = [
  { az: -0.46, el: 0.34, r: 15, color: SPACE.planets[2], detail: 2, spin: 0.03, ring: true },
  { az: 0.5, el: 0.2, r: 7, color: SPACE.planets[0], detail: 1, spin: -0.05, ring: false },
  { az: -0.18, el: 0.13, r: 5, color: SPACE.planets[1], detail: 1, spin: 0.04, ring: false },
];
const FAR = 520;

function Planets({ sp, belt }: { sp: SpaceState; belt: number }) {
  const group = useRef<THREE.Group>(null);
  const bodies = useRef<(THREE.Mesh | null)[]>([]);
  const beltRef = useRef<THREE.Points>(null);
  const beltGeometry = useMemo(() => {
    const rnd = seeded(404);
    const pos = new Float32Array(belt * 3);
    for (let i = 0; i < belt; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 21 + rnd() * rnd() * 13;
      pos.set([Math.cos(a) * r, (rnd() - 0.5) * 0.9, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [belt]);
  useEffect(() => () => beltGeometry.dispose(), [beltGeometry]);
  useFrame(({ clock, camera }) => {
    const t = sp.stage.reduced ? 0 : clock.elapsedTime;
    if (group.current) group.current.position.set(camera.position.x - (sp.travel * 0.006) % 60, camera.position.y, camera.position.z);
    bodies.current.forEach((m, i) => {
      if (m) m.rotation.y = t * PLANETS[i].spin;
    });
    if (beltRef.current) beltRef.current.rotation.y = t * 0.02;
  });
  return (
    <group ref={group}>
      {PLANETS.map((p, i) => (
        <group key={i} position={[Math.sin(p.az) * FAR, Math.sin(p.el) * FAR, -Math.cos(p.az) * FAR]}>
          <mesh
            ref={(m) => {
              bodies.current[i] = m;
            }}
          >
            <icosahedronGeometry args={[p.r, p.detail]} />
            <meshStandardMaterial color={p.color} flatShading roughness={1} />
          </mesh>
          {p.ring && (
            <group rotation={[0.42, 0, 0.3]}>
              <points ref={beltRef} geometry={beltGeometry}>
                <pointsMaterial color={SPACE.ring} size={0.7} sizeAttenuation transparent opacity={0.8} depthWrite={false} toneMapped={false} />
              </points>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

/** Direction of the little moon from the camera: the landmark linking back to scene 1. */
const MOON_DIR = new THREE.Vector3(0.1, 0.6, -1).normalize();
const MOON_SCALE = 0.62;
const MOON_DISTANCE = 170;

function DistantMoon() {
  const group = useRef<THREE.Group>(null);
  const offset = useMemo(() => MOON_DIR.clone().multiplyScalar(MOON_DISTANCE).addScaledVector(MOON.position, -MOON_SCALE), []);
  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position).add(offset);
  });
  return (
    <group ref={group} scale={MOON_SCALE}>
      <Moon />
    </group>
  );
}

/* ---------------- All layers ---------------- */

type Budget = { dome: number; far: number; mid: number; near: number; dust: number; puffs: number; belt: number };

const Y_FAR: [number, number] = [8, 300];
const Z_FAR: [number, number] = [-360, -170];
const S_FAR: [number, number] = [0.5, 1.6];
const Y_MID: [number, number] = [5, 120];
const Z_MID: [number, number] = [-140, -44];
const S_MID: [number, number] = [0.14, 0.5];
const Y_NEAR: [number, number] = [-2, 26];
const Z_NEAR: [number, number] = [-34, -7];
const S_NEAR: [number, number] = [0.05, 0.13];
const Y_DUST: [number, number] = [-9, -1.2];
const Z_DUST: [number, number] = [-3, 7];
const S_DUST: [number, number] = [0.025, 0.06];

export function Cosmos({ sp, budget }: { sp: SpaceState; budget: Budget }) {
  const camera = useThree((s) => s.camera);
  // The aurora slides very slowly with the train: the deepest layer of parallax.
  const drift = useMemo(() => () => sp.travel * 0.00012, [sp]);
  useLayoutEffect(() => {
    camera.far = 2200;
    camera.updateProjectionMatrix();
  }, [camera]);
  return (
    <>
      <SkyDome drift={drift} />
      <DomeStars count={budget.dome} />
      <StreakLayer sp={sp} count={budget.far} rate={0.55} width={900} y={Y_FAR} z={Z_FAR} size={S_FAR} stretch={0.22} color={SPACE.star} opacity={0.9} seed={21} />
      <StreakLayer sp={sp} count={budget.mid} rate={1} width={330} y={Y_MID} z={Z_MID} size={S_MID} stretch={0.2} color={SPACE.star} opacity={0.9} seed={22} />
      <StreakLayer sp={sp} count={Math.ceil(budget.mid * 0.15)} rate={1} width={330} y={Y_MID} z={Z_MID} size={S_MID} stretch={0.2} color={SPACE.starWarm} opacity={0.9} seed={23} />
      <StreakLayer sp={sp} count={budget.near} rate={1} width={100} y={Y_NEAR} z={Z_NEAR} size={S_NEAR} stretch={0.11} color={SPACE.star} opacity={0.85} seed={24} />
      {/* Stardust flying backward, below the train */}
      <StreakLayer sp={sp} count={budget.dust} rate={1} width={46} y={Y_DUST} z={Z_DUST} size={S_DUST} stretch={0.05} color={SPACE.dust} opacity={0.8} seed={25} />
      <Planets sp={sp} belt={budget.belt} />
      <DistantMoon />
      <CloudLayer sp={sp} y={-40} seed={0.21} floor />
      <CloudLayer sp={sp} y={-28} seed={0.57} floor={false} />
      <LightColumns sp={sp} />
      <CloudPuffs sp={sp} count={budget.puffs} />
    </>
  );
}
