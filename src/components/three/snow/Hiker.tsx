"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { IDLE_TIMING } from "@/config/timing";
import { PALETTE } from "@/config/world";
import { FigureHead, pinBubble, Scarf } from "../objects/FigureBits";
import { useStage } from "../stage";
import { PATH, pathPoint, PEAK, seatPoint, STATIONS, type SnowState } from "./snowState";

const S = PALETTE.snow3;
const UP = new THREE.Vector3(0, 1, 0);
const SCALE = 1.25;
const LIMB = 0.4;

const pos = new THREE.Vector3();
const seat = new THREE.Vector3();
const dir = new THREE.Vector3();
const tangent = new THREE.Vector3();
const hip = new THREE.Vector3();
const chest = new THREE.Vector3();
const foot = new THREE.Vector3();
const knee = new THREE.Vector3();
const hand = new THREE.Vector3();
const elbow = new THREE.Vector3();
const shoulder = new THREE.Vector3();
const top = new THREE.Vector3();

/** Places a capsule (length LIMB, along y) between two points. */
function aim(o: THREE.Object3D | null, from: THREE.Vector3, to: THREE.Vector3) {
  if (!o) return;
  dir.copy(to).sub(from);
  const len = Math.max(dir.length(), 0.001);
  o.position.copy(from).addScaledVector(dir, 0.5);
  o.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
  o.scale.set(1, len / LIMB, 1);
}

