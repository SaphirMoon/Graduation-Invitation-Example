"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { GRADE } from "@/config/theme";
import { CAMERA, CAMERA_FINAL, detectTier, MOON, PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { Effects } from "../Effects";
import { Moon } from "../objects/Moon";
import { ReadySignal } from "../ReadySignal";
import { CLOUD_FRAG, CLOUD_VERT, DomeStars, noiseTexture, SkyDome } from "../space/Cosmos";
import { StageContext, type StageDom } from "../stage";
import { Hiker } from "./Hiker";
import { Mountain } from "./Mountain";
import { FALL_LAYERS, OMEN_POS, groundY, pathPoint, PEAK, SNOW_BUDGET, SNOW_CAMERA, STATIONS, type SnowState } from "./snowState";
import { Snowfall } from "./Snowfall";
import { Stations } from "./Stations";

const S = PALETTE.snow3;
const SPACE = PALETTE.space;

/* ---------------- Camera ---------------- */

const walker = new THREE.Vector3();
const out = new THREE.Vector3();
const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const target = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const lockPos = new THREE.Vector3();
const lockLook = new THREE.Vector3();
const m = new THREE.Matrix4();
const qLand = new THREE.Quaternion();
const qFall = new THREE.Quaternion();
const euler = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const eye = new THREE.Vector3();
const aim = new THREE.Vector3();
/** While falling: where the camera aims, and how far in front of its landing spot it is */
const MOUNTAIN_CENTER = new THREE.Vector3(PEAK.x, PEAK.height * 0.3, PEAK.z);
const FALL_BACK = 0.3;

function SnowCamera({ sp }: { sp: SnowState }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog(S.fog, 130, 1250), []);
  const fogColor = useMemo(() => new THREE.Color(S.fog), []);
  const whiteOut = useMemo(() => new THREE.Color(S.gustFog), []);

  useLayoutEffect(() => {
    camera.fov = size.width < size.height ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    camera.near = 0.2;
    camera.far = 3200;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }) => {
    const portrait = size.width < size.height;
    const follow = portrait ? SNOW_CAMERA.followPortrait : SNOW_CAMERA.followLandscape;
    const lock = portrait ? SNOW_CAMERA.lockPortrait : SNOW_CAMERA.lockLandscape;
    const summit = portrait ? SNOW_CAMERA.summitPortrait : SNOW_CAMERA.summitLandscape;
    const t = sp.stage.reduced ? 0 : clock.elapsedTime;

    // Following the narrator: downhill of them, looking up.
    pathPoint(sp.u, walker);
    out.set(walker.x - PEAK.x, 0, walker.z - PEAK.z);
    if (out.lengthSq() < 4) out.set(0, 0, 1);
    out.normalize();
    pos.copy(walker).addScaledVector(out, follow.distance);
    pos.y = Math.max(walker.y - follow.below, groundY(pos.x, pos.z) + 1.3);
    look.copy(walker).addScaledVector(out, -1);
    look.y = walker.y + follow.up + follow.footUp * Math.max(0, 1 - sp.alt * 2.5);

    // Locked on an ice block.
    if (sp.lock > 0) {
      const s = STATIONS[Math.min(sp.station, STATIONS.length - 1)];
      lockPos.copy(s.block).addScaledVector(s.out, lock.distance);
      lockPos.y = s.block.y + lock.height;
      lockLook.copy(s.block);
      lockLook.y += lock.look;
      pos.lerp(lockPos, sp.lock);
      look.lerp(lockLook, sp.lock);
    }

    // On the summit: behind the narrator, looking out.
    if (sp.summit > 0) {
      target.set(walker.x + summit.side, walker.y + summit.height, walker.z - summit.back);
      target.y = Math.max(target.y, groundY(target.x, target.z) + 1.2);
      lookTarget.set(walker.x, walker.y + summit.lookUp, walker.z + summit.lookOut);
      pos.lerp(target, sp.summit);
      look.lerp(lookTarget, sp.summit);
    }

    // Wind on the lens: tiny, a little stronger in a gust.
    pos.x += Math.sin(t * 0.4) * 0.03 + Math.sin(t * 17) * 0.025 * sp.blizzard;
    pos.y += Math.sin(t * 0.53) * 0.025 + Math.cos(t * 19) * 0.02 * sp.blizzard;

    // Falling from the previous scene: level → straight down → landing pose.
    // The landing pose looks from the real height (and a little from the front) at the mountain,
    // so the peak stays in frame all the way down instead of staring at the snow below.
    eye.copy(pos);
    eye.y += sp.fall;
    eye.z += sp.fall * FALL_BACK;
    aim.copy(look);
    // Close to the ground the gaze levels off toward the peak, instead of staring at the snow.
    aim.y += Math.min(sp.fall, 60) * 0.9;
    aim.lerp(MOUNTAIN_CENTER, THREE.MathUtils.smoothstep(sp.fall, 40, 260));
    m.lookAt(eye, aim, UP);
    qLand.setFromRotationMatrix(m);
    if (sp.land < 1) {
      euler.set(-sp.tilt * Math.PI * 0.5, 0, 0);
      qFall.setFromEuler(euler);
      camera.quaternion.copy(qFall).slerp(qLand, sp.land);
    } else camera.quaternion.copy(qLand);
    camera.position.copy(eye);

    // Fog: normally a distant haze; closes in during a gust.
    if (scene.fog !== fog) scene.fog = fog;
    fog.near = THREE.MathUtils.lerp(130, 10, sp.blizzard);
    fog.far = THREE.MathUtils.lerp(1250, 90, sp.blizzard);
    fog.color.copy(fogColor).lerp(whiteOut, Math.min(1, sp.blizzard * 2));
  });
  return null;
}

