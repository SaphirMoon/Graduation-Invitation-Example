"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { SpeechBubble } from "@/components/characters/SpeechBubble";
import { BOARD_U, createBridgeState } from "@/components/three/bridge/bridgeState";
import type { StageDom } from "@/components/three/stage";
import { NextButton, SkipButton } from "@/components/ui/Buttons";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { buildBridgeTimeline } from "@/components/year/bridgeTimeline";
import { Lightbox } from "@/components/year/Lightbox";
import { STORY } from "@/config/story";
import { useWebGL } from "@/hooks/useWebGL";
import { sfx } from "@/lib/audio/sfx";
import type { LoopVoice } from "@/lib/audio/synth";
import { getMemory, type MemoryPhoto, type YearMemory } from "@/lib/memories";
import PlaceholderScene from "./PlaceholderScene";
import type { SceneProps } from "./types";
import { FlatYear } from "./Year";
import styles from "@/components/year/Year.module.css";

const BridgeStage3D = dynamic(() => import("@/components/three/bridge/BridgeStage3D"), { ssr: false });

/** One year as a bridge of light toward the island where the invitation waits. */
export default function YearBridge(props: SceneProps) {
  const webgl = useWebGL();
  const memory = useMemo(() => {
    const m = getMemory(props.sceneId, props.guest.album);
    // One board per stop on the bridge.
    return m ? { ...m, photos: m.photos.slice(0, BOARD_U.length) } : null;
  }, [props.sceneId, props.guest.album]);
  if (!memory) return <PlaceholderScene {...props} />;
  return webgl ? <Bridge3D {...props} memory={memory} /> : <FlatYear {...props} memory={memory} />;
}

const NO_PHOTOS: MemoryPhoto[] = [];

function Bridge3D({ memory, guest, onNext, reducedMotion }: SceneProps & { memory: YearMemory }) {
  const pastPhotos = useMemo(() => getMemory("year3", guest.album)?.photos ?? NO_PHOTOS, [guest.album]);
  const [sp] = useState(() => createBridgeState(memory.photos.length, pastPhotos.length, reducedMotion));
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dom = useMemo<StageDom>(() => ({ bubbleAnchor: anchorRef }), []);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const timerRef = useRef<gsap.core.Tween | null>(null);
  const holdLeft = useRef(0);
  const hum = useRef<LoopVoice | null>(null);
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
    const tl = buildBridgeTimeline({
      sp,
      dom: {
        title: titleRef.current,
        bubbles: Array.from(anchorRef.current?.querySelectorAll<HTMLElement>("[data-line]") ?? []),
        captions: Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-caption]") ?? []),
        next: nextRef.current,
      },
      reduced: reducedMotion,
      play: (cue) => sfx.play(cue),
      onHold: startHold,
    });
    tlRef.current = tl;
    // Dev helper: ?t=answer, ?t=build, ?t=lookBack, ?t=clear0, ?t=final, ?t=end jump there and freeze.
    const t = new URLSearchParams(window.location.search).get("t");
    if (t !== null) tl.seek(Number.isNaN(Number(t)) ? t : Number(t), true).pause();
    else tl.play();
  }, [ready, sp, reducedMotion, startHold]);

  // Sound: a soft hum under everything; a light note on each step on the planks.
  useEffect(() => {
    if (!ready) return;
    const start = () => {
      hum.current ??= sfx.loop("cosmos");
      hum.current?.set(0.7);
    };
    start();
    let lastStep = 0;
    const tick = () => {
      const step = Math.floor(sp.steps);
      if (step !== lastStep) {
        lastStep = step;
        if (sp.walk > 0.6) sfx.play("plank");
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
      hum.current?.stop();
      hum.current = null;
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

  /** "Tiếp →": skips the current wait or hurries to the next one; on the island, on to the invitation. */
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

  /** "Bỏ qua": straight to the island; pressed there, on to the invitation. */
  const skip = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (tl.time() >= tl.labels.arrive) {
      onNext();
      return;
    }
    timerRef.current?.kill();
    timerRef.current = null;
    tl.timeScale(1).seek("arrive", true).play();
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
      <BridgeStage3D sp={sp} photos={memory.photos} pastPhotos={pastPhotos} dom={dom} onReady={() => setReady(true)} onOpenPhoto={openPhoto} />

      <h2 ref={titleRef} className={styles.title}>
        {memory.title}
      </h2>

      {/* Moved every frame to sit above the narrator or the photo board */}
      <div ref={anchorRef} className={styles.bubbleAnchor}>
        {memory.dialogue.map((line, i) => (
          <div key={i} className={styles.bubbleOffset}>
            <div data-line className={styles.bubble}>
              <SpeechBubble text={line} speaker={STORY.scene1.speaker} />
            </div>
          </div>
        ))}
      </div>

      {memory.photos.map((p) => (
        <p key={p.src} data-caption className={`${styles.trainCaption} ${styles.stationCaption}`}>
          <span>{p.caption}</span>
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

      {/* Only until the first frame: the scene opens on the same summit the previous one ended on */}
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
