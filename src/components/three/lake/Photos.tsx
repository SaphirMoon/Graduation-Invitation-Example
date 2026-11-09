"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { THEME } from "@/config/theme";
import type { MemoryPhoto } from "@/lib/memories";
import { drawPlayBadge, radialTexture } from "../textures";
import { BOAT_SCALE, heroSpot, LAKE_YAW, PHOTO, photoSlot, TOSS_HAND, type LakeState } from "./lakeState";

export const CANVAS = { width: 640, height: 755, margin: 32, window: 576 };

/** The handwriting family resolved from the root layout's CSS variable. */
export function handFont() {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim() || "cursive";
}

/** Sets the largest font at which the caption fits in up to two lines; returns the lines. */
function fitCaption(ctx: CanvasRenderingContext2D, caption: string, maxWidth: number) {
  const words = caption.split(" ");
  for (let px = 44; px >= 22; px -= 2) {
    ctx.font = `${px}px ${handFont()}`;
    if (ctx.measureText(caption).width <= maxWidth) return [caption];
    // The most even split into two lines that fits.
    let best: string[] | null = null;
    let widest = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (w <= maxWidth && w < widest) {
        best = [a, b];
        widest = w;
      }
    }
    // Two lines need a slightly smaller face to sit inside the paper strip.
    if (best && px <= 38) return best;
  }
  return [caption];
}

export function drawPolaroid(ctx: CanvasRenderingContext2D, caption: string, img: HTMLImageElement | null, isVideo = false, focus = 0.5) {
  const { width, height, margin, window: size } = CANVAS;
  ctx.fillStyle = THEME.polaroid.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = THEME.polaroid.empty;
  ctx.fillRect(margin, margin, size, size);
  if (img) {
    // Crop to the square window (object-fit: cover).
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) * focus, (img.naturalHeight - s) * focus, s, s, margin, margin, size, size);
    if (isVideo) drawPlayBadge(ctx, margin + size / 2, margin + size / 2, size * 0.13);
  }
  ctx.fillStyle = THEME.polaroid.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = fitCaption(ctx, caption, size);
  const middle = margin + size + (height - margin - size) / 2;
  const step = parseInt(ctx.font, 10) * 1.42;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, middle + (i - (lines.length - 1) / 2) * step));
}

const pos = new THREE.Vector3();
const hero = new THREE.Vector3();
const slot = new THREE.Vector3();
const toss = new THREE.Vector3();
const lean = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Quaternion();
const groupInverse = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -LAKE_YAW);
const ease = (x: number) => x * x * (3 - 2 * x);