/* ---------------- Clouds ---------------- */

/** Sea of clouds below the climber: thin at the foot, dense higher up. Also the first layer of the fall. */
export function CloudSea({ sp, y, seed, fade }: { sp: SnowState; y: number; seed: number; fade: () => number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(3200, 2400).rotateX(-Math.PI / 2), []);
  const material = useMemo(() => {
    const c = (hex: string) => new THREE.Color(hex);
    return new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uNoise: { value: noiseTexture() },
        uTravel: { value: 0 },
        uSeed: { value: seed },
        uFloor: { value: 0 },
        uFade: { value: 1 },
        uTime: { value: 0 },
        uDeep: { value: c(SPACE.cloud.deep) },
        uTeal: { value: c(SPACE.cloud.teal) },
        uLavender: { value: c(SPACE.cloud.lavender) },
        uPeach: { value: c(SPACE.cloud.peach) },
        uFar: { value: c(SPACE.horizon) },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
  }, [seed]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(({ clock, camera }) => {
    const v = fade();
    const me = mesh.current;
    if (!me) return;
    me.visible = v > 0.01;
    me.position.set(camera.position.x, y, camera.position.z);
    material.uniforms.uFade.value = v;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uTravel.value = sp.stage.reduced ? 0 : clock.elapsedTime * 1.6;
  });
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={-3} />;
}

const FALL_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uCam;
uniform float uSeed;
uniform float uBlur;
uniform vec3 uDeep;
uniform vec3 uLavender;
uniform vec3 uTeal;
uniform vec3 uPeach;
varying vec3 vP;
void main(){
  vec2 d = vP.xz - uCam.xz;
  float r = length(d) + 1.0;
  float gap = abs(uCam.y - vP.y);
  // Sampled in polar coordinates: when falling, the wisps stretch away from the center.
  float ang = atan(d.y, d.x) / 6.28318;
  float v = log(r) * mix(0.7, 0.16, uBlur);
  float n = texture2D(uNoise, vec2(ang * 3.0 + uSeed, v + uSeed)).r * 0.62;
  n += texture2D(uNoise, vec2(ang * 7.0 - uSeed, v * 2.3)).g * 0.38;
  vec3 col = mix(uLavender, uTeal, smoothstep(0.44, 0.56, texture2D(uNoise, vec2(ang * 2.0, v * 0.5 + uSeed * 2.0)).g));
  col = mix(uDeep, col, smoothstep(0.34, 0.46, n));
  col = mix(col, uPeach, smoothstep(0.48, 0.62, n));
  float a = smoothstep(0.4, 0.56, n);
  // A small opening right below the camera, so the layers slide past on both sides;
  // and a layer dissolves just as the camera reaches it.
  a *= smoothstep(gap * 0.02, gap * 0.16 + 3.0, r);
  a *= smoothstep(4.0, 50.0, gap);
  a *= 1.0 - smoothstep(900.0, 1500.0, r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

/** The cloud layers crossed while falling. */
function FallLayers({ sp }: { sp: SnowState }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2), []);
  const materials = useMemo(() => {
    const c = (hex: string) => new THREE.Color(hex);
    return FALL_LAYERS.map(
      (_, i) =>
        new THREE.ShaderMaterial({
          vertexShader: CLOUD_VERT,
          fragmentShader: FALL_FRAG,
          uniforms: {
            uNoise: { value: noiseTexture() },
            uCam: { value: new THREE.Vector3() },
            uSeed: { value: i * 0.37 + 0.11 },
            uBlur: { value: 0 },
            uDeep: { value: c(SPACE.cloud.deep) },
            uLavender: { value: c(SPACE.cloud.lavender) },
            uTeal: { value: c(SPACE.cloud.teal) },
            uPeach: { value: c(SPACE.cloud.peach) },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
    );
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((mat) => mat.dispose());
    },
    [geometry, materials],
  );
  const lastY = useRef(0);
  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    g.visible = sp.land < 0.75 && sp.fall > 5;
    if (!g.visible) return;
    const speed = Math.abs(camera.position.y - lastY.current) / Math.max(delta, 0.001);
    lastY.current = camera.position.y;
    const blur = THREE.MathUtils.clamp(speed / 320, 0, 1);
    g.children.forEach((child, i) => child.position.set(camera.position.x, FALL_LAYERS[i], camera.position.z));
    materials.forEach((mat) => {
      mat.uniforms.uCam.value.copy(camera.position);
      mat.uniforms.uBlur.value = blur;
    });
  });
  return (
    <group ref={group}>
      {FALL_LAYERS.map((_, i) => (
        <mesh key={i} geometry={geometry} material={materials[i]} frustumCulled={false} renderOrder={-2 + i} />
      ))}
    </group>
  );
}

/* ---------------- Moon, and the little light far away ---------------- */

const MOON_DISTANCE = 170;
const forward = new THREE.Vector3();
const smooth = new THREE.Vector3(0, 0, -1);
const right = new THREE.Vector3();
const moonUp = new THREE.Vector3();
const moonPos = new THREE.Vector3();
const toCam = new THREE.Vector3();
const MOON_FACING = CAMERA_FINAL.clone().sub(MOON.position).normalize();
const MOON_OFFSET = MOON.position.clone().negate();

/** The moon keeps to the upper part of the frame, drifting behind the camera's turns, and grows with altitude. */
export function ClimbMoon({ sp }: { sp: SnowState }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    camera.getWorldDirection(forward);
    smooth.lerp(forward, Math.min(1, delta * 1.2)).normalize();
    right.crossVectors(smooth, UP).normalize();
    moonUp.crossVectors(right, smooth);
    moonPos.copy(smooth).addScaledVector(moonUp, 0.42).addScaledVector(right, 0.1).normalize().multiplyScalar(MOON_DISTANCE);
    // It only joins once the camera is down: from high up it would float in front of the slopes.
    const scale = (0.3 + sp.alt * 0.36) * (1 - THREE.MathUtils.smoothstep(sp.fall, 15, 70));
    // A moon below the horizon would float in front of the clouds when the camera looks down.
    const up = THREE.MathUtils.smoothstep(moonPos.y, 18, 48);
    g.scale.setScalar(Math.max(scale * up, 0.0001));
    g.position.copy(camera.position).add(moonPos);
    // The moon's cratered side always faces the viewer, whichever way the camera turned.
    g.quaternion.setFromUnitVectors(MOON_FACING, toCam.copy(moonPos).negate().normalize());
    g.visible = scale * up > 0.001;
  });
  return (
    <group ref={group}>
      <group position={MOON_OFFSET}>
        <Moon />
      </group>
    </group>
  );
}

