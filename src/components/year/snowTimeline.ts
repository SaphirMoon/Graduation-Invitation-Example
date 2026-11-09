/**
 * Master timeline of year 3: the fall from the previous scene, then the climb.
 * It only tweens the controls on SnowState and the HTML overlay. Waits are real timeline pauses:
 * `onHold` starts a timer and "Tiếp →" can resume early. To change the rhythm, edit SNOW_TIMING.
 */
import gsap from "gsap";
import type { Cue } from "@/config/audio";
import { STATION_U, type SnowState } from "@/components/three/snow/snowState";

/** Tweakable rhythm, in seconds */
export const SNOW_TIMING = {
  /** The train's star streaks slowing down into snowflakes */
  streakFade: 1.5,
  /** Camera tilting down, then falling through the clouds */
  tilt: 1.3,
  fall: 5,
  /** Blending from straight down into the view at the foot of the mountain */
  land: 2,
  /** When the landing starts: right as the last cloud layer is crossed */
  landAt: 3,
  /** Seconds per character of the speech bubble */
  charDelay: 0.03,
  /** Auto-advance after a line / at a station */
  holdLine: 2.6,
  holdStation: 4.5,
  /** Walking between two stations */
  leg: 6.2,
  /** Peak of the gust and its length (one leg, between stations 2 and 3) */
  gust: 1,
  gustReduced: 0.3,
  gustLength: 3.6,
  /** Reaching the summit */
  toSummit: 3,
};

const T = SNOW_TIMING;

export type SnowDom = {
  title: HTMLElement | null;
  bubbles: HTMLElement[];
  captions: HTMLElement[];
  haze: HTMLElement | null;
  next: HTMLElement | null;
};

type Options = {
  sp: SnowState;
  dom: SnowDom;
  reduced: boolean;
  play: (cue: Cue) => void;
  onHold: (seconds: number) => void;
};

