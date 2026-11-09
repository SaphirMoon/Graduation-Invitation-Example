/**
 * THE ONE PALETTE — edit here to recolor the whole world (3D scenes, invitation, UI, SVG fallback, OG image).
 * Scenes 0, 1 and the invitation: near-black sky over brighter teal land, a silver-pink horizon between them.
 * Saturated sapphire stays reserved for the blue moon, crystal, shards and the moon's beam.
 * The year scenes have their own silver-blue look: `world.lake`, `world.space`.
 */

/* ---- Brand accent: keep it the most saturated thing on screen ---- */
const SAPPHIRE = "#0F52BA";
const SAPPHIRE_BRIGHT = "#3A7BFF";
const SAPPHIRE_GLOW = "#6FA8FF";
const SAPPHIRE_PALE = "#9CC8FF";
const SAPPHIRE_ICE = "#CFE8FF";

/* ---- Fresh accents ---- */
const GOLD = "#FFC978";
const CORAL = "#FF8A7A";
const MINT = "#8FE3CF";

/* ---- Silver-blue night ---- */
const NIGHT = "#141B2E";
const SLATE = "#5B6F8F";
const MIST = "#B8C4D6";
const MIDNIGHT = "#02030A";
const TEAL = "#1E5A66";
const FAR_HILL = "#2B3B6B";
const MOONLIGHT = "#EAF1FF";

