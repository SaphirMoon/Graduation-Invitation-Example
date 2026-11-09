/**
 * Procedural moon surface: a subdivided icosphere with craters (bowl + raised rim),
 * darker "maria" patches and fine grain. Relief shading is baked into vertex colors
 * (from the height field's slope, so craters read smooth and round) because the moon
 * is mostly emissive and real lights barely shade it.
 */
import * as THREE from "three";
import { seeded } from "@/lib/random";

/** Moon-local frame: +Z faces the viewer, +Y is up. Light for the baked relief: upper left. */
const SUN = new THREE.Vector3(-0.6, 0.55, 0.58).normalize();

/** Relief contrast (how strongly crater walls light up / fall into shadow) */
const RELIEF = 2.7;
/** Displacement of the actual geometry relative to the shading height (keeps the silhouette tidy) */
const DISPLACE = 0.4;

/** Dark maria on the visible side: direction (local frame), angular radius (rad), darkness */
const MARIA: [number, number, number, number, number][] = [
  [-0.36, 0.42, 0.83, 0.42, 0.36],
  [-0.62, -0.02, 0.78, 0.5, 0.32],
  [0.3, 0.32, 0.9, 0.27, 0.36],
  [0.46, 0.04, 0.89, 0.24, 0.34],
  [0.05, 0.1, 0.99, 0.18, 0.24],
  [0.12, -0.36, 0.92, 0.22, 0.26],
  [0.62, 0.42, 0.66, 0.16, 0.3],
];

type Crater = { c: THREE.Vector3; r: number; depth: number; bright: number };

function randomDir(rnd: () => number, front: boolean) {
  // Uniform on the sphere (or on the visible hemisphere)
  const z = front ? 0.15 + rnd() * 0.85 : rnd() * 2 - 1;
  const t = rnd() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(t) * s, Math.sin(t) * s, z);
}

/** Smooth, cheap 3D grain (sum of sines). */
function grain(x: number, y: number, z: number) {
  return (
    Math.sin(x * 9.1 + y * 3.7 + 1.3) * 0.5 +
    Math.sin(y * 11.3 - z * 5.1 + 0.4) * 0.3 +
    Math.sin(z * 17.7 + x * 7.9 + 2.1) * 0.2
  );
}

function makeSurface() {
  const rnd = seeded(91152);
  const craters: Crater[] = Array.from({ length: 30 }, (_, i) => {
    const r = 0.06 + Math.pow(rnd(), 2.2) * 0.22;
    return {
      c: randomDir(rnd, i < 22),
      r,
      depth: r * (0.1 + rnd() * 0.06),
      // A few young, bright craters
      bright: rnd() < 0.3 ? 0.16 : 0,
    };
  });
  const maria = MARIA.map(([x, y, z, r, k]) => ({ c: new THREE.Vector3(x, y, z).normalize(), r, k }));

  /** Height (fraction of the radius) and albedo at a unit direction. */
  return (v: THREE.Vector3) => {
    let h = 0;
    let albedo = 1 + grain(v.x, v.y, v.z) * 0.04;
    for (const m of maria) {
      const d = Math.acos(THREE.MathUtils.clamp(v.dot(m.c), -1, 1)) / m.r;
      const edge = 1 + Math.sin(v.x * 23 + v.y * 17) * 0.12 + Math.sin(v.z * 31 - v.x * 13) * 0.08;
      const w = 1 - THREE.MathUtils.smoothstep(d, 0.5 * edge, 1.05 * edge);
      albedo -= w * m.k;
      h -= w * 0.004;
    }
    for (const c of craters) {
      const d = Math.acos(THREE.MathUtils.clamp(v.dot(c.c), -1, 1)) / c.r;
      if (d > 1.8) continue;
      // Smooth bowl (zero slope at the center) blending into a raised rim
      if (d < 1) {
        h -= c.depth * (1 - d * d) * (1 - d * d);
        albedo -= 0.06 * (1 - d);
      }
      const rim = Math.exp(-((d - 1) * (d - 1)) / 0.05);
      h += c.depth * 0.3 * rim;
      albedo += (0.03 + c.bright) * rim + c.bright * 0.25 * Math.max(0, 1 - d);
    }
    h += grain(v.x * 2.3, v.y * 2.3, v.z * 2.3) * 0.002;
    return { h, albedo };
  };
}

/**
 * @param radius world radius
 * @param detail icosphere subdivision (faces = 20 × (detail + 1)²)
 * @param facing world-space direction from the moon toward the viewer (the +Z of the local frame)
 */
export function buildMoonGeometry(radius: number, detail: number, facing: THREE.Vector3) {
  const surface = makeSurface();
  const g = new THREE.IcosahedronGeometry(1, detail); // non-indexed: vertices are repeated per face
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  // Shared corners get identical values; cache them so the surface is evaluated once per corner.
  const cache = new Map<string, [number, number, number, number]>();
  const v = new THREE.Vector3();
  const t = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const EPS = 0.012;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    let entry = cache.get(key);
    if (!entry) {
      const { h, albedo } = surface(v);
      // Slope toward the sun: terrain rising toward the light faces away from it → darker.
      t.copy(SUN).addScaledVector(v, -v.dot(SUN));
      let relief = 1;
      if (t.lengthSq() > 1e-6) {
        t.normalize();
        probe.copy(v).addScaledVector(t, EPS).normalize();
        const slope = (surface(probe).h - h) / EPS;
        relief = THREE.MathUtils.clamp(1 - slope * RELIEF, 0.55, 1.35);
      }
      // Gentle limb falloff so the disc reads as a sphere
      const limb = 0.86 + 0.14 * Math.max(0, v.z);
      const val = albedo * relief * limb;
      entry = [1 + h * DISPLACE, val * 0.97, val * 0.99, val * 1.03]; // slightly cool silver
      cache.set(key, entry);
    }
    const [k, r, gg, b] = entry;
    pos.setXYZ(i, v.x * radius * k, v.y * radius * k, v.z * radius * k);
    colors[i * 3] = r;
    colors[i * 3 + 1] = gg;
    colors[i * 3 + 2] = b;
  }

  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();

  // Orient the local frame so +Z faces the viewer and +Y stays up.
  const z = facing.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z));
  return g;
}
