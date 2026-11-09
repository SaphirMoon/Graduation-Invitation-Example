"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { SpeechBubble } from "@/components/characters/SpeechBubble";
import { createSpaceState } from "@/components/three/space/spaceState";
import type { StageDom } from "@/components/three/stage";
import { NextButton, SkipButton } from "@/components/ui/Buttons";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { Lightbox } from "@/components/year/Lightbox";
import { buildSpaceTimeline, SPACE_TIMING } from "@/components/year/spaceTimeline";
import { STORY } from "@/config/story";
import { useWebGL } from "@/hooks/useWebGL";
import { sfx } from "@/lib/audio/sfx";
import type { LoopVoice } from "@/lib/audio/synth";
import { getMemory, type YearMemory } from "@/lib/memories";
import PlaceholderScene from "./PlaceholderScene";
import type { SceneProps } from "./types";
import { FlatYear } from "./Year";
import styles from "@/components/year/Year.module.css";

const SpaceStage3D = dynamic(() => import("@/components/three/space/SpaceStage3D"), { ssr: false });

/** One year as a high-speed train through space. */
export default function YearSpace(props: SceneProps) {
  const webgl = useWebGL();
  const memory = useMemo(() => getMemory(props.sceneId, props.guest.album), [props.sceneId, props.guest.album]);
  if (!memory) return <PlaceholderScene {...props} />;
  return webgl ? <Space3D {...props} memory={memory} /> : <FlatYear {...props} memory={memory} />;
}

function Space3D({ memory, onNext, reducedMotion }: SceneProps & { memory: YearMemory }) {
  const [sp] = useState(() => createSpaceState(memory.photos.length, reducedMotion));
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dom = useMemo<StageDom>(() => ({ bubbleAnchor: anchorRef }), []);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const trainSound = useRef<LoopVoice | null>(null);
  const humSound = useRef<LoopVoice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ready || tlRef.current) return;
    const tl = buildSpaceTimeline(
      sp,
      {
        title: titleRef.current,
        bubbles: Array.from(anchorRef.current?.querySelectorAll<HTMLElement>("[data-line]") ?? []),
        captions: Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-caption]") ?? []),
        next: nextRef.current,
      },
      reducedMotion,
      (cue) => sfx.play(cue),
      () => setDone(true),
    );
    tlRef.current = tl;
    // Dev helper: ?t=20 or ?t=car1 or ?t=peak0 jumps there and freezes the timeline (the train keeps running).
    const t = new URLSearchParams(window.location.search).get("t");
    if (t !== null) tl.seek(Number.isNaN(Number(t)) ? t : Number(t)).pause();
    else tl.play();
  }, [ready, sp, reducedMotion]);

  // The next scene opens on this same sky: have it ready, so the cut doesn't show a loading gap.
  useEffect(() => {
    void import("@/components/three/snow/SnowStage3D");
  }, []);

  // Sound: the rush of the train follows its speed; the cosmic hum stays underneath.
  useEffect(() => {
    if (!ready) return;
    const start = () => {
      trainSound.current ??= sfx.loop("train");
      humSound.current ??= sfx.loop("cosmos");
      humSound.current?.set(1);
    };
    start();
    const tick = () => trainSound.current?.set(Math.min((sp.trainSpeed * sp.flow) / SPACE_TIMING.transferSpeed, 1));
    gsap.ticker.add(tick);
    // Opened directly on this scene: audio can only start from a gesture.
    const onGesture = () => {
      sfx.unlock();
      start();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointerdown", onGesture);
      trainSound.current?.stop();
      humSound.current?.stop();
      trainSound.current = null;
      humSound.current = null;
    };
  }, [ready, sp]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
      document.body.style.cursor = "";
    },
    [],
  );

  /** "Bỏ qua": straight to the train leaving; pressed again, to the very end. */
  const skip = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (tl.time() < tl.labels.exit) tl.seek("exit", true).play();
    else {
      tl.seek("end", true).pause();
      setDone(true);
    }
  }, []);

  // The lightbox only holds the story: the train keeps running behind it.
  const openPhoto = useCallback((i: number) => {
    tlRef.current?.pause();
    setOpen(i);
  }, []);
  const closePhoto = useCallback(() => {
    setOpen(null);
    tlRef.current?.play();
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <SpaceStage3D sp={sp} photos={memory.photos} dom={dom} onReady={() => setReady(true)} onOpenPhoto={openPhoto} />

      <h2 ref={titleRef} className={styles.title}>
        {memory.title}
      </h2>

      {/* Moved every frame by the train to sit above the cab */}
      <div ref={anchorRef} className={styles.bubbleAnchor}>
        {memory.dialogue.map((line, i) => (
          <div key={i} className={styles.bubbleOffset}>
            <div data-line className={styles.bubble}>
              <SpeechBubble text={line} speaker={STORY.scene1.speaker} />
            </div>
          </div>
        ))}
      </div>

      {/* Handwritten caption under the car the camera is locked on */}
      {memory.photos.map((p) => (
        <p key={p.src} data-caption className={styles.trainCaption}>
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

      {/* The silver mist of the previous year clears into space */}
      <div className={`${styles.coverMist} ${ready ? styles.coverHidden : ""}`} aria-hidden />

      <NextButton ref={nextRef} className={`${styles.hidden} ${styles.nextCompact}`} onClick={onNext}>
        {STORY.ui.next}
      </NextButton>
      {!done && <SkipButton onClick={skip}>{STORY.ui.skip}</SkipButton>}
      <SoundToggle />

      {open !== null && <Lightbox photo={memory.photos[open]} onClose={closePhoto} />}
    </div>
  );
}
