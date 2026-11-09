"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { THEME } from "@/config/theme";
import { PALETTE } from "@/config/world";
import type { MemoryPhoto } from "@/lib/memories";
import { handFont } from "../lake/Photos";
import { drawPlayBadge, radialTexture } from "../textures";
import { groundY, pathPoint, STATIONS, type SnowState, type Station } from "./snowState";

const S = PALETTE.snow3;
const ICE = { width: 3.9, height: 4.9, depth: 1.5, photo: 3.2, photoY: 2.62 };
const IMAGE = 900;

/* ---------------- The ice block ---------------- */

/** A chunk of ice: a beveled box with its corners nudged, so the facets look hand-cut. */
function iceGeometry() {
  const { width: w, height: h, depth: d } = ICE;
  const g = new THREE.BoxGeometry(1, 1, 1, 2, 3, 1).toNonIndexed();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Same nudge for the same corner, wherever it appears.
    const seed = Math.sin(x * 91.7 + y * 47.3 + z * 13.1) * 43758.5;
    const n = seed - Math.floor(seed) - 0.5;
    const taper = 1 - (y + 0.5) * 0.1;
    pos.setXYZ(i, (x + n * 0.06) * w * taper, (y + 0.5) * h + (y > 0.4 ? n * 0.5 : 0), (z + n * 0.05) * d * taper);
  }
  g.computeVertexNormals();
  return g;
}

function IceBlock({ sp, station, photo, index, onOpen }: { sp: SnowState; station: Station; photo: MemoryPhoto; index: number; onOpen: (i: number) => void }) {
  const geometry = useMemo(() => iceGeometry(), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 12), [geometry]);
  const shell = useMemo(
    () => new THREE.MeshBasicMaterial({ color: S.ice, transparent: true, opacity: 0.1, side: THREE.FrontSide, depthWrite: false, toneMapped: false }),
    [],
  );
  const inner = useMemo(() => new THREE.MeshBasicMaterial({ color: S.iceBack, transparent: true, opacity: 0.85, side: THREE.BackSide, depthWrite: false }), []);
  const lines = useMemo(() => new THREE.LineBasicMaterial({ color: S.iceEdge, transparent: true, opacity: 0.55, toneMapped: false }), []);
  const frost = useMemo(() => new THREE.MeshBasicMaterial({ color: S.frost, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), []);
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: radialTexture("ice-halo", 0.1, 1.2), color: S.iceGlow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const loading = useRef(false);
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = IMAGE;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = THEME.polaroid.empty;
      ctx.fillRect(0, 0, IMAGE, IMAGE);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas: c, texture: tex };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      edges.dispose();
      shell.dispose();
      inner.dispose();
      lines.dispose();
      frost.dispose();
      halo.dispose();
      texture.dispose();
    },
    [geometry, edges, shell, inner, lines, frost, halo, texture],
  );

  useFrame(() => {
    // Lazy-load: as the narrator approaches this station.
    if (!loading.current && sp.u > station.u - 0.2) {
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
    const glow = sp.ice[index].glow;
    frost.opacity = 0.82 * (1 - glow);
    halo.opacity = 0.5 * glow;
    // The ice clears as it lights up, so the photo inside stays true.
    shell.opacity = 0.2 - glow * 0.13;
    lines.opacity = 0.5 + glow * 0.5;
  });

  const { photo: size, photoY: y } = ICE;
  return (
    <group position={station.block} rotation={[0, station.yaw, 0]}>
      <mesh geometry={geometry} material={inner} renderOrder={2} />
      <sprite material={halo} position={[0, y, -0.2]} scale={[7, 7, 1]} renderOrder={3} />
      <mesh
        position={[0, y, 0.1]}
        renderOrder={4}
        onClick={(e) => {
          e.stopPropagation();
          if (sp.ice[index].glow > 0.3) onOpen(index);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "zoom-in";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, y, 0.11]} material={frost} renderOrder={5}>
        <planeGeometry args={[size, size]} />
      </mesh>
      <mesh geometry={geometry} material={shell} renderOrder={6} />
      <lineSegments geometry={edges} material={lines} renderOrder={7} />
    </group>
  );
}

