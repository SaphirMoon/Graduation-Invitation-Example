/**
 * SOUND — volume and the files for each cue.
 *
 * Every cue has a built-in placeholder synthesized with the Web Audio API.
 * To use a real recording, drop the file into /public/audio/ and set its path here,
 * e.g. chime: "/audio/chime.mp3". Leave a cue as null to keep the placeholder.
 */
export type Cue =
  | "curtain" // curtains open
  | "moon" // the moon brightens
  | "chime" // the crystal is lit by the beam
  | "rise" // the crystal shoots up
  | "impact" // hits the moon: boom + breaking glass
  | "swirl" // shards spiral into the moon
  | "chord" // the moon turns sapphire
  | "whoosh" // the beam of light on the bridge
  | "breeze" // the train moving to the next car; the fall through the clouds
  | "step" // a step in the snow
  | "icebell" // an ice block or a photo board lights up
  | "plank"; // a step on the bridge of light

/** Continuous sounds: started and stopped by a scene, level 0..1 set live. */
export type LoopCue =
  | "train" // the rush of the high-speed train; follows its speed
  | "cosmos" // soft cosmic hum
  | "wind"; // mountain wind; follows altitude and gusts

export const AUDIO = {
  /** Master volume 0..1 (moderate by default) */
  volume: 0.55,
  /** Remember the visitor's mute choice in localStorage under this key */
  storageKey: "sapphire-invite-muted",
  files: {
    curtain: null,
    moon: null,
    chime: null,
    rise: null,
    impact: null,
    swirl: null,
    chord: null,
    whoosh: null,
    breeze: null,
    step: null,
    icebell: null,
    plank: null,
  } as Record<Cue, string | null>,
  /** Seamless loops; with a file, the level sets its volume and playback rate */
  loops: {
    train: null,
    cosmos: null,
    wind: null,
  } as Record<LoopCue, string | null>,
};
