"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { SpeechBubble } from "@/components/characters/SpeechBubble";
import { createSnowState } from "@/components/three/snow/snowState";
import type { StageDom } from "@/components/three/stage";
import { NextButton, SkipButton } from "@/components/ui/Buttons";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { Lightbox } from "@/components/year/Lightbox";
import { buildSnowTimeline } from "@/components/year/snowTimeline";
import { STORY } from "@/config/story";
import { useWebGL } from "@/hooks/useWebGL";
import { sfx } from "@/lib/audio/sfx";
import type { LoopVoice } from "@/lib/audio/synth";
import { getMemory, type YearMemory } from "@/lib/memories";
import PlaceholderScene from "./PlaceholderScene";
import type { SceneProps } from "./types";
import { FlatYear } from "./Year";
import styles from "@/components/year/Year.module.css";

const SnowStage3D = dynamic(() => import("@/components/three/snow/SnowStage3D"), { ssr: false });

/** One year as a climb up a snow mountain. */
export default function YearSnow(props: SceneProps) {
  const webgl = useWebGL();
  const memory = useMemo(() => getMemory(props.sceneId, props.guest.album), [props.sceneId, props.guest.album]);
  if (!memory) return <PlaceholderScene {...props} />;
  return webgl ? <Snow3D {...props} memory={memory} /> : <FlatYear {...props} memory={memory} />;
}

function Snow3D({ memory, entry, onNext, reducedMotion }: SceneProps & { memory: YearMemory }) {
  const [sp] = useState(() => createSnowState(memory.photos.length, reducedMotion));
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dom = useMemo<StageDom>(() => ({ bubbleAnchor: anchorRef }), []);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const timerRef = useRef<gsap.core.Tween | null>(null);
  const holdLeft = useRef(0);
  const windSound = useRef<LoopVoice | null>(null);
  const padSound = useRef<LoopVoice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const startHold = useCallback((seconds: number) => {
    const tl = tlRef.current;
    if (!tl) return;
    tl.timeScale(1);
    holdLeft.current = seconds;
    timerRef.current?.kill();
    timerRef.current = gsap.to(holdLeft, { current: 0, duration: seconds, ease: "none", onComplete: () => void tl.play() });
  }, []);

  useEffect(() => {
    if (!ready || tlRef.current) return;
    const root = rootRef.current;
    const tl = buildSnowTimeline({
      sp,
      dom: {
        title: titleRef.current,
        bubbles: Array.from(anchorRef.current?.querySelectorAll<HTMLElement>("[data-line]") ?? []),
        captions: Array.from(root?.querySelectorAll<HTMLElement>("[data-caption]") ?? []),
        haze: hazeRef.current,
        next: nextRef.current,
      },
      reduced: reducedMotion,
      play: (cue) => sfx.play(cue),
      onHold: startHold,
    });
    tlRef.current = tl;
    // Dev helper: ?t=20 or ?t=station1 or ?t=gust jumps there and freezes the timeline (screenshots).
    const t = new URLSearchParams(window.location.search).get("t");
    if (t !== null) tl.seek(Number.isNaN(Number(t)) ? t : Number(t), true).pause();
    else {
      if (entry === "nav" && !reducedMotion) tl.seek("foot", true);
      tl.play();
    }
  }, [ready, sp, reducedMotion, startHold, entry]);

  // The next scene opens on this same summit: have it ready, so the cut doesn't show a loading gap.
  useEffect(() => {
    void import("@/components/three/bridge/BridgeStage3D");
  }, []);

  // Sound: a calm pad under a soft breeze that follows altitude and gusts; steps while walking.
  useEffect(() => {
    if (!ready) return;
    const start = () => {
      windSound.current ??= sfx.loop("wind");
      padSound.current ??= sfx.loop("cosmos");
      padSound.current?.set(0.7);
    };
    start();
    let lastStep = 0;
    const tick = () => {
      windSound.current?.set(Math.min(1, 0.25 + sp.alt * 0.25 + sp.blizzard * 0.75));
      const step = Math.floor(sp.strides);
      if (step !== lastStep) {
        lastStep = step;
        if (sp.walk > 0.6 && sp.land >= 1) sfx.play("step");
      }
    };
    gsap.ticker.add(tick);
    const onGesture = () => {
      sfx.unlock();
      start();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointerdown", onGesture);
      windSound.current?.stop();
      windSound.current = null;
      padSound.current?.stop();
      padSound.current = null;
    };
  }, [ready, sp]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
      timerRef.current?.kill();
      document.body.style.cursor = "";
    },
    [],
  );

  /** "Tiếp →": skips the current wait or hurries to the next one; on the summit, leaves the scene. */
  const advance = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (tl.progress() >= 1) {
      onNext();
      return;
    }
    if (tl.paused()) {
      timerRef.current?.kill();
      timerRef.current = null;
      tl.timeScale(1).play();
    } else tl.timeScale(3);
  }, [onNext]);

  /** "Bỏ qua": straight to the summit; pressed there, out of the scene. */
  const skip = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (tl.time() >= tl.labels.summit) {
      onNext();
      return;
    }
    timerRef.current?.kill();
    timerRef.current = null;
    tl.timeScale(1).seek("summit", true).play();
  }, [onNext]);

  const openPhoto = useCallback((i: number) => {
    tlRef.current?.pause();
    timerRef.current?.pause();
    setOpen(i);
  }, []);
  const closePhoto = useCallback(() => {
    setOpen(null);
    const timer = timerRef.current;
    if (timer && timer.progress() < 1) timer.resume();
    else tlRef.current?.play();
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <SnowStage3D sp={sp} photos={memory.photos} dom={dom} onReady={() => setReady(true)} onOpenPhoto={openPhoto} />

      <h2 ref={titleRef} className={styles.title}>
        {memory.title}
      </h2>

      {/* Moved every frame to sit above the narrator or the ice block */}
      <div ref={anchorRef} className={styles.bubbleAnchor}>
        {memory.dialogue.map((line, i) => (
          <div key={i} className={styles.bubbleOffset}>
            <div data-line className={styles.bubble}>
              <SpeechBubble text={line} speaker={STORY.scene1.speaker} />
            </div>
          </div>
        ))}
      </div>

      {/* Caption and altitude under the ice block */}
      {memory.photos.map((p) => (
        <p key={p.src} data-caption className={`${styles.trainCaption} ${styles.stationCaption}`}>
          <span>
            <small className={styles.altitude}>{p.altitude}</small>
            {p.caption}
          </span>
        </p>
      ))}

      <ul className={styles.srOnly}>
        {memory.photos.map((p, i) => (
          <li key={p.src}>
            <button type="button" onClick={() => openPhoto(i)}>
              {p.videoId ? STORY.ui.viewVideo : STORY.ui.viewPhoto}: {p.caption}
            </button>
          </li>
        ))}
      </ul>

      {/* Reduced visibility in the gust */}
      <div ref={hazeRef} className={styles.gustHaze} aria-hidden />

      {/* Only until the first frame: the scene opens on the same sky the previous one ended with */}
      <div className={`${styles.coverNight} ${ready ? styles.coverHidden : ""}`} aria-hidden />

      <NextButton ref={nextRef} className={`${styles.hidden} ${styles.nextCompact}`} onClick={advance}>
        {STORY.ui.next}
      </NextButton>
      <SkipButton onClick={skip}>{STORY.ui.skip}</SkipButton>
      <SoundToggle />

      {open !== null && <Lightbox photo={memory.photos[open]} onClose={closePhoto} />}
    </div>
  );
}
