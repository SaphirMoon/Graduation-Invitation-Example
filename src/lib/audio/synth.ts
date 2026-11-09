/**
 * Placeholder sound effects synthesized with the Web Audio API (no files needed).
 * Each function schedules its sound on `out` and returns immediately.
 */
import type { Cue, LoopCue } from "@/config/audio";

type Synth = (ctx: AudioContext, out: AudioNode) => void;

/** Shared white-noise buffer (2 s). */
let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

/** Gain envelope: 0 → peak over `a`, hold, then exponential decay to silence by `end`. */
function env(ctx: AudioContext, t0: number, peak: number, a: number, end: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + end);
  return g;
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, f: number, t0: number, peak: number, a: number, end: number, f1?: number) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + end);
  const g = env(ctx, t0, peak, a, end);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + end + 0.05);
}

/** Band-passed noise sweep (whooshes). */
function sweep(ctx: AudioContext, out: AudioNode, t0: number, dur: number, f0: number, f1: number, peak: number, q = 1.2) {
  const src = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = env(ctx, t0, peak, dur * 0.45, dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export const SYNTH: Record<Cue, Synth> = {
  // Soft fabric swish
  curtain(ctx, out) {
    const t = ctx.currentTime;
    sweep(ctx, out, t, 1.3, 400, 2200, 0.35, 0.7);
    sweep(ctx, out, t + 0.1, 1.1, 300, 1500, 0.2, 0.9);
  },
  // Airy pad swelling in
  moon(ctx, out) {
    const t = ctx.currentTime;
    [220, 329.63, 440].forEach((f, i) => tone(ctx, out, "sine", f, t + i * 0.05, 0.07, 1.2, 3.2));
  },
  // Crystal bell: inharmonic partials with a long ring
  chime(ctx, out) {
    const t = ctx.currentTime;
    const f = 1318.5;
    [1, 2.76, 5.4, 8.9].forEach((m, i) => tone(ctx, out, "sine", f * m, t, 0.16 / (i + 1), 0.005, 2.4 - i * 0.4));
  },
  // Rising whoosh + pitch glide
  rise(ctx, out) {
    const t = ctx.currentTime;
    sweep(ctx, out, t, 1.25, 250, 4200, 0.4, 1.4);
    tone(ctx, out, "triangle", 180, t, 0.05, 0.6, 1.25, 1100);
  },
  // Deep boom + shattering glass
  impact(ctx, out) {
    const t = ctx.currentTime;
    tone(ctx, out, "sine", 95, t, 0.6, 0.005, 1.1, 38);
    const n = noise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = env(ctx, t, 0.35, 0.005, 0.5);
    n.connect(lp).connect(g).connect(out);
    n.start(t);
    n.stop(t + 0.6);
    // Glass: short high pings + bright crackle
    for (let i = 0; i < 9; i++) {
      const dt = Math.random() * 0.35;
      tone(ctx, out, "sine", 2400 + Math.random() * 4200, t + dt, 0.05, 0.002, 0.25 + Math.random() * 0.4);
    }
    sweep(ctx, out, t, 0.45, 6000, 3000, 0.18, 0.8);
  },
  // Swirling whoosh with a wobbling filter
  swirl(ctx, out) {
    const t = ctx.currentTime;
    const src = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3;
    // Lasts as long as the shards' laps; the "whoosh" rate speeds up with them.
    const len = 2.4;
    bp.frequency.setValueAtTime(450, t);
    bp.frequency.exponentialRampToValueAtTime(2800, t + len);
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(1.5, t);
    lfo.frequency.exponentialRampToValueAtTime(12, t + len);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 450;
    lfo.connect(lfoGain).connect(bp.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
    g.gain.linearRampToValueAtTime(0.32, t + len - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1);
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    lfo.start(t);
    src.stop(t + len + 0.15);
    lfo.stop(t + len + 0.15);
  },
  // The train surging forward
  whoosh(ctx, out) {
    const t = ctx.currentTime;
    sweep(ctx, out, t, 1.15, 260, 2400, 0.3, 0.9);
    tone(ctx, out, "sine", 90, t, 0.1, 0.3, 1, 170);
  },
  // A slow breath of air: no hard edge, nothing high enough to hiss
  breeze(ctx, out) {
    sweep(ctx, out, ctx.currentTime, 1.8, 220, 720, 0.09, 0.6);
  },
  // A boot pressing softly into snow
  step(ctx, out) {
    const t = ctx.currentTime;
    sweep(ctx, out, t, 0.14, 1000 + Math.random() * 400, 450, 0.03, 0.9);
  },
  // Soft bell inside the ice
  icebell(ctx, out) {
    const t = ctx.currentTime;
    [1318.5, 1975.5, 2637].forEach((f, i) => tone(ctx, out, "sine", f, t + i * 0.05, 0.05 / (i + 1), 0.01, 2.2));
  },
  // A light note under the foot, on a pentatonic scale
  plank(ctx, out) {
    const t = ctx.currentTime;
    const notes = [523.25, 587.33, 659.25, 783.99, 880];
    tone(ctx, out, "sine", notes[Math.floor(Math.random() * notes.length)], t, 0.035, 0.008, 0.5);
  },
  // Warm sapphire chord (add9), slow bloom
  chord(ctx, out) {
    const t = ctx.currentTime;
    [261.63, 329.63, 392, 587.33, 659.25].forEach((f, i) => {
      tone(ctx, out, "sine", f, t + i * 0.03, 0.08, 0.25, 3.6);
      tone(ctx, out, "triangle", f * 2, t + i * 0.03, 0.015, 0.4, 2.6);
    });
  },
};

/** A running continuous sound. */
export type LoopVoice = {
  /** 0..1: silence → full (the train's rhythm also follows it) */
  set: (level: number) => void;
  stop: () => void;
};

export const LOOPS: Record<LoopCue, (ctx: AudioContext, out: AudioNode) => LoopVoice> = {
  // A muffled glide with a warm low tone under it: speed barely changes the character.
  train(ctx, out) {
    const src = noise(ctx);
    const air = ctx.createBiquadFilter();
    air.type = "lowpass";
    air.frequency.value = 300;
    const hum = ctx.createOscillator();
    hum.frequency.value = 55;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.25;
    const master = ctx.createGain();
    master.gain.value = 0;
    src.connect(air).connect(master);
    hum.connect(humGain).connect(master);
    master.connect(out);
    src.start();
    hum.start();
    return {
      set(level) {
        const t = ctx.currentTime;
        master.gain.setTargetAtTime(0.015 + level * 0.07, t, 0.6);
        air.frequency.setTargetAtTime(300 + level * 350, t, 0.6);
        hum.frequency.setTargetAtTime(55 + level * 25, t, 0.8);
      },
      stop() {
        const t = ctx.currentTime;
        master.gain.setTargetAtTime(0, t, 0.3);
        [src, hum].forEach((n) => n.stop(t + 1.6));
      },
    };
  },
  // A low, soft breeze that swells slowly: gusts add a little air rather than a howl.
  wind(ctx, out) {
    const src = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 320;
    bp.Q.value = 0.5;
    const howl = ctx.createOscillator();
    howl.frequency.value = 0.1;
    const howlDepth = ctx.createGain();
    howlDepth.gain.value = 60;
    howl.connect(howlDepth).connect(bp.frequency);
    const master = ctx.createGain();
    master.gain.value = 0;
    src.connect(bp).connect(master).connect(out);
    src.start();
    howl.start();
    return {
      set(level) {
        const t = ctx.currentTime;
        master.gain.setTargetAtTime(level * 0.07, t, 0.8);
        bp.frequency.setTargetAtTime(300 + level * 300, t, 0.8);
      },
      stop() {
        const t = ctx.currentTime;
        master.gain.setTargetAtTime(0, t, 0.4);
        [src, howl].forEach((n) => n.stop(t + 2));
      },
    };
  },
  // Slowly beating detuned sines an open fifth apart, with a breathing filter.
  cosmos(ctx, out) {
    const master = ctx.createGain();
    master.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.07;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 350;
    breath.connect(breathGain).connect(lp.frequency);
    const oscs = [110, 110.6, 164.8, 220.4, 329.9].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 3 ? "sine" : "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i < 3 ? 0.28 : 0.06;
      o.connect(g).connect(lp);
      o.start();
      return o;
    });
    lp.connect(master).connect(out);
    breath.start();
    return {
      set(level) {
        master.gain.setTargetAtTime(level * 0.2, ctx.currentTime, 0.6);
      },
      stop() {
        const t = ctx.currentTime;
        master.gain.setTargetAtTime(0, t, 0.5);
        [...oscs, breath].forEach((n) => n.stop(t + 2.5));
      },
    };
  },
};
