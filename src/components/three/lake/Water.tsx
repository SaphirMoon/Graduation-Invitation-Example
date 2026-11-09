"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import { LAKE_MOON_DIR, LAKE_ORIGIN, LAKE_YAW, type LakeState } from "./lakeState";

/** Ring waves rendered at once (the timeline can schedule more; only live ones are sent). */
const MAX_RIPPLES = 8;
/** Final radius of a ring wave, in meters */
const RIPPLE_RADIUS = 7;

const VERT = /* glsl */ `
varying vec3 vP;
void main(){
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uMoonDir;
uniform vec3 uDeep;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uMist;
uniform vec3 uHill;
uniform vec3 uMoonPath;
uniform vec3 uMoonCore;
uniform vec3 uLantern;
uniform vec3 uLanternColor;
uniform float uLanternPower;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uRip[${MAX_RIPPLES}];
uniform sampler2D uRipples;
varying vec3 vP;

// One directional wave's slope.
vec2 wave(vec2 p, vec2 dir, float k, float amp, float speed){
  return dir * amp * k * cos(dot(dir, p) * k + uTime * speed);
}

void main(){
  vec2 p = vP.xz;
  float dist = length(uCam - vP);

  // A slow swell, then a tiling noise sampled at three scales: no repeating pattern, and the
  // mipmaps calm the far water by themselves.
  vec2 g = wave(p, vec2(0.28, 0.96), 0.5, 0.035, 0.55);
  g += (texture2D(uRipples, p * 0.031 + uTime * vec2(0.0035, 0.0062)).rg - 0.5) * 0.17;
  g += (texture2D(uRipples, p.yx * 0.083 - uTime * vec2(0.0079, 0.0047)).rg - 0.5) * 0.15;
  g += (texture2D(uRipples, p * 0.21 + uTime * vec2(-0.0091, 0.0133)).rg - 0.5) * 0.1;

  // Ring waves from paddle strokes and landing photos.
  float rim = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    float age = uRip[i].z;
    if (age <= 0.0) continue;
    vec2 to = p - uRip[i].xy;
    float d = length(to) + 0.001;
    float r = age * ${RIPPLE_RADIUS.toFixed(1)};
    float width = 0.28 + age * 0.75;
    float ring = exp(-pow((d - r) / width, 2.0)) * (1.0 - age) * (1.0 - age);
    g += (to / d) * sin((d - r) * 7.0) * ring * 0.42;
    rim += ring;
  }

  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(uCam - vP);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  // Reflected sky, with the banks' dark silhouette close to the horizon.
  vec3 sky = mix(uHorizon, uTop, smoothstep(0.0, 0.5, R.y));
  sky = mix(sky, uMist, (1.0 - smoothstep(0.0, 0.2, R.y)) * 0.3);
  sky = mix(sky, uHill, (1.0 - smoothstep(0.015, 0.1, R.y)) * 0.75);
  vec3 col = mix(uDeep, sky, 0.3 + 0.7 * fres);

  // The moon's path: a tight glitter core inside a wider sapphire-silver streak.
  float m = max(dot(R, uMoonDir), 0.0);
  float core = pow(m, 900.0);
  float streak = pow(m, 70.0);
  col += uMoonPath * streak * 0.34 + uMoonCore * core * 0.75;

  // Lantern: warm pool under the bow plus a stretched reflection.
  vec3 toL = uLantern - vP;
  float ld = length(toL);
  float lg = pow(max(dot(R, toL / ld), 0.0), 90.0) * 0.55 + exp(-ld * ld / 5.0) * 0.22;
  col += uLanternColor * lg * uLanternPower;

  col += uMoonPath * min(rim, 1.0) * 0.12;

  col = mix(col, uFogColor, clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/** Tiling slope map (RG = slope) from periodic value noise; generated once. */
let rippleTex: THREE.DataTexture | null = null;
function rippleTexture() {
  if (rippleTex) return rippleTex;
  const size = 256;
  const height = new Float32Array(size * size);
  const rnd = seeded(2718);
  for (const [cells, amp] of [[6, 1], [13, 0.55], [29, 0.3], [61, 0.16]] as const) {
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
        height[y * size + x] += (top + (bottom - top) * sy) * amp;
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = THREE.MathUtils.clamp(128 + (h(x + 1, y) - h(x - 1, y)) * 900, 0, 255);
      data[i + 1] = THREE.MathUtils.clamp(128 + (h(x, y + 1) - h(x, y - 1)) * 900, 0, 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  rippleTex = tex;
  return tex;
}

const camLocal = new THREE.Vector3();
const inverse = new THREE.Matrix4().compose(
  LAKE_ORIGIN,
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), LAKE_YAW),
  new THREE.Vector3(1, 1, 1),
).invert();

/** Flat lake: ripples, moon path and lantern reflection are all computed per pixel. */
export function Water({ lake }: { lake: LakeState }) {
  const scene = useThree((s) => s.scene);
  const material = useMemo(() => {
    const c = (hex: string) => new THREE.Color(hex);
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uMoonDir: { value: LAKE_MOON_DIR.clone() },
        uDeep: { value: c(PALETTE.water.deep) },
        uTop: { value: c(PALETTE.lake.skyTop) },
        uHorizon: { value: c(PALETTE.lake.skyHorizon) },
        uMist: { value: c(PALETTE.lake.skyMist) },
        uHill: { value: c(PALETTE.water.hillReflection) },
        uMoonPath: { value: c(PALETTE.water.moonPath) },
        uMoonCore: { value: c(PALETTE.water.moonCore) },
        uLantern: { value: new THREE.Vector3() },
        uLanternColor: { value: c(PALETTE.lantern) },
        uLanternPower: { value: 1 },
        uFogColor: { value: c(PALETTE.lake.fogAfter) },
        uFogNear: { value: GRADE.lake.fogNear },
        uFogFar: { value: GRADE.lake.fogFar },
        uRipples: { value: rippleTexture() },
        uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3()) },
      },
      fog: false,
    });
  }, []);
  // Baked flat: the shader's vP is lake space with y up.
  const geometry = useMemo(() => new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useFrame(({ clock, camera }) => {
    const u = material.uniforms;
    // Gentle swell only with reduced motion.
    u.uTime.value = clock.elapsedTime * (lake.stage.reduced ? 0.25 : 1);
    u.uCam.value.copy(camLocal.copy(camera.position).applyMatrix4(inverse));
    u.uLantern.value.copy(lake.lantern);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      u.uFogNear.value = fog.near;
      u.uFogFar.value = fog.far;
      u.uFogColor.value.copy(fog.color);
    }
    // Send the youngest live ripples.
    const rip = u.uRip.value as THREE.Vector3[];
    let n = 0;
    for (let i = lake.ripples.length - 1; i >= 0 && n < MAX_RIPPLES; i--) {
      const r = lake.ripples[i];
      if (r.age > 0 && r.age < 1) rip[n++].set(r.x, r.z, r.age);
    }
    for (; n < MAX_RIPPLES; n++) rip[n].z = 0;
  });

  return (
    <mesh geometry={geometry} material={material} renderOrder={-2} />
  );
}