export const THEME = {
  white: "#FFFFFF",
  bg: "#05070F",
  /** Dark translucent surfaces (buttons, speech bubble) */
  surface: NIGHT,
  slate: SLATE,
  shadow: "#05070E",

  sapphire: SAPPHIRE,
  sapphireBright: SAPPHIRE_BRIGHT,
  sapphireGlow: SAPPHIRE_GLOW,
  sapphirePale: SAPPHIRE_PALE,
  sapphireIce: SAPPHIRE_ICE,
  sapphireDeep: "#0A3A8C",
  gold: GOLD,
  goldLight: "#FFD89A",
  coral: CORAL,
  mint: MINT,
  silver: "#C8D2DE",
  silverBright: "#EEF3F9",
  moonlight: MOONLIGHT,

  /** Polaroid frames of the memory photos */
  polaroid: { paper: "#F1EFE7", ink: "#2A3244", empty: "#C9CFD8" },

  /** The glowing play mark on a video's poster in the 3D scenes */
  playBadge: { disc: "rgba(16, 22, 36, 0.55)", glow: "#FFE3A8", mark: "#FFF9EC" },

  /** Invitation card and envelope */
  card: {
    paper: "#F3F2EA",
    paperLight: "#F6F5EE",
    paperCool: "#E6ECF2",
    paperShade: "#D3DDEB",
    ink: "#1C2740",
    inkSoft: "#33415E",
    muted: "#5C6880",
    accent: "#44597D",
    signature: "#2F4468",
  },
  envelope: {
    backTop: "#101A3C",
    backBottom: "#17244C",
    side: "#2B3B6B",
    sideLight: "#33467C",
    bottomTop: "#42588F",
    bottomBottom: "#34477E",
    flapTop: "#4C639C",
    flapBottom: "#3D5289",
    edge: "#DCE5F2",
  },

  /** 3D world */
  world: {
    skyTop: MIDNIGHT,
    /** Middle of the sky, and the deep blue just above the horizon glow */
    skyMid: "#070B1A",
    skyHorizon: "#10183A",
    /** Horizon glow separating sky and land: silver, with a pink core */
    skyMist: "#9AA9D6",
    skyMistWarm: "#F3B6C8",
    /** Faint nebula clouds [color, opacity] */
    nebula: [
      ["#6B4EFF", 0.24],
      ["#FF5FA2", 0.08],
      ["#35E0FF", 0.12],
    ],
    fog: "#59649E",
    fogAfter: "#505C9A",
    moonlight: MOONLIGHT,
    /** Halo and sky glow around the white moon */
    moonHalo: "#8FB0F0",
    /** Sky glow around the sapphire moon (softer than the moon itself) */
    skyGlowAfter: "#3A6BD8",
    /** The moon's light on the land stays silver, even when the moon is sapphire */
    moonLightAfter: MOONLIGHT,
    sapphire: SAPPHIRE,
    sapphireBright: SAPPHIRE_BRIGHT,
    hemiSky: "#D6EEF0",
    hemiGround: "#2C5560",
    fill: "#CFE4F0",
    groundLow: TEAL,
    groundHigh: "#4FB8A8",
    /** Tufts come in patches of these tones */
    grass: ["#1F6E72", "#2F8C86", "#4FB8A8", "#7AD1B4"],
    rock: "#2E4656",
    /** Silver rim on slopes and rocks facing the moon */
    rim: MOONLIGHT,
    stream: { water: "#2A6C92", glint: "#BFD8F0" },
    /** Hill layers, near → far */
    mountains: [TEAL, "#254C6E", FAR_HILL, FAR_HILL],
    star: "#E4ECFA",
    cloud: "#39447C",
    cloudAfter: "#334690",
    figure: "#CFD7E5",
    figureEyes: "#1C2438",
    figureShadow: "#05070E",
    scarf: CORAL,
    velvet: { dark: "#0B1640", mid: "#1F3A8A", light: "#5479D0" },
    hem: GOLD,
    firefly: GOLD,
    fireflyAlt: MINT,
    /** Lit windows on a far hill */
    window: GOLD,
    flowers: [CORAL, MINT, GOLD],
    dust: "#E6EEFB",
    snow: "#DCE7F8",
    snowAccents: [MINT, CORAL],
    /** Crystal VFX (sapphire family) */
    crystalRim: SAPPHIRE_PALE,
    crystalTrail: SAPPHIRE_GLOW,
    crystalSparks: SAPPHIRE_ICE,
    liftRing: "#8EC1FF",
    impactRing: "#7FB6FF",
    /** Year scenes: the lake's silver-blue sky, land and lights */
    lake: {
      skyTop: NIGHT,
      skyHorizon: SLATE,
      skyMist: MIST,
      fog: MIST,
      fogAfter: "#A9B9D2",
      skyGlowAfter: "#7C9BE0",
      moonLightAfter: "#C4D4F0",
      hemiSky: "#D3D9E4",
      hemiGround: "#3C4456",
      fill: "#C6CEDD",
      mountains: ["#1C2438", "#2C3750", "#34425C", "#35425C"],
      moonHalo: "#C9D9F5",
      moonlight: MOONLIGHT,
      star: "#E4ECFA",
      cloud: "#94A4BF",
      cloudAfter: "#8294BC",
    },
    /** Year scenes: the lake */
    water: { deep: "#222C42", moonPath: "#8FB4F5", moonCore: "#EAF1FF", hillReflection: "#1F283C" },
    boat: { hull: "#5D4B41", hullDark: "#46392F", rim: "#8A6F58", seat: "#74604F", floor: "#3B3029" },
    lantern: GOLD,
    /** Year 2: near-black space above a brighter sea of clouds */
    space: {
      skyTop: MIDNIGHT,
      skyMid: "#070B1A",
      horizon: "#9AA9D6",
      horizonWarm: "#F3B6C8",
      /** Aurora ribbons [color, strength] */
      aurora: [
        ["#6B4EFF", 0.3],
        ["#FF5FA2", 0.15],
        ["#35E0FF", 0.15],
      ],
      star: "#EEF3FF",
      starWarm: "#FFE9C8",
      dust: "#DDF3FF",
      planets: ["#B4908F", "#7FAAA2", "#8F89C2"],
      ring: "#D5DCEC",
      /** Sea of clouds */
      cloud: { deep: "#8682C8", teal: "#74CFC0", lavender: "#B4A8EA", peach: "#F7BFA8", top: "#F4F1FB" },
      column: GOLD,
      deck: "#39425E",
      deckSide: "#1C2238",
      pylon: "#8FE3FF",
      runLight: "#35E0FF",
      wake: "#6FD8FF",
      lightSky: "#E8EEFA",
      lightGround: "#B4B8D4",
      lightFill: "#F4F7FF",
    },
    /** Year 3: silver-white snow with blue-violet shadows, under a near-black sky */
    snow3: {
      lit: "#EEF1FA",
      mid: "#B9C1E6",
      shadow: "#6C6FBA",
      rim: "#FFFFFF",
      rock: "#3F4670",
      rockLit: "#8E94BC",
      plain: "#AEB4DC",
      trail: "#C6CCEC",
      print: "#8388C8",
      far: ["#6A70B0", "#50568F"],
      fog: "#5E649E",
      gustFog: "#C9D3EE",
      gustFlake: "#8D97D2",
      pine: "#1F3F52",
      pineSnow: "#E4EAF6",
      flake: "#F8FAFF",
      jacket: "#27345E",
      beanie: "#27345E",
      beanieBand: CORAL,
      pack: "#B5654E",
      packRoll: MINT,
      scarf: SAPPHIRE_BRIGHT,
      ice: "#BFE6FF",
      iceBack: "#2F5C9C",
      iceGlow: "#8FD0FF",
      iceEdge: "#EFFAFF",
      frost: "#CFE4F6",
      wood: "#5E4A3E",
      sign: "#E8DCC6",
      signInk: "#33291F",
      lantern: GOLD,
      lanternPool: "#FFD9A0",
      flags: [CORAL, MINT],
      omen: GOLD,
      omenCore: "#FFF3D6",
      lightSky: "#E8EEFA",
      lightGround: "#AEB4DC",
    },
    /** Year 4: the bridge of light and the island: warm, festive */
    bridge: {
      plank: SAPPHIRE,
      plankEdge: "#BFE0FF",
      step: GOLD,
      post: "#D5DCEC",
      rope: "#E6DCC6",
      lamp: GOLD,
      beam: "#FFE2B0",
      wood: "#5E4A3E",
      frame: "#F1EFE7",
      boardGlow: "#FFD89A",
      boardOff: "#2B3B6B",
      boardDim: "#5A6688",
      skyLanternLow: GOLD,
      skyLanternHigh: CORAL,
      fireflyWarm: GOLD,
      fireflyMint: MINT,
      island: {
        rock: "#5E5FA8",
        rockLight: "#8C8FD0",
        grass: "#4FB8A8",
        grassLight: "#8FE3CF",
        tower: "#F4F1EA",
        band: CORAL,
        house: "#F2E6D2",
        roof: CORAL,
        tree: "#2F8C86",
        window: GOLD,
        windowDark: "#5A6688",
        flash: "#FFF3D6",
      },
    },
    train: {
      body: "#E6EBF3",
      bodyShade: "#CDD5E1",
      under: "#5F6A86",
      windowFrame: "#2E3650",
      windowLow: "#F0A85E",
      glass: "#9CCBEF",
      window: "#FFD89A",
      stripe: "#35E0FF",
      stripe2: SAPPHIRE_BRIGHT,
      pad: "#35E0FF",
      frame: "#C8D2DE",
      lamp: GOLD,
      seat: "#5C6880",
      screenEmpty: "#2B3B6B",
    },
  },

  /* ---- Flat SVG fallback (no WebGL) and OG image ---- */
  sky: { glow: "#10183A", mid: "#070B1A", edge: MIDNIGHT },
  blueBright: SAPPHIRE_GLOW,
  blue: SAPPHIRE_BRIGHT,
  moonWhite: "#F4F7FB",
  moonWhiteShade: "#DCE4EE",
  moonCrater: "#C5D0DD",
  curtain: { dark: "#0B1640", mid: "#1F3A8A", light: "#5479D0", trim: GOLD },
  hillBack: FAR_HILL,
  hillFront: TEAL,
  figure: "#E6ECF4",
  crystalFacets: ["#BFE6FF", "#7CC4FF", "#3D8BFF", "#2463D6", "#3D8BFF", SAPPHIRE],
} as const;