export function buildSnowTimeline({ sp, dom, reduced, play, onHold }: Options) {
  const tl = gsap.timeline({ paused: true });
  const stations = sp.photoCount;
  const opening = 0;
  const closing = dom.bubbles.length - 1;

  gsap.set(dom.bubbles, { autoAlpha: 0, scale: 0.92, y: 8, transformOrigin: "50% 100%" });
  dom.bubbles.forEach((b) => gsap.set(b.querySelectorAll("[data-char]"), { opacity: 0 }));
  gsap.set(dom.captions, { autoAlpha: 0, y: 10 });
  if (dom.next) gsap.set(dom.next, { autoAlpha: 0, y: 10 });
  if (dom.title) gsap.set(dom.title, { autoAlpha: 0, y: 8 });
  if (dom.haze) gsap.set(dom.haze, { autoAlpha: 0 });

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

  /* ---------------- The fall (no fade, no cover: one continuous camera move) ---------------- */
  if (!reduced) {
    tl.addLabel("fall", 0);
    tl.to(sp, { streakX: 0, duration: T.streakFade, ease: "power2.out" }, 0)
      .to(sp, { tilt: 1, duration: T.tilt, ease: "sine.inOut" }, 0.5)
      .to(sp, { fall: 0, duration: T.fall, ease: "power3.inOut" }, 1.1)
      .call(play, ["breeze"], 1.5)
      .call(play, ["breeze"], 3.4);
    tl.to(sp, { land: 1, duration: T.land, ease: "sine.inOut" }, T.landAt);
    tl.addLabel("clouds", 2.6);
    t = 1.1 + T.fall + 0.25;
  } else t = 0.3;

  /* ---------------- 1) At the foot: opening line ---------------- */
  tl.addLabel("foot", t);
  if (dom.title) tl.to(dom.title, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, t).to(dom.title, { autoAlpha: 0, y: -6, duration: 0.5 }, t + 2);
  tl.to(sp, { look: 1, duration: 0.5 }, t);
  if (dom.next) tl.to(dom.next, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t + 0.5);
  t += 0.7;
  say(opening);
  hold(T.holdLine);
  hideBubble(opening);
  tl.to(sp, { look: 0, duration: 0.4 }, t);

  /* ---------------- 2–3) Climbing, station by station ---------------- */
  for (let i = 0; i < stations; i++) {
    const from = i === 0 ? 0 : STATION_U[i - 1];
    tl.addLabel(`leg${i}`, t);
    tl.to(sp, { walk: 1, duration: 0.4, ease: "sine.inOut" }, t)
      .to(sp, { u: STATION_U[i], duration: T.leg * ((STATION_U[i] - from) / 0.21), ease: "sine.inOut" }, t);
    // A gust between stations 2 and 3.
    if (i === 2) {
      const at = t + 1.1;
      const peak = reduced ? T.gustReduced : T.gust;
      tl.addLabel("gust", at + T.gustLength * 0.45);
      tl.to(sp, { blizzard: peak, duration: T.gustLength * 0.35, ease: "power2.in" }, at)
        .to(sp, { blizzard: 0, duration: T.gustLength * 0.5, ease: "sine.inOut" }, at + T.gustLength * 0.5);
      if (dom.haze) {
        tl.to(dom.haze, { autoAlpha: peak * 0.2, duration: T.gustLength * 0.35, ease: "power1.in" }, at)
          .to(dom.haze, { autoAlpha: 0, duration: T.gustLength * 0.5, ease: "sine.inOut" }, at + T.gustLength * 0.5);
      }
    }
    t += T.leg * ((STATION_U[i] - from) / 0.21);

    // Arrived: the camera locks on the block, the narrator sits, the ice lights up from inside.
    tl.addLabel(`station${i}`, t);
    tl.set(sp, { station: i }, t - 0.5)
      .to(sp, { walk: 0, duration: 0.5, ease: "sine.inOut" }, t - 0.4)
      .to(sp, { sit: 1, duration: 0.9, ease: "sine.inOut" }, t - 0.1)
      .to(sp, { lock: 1, duration: 1.5, ease: "sine.inOut" }, t - 0.2)
      .to(sp.ice[i], { glow: 1, duration: 2, ease: "sine.inOut" }, t + 0.6)
      .call(play, ["icebell"], t + 0.7)
      .to(dom.captions[i], { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + 1.2);
    tl.addLabel(`clear${i}`, t + (reduced ? 1.7 : 2.7));
    t += 1.5;
    say(i + 1);
    hold(T.holdStation);
    hideBubble(i + 1);
    tl.to(dom.captions[i], { autoAlpha: 0, y: -6, duration: 0.25 }, t - 0.25)
      .to(sp, { lock: 0, duration: 1.3, ease: "sine.inOut" }, t)
      .to(sp, { sit: 0, duration: 0.8, ease: "sine.inOut" }, t);
    t += 0.5;
  }

  /* ---------------- 5) The summit ---------------- */
  tl.addLabel("toSummit", t);
  tl.to(sp, { walk: 1, duration: 0.4 }, t).to(sp, { u: 1, duration: T.leg * ((1 - STATION_U[stations - 1]) / 0.21), ease: "sine.inOut" }, t);
  t += T.leg * ((1 - STATION_U[stations - 1]) / 0.21);
  tl.addLabel("summit", t);
  tl.set(sp, { walk: 0 }, t + 0.5);
  tl.to(sp, { summit: 1, duration: T.toSummit, ease: "sine.inOut" }, t - 0.2).to(sp, { look: 0.5, duration: 0.8 }, t + T.toSummit - 0.4);
  t += T.toSummit;
  tl.to(sp, { omen: 1, duration: 2.4, ease: "sine.inOut" }, t);
  tl.addLabel("top", t + 0.1);
  say(closing);
  tl.to({}, { duration: 0.1 }, t);
  tl.addLabel("end", t + 0.1);
  return tl;
}
