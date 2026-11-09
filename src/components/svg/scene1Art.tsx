/**
 * Artwork for Scene 1 (plain SVG, flat minimal style).
 * Shared coordinate space: viewBox "-600 0 1600 800" — the main content column is x 0..400
 * (screen center); the sides only exist so sky/hills fill wide screens.
 * Animated elements sit in a child <g> WITHOUT a transform attribute, while positioning
 * lives on the parent <g> — so GSAP never overwrites the coordinates.
 */
import { THEME } from "@/config/theme";
import { round, seeded } from "@/lib/random";

export const VIEWBOX = "-600 0 1600 800";
export const MOON = { x: 200, y: 170, r: 52 };
export const GROUND_Y = 640;
export const CRYSTAL_Y = 618;

/* ---------------- Stars ---------------- */

const rnd = seeded(20260703);
export const STARS = Array.from({ length: 90 }, (_, i) => {
  const central = i < 45; // denser in the center column (the area visible on phones)
  return {
    x: round(central ? rnd() * 400 : -600 + rnd() * 1600),
    y: round(rnd() * 560),
    r: round(0.6 + rnd() * 1.3, 2),
    layer: i % 3,
  };
});

const SPARKLES = [
  { x: 52, y: 92, s: 1 },
  { x: 338, y: 70, s: 0.8 },
  { x: 318, y: 300, s: 0.7 },
  { x: 70, y: 360, s: 0.85 },
  { x: -180, y: 140, s: 1 },
  { x: 640, y: 200, s: 0.9 },
];

const SPARKLE_PATH = "M0 -6 L1.2 -1.2 L6 0 L1.2 1.2 L0 6 L-1.2 1.2 L-6 0 L-1.2 -1.2Z";

