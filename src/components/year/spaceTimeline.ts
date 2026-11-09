/**
 * Master timeline of the high-speed train. The train never stops; the timeline only tweens the
 * controls on SpaceState: trainSpeed, cameraTarget, cameraBlend, cameraRelease (and the HTML overlay).
 * To change the rhythm, edit SPACE_TIMING.
 */
import gsap from "gsap";
import type { Cue } from "@/config/audio";
import type { SpaceState } from "@/components/three/space/spaceState";

/** Tweakable rhythm, in seconds */
export const SPACE_TIMING = {
  /** Train driving into the frame from the left */
  enter: 3.4,
  /** Seconds per character of the speech bubble, and reading time after each line */
  charDelay: 0.03,
  readAfter: 1.6,
  /** Camera moving from the 3/4 shot to the first car */
  toFirstCar: 2.6,
  /** How long the camera stays locked on each car */
  hold: 3.2,
  /** Moving on to the next car, and the speed reached meanwhile */
  transfer: 1.1,
  transferSpeed: 1.6,
  /** Camera letting go, the train running off, and when "Tiếp →" appears */
  release: 2.4,
  leave: 10,
  nextAfter: 4.5,
};

const T = SPACE_TIMING;

export type SpaceDom = {
  title: HTMLElement | null;
  bubbles: HTMLElement[];
  captions: HTMLElement[];
  next: HTMLElement | null;
};

export function buildSpaceTimeline(sp: SpaceState, dom: SpaceDom, reduced: boolean, play: (cue: Cue) => void, onEnd: () => void) {
  const tl = gsap.timeline({ paused: true, onComplete: onEnd });
  const cars = dom.captions.length;

  gsap.set(dom.bubbles, { autoAlpha: 0, scale: 0.92, y: 8, transformOrigin: "50% 100%" });
  dom.bubbles.forEach((b) => gsap.set(b.querySelectorAll("[data-char]"), { opacity: 0 }));
  gsap.set(dom.captions, { autoAlpha: 0, y: 10 });
  if (dom.next) gsap.set(dom.next, { autoAlpha: 0, y: 10 });
  if (dom.title) gsap.set(dom.title, { autoAlpha: 0, y: 8 });

  /* ---------------- 1) The train drives in; the narrator talks ---------------- */
  if (!reduced) tl.fromTo(sp, { entry: -80 }, { entry: 0, duration: T.enter, ease: "power2.out", immediateRender: false }, 0);
  if (dom.title) tl.to(dom.title, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" }, 0.8).to(dom.title, { autoAlpha: 0, y: -6, duration: 0.6 }, 3);

  let t = reduced ? 0.6 : T.enter - 0.6;
  tl.addLabel("talk", t);
  for (const bubble of dom.bubbles) {
    const chars = bubble.querySelectorAll("[data-char]");
    tl.to(bubble, { autoAlpha: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }, t);
    if (reduced) tl.set(chars, { opacity: 1 }, t);
    else tl.to(chars, { opacity: 1, duration: 0.01, ease: "none", stagger: T.charDelay }, t + 0.2);
    t += 0.2 + (reduced ? 0 : chars.length * T.charDelay) + T.readAfter;
    tl.to(bubble, { autoAlpha: 0, y: -6, duration: 0.25 }, t);
    t += 0.3;
  }

  /* ---------------- 2) Camera locks on the first photo car ---------------- */
  tl.addLabel("lock", t);
  if (reduced) {
    tl.set(sp, { cameraBlend: 1, cameraTarget: 1 }, t);
    t += 0.1;
  } else {
    tl.to(sp, { cameraBlend: 1, cameraTarget: 1, duration: T.toFirstCar, ease: "sine.inOut" }, t);
    t += T.toFirstCar;
  }

  /* ---------------- 3) One car at a time; a speed pulse carries the next one into frame ---------------- */
  for (let i = 0; i < cars; i++) {
    tl.addLabel(`car${i}`, t);
    tl.to(dom.captions[i], { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, t - 0.15);
    t += T.hold;
    tl.to(dom.captions[i], { autoAlpha: 0, y: -6, duration: 0.25 }, t - 0.1);
    if (i === cars - 1) break;
    tl.addLabel(`transfer${i}`, t);
    tl.addLabel(`peak${i}`, t + T.transfer / 2);
    if (reduced) {
      tl.set(sp, { cameraTarget: i + 2 }, t + 0.2);
      t += 0.4;
    } else {
      tl.to(sp, { trainSpeed: T.transferSpeed, duration: T.transfer / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, t)
        .to(sp, { cameraTarget: i + 2, duration: T.transfer, ease: "sine.inOut" }, t)
        .call(play, ["breeze"], t);
      t += T.transfer;
    }
  }

  /* ---------------- 5) The camera lets go; the train runs off among the stars ---------------- */
  tl.addLabel("exit", t);
  const flow = reduced ? 0.6 : 0.22;
  tl.to(sp, { cameraRelease: 1, duration: reduced ? 0.8 : T.release, ease: "sine.inOut" }, t)
    .to(sp, { flow, duration: T.release, ease: "sine.inOut" }, t)
    .to(sp, { climb: 1, duration: T.release * 1.5, ease: "sine.inOut" }, t)
    .to(sp, { exit: 900, duration: T.leave, ease: "power2.in" }, t + 0.1)
    .call(play, ["breeze"], t + 0.4);
  tl.addLabel("away", t + 6);
  if (dom.next) tl.to(dom.next, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, t + T.nextAfter);
  tl.addLabel("end", t + T.leave + 0.1);
  return tl;
}
