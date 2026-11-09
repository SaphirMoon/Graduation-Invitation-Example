"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GRADE, THEME } from "@/config/theme";
import { IDLE_TIMING } from "@/config/timing";
import { PALETTE } from "@/config/world";
import { radialTexture } from "../textures";
import { useStage } from "../stage";
import { FigureHead, pinBubble, Scarf } from "../objects/FigureBits";
import { BOAT_SCALE, TOSS_HAND, type LakeState } from "./lakeState";

const Y = new THREE.Vector3(0, 1, 0);
const v = new THREE.Vector3();
const G = new THREE.Vector3();
const B = new THREE.Vector3();
const lower = new THREE.Vector3();
const hand = new THREE.Vector3();
const dir = new THREE.Vector3();

/** Stick-figure pose (boat space: +x bow, +z toward the camera, y up from the waterline). */
const SEAT = { x: -0.35, y: 0.34 };
const SHOULDER_L = new THREE.Vector3(SEAT.x, 0.86, -0.09);
const SHOULDER_R = new THREE.Vector3(SEAT.x, 0.86, 0.09);
const REST_GRIP = new THREE.Vector3(-0.5, 0.62, 0.36);
const REST_BLADE = new THREE.Vector3(0.95, 0.5, 0.62);
const INTO_BOAT = new THREE.Vector3(0.22, 0.3, 0.1);
const PADDLE_LENGTH = 1.75;
const ARM_MESH = 0.48;

/* ---------------- Hull ---------------- */

/** Stations along the boat: x, half width, gunwale height, keel height. */
const STATIONS: [number, number, number, number][] = [
  [-1.7, 0.04, 0.62, 0.14],
  [-1.25, 0.4, 0.5, -0.08],
  [-0.45, 0.6, 0.43, -0.14],
  [0.45, 0.6, 0.43, -0.14],
  [1.25, 0.4, 0.5, -0.08],
  [1.7, 0.03, 0.74, 0.14],
];

function hullGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const hull = new THREE.Color(PALETTE.boat.hull);
  const dark = new THREE.Color(PALETTE.boat.hullDark);
  const rim = new THREE.Color(PALETTE.boat.rim);
  // Each station's cross-section: gunwale, bilge, keel, bilge, gunwale.
  const ring = ([x, w, top, keel]: (typeof STATIONS)[number]) => [
    [x, top, w],
    [x, (top + keel) * 0.42, w * 0.82],
    [x, keel, 0],
    [x, (top + keel) * 0.42, -w * 0.82],
    [x, top, -w],
  ];
  for (let s = 0; s < STATIONS.length - 1; s++) {
    const a = ring(STATIONS[s]);
    const b = ring(STATIONS[s + 1]);
    for (let k = 0; k < 4; k++) {
      // Plank strips: the top ones lighter, like a worn rim.
      const c = k === 0 || k === 3 ? rim : (s + k) % 2 ? hull : dark;
      positions.push(...a[k], ...b[k], ...b[k + 1], ...a[k], ...b[k + 1], ...a[k + 1]);
      for (let i = 0; i < 6; i++) colors.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** A fixed limb segment between two points. */
function Limb({ a, b, radius, material }: { a: [number, number, number]; b: [number, number, number]; radius: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const D = new THREE.Vector3(...b).sub(A);
    return {
      position: A.clone().addScaledVector(D, 0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(Y, D.clone().normalize()),
      length: D.length(),
    };
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <capsuleGeometry args={[radius, length, 4, 8]} />
    </mesh>
  );
}

/** Places a capsule with its base at `from`, reaching to `to`. */
function aim(o: THREE.Object3D | null, from: THREE.Vector3, to: THREE.Vector3, meshLength: number) {
  if (!o) return;
  dir.copy(to).sub(from);
  const len = dir.length();
  o.position.copy(from).addScaledVector(dir, 0.5);
  o.quaternion.setFromUnitVectors(Y, dir.divideScalar(len));
  o.scale.set(1, len / meshLength, 1);
}

/** Wooden boat with lantern and the narrator, who rows and releases the photos. */
export function Boat({ lake, photoCount }: { lake: LakeState; photoCount: number }) {
  const { dom } = useStage();
  const group = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const paddle = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const anchorPoint = useRef<THREE.Group>(null);
  const lanternPoint = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.Sprite>(null);
  const stack = useRef<THREE.Mesh>(null);
  const nextBlink = useRef(2);
  const blinkAt = useRef(-1);

  const hull = useMemo(() => hullGeometry(), []);
  const hullMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide }),
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
  const glowTex = useMemo(() => radialTexture("lantern", 0.04, 1.2), []);
  const shadowTex = useMemo(() => radialTexture("boat-shadow", 0.3, 1.1), []);

  useFrame(({ clock, camera, size }) => {
    const t = clock.elapsedTime;
    const moving = lake.stage.reduced ? 0 : 1;
    const g = group.current;
    if (g) {
      g.position.set(lake.boat.x, Math.sin(t * 0.9) * 0.055 * moving, lake.boat.z);
      g.rotation.set(Math.sin(t * 0.75) * 0.018 * moving, lake.boat.yaw, Math.sin(t * 0.62 + 1) * 0.022 * moving);
    }

    // Paddle: grip and blade trace ellipses; the blade is in the water on the power half (0 → 0.5).
    const th = lake.rowPhase * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const r = lake.row;
    G.set(-0.02 + 0.24 * c, 1 + 0.05 * s, 0.3).lerp(REST_GRIP, 1 - r);
    B.set(0.12 + 0.62 * c, -0.12 + 0.44 * Math.max(0, -s), 0.8).lerp(REST_BLADE, 1 - r);
    dir.copy(B).sub(G).normalize();
    if (paddle.current) {
      paddle.current.position.copy(G);
      paddle.current.quaternion.setFromUnitVectors(Y, v.copy(dir).negate());
    }
    lower.copy(G).addScaledVector(dir, 0.72);

    // Right hand: on the paddle → into the boat → up with the photo.
    hand.copy(lower).lerp(INTO_BOAT, lake.reach).lerp(TOSS_HAND, lake.toss);
    aim(armL.current, SHOULDER_L, G, ARM_MESH);
    aim(armR.current, SHOULDER_R, hand, ARM_MESH);
    if (g) {
      g.updateMatrix();
      lake.hand.copy(hand).applyMatrix4(g.matrix);
    }

    // Head turns toward the camera while talking; blink now and then.
    if (head.current) head.current.rotation.y = THREE.MathUtils.lerp(1.1, 0.15, lake.face);
    if (eyes.current) {
      if (t > nextBlink.current) {
        blinkAt.current = t;
        nextBlink.current = t + IDLE_TIMING.blinkMin + Math.random() * (IDLE_TIMING.blinkMax - IDLE_TIMING.blinkMin);
      }
      eyes.current.scale.y = t - blinkAt.current < 0.13 ? 0.12 : 1;
    }

    // The stack of photos in the boat shrinks as they are released.
    if (stack.current) {
      const left = lake.photos.filter((p) => p.show <= 0).length;
      stack.current.visible = left > 0;
      stack.current.scale.y = Math.max(0.2, left / photoCount);
    }

    // Lantern flicker and its position for the water reflection.
    const flicker = 1 + (Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.1) * 0.03) * moving;
    if (light.current) light.current.intensity = 7 * flicker;
    if (glow.current) glow.current.scale.setScalar(1.25 * flicker);
    if (lanternPoint.current && g) lake.lantern.setFromMatrixPosition(lanternPoint.current.matrix).applyMatrix4(g.matrix);

    // Speech bubble anchor above the head, kept inside the screen.
    pinBubble(dom.bubbleAnchor.current, anchorPoint.current, camera, size);
  });

  const wood = PALETTE.boat;
  return (
    <group ref={group} scale={BOAT_SCALE}>
      <mesh geometry={hull} material={hullMat} />
      {/* Soft contact shadow on the water */}
      <mesh position={[0, 0.03, 0.12]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.6, 1.9, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} color={THEME.shadow} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      {/* Floor and two seats */}
      <mesh position={[0, 0.02, 0]} scale={[1.7, 0.04, 0.62]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={wood.floor} roughness={1} />
      </mesh>
      <mesh position={[SEAT.x, SEAT.y - 0.04, 0]} scale={[0.3, 0.05, 1.1]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={wood.seat} flatShading roughness={1} />
      </mesh>
      <mesh position={[0.82, 0.34, 0]} scale={[0.24, 0.05, 0.88]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={wood.seat} flatShading roughness={1} />
      </mesh>
      {/* The photos waiting to be released */}
      <mesh ref={stack} position={[0.24, 0.1, 0.1]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.3, 0.09, 0.36]} />
        <meshStandardMaterial color={THEME.polaroid.paper} roughness={0.8} />
      </mesh>

      {/* Lantern on a post at the bow */}
      <Limb a={[1.62, 0.6, 0]} b={[1.62, 1.08, 0]} radius={0.022} material={hullMat} />
      <Limb a={[1.62, 1.08, 0]} b={[1.86, 1.1, 0]} radius={0.016} material={hullMat} />
      <group ref={lanternPoint} position={[1.86, 0.94, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.2, 0.14]} />
          <meshBasicMaterial color={PALETTE.lantern} toneMapped={false} />
        </mesh>
        <sprite ref={glow}>
          <spriteMaterial map={glowTex} color={PALETTE.lantern} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <pointLight ref={light} color={PALETTE.lantern} distance={9} decay={1.7} />
      </group>

      {/* Narrator, seated */}
      <Limb a={[SEAT.x, SEAT.y, 0.07]} b={[0.08, 0.5, 0.11]} radius={0.045} material={body} />
      <Limb a={[0.08, 0.5, 0.11]} b={[0.14, 0.1, 0.11]} radius={0.042} material={body} />
      <Limb a={[SEAT.x, SEAT.y, -0.07]} b={[0.08, 0.5, -0.11]} radius={0.045} material={body} />
      <Limb a={[0.08, 0.5, -0.11]} b={[0.14, 0.1, -0.11]} radius={0.042} material={body} />
      <Limb a={[SEAT.x, SEAT.y, 0]} b={[SEAT.x, 0.82, 0]} radius={0.052} material={body} />
      <mesh ref={armL} material={body}>
        <capsuleGeometry args={[0.038, ARM_MESH, 4, 8]} />
      </mesh>
      <mesh ref={armR} material={body}>
        <capsuleGeometry args={[0.038, ARM_MESH, 4, 8]} />
      </mesh>
      <group position={[SEAT.x, 0.9, 0]}>
        <Scarf />
      </group>
      {/* Head + face */}
      <group ref={head} position={[SEAT.x, 1.09, 0]}>
        <FigureHead material={body} eyes={eyes} />
      </group>
      <group ref={anchorPoint} position={[SEAT.x, 1.42, 0]} />

      {/* Paddle: origin at the grip, shaft along +y (toward the grip end), blade along -y */}
      <group ref={paddle}>
        <mesh position={[0, -PADDLE_LENGTH / 2 + 0.1, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, PADDLE_LENGTH - 0.2, 6]} />
          <meshStandardMaterial color={wood.rim} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
          <meshStandardMaterial color={wood.rim} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, -PADDLE_LENGTH + 0.1, 0]} scale={[0.17, 0.42, 0.03]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={wood.seat} flatShading roughness={1} />
        </mesh>
      </group>
    </group>
  );
}
