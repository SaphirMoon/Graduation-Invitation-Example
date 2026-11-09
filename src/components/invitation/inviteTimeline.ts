/**
 * GSAP timelines for the invitation scene.
 *  - intro: beam from the moon, envelope floats down into it (then a gentle float loop).
 *  - open:  seal breaks → flap opens → card slides out and grows to fill the screen →
 *           handwriting-style line reveals → photo → buttons → sparkles + caps (once).
 * Sound cues are `call`s, so seeking or skipping with progress(1, true) stays silent.
 */
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import type { Cue } from "@/config/audio";

gsap.registerPlugin(SplitText);

/** Clip-path states for the left-to-right "pen" reveal (negative insets keep diacritics and swashes). */
const CLIP_HIDDEN = "inset(-45% 104% -45% -4%)";
const CLIP_SHOWN = "inset(-45% -4% -45% -4%)";

/** Reveal speed: seconds per character, clamped. */
const PER_CHAR = 0.026;
const REVEAL_MIN = 0.45;
const REVEAL_MAX = 1.35;

export type Beam = { grow: number };

export type IntroDom = {
  beam: Beam;
  beamLayer: HTMLElement;
  envelope: HTMLElement;
  hint: HTMLElement;
};

export function buildIntro(d: IntroDom, reduced: boolean) {
  const tl = gsap.timeline({ paused: true });
  if (reduced) {
    tl.set(d.beam, { grow: 1 }, 0)
      .fromTo(d.beamLayer, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0)
      .fromTo(d.envelope, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.2)
      .fromTo(d.hint, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 0.6);
    return tl;
  }
  tl.fromTo(d.beamLayer, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: "power1.out" }, 0)
    .fromTo(d.beam, { grow: 0 }, { grow: 1, duration: 1.3, ease: "power2.out" }, 0)
    // The envelope drifts down inside the light, settling with a slight sway.
    .fromTo(
      d.envelope,
      { autoAlpha: 0, y: () => -window.innerHeight * 0.45, rotation: -7, scale: 0.86 },
      { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 2.1, ease: "power2.out" },
      0.35,
    )
    .fromTo(d.hint, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power1.out" }, 2.1);
  return tl;
}

