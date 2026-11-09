"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GRADE } from "@/config/theme";
import { IDLE_TIMING } from "@/config/timing";
import { PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { CONE_FRAG, CONE_VERT } from "../shaders";
import { FigureHead, pinBubble, Scarf } from "../objects/FigureBits";
import { drawPlayBadge, radialTexture } from "../textures";
import { useStage } from "../stage";
import { carOffset, targetOffset, TRACK_GLSL, trackPoint, TRAIN, type SpaceState } from "./spaceState";

const T = PALETTE.train;
const UP = new THREE.Vector3(0, 1, 0);
const p1 = new THREE.Vector3();
const p2 = new THREE.Vector3();
const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const pose = new THREE.Matrix4();
const shake = new THREE.Matrix4();

/** Rigid transform of a vehicle centered at world x, spanning `half` meters each way along the track. */
function vehicleMatrix(x: number, half: number, sp: SpaceState, target: THREE.Matrix4) {
  trackPoint(x - half, sp.travel, sp.climb, p1);
  trackPoint(x + half, sp.travel, sp.climb, p2);
  xAxis.copy(p2).sub(p1).normalize();
  zAxis.crossVectors(xAxis, UP).normalize();
  yAxis.crossVectors(zAxis, xAxis).normalize();
  target.makeBasis(xAxis, yAxis, zAxis);
  target.setPosition(p1.add(p2).multiplyScalar(0.5));
  return target;
}

/* ---------------- Hull: an octagon-ish section lofted through stations ---------------- */

/** Section as [up, side], unit box. Faces: 0,8 lower chamfers · 1,7 lower walls · 2,6 upper walls · 3,5 upper chamfers · 4 roof · 9 belly. */
const RING: [number, number][] = [
  [-1, 0.62],
  [-0.8, 1],
  [0.05, 1],
  [0.8, 1],
  [1, 0.62],
  [1, -0.62],
  [0.8, -1],
  [0.05, -1],
  [-0.8, -1],
  [-1, -0.62],
];

/** [x, height scale, width scale, drop of the center] */
type Station = [number, number, number, number];

const faceColor = (k: number) => {
  if (k === 0 || k === 8 || k === 9) return T.under;
  if (k === 1 || k === 7) return T.bodyShade;
  return T.body;
};

function ringPoint([x, sh, sw, drop]: Station, k: number): [number, number, number] {
  const [uy, uz] = RING[k % RING.length];
  return [x, TRAIN.centerY + drop + uy * TRAIN.halfHeight * sh, uz * TRAIN.halfWidth * sw];
}

function hull(stations: Station[], isGlass?: (segment: number, face: number) => boolean) {
  const pos: number[] = [];
  const col: number[] = [];
  const glass: number[] = [];
  const c = new THREE.Color();
  const push = (a: number[], color: string) => {
    pos.push(...a);
    c.set(color);
    for (let i = 0; i < a.length / 3; i++) col.push(c.r, c.g, c.b);
  };
  for (let s = 0; s < stations.length - 1; s++) {
    for (let k = 0; k < RING.length; k++) {
      const a = ringPoint(stations[s], k);
      const b = ringPoint(stations[s + 1], k);
      const d = ringPoint(stations[s], k + 1);
      const e = ringPoint(stations[s + 1], k + 1);
      const quad = [...a, ...b, ...e, ...a, ...e, ...d];
      if (isGlass?.(s, k)) glass.push(...quad);
      else push(quad, faceColor(k));
    }
  }
  // End caps
  for (const st of [stations[0], stations[stations.length - 1]]) {
    const center: [number, number, number] = [st[0], TRAIN.centerY + st[3], 0];
    for (let k = 0; k < RING.length; k++) push([...center, ...ringPoint(st, k), ...ringPoint(st, k + 1)], T.under);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute("position", new THREE.Float32BufferAttribute(glass, 3));
  glassGeo.computeVertexNormals();
  return { body: g, glass: glassGeo };
}

const LOCO_STATIONS: Station[] = [
  [-TRAIN.locoBack, 1, 1, 0],
  [0.6, 1, 1, 0],
  [3.4, 0.98, 0.98, -0.05],
  [5.6, 0.8, 0.88, -0.42],
  [7.6, 0.54, 0.66, -1.12],
  [9, 0.28, 0.4, -1.78],
  [TRAIN.locoNose, 0.08, 0.14, -2.28],
];

/* ---------------- Glowing details: windows, stripes, magnetic pads (unlit) ---------------- */

type Quad = {
  x: [number, number];
  y: [number, number];
  z: number;
  color: THREE.ColorRepresentation;
  /** Different color at the top edge (a soft vertical gradient) */
  top?: THREE.ColorRepresentation;
  gain?: number;
};

function quads(items: Quad[]) {
  const pos: number[] = [];
  const col: number[] = [];
  const low = new THREE.Color();
  const high = new THREE.Color();
  for (const q of items) {
    const [x0, x1] = q.x;
    const [y0, y1] = q.y;
    pos.push(x0, y0, q.z, x1, y0, q.z, x1, y1, q.z, x0, y0, q.z, x1, y1, q.z, x0, y1, q.z);
    low.set(q.color).multiplyScalar(q.gain ?? 1);
    high.set(q.top ?? q.color).multiplyScalar(q.gain ?? 1);
    for (const c of [low, low, high, low, high, high]) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function pad(x: number, width: number) {
  const g = new THREE.BoxGeometry(width, 0.14, 2.2).toNonIndexed();
  g.translate(x, 0.42, 0);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const n = g.attributes.position.count;
  const c = new THREE.Color(T.pad);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** A window: dark frame, warm light that is brighter at the top, on both sides of the train. */
function windowQuads(x: number, z: number): Quad[] {
  const out = Math.sign(z) * 0.006;
  return [
    { x: [x - 0.47, x + 0.47], y: [3.05, 4.65], z, color: T.windowFrame },
    { x: [x - 0.39, x + 0.39], y: [3.13, 4.57], z: z + out, color: T.windowLow, top: T.window },
  ];
}

function sideQuads(length: number, windows: number[]) {
  const items: Quad[] = [];
  for (const z of [TRAIN.halfWidth + 0.015, -TRAIN.halfWidth - 0.015]) {
    items.push({ x: [-length / 2, length / 2], y: [1.05, 1.13], z, color: T.stripe });
    items.push({ x: [-length / 2, length / 2], y: [5.28, 5.36], z, color: T.stripe2, gain: 1.35 });
    for (const x of windows) items.push(...windowQuads(x, z));
  }
  return items;
}

function mergeGlow(items: Quad[], pads: [number, number][]) {
  const parts = [quads(items), ...pads.map(([x, w]) => pad(x, w))];
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function carGlowGeometry() {
  const L = TRAIN.carLength;
  return mergeGlow(sideQuads(L, [-4.7, -3.45, 3.45, 4.7]), [
    [-L * 0.3, 1.8],
    [L * 0.3, 1.8],
  ]);
}

function locoGlowGeometry() {
  // Windows and stripes on the straight part only; the nose stays clean.
  const items: Quad[] = [];
  for (const z of [TRAIN.halfWidth + 0.015, -TRAIN.halfWidth - 0.015]) {
    items.push({ x: [-TRAIN.locoBack, 3.3], y: [1.05, 1.13], z, color: T.stripe });
    items.push({ x: [-TRAIN.locoBack, 0.5], y: [5.28, 5.36], z, color: T.stripe2, gain: 1.35 });
    for (const x of [-6, -4.7, -3.4, -2.1, -0.8]) items.push(...windowQuads(x, z));
  }
  return mergeGlow(items, [
    [-4, 2.2],
    [2, 2.2],
  ]);
}

/* ---------------- The light trail behind the last car ---------------- */

const WAKE_VERT = /* glsl */ `
${TRACK_GLSL}
uniform float uTail;
attribute float aT;
attribute float aSide;
varying float vT;
varying float vSide;
void main(){
  vec3 p = position;
  p.x += uTail;
  float s = p.x + uTravel;
  p.y += trackY(s) + trackClimb(p.x);
  p.z += trackZ(s);
  vT = aT;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const WAKE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
varying float vSide;
void main(){
  gl_FragColor = vec4(uColor, pow(vT, 2.2) * (1.0 - abs(vSide)) * uOpacity);
}
`;

const WAKE_LENGTH = 110;

function Wake({ sp }: { sp: SpaceState }) {
  const { geometry, material } = useMemo(() => {
    const seg = 28;
    const pos: number[] = [];
    const t: number[] = [];
    const side: number[] = [];
    const idx: number[] = [];
    // Two crossed ribbons, so the trail reads from the side and from behind.
    const rows: [number, number, number, number][] = [
      [3.2, -1.7, 3.2, 1.7],
      [0.7, 0, 5.2, 0],
    ];
    rows.forEach(([y0, z0, y1, z1], r) => {
      const base = r * (seg + 1) * 3;
      for (let i = 0; i <= seg; i++) {
        const k = i / seg;
        const x = -WAKE_LENGTH * (1 - k);
        pos.push(x, y0, z0, x, (y0 + y1) / 2, (z0 + z1) / 2, x, y1, z1);
        t.push(k, k, k);
        side.push(-1, 0, 1);
        if (i < seg) {
          const a = base + i * 3;
          idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      vertexShader: WAKE_VERT,
      fragmentShader: WAKE_FRAG,
      uniforms: {
        uTravel: { value: 0 },
        uClimb: { value: 0 },
        uTail: { value: 0 },
        uColor: { value: new THREE.Color(PALETTE.space.wake) },
        uOpacity: { value: 0.6 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry: g, material: m };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    const u = material.uniforms;
    u.uTravel.value = sp.travel;
    u.uClimb.value = sp.climb;
    u.uTail.value = sp.entry + sp.exit - carOffset(sp.photoCount - 1) - TRAIN.carLength / 2;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}

/* ---------------- The photo screen on a car ---------------- */

const SCREEN = { width: 1000, height: 800 };

/** Object-fit: cover into the canvas. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, focus = 0.5) {
  const { width, height } = SCREEN;
  const k = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const w = width / k;
  const h = height / k;
  ctx.drawImage(img, (img.naturalWidth - w) * focus, (img.naturalHeight - h) * focus, w, h, 0, 0, width, height);
}

function CarPhoto({ sp, photo, index, onOpen }: { sp: SpaceState; photo: MemoryPhoto; index: number; onOpen: (i: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const loading = useRef(false);
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = SCREEN.width;
    c.height = SCREEN.height;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = T.screenEmpty;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas: c, texture: tex };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    // Lazy-load: when the camera is about to reach this car.
    if (!loading.current && sp.cameraTarget > index - 1.5) {
      loading.current = true;
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawCover(ctx, img, photo.focus);
        if (photo.videoId) drawPlayBadge(ctx, canvas.width / 2, canvas.height / 2, canvas.height * 0.15);
        texture.needsUpdate = true;
      };
      img.src = photo.src;
    }
    const g = group.current;
    if (!g) return;
    vehicleMatrix(sp.entry + sp.exit - carOffset(index), 3, sp, pose);
    pose.decompose(g.position, g.quaternion, g.scale);
  });

  const { photoWidth: w, photoHeight: h, photoY: y, halfWidth: z } = TRAIN;
  return (
    <group ref={group}>
      {/* Warm light from inside the car, around a thin frame */}
      <mesh position={[0, y, z + 0.03]}>
        <planeGeometry args={[w + 0.42, h + 0.2]} />
        <meshBasicMaterial color={new THREE.Color(T.window).multiplyScalar(1.05)} toneMapped={false} />
      </mesh>
      <mesh position={[0, y, z + 0.045]}>
        <planeGeometry args={[w + 0.12, h + 0.12]} />
        <meshBasicMaterial color={T.frame} toneMapped={false} />
      </mesh>
      <mesh
        position={[0, y, z + 0.06]}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(index);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "zoom-in";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------------- The narrator, seated in the glass cab ---------------- */

function Limb({ a, b, r, material }: { a: [number, number, number]; b: [number, number, number]; r: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const D = new THREE.Vector3(...b).sub(A);
    return {
      position: A.clone().addScaledVector(D, 0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, D.clone().normalize()),
      length: D.length(),
    };
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <capsuleGeometry args={[r, length, 4, 8]} />
    </mesh>
  );
}

const CAB = { x: 2.6, y: 2.75, z: 0.75, scale: 2.2 };

const blink = { next: 2, at: -1 };

/* ---------------- Train ---------------- */

type Props = { sp: SpaceState; photos: MemoryPhoto[]; onOpen: (i: number) => void };

export function Train({ sp, photos, onOpen }: Props) {
  const { dom } = useStage();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cars = photos.length;
  const loco = useRef<THREE.Group>(null);
  const carBody = useRef<THREE.InstancedMesh>(null);
  const carGlow = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const anchorPoint = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);

  const locoHull = useMemo(
    () =>
      hull(LOCO_STATIONS, (s, k) => {
        const upper = k === 2 || k === 3 || k === 5 || k === 6;
        // Side glass over the cab, then the raked windscreen.
        return (s === 1 && upper) || (s === 2 && (upper || k === 4));
      }),
    [],
  );
  const carHull = useMemo(() => {
    const L = TRAIN.carLength / 2;
    return hull([
      [-L, 1, 1, 0],
      [L, 1, 1, 0],
    ]).body;
  }, []);
  const carGlowGeo = useMemo(() => carGlowGeometry(), []);
  const locoGlowGeo = useMemo(() => locoGlowGeometry(), []);
  const painted = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }), []);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const glassMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: T.glass, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    [],
  );
  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.figure,
        emissive: PALETTE.moonlight,
        emissiveIntensity: GRADE.figureGlow,
        roughness: 0.55,
      }),
    [],
  );
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.6 }, uColor: { value: new THREE.Color(T.lamp).multiplyScalar(1.1) } },
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
      locoHull.body.dispose();
      locoHull.glass.dispose();
      carHull.dispose();
      carGlowGeo.dispose();
      locoGlowGeo.dispose();
      painted.dispose();
      glow.dispose();
      glassMat.dispose();
      body.dispose();
      beamMat.dispose();
    },
    [locoHull, carHull, carGlowGeo, locoGlowGeo, painted, glow, glassMat, body, beamMat],
  );
  const glowTex = useMemo(() => radialTexture("headlamp", 0.05, 1.2), []);

  useLayoutEffect(() => {
    if (carBody.current) carBody.current.count = cars;
    if (carGlow.current) carGlow.current.count = cars;
  }, [cars]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Light rattle; stronger with the speed, none with reduced motion.
    const rattle = sp.stage.reduced ? 0 : 0.012 * sp.trainSpeed;
    const front = sp.entry + sp.exit;

    if (loco.current) {
      vehicleMatrix(front, 5, sp, pose);
      pose.decompose(loco.current.position, loco.current.quaternion, loco.current.scale);
      loco.current.position.y += Math.sin(t * 37) * rattle;
    }
    // The car the camera rides on stays calm, so its photo is steady; the others rattle.
    const locked = targetOffset(sp.cameraTarget);
    for (let c = 0; c < cars; c++) {
      const off = carOffset(c);
      vehicleMatrix(front - off, 3, sp, pose);
      const calm = THREE.MathUtils.smoothstep(Math.abs(off - locked), 2, 9);
      shake.makeTranslation(0, Math.sin(t * 31 + c * 2.1) * rattle * calm, 0);
      pose.premultiply(shake);
      carBody.current?.setMatrixAt(c, pose);
      carGlow.current?.setMatrixAt(c, pose);
    }
    if (carBody.current) carBody.current.instanceMatrix.needsUpdate = true;
    if (carGlow.current) carGlow.current.instanceMatrix.needsUpdate = true;

    // Headlight sweeps a little.
    if (beam.current) beam.current.rotation.y = sp.stage.reduced ? 0 : Math.sin(t * 0.7) * 0.05;
    beamMat.uniforms.uTime.value = t;

    if (eyes.current) {
      if (t > blink.next) {
        blink.at = t;
        blink.next = t + IDLE_TIMING.blinkMin + Math.random() * (IDLE_TIMING.blinkMax - IDLE_TIMING.blinkMin);
      }
      eyes.current.scale.y = t - blink.at < 0.13 ? 0.12 : 1;
    }
    pinBubble(dom.bubbleAnchor.current, anchorPoint.current, camera, size);
  });

  const nose = LOCO_STATIONS[LOCO_STATIONS.length - 1];
  const lampY = TRAIN.centerY + nose[3] + 0.42;
  return (
    <>
      <group ref={loco}>
        <mesh geometry={locoHull.body} material={painted} />
        <mesh geometry={locoGlowGeo} material={glow} />

        {/* Cab interior: warm light, bulkhead, floor, console */}
        <mesh position={[0.72, 3.3, 0]}>
          <boxGeometry args={[0.12, 4, 3.1]} />
          <meshStandardMaterial color={T.under} roughness={0.8} />
        </mesh>
        <mesh position={[3, 2.15, 0]}>
          <boxGeometry args={[4.6, 0.1, 3]} />
          <meshStandardMaterial color={T.under} roughness={0.9} />
        </mesh>
        <mesh position={[4.35, 2.75, 0.75]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.8, 0.5, 1.5]} />
          <meshStandardMaterial color={T.bodyShade} emissive={T.stripe} emissiveIntensity={0.22} flatShading />
        </mesh>
        <mesh position={[2.1, 2.45, CAB.z]}>
          <boxGeometry args={[0.9, 0.5, 0.9]} />
          <meshStandardMaterial color={T.seat} flatShading roughness={0.9} />
        </mesh>
        <pointLight position={[3.4, 3.9, 0.4]} color={T.window} intensity={7} distance={6} decay={1.6} />

        {/* Narrator: same character as ever, driving */}
        <group position={[CAB.x, CAB.y, CAB.z]} scale={CAB.scale}>
          <Limb a={[0, 0, 0.07]} b={[0.46, 0.08, 0.1]} r={0.045} material={body} />
          <Limb a={[0.46, 0.08, 0.1]} b={[0.52, -0.3, 0.1]} r={0.042} material={body} />
          <Limb a={[0, 0, -0.07]} b={[0.46, 0.08, -0.1]} r={0.045} material={body} />
          <Limb a={[0.46, 0.08, -0.1]} b={[0.52, -0.3, -0.1]} r={0.042} material={body} />
          <Limb a={[0, 0, 0]} b={[0, 0.48, 0]} r={0.052} material={body} />
          <Limb a={[0, 0.46, 0.09]} b={[0.47, 0.25, 0.14]} r={0.038} material={body} />
          <Limb a={[0, 0.46, -0.09]} b={[0.47, 0.25, -0.14]} r={0.038} material={body} />
          <group position={[0, 0.54, 0]}>
            <Scarf />
          </group>
          <group position={[0, 0.74, 0]} rotation={[0, 0.45, 0]}>
            <FigureHead material={body} eyes={eyes} />
          </group>
        </group>
        <group ref={anchorPoint} position={[CAB.x, 6.15, 0]} />

        <mesh geometry={locoHull.glass} material={glassMat} renderOrder={2} />

        {/* Headlight */}
        <mesh position={[nose[0] - 0.25, lampY, 0]}>
          <sphereGeometry args={[0.2, 8, 6]} />
          <meshBasicMaterial color={new THREE.Color(T.lamp).multiplyScalar(1.7)} toneMapped={false} />
        </mesh>
        <sprite position={[nose[0], lampY, 0]} scale={[3.4, 3.4, 1]}>
          <spriteMaterial map={glowTex} color={T.lamp} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <group ref={beam} position={[nose[0], lampY, 0]}>
          <mesh position={[17, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={beamMat} renderOrder={2}>
            <coneGeometry args={[4.4, 34, 24, 1, true]} />
          </mesh>
        </group>
      </group>

      {/* Cars: body and glowing details, one draw call each */}
      <instancedMesh ref={carBody} args={[carHull, painted, Math.max(cars, 1)]} frustumCulled={false} />
      <instancedMesh ref={carGlow} args={[carGlowGeo, glow, Math.max(cars, 1)]} frustumCulled={false} />

      {photos.map((p, i) => (
        <CarPhoto key={p.src} sp={sp} photo={p} index={i} onOpen={onOpen} />
      ))}
      <Wake sp={sp} />
    </>
  );
}