/* ---------------- Altitude post: wood, with a handwritten sign ---------------- */

function AltitudePost({ point, yaw, label }: { point: THREE.Vector3; yaw: number; label: string }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 120;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const ctx = c.getContext("2d");
    if (ctx) {
      void document.fonts.load(`54px ${handFont()}`, label).finally(() => {
        ctx.fillStyle = S.sign;
        ctx.fillRect(0, 0, 320, 120);
        ctx.fillStyle = S.signInk;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `50px ${handFont()}`;
        ctx.fillText(label, 160, 62);
        tex.needsUpdate = true;
      });
    }
    return tex;
  }, [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={point} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.13, 1.7, 0.13]} />
        <meshBasicMaterial color={S.wood} />
      </mesh>
      <mesh position={[0, 1.42, 0.08]}>
        <planeGeometry args={[1.12, 0.42]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  );
}

/* ---------------- Warm lights ---------------- */

const tmp = new THREE.Object3D();

/** Lanterns at each station and on the summit: bodies are instanced, flicker is shared. */
function Lanterns({ spots, reduced }: { spots: THREE.Vector3[]; reduced: boolean }) {
  const posts = useRef<THREE.InstancedMesh>(null);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<(THREE.Sprite | null)[]>([]);
  const glow = useMemo(() => radialTexture("snow-lantern", 0.04, 1.2), []);
  const pool = useMemo(() => radialTexture("snow-pool", 0, 1), []);
  useLayoutEffect(() => {
    spots.forEach((p, i) => {
      tmp.position.set(p.x, p.y + 0.5, p.z);
      tmp.scale.set(0.06, 1, 0.06);
      tmp.updateMatrix();
      posts.current?.setMatrixAt(i, tmp.matrix);
      tmp.position.set(p.x, p.y + 1.1, p.z);
      tmp.scale.set(0.24, 0.32, 0.24);
      tmp.updateMatrix();
      bodies.current?.setMatrixAt(i, tmp.matrix);
    });
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    halos.current.forEach((h, i) => {
      if (!h) return;
      const f = reduced ? 1 : 1 + Math.sin(t * 7.3 + i * 2) * 0.05 + Math.sin(t * 12.1 + i) * 0.03;
      h.scale.setScalar(2.1 * f);
    });
  });
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={S.wood} />
      </instancedMesh>
      <instancedMesh ref={bodies} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={S.lantern} toneMapped={false} />
      </instancedMesh>
      {spots.map((p, i) => (
        <group key={i}>
          <sprite
            ref={(s) => {
              halos.current[i] = s;
            }}
            position={[p.x, p.y + 1.1, p.z]}
          >
            <spriteMaterial map={glow} color={S.lantern} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
          </sprite>
          {/* Warm pool of light on the snow; multiplied so it tints rather than blows out */}
          <mesh position={[p.x, p.y + 0.14, p.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <planeGeometry args={[4.6, 4.6]} />
            <meshBasicMaterial map={pool} color={S.lanternPool} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Strings of small coral and mint flags. */
function Flags({ sp, strings }: { sp: SnowState; strings: [THREE.Vector3, THREE.Vector3][] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const PER = 9;
  const count = strings.length * PER;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.34, 0], 3));
    return g;
  }, []);
  const rope = useMemo(() => {
    const pts: number[] = [];
    const point = new THREE.Vector3();
    for (const [a, b] of strings) {
      for (let i = 0; i < 12; i++) {
        for (const k of [i / 12, (i + 1) / 12]) {
          point.lerpVectors(a, b, k);
          point.y -= Math.sin(k * Math.PI) * 0.38;
          pts.push(point.x, point.y, point.z);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [strings]);
  useEffect(
    () => () => {
      geometry.dispose();
      rope.dispose();
    },
    [geometry, rope],
  );
  const spots = useMemo(() => {
    const out: { p: THREE.Vector3; yaw: number; seed: number }[] = [];
    strings.forEach(([a, b], s) => {
      for (let i = 0; i < PER; i++) {
        const k = (i + 0.5) / PER;
        const p = a.clone().lerp(b, k);
        p.y -= Math.sin(k * Math.PI) * 0.38;
        out.push({ p, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), seed: s * 3 + i });
      }
    });
    return out;
  }, [strings]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const colors = [new THREE.Color(S.flags[0]), new THREE.Color(S.flags[1])];
    spots.forEach((_, i) => m.setColorAt(i, colors[i % 2]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [spots]);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const windy = sp.stage.reduced ? 0.15 : 0.5 + sp.blizzard * 1.4;
    spots.forEach((f, i) => {
      tmp.position.copy(f.p);
      tmp.rotation.set(Math.sin(t * 4 + f.seed) * 0.24 * windy + windy * 0.35, f.yaw, 0);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      <lineSegments geometry={rope}>
        <lineBasicMaterial color={S.wood} />
      </lineSegments>
    </>
  );
}

/* ---------------- All stations ---------------- */

type Props = { sp: SnowState; photos: MemoryPhoto[]; onOpen: (i: number) => void };

export function Stations({ sp, photos, onOpen }: Props) {
  const used = useMemo(() => STATIONS.slice(0, photos.length), [photos.length]);
  const { lanterns, strings, posts } = useMemo(() => {
    const lanterns: THREE.Vector3[] = [];
    const strings: [THREE.Vector3, THREE.Vector3][] = [];
    const posts: { point: THREE.Vector3; yaw: number; label: string }[] = [];
    const at = (s: Station, right: number, out: number) => {
      const p = s.block.clone().addScaledVector(s.right, right).addScaledVector(s.out, out);
      p.y = groundY(p.x, p.z);
      return p;
    };
    used.forEach((s, i) => {
      lanterns.push(at(s, -1.38, 1.05));
      // The flags run behind the block, above it: they never cross the photo.
      const a = at(s, -5.2, -1.3);
      const b = at(s, 0, -1.3);
      const c = at(s, 5.2, -1.3);
      a.y = c.y = s.block.y + 4.7;
      b.y = s.block.y + 6.1;
      strings.push([a, b], [b, c]);
      posts.push({ point: at(s, 2.6, 2.2), yaw: s.yaw, label: photos[i].altitude ?? "" });
    });
    // Markers between the stations.
    used.forEach((s, i) => {
      const next = used[i + 1];
      if (!next) return;
      const u = (s.u + next.u) / 2;
      const p = new THREE.Vector3();
      pathPoint(u, p);
      const a = parseAltitude(photos[i].altitude);
      const b = parseAltitude(photos[i + 1].altitude);
      if (a === null || b === null) return;
      const out = new THREE.Vector3(p.x, 0, p.z + 20).normalize();
      p.addScaledVector(out, 1.5);
      p.y = groundY(p.x, p.z);
      posts.push({ point: p, yaw: Math.atan2(out.x, out.z), label: `${((a + b) / 2).toLocaleString("vi-VN")} m` });
    });
    // On the summit.
    const top = new THREE.Vector3();
    pathPoint(1, top);
    lanterns.push(top.clone().add(new THREE.Vector3(1.2, 0, 1.1)).setY(groundY(top.x + 1.2, top.z + 1.1)));
    return { lanterns, strings, posts };
  }, [used, photos]);

  return (
    <>
      {used.map((s, i) => (
        <IceBlock key={photos[i].src} sp={sp} station={s} photo={photos[i]} index={i} onOpen={onOpen} />
      ))}
      <Lanterns spots={lanterns} reduced={sp.stage.reduced} />
      <Flags sp={sp} strings={strings} />
      {posts.map((p, i) => (
        <AltitudePost key={i} point={p.point} yaw={p.yaw} label={p.label} />
      ))}
    </>
  );
}

function parseAltitude(a?: string) {
  if (!a) return null;
  const n = Number(a.replace(/[^\d]/g, ""));
  return Number.isNaN(n) ? null : n;
}
