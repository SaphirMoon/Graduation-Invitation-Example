/** Hand-built SVG art for the invitation: sapphire seal, envelope parts, icons, graduation cap. */
import { alpha, THEME } from "@/config/theme";

/* ---------------- Low-poly sapphire (seal) ---------------- */

const SIDES = 8;
const R_OUT = 46;
const R_IN = 24;
/** Light from the upper left (SVG y points down) */
const LIGHT = { x: -0.6, y: -0.8 };
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const DARK = rgb(THEME.sapphireDeep);
const LIGHT_C = rgb(THEME.sapphireGlow);

const mix = (t: number) =>
  `rgb(${DARK.map((d, i) => Math.round(d + (LIGHT_C[i] - d) * Math.min(1, Math.max(0, t)))).join(" ")})`;
const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;

/** Facets of a top-down octagonal gem: crown triangles shaded by their facing direction. */
const FACETS = Array.from({ length: SIDES }, (_, i) => {
  const a0 = (i / SIDES) * Math.PI * 2 - Math.PI / 2 + Math.PI / SIDES;
  const a1 = a0 + (Math.PI * 2) / SIDES;
  const mid = (a0 + a1) / 2;
  const facing = Math.cos(mid) * LIGHT.x + Math.sin(mid) * LIGHT.y; // -1..1
  return [
    { points: `${pt(R_OUT, a0)} ${pt(R_OUT, a1)} ${pt(R_IN, a0)}`, fill: mix(0.18 + facing * 0.42) },
    { points: `${pt(R_OUT, a1)} ${pt(R_IN, a1)} ${pt(R_IN, a0)}`, fill: mix(0.42 + facing * 0.4) },
  ];
}).flat();
const TABLE = Array.from({ length: SIDES }, (_, i) =>
  pt(R_IN, (i / SIDES) * Math.PI * 2 - Math.PI / 2 + Math.PI / SIDES),
).join(" ");

export function SapphireSeal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-52 -52 104 104" aria-hidden>
      <defs>
        <linearGradient id="seal-table" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={THEME.sapphireIce} />
          <stop offset="0.55" stopColor={THEME.sapphireBright} />
          <stop offset="1" stopColor={THEME.sapphire} />
        </linearGradient>
      </defs>
      {/* Silver bezel */}
      <circle r="50" fill={THEME.surface} stroke={THEME.silver} strokeWidth="1.6" />
      {FACETS.map((f, i) => (
        <polygon key={i} points={f.points} fill={f.fill} stroke={alpha(THEME.sapphireIce, 0.35)} strokeWidth="0.6" />
      ))}
      <polygon points={TABLE} fill="url(#seal-table)" stroke={alpha(THEME.sapphireIce, 0.6)} strokeWidth="0.6" />
      {/* Specular glint */}
      <polygon points="-15,-14 -3,-19 -9,-6" fill={alpha(THEME.white, 0.75)} />
    </svg>
  );
}

/** Small sapphire splinters that fly off when the seal breaks. */
export const SHARD_SHAPES = [
  "0,0 12,3 4,11",
  "0,4 9,0 11,10",
  "2,0 13,6 0,9",
  "0,0 8,2 6,12",
  "0,6 10,0 9,9",
  "1,0 12,9 0,12",
  "0,2 10,0 5,8",
];

export function Shard({ points, className }: { points: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 13 13" aria-hidden>
      <polygon points={points} fill={THEME.sapphireGlow} stroke={THEME.sapphireIce} strokeWidth="0.7" />
    </svg>
  );
}

/* ---------------- Envelope (viewBox 300 × 200) ---------------- */

const ENV = THEME.envelope;
const EDGE = alpha(ENV.edge, 0.5);

export function EnvelopeBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="env-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ENV.backTop} />
          <stop offset="1" stopColor={ENV.backBottom} />
        </linearGradient>
      </defs>
      <rect width="300" height="200" rx="6" fill="url(#env-back)" />
    </svg>
  );
}

export function EnvelopePocket({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="env-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={ENV.side} />
          <stop offset="1" stopColor={ENV.sideLight} />
        </linearGradient>
        <linearGradient id="env-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ENV.bottomTop} />
          <stop offset="1" stopColor={ENV.bottomBottom} />
        </linearGradient>
      </defs>
      <path d="M0 6 Q0 0 6 0 L140 104 L0 200 Z" fill="url(#env-side)" />
      <path d="M300 6 Q300 0 294 0 L160 104 L300 200 Z" fill="url(#env-side)" />
      <path d="M0 200 L150 92 L300 200 Z" fill="url(#env-bottom)" />
      <path d="M0 200 L150 92 L300 200" fill="none" stroke={EDGE} strokeWidth="1" />
      <path d="M0 4 L140 104 M300 4 L160 104" fill="none" stroke={alpha(ENV.edge, 0.2)} strokeWidth="1" />
    </svg>
  );
}

export function EnvelopeFlap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="env-flap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ENV.flapTop} />
          <stop offset="1" stopColor={ENV.flapBottom} />
        </linearGradient>
      </defs>
      <path d="M0 0 L300 0 L156 114 Q150 119 144 114 Z" fill="url(#env-flap)" />
      <path d="M0 0 L144 114 Q150 119 156 114 L300 0" fill="none" stroke={EDGE} strokeWidth="1.2" />
    </svg>
  );
}

/* ---------------- Line icons (1.4 px strokes) ---------------- */

type IconProps = { className?: string };

export function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

export function RouteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="18" r="2" />
      <path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16" />
      <path d="M15 1.8 17.6 4 15 6.2" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.2 4L19 7" />
    </svg>
  );
}

/* ---------------- Graduation cap ---------------- */

export function GradCap({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 40 30" aria-hidden>
      <path d="M11 13v6.5c0 2 4 3.8 9 3.8s9-1.8 9-3.8V13" fill={THEME.surface} stroke={THEME.silver} strokeWidth="1" />
      <path d="M20 3 38 10.5 20 18 2 10.5Z" fill={THEME.silver} stroke={THEME.silverBright} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M20 10.5 31 14v8" fill="none" stroke={THEME.gold} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="31" cy="23.5" r="1.6" fill={THEME.gold} />
    </svg>
  );
}