/** Smallest angle from a to b. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const blink = { next: 2, at: -1 };

/** The narrator in winter gear: walks up the path, sits at the stations, looks around, scarf in the wind. */
export function Hiker({ sp }: { sp: SnowState }) {
  const { dom } = useStage();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const group = useRef<THREE.Group>(null);
  const limbs = useRef<(THREE.Mesh | null)[]>([]);
  const torso = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const pack = useRef<THREE.Group>(null);
  const scarf = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const headTop = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: S.jacket, roughness: 0.8, emissive: S.jacket, emissiveIntensity: 0.35 }), []);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.figure, emissive: PALETTE.moonlight, emissiveIntensity: 0.2, roughness: 0.55 }), []);
  useEffect(
    () => () => {
      body.dispose();
      skin.dispose();
    },
    [body, skin],
  );
  const setLimb = (i: number) => (m: THREE.Mesh | null) => {
    limbs.current[i] = m;
  };

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    const station = STATIONS[Math.min(sp.station, STATIONS.length - 1)];
    const calm = sp.stage.reduced ? 0.25 : 1;

    // Where: on the path, or on the seat at a station.
    pathPoint(sp.u, pos);
    PATH.getTangentAt(Math.min(sp.u, 0.999), tangent);
    let yaw = Math.atan2(tangent.x, tangent.z);
    if (sp.sit > 0) {
      seatPoint(station, seat);
      pos.lerp(seat, sp.sit);
      yaw += turn(yaw, station.yaw - 0.3) * sp.sit;
    }
    // On the summit: facing out over the clouds, away from the camera.
    yaw += turn(yaw, 0) * sp.summit;
    // Waiting at the foot: facing the camera.
    yaw += turn(yaw, 0.35) * (1 - THREE.MathUtils.smoothstep(sp.u, 0, 0.012));
    g.position.copy(pos);
    g.rotation.y = yaw;
    sp.alt = Math.min(1, Math.max(0, pos.y / PEAK.height));

    // Pose (local space: +z forward, y up).
    const w = sp.walk;
    const s = sp.sit;
    const phase = t * 9;
    sp.strides = phase / Math.PI;
    const bob = Math.abs(Math.sin(phase)) * 0.025 * w;
    hip.set(0, THREE.MathUtils.lerp(0.68 + bob, 0.24, s), 0);
    chest.set(0, hip.y + 0.44, 0.09 * w + 0.03 * s);

    for (const side of [0, 1]) {
      const sign = side ? 1 : -1;
      const swing = Math.sin(phase + (side ? Math.PI : 0));
      // Leg: thigh, shin.
      const fz = swing * 0.25 * w + 0.5 * s;
      const fy = Math.max(0, Math.cos(phase + (side ? Math.PI : 0))) * 0.11 * w;
      foot.set(sign * 0.08, fy, fz);
      knee.copy(hip).add(foot).multiplyScalar(0.5);
      knee.z += 0.1 + 0.08 * w;
      knee.y += 0.2 * s;
      knee.x = sign * 0.085;
      hip.x = sign * 0.06;
      aim(limbs.current[side * 2], hip, knee);
      aim(limbs.current[side * 2 + 1], knee, foot);
      hip.x = 0;
      // Arm: upper, lower. Swinging when walking, on the knee when sitting.
      shoulder.set(sign * 0.09, chest.y - 0.03, chest.z);
      hand.set(sign * 0.15, chest.y - 0.42 + 0.06 * w, chest.z - swing * 0.26 * w);
      if (s > 0) {
        knee.x = sign * 0.09;
        hand.lerp(knee, s);
      }
      elbow.copy(shoulder).add(hand).multiplyScalar(0.5);
      elbow.x += sign * 0.05;
      elbow.z -= 0.06;
      aim(limbs.current[side * 2 + 4], shoulder, elbow);
      aim(limbs.current[side * 2 + 5], elbow, hand);
    }
    aim(torso.current, hip, chest);
    top.copy(chest);
    if (head.current) {
      head.current.position.set(0, chest.y + 0.24, chest.z + 0.02);
      const lookAround = Math.sin(t * 0.8) * 0.75 * sp.look * calm;
      head.current.rotation.set(0, lookAround + 0.35 * (1 - sp.summit) * (1 - s), 0);
    }
    if (scarf.current) scarf.current.position.set(0, chest.y + 0.03, chest.z);
    if (pack.current) pack.current.position.set(0, chest.y - 0.2, chest.z - 0.13);
    // Scarf tail streaming in the wind.
    if (tail.current) {
      const gust = 0.9 + sp.blizzard * 0.6;
      tail.current.rotation.x = 1.15 + (Math.sin(t * 5.5) * 0.14 + Math.sin(t * 13) * 0.06) * (1 + sp.blizzard * 2.5) * calm - w * 0.15;
      tail.current.rotation.z = -gust * 0.45 + Math.sin(t * 3.1) * 0.1 * calm;
      tail.current.scale.y = 1 + sp.blizzard * 0.5;
    }
    if (eyes.current) {
      if (t > blink.next) {
        blink.at = t;
        blink.next = t + IDLE_TIMING.blinkMin + Math.random() * (IDLE_TIMING.blinkMax - IDLE_TIMING.blinkMin);
      }
      eyes.current.scale.y = t - blink.at < 0.13 ? 0.12 : 1;
    }

    // At a station the bubble sits above the ice block, so it never covers the photo.
    const a = anchor.current;
    if (a) {
      if (sp.sit > 0.5) {
        a.position.copy(station.block);
        a.position.y += 5.05;
      } else headTop.current?.getWorldPosition(a.position);
      pinBubble(dom.bubbleAnchor.current, a, camera, size);
    }
  });

  return (
    <>
      <group ref={group} scale={SCALE}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={setLimb(i)} material={body}>
            <capsuleGeometry args={[0.05, LIMB, 4, 8]} />
          </mesh>
        ))}
        {[4, 5, 6, 7].map((i) => (
          <mesh key={i} ref={setLimb(i)} material={body}>
            <capsuleGeometry args={[0.042, LIMB, 4, 8]} />
          </mesh>
        ))}
        <mesh ref={torso} material={body}>
          <capsuleGeometry args={[0.085, LIMB, 4, 10]} />
        </mesh>
        <group ref={head}>
          <FigureHead material={skin} eyes={eyes} />
          {/* Beanie */}
          <mesh position={[0, 0.075, 0]} scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.158, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={S.beanie} roughness={0.9} emissive={S.beanie} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.165, 0.165, 0.05, 12]} />
            <meshStandardMaterial color={S.beanieBand} roughness={0.9} emissive={S.beanieBand} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.042, 7, 6]} />
            <meshStandardMaterial color={S.beanieBand} roughness={1} />
          </mesh>
          <group ref={headTop} position={[0, 0.34, 0]} />
        </group>
        {/* Backpack */}
        <group ref={pack}>
          <mesh>
            <boxGeometry args={[0.24, 0.32, 0.14]} />
            <meshStandardMaterial color={S.pack} flatShading roughness={0.85} emissive={S.pack} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.055, 0.26, 7]} />
            <meshStandardMaterial color={S.packRoll} flatShading roughness={0.9} />
          </mesh>
        </group>
        {/* Sapphire scarf */}
        <group ref={scarf}>
          <Scarf color={S.scarf} />
          <group ref={tail} position={[-0.05, 0, -0.03]}>
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.026, 0.24, 3, 8]} />
              <meshStandardMaterial color={S.scarf} roughness={0.8} emissive={S.scarf} emissiveIntensity={0.5} />
            </mesh>
          </group>
        </group>
      </group>
      <group ref={anchor} />
    </>
  );
}