/**
 * GRADING — the non-color half of the look (lighting, fog, bloom). Numbers, not hues.
 * Lights are physical: intensity ≈ π shows a material at its true color.
 */
export const GRADE = {
  fogNear: 26,
  fogFar: 300,
  /** Strength of the silver and pink horizon glow (0..1), and of the sky's three-stop gradient */
  skyMist: 0.6,
  /** How far up the horizon glow reaches (0..1 of the way to the zenith) */
  skyMistHeight: 0.3,
  skyMistWarm: 0.5,
  skyMidAmt: 1,
  hemi: 2.5,
  fill: 1.3,
  moonLight: 1.4,
  moonLightPerGlow: 0.5,
  /** Rim light on the land (see three/rim.ts) */
  rimGround: 0.85,
  rimRock: 1.7,
  /** Bloom only catches what is brighter than this (linear): moon and crystal, never sky or fog */
  bloomThreshold: 0.72,
  bloom: 0.28,
  bloomMoonBlue: 0.39,
  bloomBoost: 1.5,
  vignetteOffset: 0.42,
  vignetteDarkness: 0.34,
  /** Film grain (overlay): shows much more on a bright sky than on black */
  grain: 0.09,
  /** How much the lights add to the moon: low, so emissive color stays in charge (no blow-out) */
  moonAlbedo: 0.25,
  /** Resting self-glow of the stick figure */
  figureGlow: 0.12,
  /** Wide sky glow around the moon */
  skyGlow: 0.03,
  skyGlowPerMoon: 0.09,
  /** The year scenes' silver-blue lighting */
  lake: {
    fogNear: 12,
    fogFar: 420,
    skyMist: 0.5,
    skyMistHeight: 0.32,
    skyMistWarm: 0,
    skyMidAmt: 0,
    hemi: 2.1,
    fill: 1.5,
    moonLight: 1.1,
    moonLightPerGlow: 0.6,
    skyGlow: 0.1,
    skyGlowPerMoon: 0.22,
  },
  /** Lake scenes: higher threshold, so white photo frames never glow */
  lakeBloomThreshold: 0.92,
  /** Space scene: lights and bloom (headlight, bright stars and moon only) */
  spaceHemi: 2.5,
  spaceFill: 1.7,
  spaceBloomThreshold: 0.93,
  /** Year 3: snow is bright, so only the moon and the glows may bloom */
  snowBloomThreshold: 0.96,
  /** Sapphire wave sweeping the sky at the burst (transient) */
  skyWave: 0.55,
} as const;

/** "r g b" channels of a hex color, for `rgb(var(--c-x-rgb) / 0.5)` in CSS. */
function channels(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Hex color + alpha → CSS color (for inline styles and SVG). */
export function alpha(hex: string, a: number) {
  return `rgb(${channels(hex)} / ${a})`;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * CSS variables for every color in THEME (except the 3D-only `world` group):
 * `curtain.mid` → `--c-curtain-mid` and `--c-curtain-mid-rgb`. Set on <html> by the root layout.
 */
export function themeCssVars(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: object, prefix: string) => {
    for (const [k, v] of Object.entries(node)) {
      if (k === "world" || Array.isArray(v)) continue;
      const name = `${prefix}-${kebab(k)}`;
      if (typeof v === "string") {
        out[name] = v;
        out[`${name}-rgb`] = channels(v);
      } else walk(v, name);
    }
  };
  walk(THEME, "--c");
  return out;
}
