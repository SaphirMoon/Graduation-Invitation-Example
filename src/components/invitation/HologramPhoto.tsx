"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { INVITATION } from "@/config/invitation";
import { FRAME_ASPECT, heightAt, PHOTOS, photoIndexAt, TIMELINE } from "@/data/timeline";
import { deviceTiltAllowed } from "@/lib/deviceTilt";
import styles from "./HologramPhoto.module.css";

export type PortraitMode = "wait" | "play" | "end";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const STOPS = PHOTOS.map((p) => p.stop);
/** After a dot or an arrow key, the mouse leaves t alone for this long (ms). */
const HANDS_OFF_MS = 1400;
const SWIPE_PX = 30;

/**
 * The card as a lenticular print: tilt it and the narrator grows up.
 * One number drives everything (`t`, 0..1): the photos, the stripes, the gloss, the card's angle.
 * Mouse, phone tilt, a swipe, the dots, the keys and the opening run only ever move its target.
 */
export function HologramPhoto({
  cardRef,
  shadowRef,
  glossRef,
  mode,
  reducedMotion,
}: {
  cardRef: RefObject<HTMLElement | null>;
  shadowRef: RefObject<HTMLElement | null>;
  glossRef: RefObject<HTMLElement | null>;
  mode: PortraitMode;
  reducedMotion: boolean;
}) {
  const [index, setIndex] = useState(reducedMotion ? 2 : 0);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const chipRef = useRef<HTMLDivElement>(null);
  const live = useRef({ t: reducedMotion ? 1 : 0, target: reducedMotion ? 1 : 0, tilt: 0, pointerY: 0.5, dirty: true, lastInput: 0, handsOffUntil: 0, frozen: false });
  const intro = useRef<gsap.core.Timeline | null>(null);
  const glide = useRef<gsap.core.Tween | null>(null);

  /** Draws t: which photos show and how, the gloss, and the angle of the card. */
  const draw = useCallback(() => {
    const { t, tilt, pointerY } = live.current;
    const { thresholds, transitionZone: zone, stripePx } = TIMELINE;
    const q0 = clamp01((t - (thresholds[0] - zone)) / (2 * zone));
    const q1 = clamp01((t - (thresholds[1] - zone)) / (2 * zone));
    const opacity = [1 - q0, q0 * (1 - q1), q1];
    const height = heightAt(t);

    layers.current.forEach((layer, i) => {
      if (!layer) return;
      const image = images.current[i];
      // The incoming photo opens through widening stripes, while the outgoing one simply fades.
      const incoming = i === 1 ? q0 : i === 2 ? q1 : 1;
      const striped = !reducedMotion && incoming > 0 && incoming < 1;
      layer.style.opacity = String(reducedMotion || !striped ? opacity[i] : Math.min(1, incoming * 2.5));
      layer.style.visibility = opacity[i] > 0.001 ? "visible" : "hidden";
      const mask = striped ? `repeating-linear-gradient(90deg, #000 0 ${(stripePx * incoming).toFixed(2)}px, transparent ${(stripePx * incoming).toFixed(2)}px ${stripePx}px)` : "";
      layer.style.maskImage = mask;
      layer.style.setProperty("-webkit-mask-image", mask);
      if (image) image.style.transform = `translateX(-50%) scale(${height.toFixed(4)})`;
    });

    if (reducedMotion) return;
    const card = cardRef.current;
    const side = (t - 0.5) * 2;
    const rotationY = side * TIMELINE.rotateY * tilt;
    const rotationX = (0.5 - pointerY) * 2 * TIMELINE.rotateX * tilt;
    if (card) gsap.set(card, { rotationY, rotationX, transformPerspective: 1000 });
    const shadow = shadowRef.current;
    if (shadow) {
      shadow.style.transform = `translate3d(${(-rotationY * 1.6).toFixed(1)}px, ${(rotationX * 1.6 + 16).toFixed(1)}px, -40px)`;
      shadow.style.opacity = (0.45 + (Math.abs(rotationY) / TIMELINE.rotateY) * 0.4).toFixed(3);
    }
    const gloss = glossRef.current;
    if (gloss) {
      const near = Math.min(Math.abs(t - thresholds[0]), Math.abs(t - thresholds[1]));
      gloss.style.transform = `translate3d(${(side * 62).toFixed(1)}%, 0, 0)`;
      gloss.style.opacity = (0.1 + 0.36 * (1 - clamp01(near / (zone * 2.2)))).toFixed(3);
    }
  }, [cardRef, shadowRef, glossRef, reducedMotion]);

  // One draw per frame, only while something is still moving.
  useEffect(() => {
    const tick = (_time: number, deltaMs: number) => {
      const s = live.current;
      const k = 1 - Math.exp((-deltaMs / 1000) * 9);
      const wanted = mode === "wait" ? 0 : intro.current || performance.now() - s.lastInput < 1500 ? 1 : TIMELINE.restTilt;
      const nextT = Math.abs(s.target - s.t) < 0.0006 ? s.target : s.t + (s.target - s.t) * k;
      const nextTilt = Math.abs(wanted - s.tilt) < 0.002 ? wanted : s.tilt + (wanted - s.tilt) * k * 0.3;
      if (nextT === s.t && nextTilt === s.tilt && !s.dirty) return;
      s.t = nextT;
      s.tilt = nextTilt;
      s.dirty = false;
      draw();
      setIndex(photoIndexAt(s.t));
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [draw, mode]);

  const stopRunning = useCallback(() => {
    intro.current?.kill();
    intro.current = null;
    glide.current?.kill();
    glide.current = null;
  }, []);

  /** The opening run: each photo in turn, ending on today's, then the controls are the viewer's. */
  const runIntro = useCallback(
    (fromNow: boolean) => {
      stopRunning();
      const { introHold: hold, introMove: move } = TIMELINE;
      const s = live.current;
      const tl = gsap.timeline({
        onComplete: () => {
          intro.current = null;
          s.lastInput = performance.now();
        },
      });
      if (fromNow) tl.to(s, { target: 0, duration: 0.6, ease: "sine.inOut" });
      else s.target = s.t = 0;
      tl.to(s, { target: STOPS[1], duration: move, ease: "sine.inOut" }, `+=${hold}`).to(s, { target: STOPS[2], duration: move, ease: "sine.inOut" }, `+=${hold}`);
      intro.current = tl;
    },
    [stopRunning],
  );

  const goToPhoto = useCallback(
    (i: number) => {
      stopRunning();
      const s = live.current;
      s.lastInput = performance.now();
      s.handsOffUntil = s.lastInput + HANDS_OFF_MS;
      glide.current = gsap.to(s, { target: STOPS[i], duration: 0.7, ease: "sine.inOut" });
    },
    [stopRunning],
  );

  const replay = useCallback(() => {
    if (reducedMotion) {
      goToPhoto(0);
      return;
    }
    live.current.lastInput = performance.now();
    runIntro(true);
  }, [reducedMotion, goToPhoto, runIntro]);

  // The card finished writing, or "Bỏ qua" was pressed.
  useEffect(() => {
    const s = live.current;
    const held = new URLSearchParams(window.location.search).get("holo");
    if (mode !== "wait" && held !== null) {
      // Dev helper: ?t=end&holo=0.33 freezes the card at that t (screenshots).
      stopRunning();
      s.frozen = true;
      s.t = s.target = Number(held);
      s.tilt = 1;
      s.lastInput = Infinity;
      s.dirty = true;
      return;
    }
    if (mode === "end") {
      stopRunning();
      s.t = s.target = 1;
      s.dirty = true;
    } else if (mode === "play" && !reducedMotion) runIntro(false);
  }, [mode, reducedMotion, runIntro, stopRunning]);

  useEffect(() => stopRunning, [stopRunning]);

  // The viewer's hands: mouse, swipe, phone tilt, arrow keys.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || mode === "wait") return;
    const s = live.current;
    let drag: { x: number; lastX: number; moved: boolean } | null = null;

    const onMove = (e: PointerEvent) => {
      if (s.frozen) return;
      const box = card.getBoundingClientRect();
      if (e.pointerType === "mouse") {
        if (reducedMotion || intro.current || performance.now() < s.handsOffUntil) return;
        if (chipRef.current?.contains(e.target as Node)) return;
        s.target = clamp01((e.clientX - box.left - box.width * 0.06) / (box.width * 0.88));
        s.pointerY = clamp01((e.clientY - box.top) / box.height);
        s.lastInput = performance.now();
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      if (!drag.moved && Math.abs(e.clientX - drag.x) > 6) {
        drag.moved = true;
        stopRunning();
        // Keeps the swipe going past the card's edge; the swipe still works if it is refused.
        try {
          card.setPointerCapture(e.pointerId);
        } catch {}
      }
      if (drag.moved && !reducedMotion) {
        s.target = clamp01(s.target + dx / (box.width * 0.8));
        s.lastInput = performance.now();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || (e.target as Element).closest("button, a")) return;
      drag = { x: e.clientX, lastX: e.clientX, moved: false };
    };
    const onUp = (e: PointerEvent) => {
      if (drag?.moved && reducedMotion && Math.abs(e.clientX - drag.x) > SWIPE_PX) {
        const step = e.clientX < drag.x ? -1 : 1;
        goToPhoto(Math.max(0, Math.min(PHOTOS.length - 1, photoIndexAt(s.target) + step)));
      }
      drag = null;
    };
    const onCancel = () => {
      drag = null;
    };

    let lastGamma: number | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || s.frozen) return;
      const delta = lastGamma === null ? 0 : e.gamma - lastGamma;
      lastGamma = e.gamma;
      // Relative, so taking over never makes the photo jump. Ignore the hand's tiny tremor.
      if (Math.abs(delta) < 0.25 || Math.abs(delta) > 30 || intro.current || performance.now() < s.handsOffUntil) return;
      s.target = clamp01(s.target + delta / (TIMELINE.gyroRange * 2));
      s.lastInput = performance.now();
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || s.frozen) return;
      if ((e.target as Element | null)?.closest?.("nav")) return;
      const step = e.key === "ArrowLeft" ? -1 : 1;
      goToPhoto(Math.max(0, Math.min(PHOTOS.length - 1, photoIndexAt(s.target) + step)));
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    const useGyro = !reducedMotion && deviceTiltAllowed();
    if (useGyro) window.addEventListener("deviceorientation", onTilt);
    return () => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerdown", onDown);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      if (useGyro) window.removeEventListener("deviceorientation", onTilt);
    };
  }, [cardRef, mode, reducedMotion, goToPhoto, stopRunning]);

  const photo = PHOTOS[index];
  const label = `${photo.label}${photo.year ? ` · ${photo.year}` : ""}`;

  return (
    <div className={styles.frame} style={{ aspectRatio: FRAME_ASPECT }}>
      <div className={styles.stage} role="img" aria-label={`${INVITATION.signature}: ${label}`}>
        {PHOTOS.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => {
              layers.current[i] = el;
            }}
            className={styles.layer}
          >
            <Image
              ref={(el) => {
                images.current[i] = el;
              }}
              className={styles.image}
              src={p.src}
              width={p.width}
              height={p.height}
              alt=""
              sizes="320px"
              priority
            />
          </div>
        ))}
      </div>

      <div ref={chipRef} className={styles.chip} data-on={mode !== "wait"}>
        <p className={styles.label} aria-live="polite">
          {label}
        </p>
        <div className={styles.controls}>
          {PHOTOS.map((p, i) => (
            <button key={p.id} type="button" className={styles.dot} aria-label={`${INVITATION.ui.portraitDot}: ${p.label}`} aria-current={i === index} onClick={() => goToPhoto(i)}>
              <span className={styles.dotMark} data-on={i === index} />
            </button>
          ))}
          <button type="button" className={styles.replay} aria-label={INVITATION.ui.portraitReplay} title={INVITATION.ui.portraitReplay} onClick={replay}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8a5 5 0 1 0 1.6-3.7" />
              <path d="M3.2 2.4v2.4h2.4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
