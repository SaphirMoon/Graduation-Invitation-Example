/**
 * Master timeline of a year scene. It only tweens plain values on the lake state and the HTML overlay.
 * Waits ("holds") are real timeline pauses: `onHold` starts the auto-advance timer and the scene's
 * "Tiếp →" resumes early. Ripples are short tweens placed before each hold, so they never freeze.
 */
import gsap from "gsap";
import { BOAT_SCALE, BOAT_SPOT, heroSpot, type LakeState } from "@/components/three/lake/lakeState";

/** Tweakable rhythm, in seconds */
export const YEAR_TIMING = {
  /** One paddle stroke */
  stroke: 1.5,
  /** Boat travel per stroke while arriving */
  strokesIn: 4,
  /** Seconds per character of the speech bubble */
  charDelay: 0.028,
  /** Auto-advance after each spoken line / landed photo */
  holdLine: 3.2,
  holdPhoto: 2.6,
  /** Photo flight and the time its ripple runs before the hold starts */
  flight: 1.2,
  afterLanding: 2.8,
  ripple: 3.2,
  /** Strokes while leaving, and the silver fade at the very end */
  strokesOut: 6,
  fade: 3.4,
};

const T = YEAR_TIMING;

export type YearDom = {
  title: HTMLElement | null;
  /** One bubble per dialogue line */
  bubbles: HTMLElement[];
  next: HTMLElement | null;
  fade: HTMLElement | null;
};

type Options = {
  lake: LakeState;
  dom: YearDom;
  /** Index of the line spoken before each photo (-1 = none) */
  lineBeforePhoto: number[];
  reduced: boolean;
  /** Portrait/landscape affects the landing spot (for the ripple) */
  aspect: number;
  onHold: (seconds: number) => void;
  onEnd: () => void;
};

