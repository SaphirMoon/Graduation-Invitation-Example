import * as THREE from "three";
import { THEME } from "@/config/theme";

const cache = new Map<string, THREE.Texture>();

/** Soft radial gradient texture (white center → transparent), generated once on a canvas. */
export function radialTexture(key = "soft", inner = 0, falloff = 1): THREE.Texture {
  const id = `${key}:${inner}:${falloff}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(Math.min(0.99, inner), "rgba(255,255,255,0.9)");
  g.addColorStop(Math.min(0.995, inner + 0.35 * falloff), "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, tex);
  return tex;
}

/** Soft glowing ring (transparent center and outside), for shockwaves. */
export function ringTexture(): THREE.Texture {
  const id = "ring";
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.6, "rgba(255,255,255,0.04)");
  g.addColorStop(0.86, "rgba(255,255,255,0.55)");
  g.addColorStop(0.93, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, tex);
  return tex;
}

/** The glowing ▶ drawn over a video's poster, so it reads as something to tap. */
export function drawPlayBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const { disc, glow, mark } = THEME.playBadge;
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = radius * 0.7;
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mark;
  ctx.lineWidth = radius * 0.07;
  ctx.stroke();
  ctx.fillStyle = mark;
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 0.1;
  ctx.beginPath();
  // Nudged right: a triangle's visual center sits ahead of its bounding box.
  ctx.moveTo(x - radius * 0.3, y - radius * 0.46);
  ctx.lineTo(x + radius * 0.5, y);
  ctx.lineTo(x - radius * 0.3, y + radius * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
