/**
 * Master timeline of year 4: the lantern, the answer, the bridge of light, the walk to the island.
 * It only tweens the controls on BridgeState and the HTML overlay. Waits are real timeline pauses:
 * `onHold` starts a timer and "Tiếp →" can resume early. To change the rhythm, edit BRIDGE_TIMING.
 */
import gsap from "gsap";
import type { Cue } from "@/config/audio";
import { BOARD_U, type BridgeState, LENGTH } from "@/components/three/bridge/bridgeState";

/** Tweakable rhythm, in seconds */
export const BRIDGE_TIMING = {
  /** The lantern going up; the far light answering; the ray; the bridge laying itself out */
  raise: 1.1,
  answer: 1,
  beam: 0.9,
  build: 3.6,
  /** Camera rising and moving behind the narrator */
  toFollow: 2.8,
  /** Walking speed, in meters per second */
  speed: 4.6,
  /** Seconds per character of the speech bubble */
  charDelay: 0.03,
  /** Auto-advance after a line / at a photo */
  holdLine: 2.6,
  holdBoard: 4.5,
};

const T = BRIDGE_TIMING;

export type BridgeDom = {
  title: HTMLElement | null;
  bubbles: HTMLElement[];
  captions: HTMLElement[];
  next: HTMLElement | null;
};

type Options = {
  sp: BridgeState;
  dom: BridgeDom;
  reduced: boolean;
  play: (cue: Cue) => void;
  onHold: (seconds: number) => void;
};