export function buildYearTimeline({ lake, dom, lineBeforePhoto, reduced, aspect, onHold, onEnd }: Options) {
  const tl = gsap.timeline({ paused: true, onComplete: onEnd });
  lake.stage.reduced = reduced;
  const count = lake.photos.length;
  const closingLine = dom.bubbles.length - 1;

  gsap.set(dom.bubbles, { autoAlpha: 0, scale: 0.92, y: 8, transformOrigin: "50% 100%" });
  dom.bubbles.forEach((b) => gsap.set(b.querySelectorAll("[data-char]"), { opacity: 0 }));
  if (dom.next) gsap.set(dom.next, { autoAlpha: 0, y: 10 });
  if (dom.title) gsap.set(dom.title, { autoAlpha: 0, y: 8 });
  if (dom.fade) gsap.set(dom.fade, { autoAlpha: 0 });

  /** Adds a pause at `at`: the timeline stops there until resumed. */
  const hold = (seconds: number, at: number) => {
    tl.addPause(at, () => onHold(seconds));
  };

  let t = 0;

  /** The narrator says a line; returns the time when the hold ends. */
  const say = (i: number, keep: number) => {
    const bubble = dom.bubbles[i];
    const chars = bubble.querySelectorAll("[data-char]");
    if (reduced) {
      tl.set(chars, { opacity: 1 }, t).to(bubble, { autoAlpha: 1, scale: 1, y: 0, duration: 0.25 }, t);
      t += 0.3;
    } else {
      tl.to(lake, { face: 1, duration: 0.4, ease: "sine.inOut" }, t)
        .to(bubble, { autoAlpha: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }, t + 0.1)
        .to(chars, { opacity: 1, duration: 0.01, ease: "none", stagger: T.charDelay }, t + 0.3);
      t += 0.35 + chars.length * T.charDelay;
    }
    hold(keep, t);
    t += 0.02;
    tl.to(bubble, { autoAlpha: 0, y: -6, duration: reduced ? 0.15 : 0.25 }, t);
    if (!reduced) tl.to(lake, { face: 0, duration: 0.4, ease: "sine.inOut" }, t);
    t += 0.3;
  };

  /** A ring wave at a fixed spot. */
  const ripple = (x: number, z: number, at: number, duration = T.ripple) => {
    if (reduced) return;
    const r = { x, z, age: 0 };
    lake.ripples.push(r);
    tl.fromTo(r, { age: 0.001 }, { age: 1, duration, ease: "none", immediateRender: false }, at);
  };

  /** Rowing: each stroke moves the boat and starts a ring wave at the blade. */
  let strokes = 0;
  const row = (n: number, from: { x: number; z: number }, to: { x: number; z: number }, start: number, sideways: boolean) => {
    for (let i = 0; i < n; i++) {
      const a = (i + 1) / n;
      const at = start + i * T.stroke;
      tl.to(lake.boat, { x: from.x + (to.x - from.x) * a, z: from.z + (to.z - from.z) * a, duration: T.stroke, ease: "power2.out" }, at);
      const b = i / n;
      const px = from.x + (to.x - from.x) * b;
      const pz = from.z + (to.z - from.z) * b;
      // The blade sits on the camera side when crossing the view, on the right when heading away.
      if (sideways) ripple(px + 0.7 * BOAT_SCALE, pz + 0.8 * BOAT_SCALE, at + 0.1);
      else ripple(px + 0.8 * BOAT_SCALE, pz - 0.7 * BOAT_SCALE, at + 0.1);
    }
    strokes += n;
    tl.to(lake, { rowPhase: strokes, duration: n * T.stroke, ease: "none" }, start);
  };

  /* ---------------- 1) Arrival ---------------- */
  if (reduced) {
    lake.camera.intro = 0;
    lake.boat.x = BOAT_SPOT.x;
    lake.boat.z = BOAT_SPOT.z;
    if (dom.title) tl.to(dom.title, { autoAlpha: 1, y: 0, duration: 0.4 }, 0).to(dom.title, { autoAlpha: 0, duration: 0.3 }, 1.4);
    t = 1.8;
  } else {
    tl.to(lake.camera, { intro: 0, duration: 3.6, ease: "sine.inOut" }, 0).to(lake, { row: 1, duration: 0.5, ease: "sine.out" }, 0.4);
    if (dom.title) tl.to(dom.title, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.8).to(dom.title, { autoAlpha: 0, y: -6, duration: 0.7 }, 3.4);
    row(T.strokesIn, { x: lake.boat.x, z: lake.boat.z }, BOAT_SPOT, 0.6, true);
    t = 0.6 + T.strokesIn * T.stroke;
    tl.to(lake, { row: 0, duration: 0.6, ease: "sine.inOut" }, t - 0.3);
    t += 0.4;
  }

  /* ---------------- 2) Opening line ---------------- */
  if (dom.next) tl.to(dom.next, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, t);
  say(0, T.holdLine);

  /* ---------------- 3) Photos ---------------- */
  tl.addLabel("photos", t);
  for (let i = 0; i < count; i++) {
    const p = lake.photos[i];
    if (lineBeforePhoto[i] >= 0) say(lineBeforePhoto[i], T.holdLine);
    tl.addLabel(`photo${i}`, t);
    if (reduced) {
      tl.set(p, { fly: 1, drift: 1 }, t).fromTo(p, { show: 0.001 }, { show: 1, duration: 0.45, immediateRender: false }, t);
      t += 0.55;
      hold(T.holdPhoto, t);
      t += 0.02;
      continue;
    }
    // Reach into the boat, lift the photo, let it go.
    tl.to(lake, { reach: 1, duration: 0.42, ease: "sine.inOut" }, t)
      .fromTo(p, { show: 0.001 }, { show: 1, duration: 0.15, immediateRender: false }, t + 0.36)
      .to(lake, { toss: 1, duration: 0.36, ease: "power2.out" }, t + 0.46);
    t += 0.8;
    // The previous photo drifts off to its place as the new one is released.
    if (i > 0) tl.to(lake.photos[i - 1], { drift: 1, duration: 2.6, ease: "sine.inOut" }, t - 0.2);
    tl.fromTo(p, { fly: 0.001 }, { fly: 1, duration: T.flight, ease: "none", immediateRender: false }, t)
      .to(lake, { toss: 0, reach: 0, duration: 0.5, ease: "sine.inOut" }, t + 0.12);
    t += T.flight;
    const hero = heroSpot(i, aspect, lake.hand.clone());
    ripple(hero.x, hero.z, t - 0.04);
    t += T.afterLanding;
    hold(T.holdPhoto, t);
    t += 0.02;
  }

  /* ---------------- 5) Closing line, last photo settles ---------------- */
  tl.addLabel("closing", t);
  if (!reduced && count > 0) tl.to(lake.photos[count - 1], { drift: 1, duration: 2.2, ease: "sine.inOut" }, t);
  say(closingLine, T.holdLine);
  tl.addLabel("leaving", t);

  /* ---------------- 6) Row into the silver mist, cut to the next scene ---------------- */
  if (dom.next) tl.to(dom.next, { autoAlpha: 0, duration: 0.3 }, t);
  if (reduced) {
    tl.to(dom.fade, { autoAlpha: 1, duration: 0.6 }, t);
    t += 0.7;
  } else {
    tl.to(lake.boat, { yaw: Math.PI / 2, duration: 1.3, ease: "sine.inOut" }, t).to(lake, { row: 1, duration: 0.5, ease: "sine.out" }, t + 0.2);
    const leave = t + 0.5;
    const away = { x: BOAT_SPOT.x, z: BOAT_SPOT.z - 26 };
    row(T.strokesOut, BOAT_SPOT, away, leave, false);
    const dur = T.strokesOut * T.stroke;
    // The camera follows; the photos slip behind it.
    tl.to(lake.camera, { z: -11, duration: dur, ease: "sine.in" }, leave)
      .to(lake, { mist: 1, duration: dur * 0.85, ease: "power1.in" }, leave + dur * 0.15)
      .to(dom.fade, { autoAlpha: 1, duration: T.fade, ease: "sine.in" }, leave + dur - T.fade + 0.4);
    t = leave + dur + 0.4;
  }
  tl.to({}, { duration: 0.01 }, t);
  return tl;
}
