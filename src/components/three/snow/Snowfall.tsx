"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/config/world";
import { seeded } from "@/lib/random";
import type { SnowState } from "./snowState";

const VERT = /* glsl */ `
attribute vec3 aOffset;
attribute float aSize;
attribute float aPhase;
uniform float uGrow;
uniform vec3 uBox;
uniform vec3 uCam;
uniform vec3 uShift;
uniform vec3 uStreak;
uniform float uTime;
varying vec2 vQ;
varying float vStretch;
varying float vTwinkle;
varying float vNear;
void main(){
  // Particles live in a box wrapped around the camera.
  vec3 c = mod(aOffset * uBox + uShift - uCam, uBox) - uBox * 0.5 + uCam;
  c.x += sin(uTime * 0.7 + aPhase * 30.0) * 0.25;
  c.z += cos(uTime * 0.6 + aPhase * 21.0) * 0.25;
  // Drawn from the point to where it was moments ago, as seen by the camera:
  // a dot at rest, a line when moving fast, whatever the direction (even straight at the lens).
  vec3 a = (viewMatrix * vec4(c, 1.0)).xyz;
  vNear = smoothstep(2.0, 7.0, -a.z);
  vec3 b = a + mat3(viewMatrix) * uStreak;
  b.z = min(b.z, -0.4);
  a.z = min(a.z, -0.4);
  vec2 onScreen = b.xy / -b.z - a.xy / -a.z;
  float seen = length(onScreen);
  vec2 dir = seen > 0.0001 ? onScreen / seen : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  vec3 mid = (a + b) * 0.5;
  vec3 span = (b - a);
  vec3 p = mid + span * position.x;
  float size = aSize * uGrow;
  p.xy += dir * position.x * size + perp * position.y * size;
  gl_Position = projectionMatrix * vec4(p, 1.0);
  vQ = position.xy * 2.0;
  float len = length(span);
  vStretch = len / (len + size);
  vTwinkle = 0.75 + 0.25 * sin(uTime * 1.8 + aPhase * 40.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vQ;
varying float vStretch;
varying float vTwinkle;
varying float vNear;
void main(){
  // A little six-armed flake at rest…
  float r = length(vQ);
  float ang = atan(vQ.y, vQ.x);
  float arms = 0.72 + 0.28 * cos(ang * 6.0);
  float flake = smoothstep(arms, arms * 0.45, r);
  // …a fading line at speed.
  float t = vQ.x * 0.5 + 0.5;
  float line = pow(1.0 - t, 1.2) * smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.0, abs(vQ.y));
  float a = mix(flake, line, smoothstep(0.25, 0.75, vStretch));
  gl_FragColor = vec4(uColor, a * vTwinkle * vNear * uOpacity);
}
`;

const BOX = new THREE.Vector3(46, 40, 46);
/** Extra flakes close around the camera, only during a gust */
const GUST_BOX = new THREE.Vector3(24, 16, 24);
/** Falling speed and light wind (m/s) */
const FALL = 1.5;
const WIND = 1.1;
/** Peak sideways speed in a gust */
const GUST = 26;
/** Longest a particle can be drawn (m) */
const MAX_STREAK = 15;
/** Seconds of movement drawn as a streak */
const EXPOSURE = 0.06;
const GUST_EXPOSURE = 0.14;

const FLAKE = new THREE.Color(PALETTE.snow3.flake);
const GUST_FLAKE = new THREE.Color(PALETTE.snow3.gustFlake);
const lastCam = new THREE.Vector3();
const velocity = new THREE.Vector3();

/** Snow, the leftover star streaks and the gust: one set of particles, shaped by their real speed. */
export function Snowfall({ sp, count, gustOnly = false, opacity }: { sp: SnowState; count: number; gustOnly?: boolean; opacity?: () => number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const started = useRef(false);
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(gustOnly ? 3302 : 3301);
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", plane.attributes.position);
    g.setIndex(plane.index);
    g.instanceCount = count;
    const off = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      off.set([rnd(), rnd(), rnd()], i * 3);
      size[i] = 0.05 + Math.pow(rnd(), 2) * 0.13;
      phase[i] = rnd();
    }
    g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uBox: { value: gustOnly ? GUST_BOX : BOX },
        uCam: { value: new THREE.Vector3() },
        uShift: { value: new THREE.Vector3() },
        uStreak: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uGrow: { value: 1 },
        uColor: { value: new THREE.Color(PALETTE.snow3.flake) },
        uOpacity: { value: 0.9 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return { geometry: g, material: m };
  }, [count, gustOnly]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock, camera }, delta) => {
    const dt = Math.min(delta, 0.1);
    const u = material.uniforms;
    if (gustOnly) {
      if (mesh.current) mesh.current.visible = sp.blizzard > 0.02;
      u.uOpacity.value = Math.min(1, sp.blizzard * 2) * 0.9;
    }
    if (opacity) u.uOpacity.value = 0.9 * opacity();
    u.uTime.value = clock.elapsedTime;
    u.uCam.value.copy(camera.position);

    // The camera's real speed: the fall stretches the particles by itself.
    if (started.current && dt > 0) velocity.copy(camera.position).sub(lastCam).divideScalar(dt);
    else velocity.set(0, 0, 0);
    lastCam.copy(camera.position);
    started.current = true;

    const windX = WIND + sp.blizzard * GUST;
    const windY = -FALL * (1 - sp.blizzard * 0.5);
    // Moves the particles by the wind and by the train's leftover speed.
    u.uShift.value.x += (windX - sp.streakX) * dt;
    u.uShift.value.y += windY * dt;

    // White on white can't be seen: in a gust the flakes turn blue-grey and grow.
    u.uColor.value.copy(FLAKE).lerp(GUST_FLAKE, sp.blizzard * 0.85);
    u.uGrow.value = 1 + sp.blizzard * 0.7;

    const streak: THREE.Vector3 = u.uStreak.value;
    streak.set(windX - sp.streakX - velocity.x, windY - velocity.y, -velocity.z).multiplyScalar(-THREE.MathUtils.lerp(EXPOSURE, GUST_EXPOSURE, sp.blizzard));
    if (sp.stage.reduced) streak.set(0, 0, 0);
    else streak.clampLength(0, MAX_STREAK);
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={8} />;
}