/** Gentle idle float (started after the intro, killed on tap). */
export function floatTween(el: HTMLElement) {
  return gsap.to(el, { y: -9, rotation: 1.2, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
}

export type OpenDom = {
  beamLayer: HTMLElement;
  envelope: HTMLElement;
  /** Envelope parts that fade away once the card is out (back, pocket, flap) */
  body: HTMLElement[];
  flap: HTMLElement;
  seal: HTMLElement;
  ring: HTMLElement;
  shards: HTMLElement[];
  mini: HTMLElement;
  hint: HTMLElement;
  card: HTMLElement;
  heading: HTMLElement;
  /** Reveal targets in reading order; elements with data-split are split into lines first */
  lines: HTMLElement[];
  rule: HTMLElement;
  photo: HTMLElement;
  actions: HTMLElement[];
  caps: HTMLElement[];
};

/** Splits multi-line targets into lines so each line is "written" separately. */
function revealTargets(lines: HTMLElement[]) {
  const splits: SplitText[] = [];
  const targets: HTMLElement[] = [];
  for (const el of lines) {
    if (el.dataset.split !== undefined) {
      const s = SplitText.create(el, { type: "lines" });
      splits.push(s);
      targets.push(...(s.lines as HTMLElement[]));
    } else targets.push(el);
  }
  return { splits, targets };
}

export function buildOpen(
  d: OpenDom,
  stage: { snow: number },
  reduced: boolean,
  play: (cue: Cue) => void,
  onComplete: () => void,
  onTextDone: () => void,
) {
  const { splits, targets } = revealTargets(d.lines);
  const tl = gsap.timeline({ paused: true, onComplete });

  if (reduced) {
    tl.to([d.envelope, d.hint], { autoAlpha: 0, duration: 0.4 }, 0)
      .to(d.beamLayer, { autoAlpha: 0.5, duration: 0.6 }, 0)
      .fromTo(d.card, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.3)
      .fromTo([d.heading, ...targets, d.rule], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.6)
      .fromTo(d.photo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.6)
      .fromTo(d.actions, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 1)
      .to(stage, { snow: 0.35, duration: 1 }, 1)
      .set(d.caps, { autoAlpha: 0 }, 0)
      .call(play, ["chord"], 0.3)
      .call(onTextDone, undefined, 0.9);
    return { tl, splits };
  }

  // Measure the FLIP start: the mini card's rect once it has slid out of the envelope.
  const yNow = Number(gsap.getProperty(d.envelope, "y")) || 0;
  const miniRect = d.mini.getBoundingClientRect();
  const cardRect = d.card.getBoundingClientRect();
  const slide = miniRect.height * 0.62;
  const from = {
    x: miniRect.left + miniRect.width / 2 - (cardRect.left + cardRect.width / 2),
    y: miniRect.top - yNow - slide + miniRect.height / 2 - (cardRect.top + cardRect.height / 2),
    scaleX: miniRect.width / cardRect.width,
    scaleY: miniRect.height / cardRect.height,
  };

  // 0) Settle, hint out
  tl.to(d.envelope, { y: 0, rotation: 0, duration: 0.22, ease: "power2.out" }, 0)
    .to(d.hint, { autoAlpha: 0, duration: 0.2 }, 0);

  // 1) Seal cracks and bursts into splinters
  tl.to(d.seal, { scale: 1.16, duration: 0.12, ease: "power2.out" }, 0.05)
    .set(d.seal, { autoAlpha: 0 }, 0.18)
    .fromTo(d.ring, { autoAlpha: 1, scale: 0.5 }, { autoAlpha: 0, scale: 2.4, duration: 0.5, ease: "power2.out" }, 0.18)
    .call(play, ["chime"], 0.12);
  d.shards.forEach((s, i) => {
    const a = (i / d.shards.length) * Math.PI * 2 + 0.4;
    const dist = 46 + (i % 3) * 22;
    tl.fromTo(
      s,
      { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1 },
      {
        x: Math.cos(a) * dist,
        y: Math.sin(a) * dist + 18,
        rotation: (i % 2 ? 1 : -1) * (160 + i * 25),
        scale: 0.25,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power2.out",
      },
      0.18,
    );
  });

  // 2) Flap opens (folds up and behind), card slides out
  tl.to(d.flap, { rotationX: 180, duration: 0.65, ease: "power2.inOut" }, 0.34)
    .set(d.flap, { zIndex: 1 }, 0.62)
    .to(d.mini, { y: -slide, duration: 0.7, ease: "power2.out" }, 0.92);

  // 3) Envelope drops away; the card grows from the mini card into place
  tl.to(d.body, { autoAlpha: 0, y: 28, duration: 0.5, ease: "power1.in" }, 1.55)
    .to(d.beamLayer, { autoAlpha: 0.45, duration: 1.2, ease: "power1.inOut" }, 1.55)
    .set(d.mini, { autoAlpha: 0 }, 1.62)
    .fromTo(
      d.card,
      { autoAlpha: 1, ...from, transformOrigin: "50% 50%" },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.95, ease: "power3.inOut", immediateRender: false },
      1.62,
    )
    .set(d.card, { autoAlpha: 0 }, 0)
    .set(d.envelope, { pointerEvents: "none" }, 1.62)
    .call(play, ["chord"], 2.35);

  // 4) Title, then each line "written" left to right
  tl.fromTo(
    d.heading,
    { autoAlpha: 0, letterSpacing: "0.55em" },
    { autoAlpha: 1, letterSpacing: "0.32em", duration: 0.9, ease: "power2.out" },
    2.5,
  );
  let cursor = 2.75;
  let ruleDone = false;
  for (const el of targets) {
    // The short rule is drawn just before the info block (marked with data-info).
    if (!ruleDone && el.dataset.info !== undefined) {
      tl.fromTo(d.rule, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, cursor);
      cursor += 0.3;
      ruleDone = true;
    }
    const len = (el.textContent ?? "").trim().length;
    const dur = Math.min(REVEAL_MAX, Math.max(REVEAL_MIN, 0.25 + len * PER_CHAR));
    tl.fromTo(el, { clipPath: CLIP_HIDDEN }, { clipPath: CLIP_SHOWN, duration: dur, ease: "power1.inOut" }, cursor);
    cursor += dur * 0.88;
  }

  // 5) Photo fades and slides in while the wish is being written
  tl.fromTo(d.photo, { autoAlpha: 0, x: 26, y: 14 }, { autoAlpha: 1, x: 0, y: 0, duration: 1.3, ease: "power2.out" }, 3.9);

  tl.call(onTextDone, undefined, cursor);

  // 6) Buttons
  tl.fromTo(d.actions, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.12 }, cursor + 0.1);

  // 7) Finale (once): blue sparkles drift down, a few caps toss up and dissolve
  tl.to(stage, { snow: 0.85, duration: 1.4, ease: "power1.out" }, cursor)
    .to(stage, { snow: 0.45, duration: 3, ease: "sine.inOut" }, cursor + 2.2);
  d.caps.forEach((c, i) => {
    const t0 = cursor + 0.1 + i * 0.16;
    const side = i % 2 ? 1 : -1;
    const rise = () => -window.innerHeight * (0.42 + (i % 3) * 0.08);
    tl.fromTo(c, { autoAlpha: 0, x: 0, y: 0, rotation: side * 10, scale: 0.85 }, { autoAlpha: 1, duration: 0.25 }, t0)
      .to(c, { y: rise, x: side * (4 + i * 3), rotation: side * (120 + i * 30), duration: 2.1, ease: "power2.out" }, t0)
      .to(c, { autoAlpha: 0, scale: 0.55, duration: 0.7, ease: "power1.in" }, t0 + 1.4);
  });

  return { tl, splits };
}