export function StarField() {
  return (
    <>
      {[0, 1, 2].map((layer) => (
        <g key={layer} data-a="star-layer" fill={THEME.silverBright}>
          {STARS.filter((s) => s.layer === layer).map((s, i) => (
            <circle key={i} data-a="star" cx={s.x} cy={s.y} r={s.r} />
          ))}
        </g>
      ))}
      <g data-a="star-layer" fill={THEME.silverBright}>
        {SPARKLES.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) scale(${s.s})`}>
            <path data-a="sparkle" d={SPARKLE_PATH} />
          </g>
        ))}
      </g>
    </>
  );
}

/* ---------------- Defs (gradient) ---------------- */

export function Scene1Defs() {
  return (
    <defs>
      <radialGradient id="s1-glow-white">
        <stop offset="0%" stopColor={THEME.white} stopOpacity="0.55" />
        <stop offset="45%" stopColor={THEME.moonlight} stopOpacity="0.18" />
        <stop offset="100%" stopColor={THEME.moonlight} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="s1-glow-blue">
        <stop offset="0%" stopColor={THEME.blue} stopOpacity="0.8" />
        <stop offset="40%" stopColor={THEME.sapphire} stopOpacity="0.32" />
        <stop offset="100%" stopColor={THEME.sapphire} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="s1-moon-white" cx="38%" cy="34%" r="70%">
        <stop offset="0%" stopColor={THEME.white} />
        <stop offset="100%" stopColor={THEME.moonWhiteShade} />
      </radialGradient>
      <radialGradient id="s1-moon-blue" cx="36%" cy="32%" r="72%">
        <stop offset="0%" stopColor={THEME.sapphirePale} />
        <stop offset="45%" stopColor={THEME.blue} />
        <stop offset="80%" stopColor={THEME.sapphire} />
        <stop offset="100%" stopColor={THEME.sapphireDeep} />
      </radialGradient>
      <linearGradient id="s1-beam-white" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={THEME.white} stopOpacity="0.5" />
        <stop offset="100%" stopColor={THEME.white} stopOpacity="0.07" />
      </linearGradient>
      <linearGradient id="s1-beam-blue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={THEME.blueBright} stopOpacity="0.55" />
        <stop offset="100%" stopColor={THEME.blueBright} stopOpacity="0.1" />
      </linearGradient>
      <radialGradient id="s1-pool-white">
        <stop offset="0%" stopColor={THEME.white} stopOpacity="0.5" />
        <stop offset="100%" stopColor={THEME.white} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="s1-pool-blue">
        <stop offset="0%" stopColor={THEME.blueBright} stopOpacity="0.6" />
        <stop offset="100%" stopColor={THEME.blueBright} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="s1-crystal-glow">
        <stop offset="0%" stopColor={THEME.blueBright} stopOpacity="0.85" />
        <stop offset="100%" stopColor={THEME.blueBright} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/* ---------------- Moon ---------------- */

const CRATERS = [
  { x: -17, y: -10, r: 9 },
  { x: 15, y: 13, r: 6.5 },
  { x: 11, y: -22, r: 4 },
  { x: -6, y: 24, r: 3.5 },
];

export function Moon() {
  return (
    <g transform={`translate(${MOON.x} ${MOON.y})`}>
      <g data-a="moon">
        <circle data-a="glow-white" r="150" fill="url(#s1-glow-white)" />
        <circle data-a="glow-blue" r="165" fill="url(#s1-glow-blue)" opacity="0" />
        <g data-a="moon-white">
          <circle r={MOON.r} fill="url(#s1-moon-white)" />
          {CRATERS.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={THEME.moonCrater} opacity="0.45" />
          ))}
        </g>
        <g data-a="moon-blue" opacity="0">
          <circle r={MOON.r} fill="url(#s1-moon-blue)" />
          {CRATERS.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={THEME.sapphireDeep} opacity="0.4" />
          ))}
          <circle r={MOON.r - 1} fill="none" stroke={THEME.sapphirePale} strokeWidth="1.5" opacity="0.5" />
        </g>
      </g>
    </g>
  );
}

/** Ring of light that expands when the crystal hits the moon */
export function ImpactRing() {
  return (
    <g transform={`translate(${MOON.x} ${MOON.y})`}>
      <circle data-a="ring" r={MOON.r + 4} fill="none" stroke={THEME.sapphirePale} strokeWidth="3" opacity="0" />
    </g>
  );
}

/* ---------------- Light beams ---------------- */

export function BeamWhite() {
  return (
    <>
      <polygon
        data-a="beam-white"
        points={`188,${MOON.y + 45} 212,${MOON.y + 45} 246,${GROUND_Y} 154,${GROUND_Y}`}
        fill="url(#s1-beam-white)"
      />
    </>
  );
}

export function BeamBlue() {
  return (
    <polygon
      data-a="beam-blue"
      points={`184,${MOON.y + 42} 216,${MOON.y + 42} 264,${GROUND_Y} 136,${GROUND_Y}`}
      fill="url(#s1-beam-blue)"
    />
  );
}

export function Pools() {
  return (
    <g transform={`translate(200 ${GROUND_Y})`}>
      <ellipse data-a="pool-white" rx="62" ry="9" fill="url(#s1-pool-white)" opacity="0" />
      <ellipse data-a="pool-blue" rx="82" ry="12" fill="url(#s1-pool-blue)" opacity="0" />
    </g>
  );
}

/* ---------------- Sapphire crystal ---------------- */

/** Crystal facets (centered at 0,0; bottom tip at y = +22). */
export const CRYSTAL_FACETS = [
  { points: "-8,-20 8,-20 5,-8 -5,-8", fill: THEME.crystalFacets[0] },
  { points: "-8,-20 -5,-8 -16,-8", fill: THEME.crystalFacets[1] },
  { points: "8,-20 16,-8 5,-8", fill: THEME.crystalFacets[2] },
  { points: "-16,-8 -5,-8 0,22", fill: THEME.crystalFacets[3] },
  { points: "-5,-8 5,-8 0,22", fill: THEME.crystalFacets[4] },
  { points: "5,-8 16,-8 0,22", fill: THEME.crystalFacets[5] },
];

export function Crystal() {
  return (
    <g transform={`translate(200 ${CRYSTAL_Y})`}>
      <g data-a="crystal-fly">
        <circle data-a="crystal-glow" r="44" fill="url(#s1-crystal-glow)" opacity="0" />
        <g data-a="crystal-shape">
          {CRYSTAL_FACETS.map((f, i) => (
            <polygon key={i} points={f.points} fill={f.fill} />
          ))}
          <polygon
            points="-8,-20 8,-20 16,-8 0,22 -16,-8"
            fill="none"
            stroke={THEME.sapphireIce}
            strokeWidth="1"
            strokeLinejoin="round"
            opacity="0.6"
          />
        </g>
        <path
          data-a="crystal-sparkle"
          d="M0 -28 L3 -3 L28 0 L3 3 L0 28 L-3 3 L-28 0 L-3 -3Z"
          fill={THEME.white}
          opacity="0"
        />
      </g>
    </g>
  );
}

/* ---------------- Shards ---------------- */

const srnd = seeded(15072004);
export const SHARDS = Array.from({ length: 10 }, (_, i) => {
  const angle = ((i / 10) * 360 + srnd() * 24) * (Math.PI / 180);
  const dist = 62 + srnd() * 52;
  const size = 6 + srnd() * 7;
  const fills = [...THEME.crystalFacets, THEME.silver];
  return {
    dx: round(Math.cos(angle) * dist),
    dy: round(Math.sin(angle) * dist),
    rot: round(-200 + srnd() * 400),
    points: `0,${round(-size)} ${round(size * 0.85)},${round(size * 0.6)} ${round(-size * 0.7)},${round(size * 0.5)}`,
    fill: fills[i % fills.length],
  };
});

export function Shards() {
  return (
    <g transform={`translate(${MOON.x} ${MOON.y})`}>
      {SHARDS.map((s, i) => (
        <polygon key={i} data-a="shard" points={s.points} fill={s.fill} opacity="0" />
      ))}
    </g>
  );
}

/* ---------------- Hills ---------------- */

export function HillBack() {
  return (
    <g data-a="hills">
      <path
        d="M-600 800 L-600 600 Q-150 548 300 600 T1000 585 L1000 800 Z"
        fill={THEME.hillBack}
      />
    </g>
  );
}

export function HillFront() {
  return (
    <g data-a="hills">
      <path d="M-600 800 L-600 660 Q-200 600 200 640 Q600 680 1000 620 L1000 800 Z" fill={THEME.hillFront} />
      <path
        d="M-600 660 Q-200 600 200 640 Q600 680 1000 620"
        fill="none"
        stroke={THEME.silver}
        strokeOpacity="0.16"
        strokeWidth="1.2"
      />
    </g>
  );
}