export function buildBridgeTimeline({ sp, dom, reduced, play, onHold }: Options) {
  const tl = gsap.timeline({ paused: true });
  const boards = sp.photoCount;
  const closing = dom.bubbles.length - 1;

  gsap.set(dom.bubbles, { autoAlpha: 0, scale: 0.92, y: 8, transformOrigin: "50% 100%" });
  dom.bubbles.forEach((b) => gsap.set(b.querySelectorAll("[data-char]"), { opacity: 0 }));
  gsap.set(dom.captions, { autoAlpha: 0, y: 10 });
  if (dom.next) gsap.set(dom.next, { autoAlpha: 0, y: 10 });
  if (dom.title) gsap.set(dom.title, { autoAlpha: 0, y: 8 });

  let t = 0;
  const say = (i: number) => {
    const bubble = dom.bubbles[i];
    if (!bubble) return;
    const chars = bubble.querySelectorAll("[data-char]");
    tl.to(bubble, { autoAlpha: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }, t);
    if (reduced) {
      tl.set(chars, { opacity: 1 }, t);
      t += 0.35;
    } else {
      tl.to(chars, { opacity: 1, duration: 0.01, ease: "none", stagger: T.charDelay }, t + 0.2);
      t += 0.3 + chars.length * T.charDelay;
    }
  };
  const hideBubble = (i: number) => {
    const bubble = dom.bubbles[i];
    if (!bubble) return;
    tl.to(bubble, { autoAlpha: 0, y: -6, duration: 0.25 }, t);
    t += 0.28;
  };
  const hold = (seconds: number) => {
    tl.addPause(t, () => onHold(seconds));
    t += 0.02;
  };
  /** Walking from `from` to `to`, at a steady speed. */
  const walkTime = (from: number, to: number) => (((to - from) * LENGTH) / T.speed) * (reduced ? 0.6 : 1);

  /* ---------------- The transition: lantern → answer → ray → bridge ---------------- */
  if (reduced) {
    tl.set(sp, { raise: 0.35 }, 0);
    t = 0.3;
  } else {
    tl.addLabel("raise", 0.3);
    tl.to(sp, { raise: 1, duration: T.raise, ease: "sine.inOut" }, 0.3).call(play, ["chime"], 0.9);
    t = 0.3 + T.raise + 0.15;
    // The far light flashes back, twice.
    tl.addLabel("answer", t + 0.1);
    tl.call(play, ["icebell"], t);
    for (const [at, peak] of [
      [t, 0.8],
      [t + 0.42, 1],
    ] as const) {
      tl.to(sp, { answer: peak, duration: 0.08, ease: "power2.out" }, at)
        .to(sp, { answer: 0, duration: 0.34, ease: "power2.in" }, at + 0.08)
        .to(sp.stage, { bloomBoost: peak * 0.8, duration: 0.08 }, at)
        .to(sp.stage, { bloomBoost: 0, duration: 0.34 }, at + 0.08);
    }
    t += T.answer;
    // The ray, then the planks following it out.
    tl.addLabel("beam", t + T.beam * 0.5);
    tl.to(sp, { beam: 1, duration: T.beam, ease: "power2.in" }, t).call(play, ["whoosh"], t);
    t += T.beam;
    tl.to(sp, { answer: 0.7, duration: 0.07 }, t).to(sp, { answer: 0, duration: 0.5, ease: "power2.in" }, t + 0.07);
    tl.addLabel("build", t + T.build * 0.55);
    tl.to(sp, { build: 1, duration: T.build, ease: "sine.inOut" }, t)
      .to(sp, { islandIn: 1, duration: T.build * 0.9, ease: "sine.in" }, t)
      .to(sp, { beamFade: 0, duration: T.build * 0.7, ease: "sine.in" }, t + T.build * 0.3)
      .to(sp, { raise: 0.35, duration: 1, ease: "sine.inOut" }, t + T.build - 0.8)
      .call(play, ["chord"], t + 0.3);
    t += T.build - 0.3;
  }

  /* ---------------- Opening line, while the camera moves behind the narrator ---------------- */
  tl.addLabel("open", t);
  if (!reduced) tl.to(sp, { follow: 1, duration: T.toFollow, ease: "sine.inOut" }, t);
  if (dom.title) tl.to(dom.title, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, t).to(dom.title, { autoAlpha: 0, y: -6, duration: 0.5 }, t + 2.2);
  if (dom.next) tl.to(dom.next, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.5);
  t += reduced ? 0.4 : T.toFollow * 0.45;
  say(0);
  hold(T.holdLine);
  hideBubble(0);

  /* ---------------- On the bridge, photo by photo ---------------- */
  let from = 0;
  for (let i = 0; i < boards; i++) {
    const to = BOARD_U[i];
    const dur = walkTime(from, to);
    tl.addLabel(`leg${i}`, t);
    tl.to(sp, { walk: 1, duration: 0.4, ease: "sine.inOut" }, t).to(sp, { u: to, duration: dur, ease: "sine.inOut" }, t);
    // On the first stretch the camera looks back once: the snow mountain shrinking behind.
    if (i === 0 && !reduced) {
      tl.addLabel("lookBack", t + dur * 0.5);
      tl.to(sp, { backShot: 1, duration: dur * 0.34, ease: "sine.inOut" }, t + 0.1)
        .to(sp, { backShot: 0, duration: dur * 0.36, ease: "sine.inOut" }, t + dur * 0.6);
    }
    t += dur;
    tl.addLabel(`board${i}`, t);
    tl.set(sp, { station: i }, t - 0.8)
      .to(sp, { walk: 0, duration: 0.5, ease: "sine.inOut" }, t - 0.4)
      .to(sp, { lock: 1, duration: 1.4, ease: "sine.inOut" }, t - 0.5)
      .to(sp.boards[i], { glow: 1, duration: 1.4, ease: "sine.inOut" }, t + 0.1)
      .call(play, ["icebell"], t + 0.2)
      .to(dom.captions[i], { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 0.8);
    tl.addLabel(`clear${i}`, t + (reduced ? 1.3 : 1.9));
    t += 1.1;
    say(i + 1);
    hold(T.holdBoard);
    hideBubble(i + 1);
    tl.to(dom.captions[i], { autoAlpha: 0, y: -6, duration: 0.25 }, t - 0.25).to(sp, { lock: 0, duration: 1.3, ease: "sine.inOut" }, t);
    t += 0.4;
    from = to;
  }

  /* ---------------- Near the end: the lighthouse lights up, the sky fills with lanterns ---------------- */
  const dur = walkTime(from, 1);
  tl.addLabel("final", t);
  tl.to(sp, { walk: 1, duration: 0.4 }, t).to(sp, { u: 1, duration: dur, ease: "sine.inOut" }, t);
  tl.to(sp, { tower: 1, duration: 2.2, ease: "sine.inOut" }, t + 0.5)
    .to(sp, { festival: 1, duration: dur, ease: "sine.in" }, t + 0.5)
    .call(play, ["chord"], t + 0.6);
  t += dur;
  tl.addLabel("arrive", t);
  tl.to(sp, { walk: 0, duration: 0.5, ease: "sine.inOut" }, t - 0.3);
  tl.to(sp, { end: 1, duration: 1.8, ease: "sine.inOut" }, t - 0.2);
  t += 1.5;
  tl.addLabel("end", t);
  say(closing);
  tl.to({}, { duration: 0.1 }, t);
  return tl;
}