function Omen({ sp }: { sp: SnowState }) {
  const sprite = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.SpriteMaterial({ map: noiseFree(), color: S.omen, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    const pulse = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.7);
    material.opacity = sp.omen * pulse;
    sprite.current?.scale.setScalar(44 + 10 * pulse);
    if (core.current) core.current.visible = sp.omen > 0.05;
  });
  return (
    <group position={OMEN_POS}>
      <sprite ref={sprite} material={material} />
      <mesh ref={core}>
        <sphereGeometry args={[2, 8, 6]} />
        <meshBasicMaterial color={S.omenCore} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

let omenTex: THREE.CanvasTexture | null = null;
function noiseFree() {
  if (omenTex) return omenTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "white");
  g.addColorStop(0.25, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  omenTex = new THREE.CanvasTexture(c);
  return omenTex;
}

/* ---------------- Stage ---------------- */

type Props = {
  sp: SnowState;
  photos: MemoryPhoto[];
  dom: StageDom;
  onReady: () => void;
  onOpenPhoto: (i: number) => void;
};

/** The snow mountain under a near-black sky, plus the fall through the clouds that leads here. */
export default function SnowStage3D({ sp, photos, dom, onReady, onOpenPhoto }: Props) {
  const tier = useMemo(() => detectTier(), []);
  const base = SNOW_BUDGET[tier];
  const [quality, setQuality] = useState<0 | 1 | 2>(tier === "high" ? 2 : 1);
  const ctx = useMemo(() => ({ state: sp.stage, dom }), [sp, dom]);
  const dpr: [number, number] = quality === 2 ? [1, 2] : quality === 1 ? [1, 1.5] : [1, 1];
  const k = quality === 2 ? 1 : quality === 1 ? 0.75 : 0.45;
  const snow = Math.round(base.snow * k);
  const dome = Math.round(base.dome * k);
  // Nebula faint at the foot; on the way up the aurora gathers.
  const aurora = useMemo(() => () => 0.42 + Math.pow(sp.alt, 2) * 0.45 + sp.summit * 0.15, [sp]);
  const drift = useMemo(() => () => 0.2 + sp.alt * 0.05, [sp]);
  const stars = useMemo(() => () => 0.4 + sp.alt * 0.6, [sp]);
  // The sea of clouds under the climber: thickens with altitude.
  const seaHigh = useMemo(() => () => THREE.MathUtils.smoothstep(sp.alt, 0.25, 0.8), [sp]);
  const seaFall = useMemo(() => () => THREE.MathUtils.smoothstep(sp.fall, 974, 992), [sp]);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      flat
      camera={{ fov: 60, near: 0.2, far: 3200, position: [0, 1000, 60] }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(SPACE.skyTop))}
    >
      <StageContext.Provider value={ctx}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => (q > 0 ? ((q - 1) as 0 | 1) : 0))}
          flipflops={3}
          onFallback={() => setQuality(0)}
        />
        <SnowCamera sp={sp} />
        <hemisphereLight args={[S.lightSky, S.lightGround, 2.6]} />
        <directionalLight position={[-30, 40, 40]} intensity={1.6} color={PALETTE.moonlight} />
        <SkyDome drift={drift} aurora={aurora} />
        <DomeStars count={dome} fade={stars} />
        <ClimbMoon sp={sp} />
        <Mountain sp={sp} rocks={base.rocks} pines={base.pines} />
        <Stations sp={sp} photos={photos} onOpen={onOpenPhoto} />
        <Hiker sp={sp} />
        <CloudSea sp={sp} y={26} seed={0.31} fade={seaHigh} />
        <CloudSea sp={sp} y={FALL_LAYERS[0] + 40} seed={0.21} fade={seaFall} />
        <FallLayers sp={sp} />
        <Omen sp={sp} />
        <Snowfall sp={sp} count={snow} />
        <Snowfall sp={sp} count={Math.round(snow * 0.55)} gustOnly />
        <Effects quality={quality} threshold={GRADE.snowBloomThreshold} />
        <ReadySignal onReady={onReady} />
      </StageContext.Provider>
    </Canvas>
  );
}
