/**
 * Tiny SFX engine on the Web Audio API.
 * - Unlocked by the "tap to open" gesture (browsers block audio before a user gesture).
 * - Plays a file from config/audio.ts when one is set, otherwise a synthesized placeholder.
 * - Global mute, persisted in localStorage; listeners can subscribe to mute changes.
 */
import { AUDIO, type Cue, type LoopCue } from "@/config/audio";
import { LOOPS, SYNTH, type LoopVoice } from "./synth";

type Listener = (muted: boolean) => void;

function readMuted(): boolean {
  try {
    return localStorage.getItem(AUDIO.storageKey) === "1";
  } catch {
    return false;
  }
}

/** Simple synthetic reverb tail so the placeholders sit in a space. */
function makeImpulse(ctx: AudioContext, seconds = 2.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private buffers = new Map<Cue | LoopCue, AudioBuffer>();
  private listeners = new Set<Listener>();
  private _muted: boolean | null = null;
  /** Silent for now (a video is playing), without touching the guest's saved mute choice */
  private held = false;

  get muted(): boolean {
    if (this._muted === null) this._muted = typeof window === "undefined" ? false : readMuted();
    return this._muted;
  }

  setMuted(m: boolean) {
    this._muted = m;
    try {
      localStorage.setItem(AUDIO.storageKey, m ? "1" : "0");
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
    this.applyVolume();
    this.listeners.forEach((l) => l(m));
  }

  setHeld(held: boolean) {
    this.held = held;
    this.applyVolume();
  }

  private applyVolume() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted || this.held ? 0 : AUDIO.volume, this.ctx.currentTime, 0.05);
    }
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  /** Must be called from a user gesture (the "tap to open" click). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.muted || this.held ? 0 : AUDIO.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      // Dry + reverb send
      const bus = ctx.createGain();
      const verb = ctx.createConvolver();
      verb.buffer = makeImpulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      bus.connect(master);
      bus.connect(verb).connect(wet).connect(master);
      this.ctx = ctx;
      this.master = master;
      this.bus = bus;
      void this.loadFiles();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private async loadFiles() {
    const ctx = this.ctx;
    if (!ctx) return;
    await Promise.all(
      (Object.entries({ ...AUDIO.files, ...AUDIO.loops }) as [Cue | LoopCue, string | null][]).map(async ([cue, url]) => {
        if (!url) return;
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          this.buffers.set(cue, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch {
          /* missing or undecodable file → the synthesized placeholder is used */
        }
      }),
    );
  }

  /**
   * Starts a continuous sound. The master gain handles mute, so toggling sound works while it runs.
   * Returns null while audio is still locked (call again after unlock()).
   */
  loop(cue: LoopCue): LoopVoice | null {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return null;
    const buf = this.buffers.get(cue);
    if (!buf) return LOOPS[cue](ctx, this.bus);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.bus);
    src.start();
    return {
      set(level) {
        gain.gain.setTargetAtTime(level, ctx.currentTime, 0.12);
        src.playbackRate.setTargetAtTime(0.7 + level * 0.5, ctx.currentTime, 0.12);
      },
      stop() {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
        src.stop(ctx.currentTime + 1.2);
      },
    };
  }

  play(cue: Cue) {
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.muted) return;
    const buf = this.buffers.get(cue);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.bus);
      src.start();
    } else {
      SYNTH[cue](ctx, this.bus);
    }
  }
}

export const sfx = new Sfx();
