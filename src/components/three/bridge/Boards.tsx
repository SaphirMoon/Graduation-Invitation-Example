"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { drawPlayBadge, radialTexture } from "../textures";
import { BOARD, type Board, BOARDS, type BridgeState, DECK_END } from "./bridgeState";

const B = PALETTE.bridge;
const IMAGE = 900;
const DIM = new THREE.Color(B.boardDim);
const WHITE = new THREE.Color("#ffffff");

/** A lantern board beside the bridge: dim until the narrator arrives, then it lights up from behind. */
function PhotoBoard({ sp, board, photo, index, onOpen }: { sp: BridgeState; board: Board; photo: MemoryPhoto; index: number; onOpen: (i: number) => void }) {
  const loading = useRef(false);
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const backing = useRef<THREE.MeshBasicMaterial>(null);
  const picture = useRef<THREE.MeshBasicMaterial>(null);
  const lamps = useRef<THREE.MeshBasicMaterial>(null);
  const haloTex = useMemo(() => radialTexture("board-halo", 0.15, 1.2), []);
  const litBack = useMemo(() => new THREE.Color(B.boardGlow).multiplyScalar(1.15), []);
  const offBack = useMemo(() => new THREE.Color(B.boardOff), []);
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = IMAGE;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = B.boardOff;
      ctx.fillRect(0, 0, IMAGE, IMAGE);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas: c, texture: tex };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    // Stands up once the bridge has reached it.
    if (group.current) {
      const k = THREE.MathUtils.smoothstep(sp.build * DECK_END, board.u + 0.01, board.u + 0.05);
      group.current.visible = k > 0.001;
      group.current.scale.setScalar(Math.max(k, 0.001));
    }
    // Lazy-load: as the narrator approaches.
    if (!loading.current && sp.u > board.u - 0.2) {
      loading.current = true;
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const focus = photo.focus ?? 0.5;
        ctx.drawImage(img, (img.naturalWidth - side) * focus, (img.naturalHeight - side) * focus, side, side, 0, 0, IMAGE, IMAGE);
        if (photo.videoId) drawPlayBadge(ctx, IMAGE / 2, IMAGE / 2, IMAGE * 0.13);
        texture.needsUpdate = true;
      };
      img.src = photo.src;
    }
    const glow = sp.boards[index].glow;
    if (picture.current) picture.current.color.copy(DIM).lerp(WHITE, glow);
    if (backing.current) backing.current.color.copy(offBack).lerp(litBack, glow);
    if (halo.current) halo.current.opacity = 0.2 * glow;
    if (lamps.current) lamps.current.opacity = 0.35 + 0.65 * glow;
  });

  const s = BOARD.size;
  const depth = board.deckY - board.center.y;
  return (
    <group ref={group} position={board.center} rotation={[0, board.yaw, 0]}>
      <sprite position={[0, 0, -0.6]} scale={[8.5, 8.5, 1]} renderOrder={1}>
        <spriteMaterial ref={halo} map={haloTex} color={B.boardGlow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </sprite>
      {/* Wooden posts going down past the deck, and a beam across the top */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * (s / 2 + 0.34), (s / 2 + 0.5 + depth - 1) / 2, -0.08]}>
          <boxGeometry args={[0.2, s / 2 + 0.5 - depth + 1, 0.2]} />
          <meshBasicMaterial color={B.wood} fog={false} />
        </mesh>
      ))}
      <mesh position={[0, s / 2 + 0.5, -0.08]}>
        <boxGeometry args={[s + 1.4, 0.2, 0.26]} />
        <meshBasicMaterial color={B.wood} fog={false} />
      </mesh>
      {/* Small lanterns at the top corners */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * (s / 2 + 0.34), s / 2 + 0.22, 0.14]}>
          <boxGeometry args={[0.24, 0.32, 0.24]} />
          <meshBasicMaterial ref={x === 1 ? lamps : undefined} color={B.lamp} transparent fog={false} toneMapped={false} />
        </mesh>
      ))}
      {/* Warm light from behind, thin frame, photo */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[s + 0.42, s + 0.42]} />
        <meshBasicMaterial ref={backing} fog={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[s + 0.1, s + 0.1]} />
        <meshBasicMaterial color={B.frame} fog={false} toneMapped={false} />
      </mesh>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (sp.boards[index].glow > 0.3) onOpen(index);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "zoom-in";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial ref={picture} map={texture} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Boards({ sp, photos, onOpen }: { sp: BridgeState; photos: MemoryPhoto[]; onOpen: (i: number) => void }) {
  return (
    <>
      {photos.slice(0, BOARDS.length).map((p, i) => (
        <PhotoBoard key={p.src} sp={sp} board={BOARDS[i]} photo={p} index={i} onOpen={onOpen} />
      ))}
    </>
  );
}