/** One polaroid: lazy-loaded texture, flight, landing, drift and bobbing. */
function Photo({ lake, photo, index, count, onOpen }: { lake: LakeState; photo: MemoryPhoto; index: number; count: number; onOpen: (i: number) => void }) {
  const aspect = useThree((s) => s.viewport.aspect);
  const group = useRef<THREE.Group>(null);
  const mirror = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const loading = useRef(false);
  const seed = useMemo(() => index * 2.4 + 0.7, [index]);

  const { canvas, texture, material, mirrorMaterial } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = CANVAS.width;
    c.height = CANVAS.height;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const mm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.055, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    return { canvas: c, texture: tex, material: m, mirrorMaterial: mm };
  }, []);
  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
      mirrorMaterial.dispose();
    },
    [texture, material, mirrorMaterial],
  );
  const shadowTex = useMemo(() => radialTexture("photo-shadow", 0.25, 1.2), []);

  /** Draws the frame + caption, then the photo as soon as it arrives. */
  const load = () => {
    loading.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = handFont();
    void document.fonts.load(`40px ${family}`, photo.caption).finally(() => {
      drawPolaroid(ctx, photo.caption, null);
      texture.needsUpdate = true;
      const img = new Image();
      img.onload = () => {
        drawPolaroid(ctx, photo.caption, img, Boolean(photo.videoId), photo.focus);
        texture.needsUpdate = true;
      };
      img.src = photo.src;
    });
  };

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    const st = lake.photos[index];
    // Lazy-load: a photo starts loading once the previous one has been released.
    if (!loading.current && (index === 0 || lake.photos[index - 1].show > 0)) load();

    const on = st.show > 0;
    g.visible = on;
    if (mirror.current) mirror.current.visible = on && st.fly >= 1;
    if (shadow.current) shadow.current.visible = on && st.fly >= 0.9;
    if (!on) return;

    const t = clock.elapsedTime;
    const motion = lake.stage.reduced ? 0.25 : 1;
    heroSpot(index, aspect, hero);
    photoSlot(index, count, aspect, slot);

    const d = ease(st.drift);
    pos.copy(hero).lerp(slot, d);
    let scale = PHOTO.heroScale + (1 - PHOTO.heroScale) * d;
    let spin = 0;
    let y = (PHOTO.height / 2) * scale * 0.94;

    if (st.fly < 1) {
      const f = st.fly;
      // Arc from the narrator's hand, growing as it comes toward the camera.
      if (f <= 0) pos.copy(lake.hand);
      else {
        toss.copy(TOSS_HAND).multiplyScalar(BOAT_SCALE);
        toss.x += lake.boat.x;
        toss.z += lake.boat.z;
        const e = ease(f);
        pos.lerpVectors(toss, hero, e);
        y = THREE.MathUtils.lerp(toss.y, y, e) + Math.sin(f * Math.PI) * 3.1;
      }
      if (f <= 0) y = lake.hand.y;
      scale = 0.14 + (scale - 0.14) * Math.pow(Math.max(f, 0), 1.3);
      spin = Math.sin(f * Math.PI) * 0.55 * (index % 2 ? 1 : -1);
    }

    // Drifting and bobbing once on the water.
    const onWater = st.fly >= 1 ? 1 : 0;
    const bob = Math.sin(t * 0.95 + seed) * 0.05 * motion * onWater;
    pos.x += Math.sin(t * 0.22 + seed) * 0.16 * motion * onWater;
    pos.z += Math.cos(t * 0.17 + seed) * 0.12 * motion * onWater;
    g.position.set(pos.x, y + bob, pos.z);
    g.scale.setScalar(scale);

    // Face the camera, leaning back onto the water, slightly askew.
    const wobble = Math.sin(t * 0.7 + seed) * 0.035 * motion;
    const tilt = (index % 2 ? 0.06 : -0.07) + wobble + spin;
    euler.setFromAxisAngle(Z, tilt);
    lean.setFromAxisAngle(X, -PHOTO.lean * (st.fly < 1 ? st.fly : 1));
    g.quaternion.copy(groupInverse).multiply(camera.quaternion).multiply(lean).multiply(euler);
    material.opacity = st.show;

    if (mirror.current) {
      mirror.current.position.set(pos.x, -y + bob * -1, pos.z);
      mirror.current.quaternion.copy(g.quaternion);
      mirror.current.scale.set(scale, -scale, scale);
      mirrorMaterial.opacity = 0.055 * st.show;
    }
    if (shadow.current) {
      shadow.current.position.set(pos.x, 0.02, pos.z + 0.25);
      shadow.current.scale.set(PHOTO.width * scale * 1.5, PHOTO.width * scale * 0.95, 1);
    }
  });

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} color={THEME.shadow} transparent opacity={0.4} depthWrite={false} fog={false} />
      </mesh>
      <mesh ref={mirror} material={mirrorMaterial} renderOrder={1}>
        <planeGeometry args={[PHOTO.width, PHOTO.height]} />
      </mesh>
      <group ref={group}>
        <mesh
          material={material}
          renderOrder={3}
          onClick={(e) => {
            e.stopPropagation();
            if (lake.photos[index].fly >= 1) onOpen(index);
          }}
          onPointerOver={() => {
            if (lake.photos[index].fly >= 1) document.body.style.cursor = "zoom-in";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <planeGeometry args={[PHOTO.width, PHOTO.height]} />
        </mesh>
      </group>
    </>
  );
}

export function Photos({ lake, photos, onOpen }: { lake: LakeState; photos: MemoryPhoto[]; onOpen: (i: number) => void }) {
  return (
    <>
      {photos.map((p, i) => (
        <Photo key={p.src} lake={lake} photo={p} index={i} count={photos.length} onOpen={onOpen} />
      ))}
    </>
  );
}
