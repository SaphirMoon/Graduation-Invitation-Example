"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { IDLE_TIMING } from "@/config/timing";
import { PALETTE } from "@/config/world";
import { FigureHead, pinBubble, Scarf } from "../objects/FigureBits";
import { radialTexture } from "../textures";
import { useStage } from "../stage";
import { BOARD, BOARDS, type BridgeState, frameAt, LENGTH, newFrame, STRIDE } from "./bridgeState";

const S = PALETTE.snow3;
const UP = new THREE.Vector3(0, 1, 0);
const SCALE = 1.25;
const LIMB = 0.4;

const frame = newFrame();
const dir = new THREE.Vector3();
const hip = new THREE.Vector3();
const chest = new THREE.Vector3();
const foot = new THREE.Vector3();
const knee = new THREE.Vector3();
const hand = new THREE.Vector3();
const elbow = new THREE.Vector3();
const shoulder = new THREE.Vector3();
const raised = new THREE.Vector3();

function aim(o: THREE.Object3D | null, from: THREE.Vector3, to: THREE.Vector3) {
  if (!o) return;
  dir.copy(to).sub(from);
  const len = Math.max(dir.length(), 0.001);
  o.position.copy(from).addScaledVector(dir, 0.5);
  o.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
  o.scale.set(1, len / LIMB, 1);
}

const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const blink = { next: 2, at: -1 };

/** The narrator from year 3 with a lantern in hand, walking the bridge. */
export function Traveler({ sp }: { sp: BridgeState }) {
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
  const lantern = useRef<THREE.Group>(null);
  const headTop = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Sprite>(null);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: S.jacket, roughness: 0.8, emissive: S.jacket, emissiveIntensity: 0.35 }), []);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.figure, emissive: PALETTE.moonlight, emissiveIntensity: 0.2, roughness: 0.55 }), []);
  const glowTex = useMemo(() => radialTexture("hand-lantern", 0.04, 1.2), []);
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
    const calm = sp.stage.reduced ? 0.25 : 1;
    frameAt(sp.u, frame);
    g.position.copy(frame.point);
    let yaw = Math.atan2(frame.tangent.x, frame.tangent.z);
    if (sp.u < 0.002) yaw = 0;
    // Turned to the board, then back toward us at the end.
    const board = BOARDS[Math.min(sp.station, BOARDS.length - 1)];
    yaw += turn(yaw, Math.atan2(-board.normal.x, -board.normal.z) + 0.5) * sp.lock;
    yaw += turn(yaw, yaw + Math.PI) * sp.end;
    g.rotation.y = yaw;

    // Legs follow the distance walked, so they never slide on the planks.
    const distance = sp.u * LENGTH;
    sp.steps = distance / STRIDE;
    const phase = sp.steps * Math.PI;
    const w = sp.walk;
    const bob = Math.abs(Math.sin(phase)) * 0.03 * w;
    hip.set(0, 0.68 + bob, 0);
    chest.set(0, hip.y + 0.44, 0.06 * w);
    for (const side of [0, 1]) {
      const sign = side ? 1 : -1;
      const swing = Math.sin(phase + (side ? Math.PI : 0));
      foot.set(sign * 0.08, Math.max(0, Math.cos(phase + (side ? Math.PI : 0))) * 0.11 * w, swing * 0.26 * w);
      knee.copy(hip).add(foot).multiplyScalar(0.5);
      knee.z += 0.1 + 0.08 * w;
      knee.x = sign * 0.085;
      hip.x = sign * 0.06;
      aim(limbs.current[side * 2], hip, knee);
      aim(limbs.current[side * 2 + 1], knee, foot);
      hip.x = 0;
      shoulder.set(sign * 0.09, chest.y - 0.03, chest.z);
      hand.set(sign * 0.15, chest.y - 0.42 + 0.06 * w, chest.z - swing * 0.26 * w);
      if (side === 1) {
        // Lantern arm: steady in front while carried; straight up when raised.
        const k = sp.raise;
        const carry = THREE.MathUtils.smoothstep(k, 0, 0.35);
        hand.lerp(raised.set(0.2, chest.y - 0.2, chest.z + 0.22), carry);
        hand.lerp(raised.set(0.34, chest.y + 0.56, chest.z + 0.12), THREE.MathUtils.smoothstep(k, 0.4, 1));
        if (lantern.current) {
          lantern.current.position.copy(hand);
          lantern.current.scale.setScalar(Math.max(carry, 0.001));
          lantern.current.getWorldPosition(sp.lantern);
        }
      }
      elbow.copy(shoulder).add(hand).multiplyScalar(0.5);
      elbow.x += sign * 0.05;
      elbow.z -= 0.05;
      aim(limbs.current[side * 2 + 4], shoulder, elbow);
      aim(limbs.current[side * 2 + 5], elbow, hand);
    }
    aim(torso.current, hip, chest);
    if (head.current) {
      head.current.position.set(0, chest.y + 0.24, chest.z + 0.02);
      // Looks up at the lamp while raising the lantern, a touch toward the camera at the photos.
      head.current.rotation.set(-0.3 * THREE.MathUtils.smoothstep(sp.raise, 0.4, 1) * (1 - sp.walk), 0.35 * sp.lock, 0);
    }
    if (scarf.current) scarf.current.position.set(0, chest.y + 0.03, chest.z);
    if (pack.current) pack.current.position.set(0, chest.y - 0.2, chest.z - 0.13);
    if (tail.current) {
      tail.current.rotation.x = 1.1 + (Math.sin(t * 4.5) * 0.14 + Math.sin(t * 11) * 0.05) * calm - w * 0.15;
      tail.current.rotation.z = -0.4 + Math.sin(t * 2.6) * 0.1 * calm;
    }
    if (eyes.current) {
      if (t > blink.next) {
        blink.at = t;
        blink.next = t + IDLE_TIMING.blinkMin + Math.random() * (IDLE_TIMING.blinkMax - IDLE_TIMING.blinkMin);
      }
      eyes.current.scale.y = t - blink.at < 0.13 ? 0.12 : 1;
    }
    if (halo.current) {
      const f = sp.stage.reduced ? 1 : 1 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 12.1) * 0.03;
      halo.current.scale.setScalar(0.62 * f * (1 + sp.raise * 0.6));
    }

    // At a board the bubble sits above the photo, so it never covers it.
    const a = anchor.current;
    if (a) {
      if (sp.lock > 0.5) {
        a.position.copy(board.center);
        a.position.y += BOARD.size / 2 + 0.9;
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
        <group ref={scarf}>
          <Scarf color={S.scarf} />
          <group ref={tail} position={[-0.05, 0, -0.03]}>
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.026, 0.24, 3, 8]} />
              <meshStandardMaterial color={S.scarf} roughness={0.8} emissive={S.scarf} emissiveIntensity={0.5} />
            </mesh>
          </group>
        </group>
        <group ref={lantern}>
          <mesh position={[0, -0.09, 0]}>
            <boxGeometry args={[0.13, 0.17, 0.13]} />
            <meshBasicMaterial color={new THREE.Color(S.lantern).multiplyScalar(1.5)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.015, 0.09, 0.015]} />
            <meshBasicMaterial color={S.wood} />
          </mesh>
          <sprite ref={halo} position={[0, -0.09, 0]}>
            <spriteMaterial map={glowTex} color={S.lantern} transparent opacity={0.36} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
          </sprite>
        </group>
      </group>
      <group ref={anchor} />
    </>
  );
}
