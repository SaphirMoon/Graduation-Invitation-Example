"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import gsap from "gsap";
import { SpeechBubble } from "@/components/characters/SpeechBubble";
import { createLakeState } from "@/components/three/lake/lakeState";
import type { StageDom } from "@/components/three/stage";
import { NextButton, SkipButton } from "@/components/ui/Buttons";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { Lightbox } from "@/components/year/Lightbox";
import { buildYearTimeline } from "@/components/year/yearTimeline";
import { STORY } from "@/config/story";
import { useWebGL } from "@/hooks/useWebGL";
import { getMemory, type YearMemory } from "@/lib/memories";
import PlaceholderScene from "./PlaceholderScene";
import type { SceneProps } from "./types";
import styles from "@/components/year/Year.module.css";

const LakeStage3D = dynamic(() => import("@/components/three/lake/LakeStage3D"), { ssr: false });

/** Spreads the middle dialogue lines (all but the first and last) evenly among the photos. */
function linesBeforePhotos(lineCount: number, photoCount: number) {
  const out = Array.from({ length: photoCount }, () => -1);
  const middle = lineCount - 2;
  for (let k = 0; k < middle; k++) {
    const at = Math.round(((k + 1) * photoCount) / (middle + 1));
    if (at > 0 && at < photoCount) out[at] = k + 1;
  }
  return out;
}

/** One year of memories on the moonlit lake. */
export default function Year(props: SceneProps) {
  const webgl = useWebGL();
  const memory = useMemo(() => getMemory(props.sceneId, props.guest.album), [props.sceneId, props.guest.album]);
  if (!memory) return <PlaceholderScene {...props} />;
  return webgl ? <Lake3D {...props} memory={memory} /> : <FlatYear {...props} memory={memory} />;
}

function Lake3D({ memory, onNext, reducedMotion }: SceneProps & { memory: YearMemory }) {
  const [lake] = useState(() => createLakeState(memory.photos.length, reducedMotion));
  const anchorRef = useRef<HTMLDivElement>(null);
  const dom = useMemo<StageDom>(() => ({ bubbleAnchor: anchorRef }), []);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const timerRef = useRef<gsap.core.Tween | null>(null);
  const holdLeft = useRef(0);
  const onNextRef = useRef(onNext);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  /** Holds: the timeline waits, then continues by itself (or earlier with "Tiếp →"). */
  const startHold = useCallback((seconds: number) => {
    const tl = tlRef.current;
    if (!tl) return;
    tl.timeScale(1);
    holdLeft.current = seconds;
    timerRef.current?.kill();
    timerRef.current = gsap.to(holdLeft, { current: 0, duration: seconds, ease: "none", onComplete: () => tl.play() });
  }, []);

  useEffect(() => {
    if (!ready || tlRef.current) return;
    const bubbles = Array.from(anchorRef.current?.querySelectorAll<HTMLElement>("[data-line]") ?? []);
    const tl = buildYearTimeline({
      lake,
      dom: { title: titleRef.current, bubbles, next: nextRef.current, fade: fadeRef.current },
      lineBeforePhoto: linesBeforePhotos(memory.dialogue.length, memory.photos.length),
      reduced: reducedMotion,
      aspect: window.innerWidth / window.innerHeight,
      onHold: startHold,
      onEnd: () => onNextRef.current(),
    });
    tlRef.current = tl;
    // Dev helper: ?t=20 or ?t=photo2 jumps there and freezes (screenshots).
    const t = new URLSearchParams(window.location.search).get("t");
    if (t !== null) {
      tl.seek(Number.isNaN(Number(t)) ? t : Number(t)).pause();
      Object.assign(window, { __yearTl: tl });
    } else tl.play();
  }, [ready, lake, memory, reducedMotion, startHold]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
      timerRef.current?.kill();
      document.body.style.cursor = "";
    },
    [],
  );

  /** "Tiếp →": skips the current wait, or fast-forwards to the next one. */
  const advance = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (tl.paused()) {
      timerRef.current?.kill();
      timerRef.current = null;
      tl.timeScale(1).play();
    } else tl.timeScale(3);
  }, []);

  /** "Bỏ qua": first to the end of the year (all photos on the water), then out of the scene. */
  const skip = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    timerRef.current?.kill();
    timerRef.current = null;
    if (tl.time() < tl.labels.closing) {
      tl.timeScale(1).seek("closing", true).play();
    } else onNextRef.current();
  }, []);

  /** The lightbox pauses everything until it closes. */
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
    <div className={styles.root}>
      <LakeStage3D lake={lake} photos={memory.photos} dom={dom} onReady={() => setReady(true)} onOpenPhoto={openPhoto} />

      <h2 ref={titleRef} className={styles.title}>
        {memory.title}
      </h2>

      {/* Moved every frame by the boat to sit above the narrator's head */}
      <div ref={anchorRef} className={styles.bubbleAnchor}>
        {memory.dialogue.map((line, i) => (
          <div key={i} className={styles.bubbleOffset}>
            <div data-line className={styles.bubble}>
              <SpeechBubble text={line} speaker={STORY.scene1.speaker} />
            </div>
          </div>
        ))}
      </div>

      {/* Keyboard / screen reader access to the floating photos */}
      <ul className={styles.srOnly}>
        {memory.photos.map((p, i) => (
          <li key={p.src}>
            <button type="button" onClick={() => openPhoto(i)}>
              {p.videoId ? STORY.ui.viewVideo : STORY.ui.viewPhoto}: {p.caption}
            </button>
          </li>
        ))}
      </ul>

      {/* Silver fog closing the scene */}
      <div ref={fadeRef} className={styles.fade} aria-hidden />

      <div className={`${styles.cover} ${ready ? styles.coverHidden : ""}`} aria-hidden />

      <NextButton ref={nextRef} className={`${styles.hidden} ${styles.nextCompact}`} onClick={advance}>
        {STORY.ui.next}
      </NextButton>
      <SkipButton onClick={skip}>{STORY.ui.skip}</SkipButton>
      <SoundToggle />

      {open !== null && <Lightbox photo={memory.photos[open]} onClose={closePhoto} />}
    </div>
  );
}

/** Without WebGL: the same words and photos on a calm page. */
export function FlatYear({ memory, onNext }: SceneProps & { memory: YearMemory }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <div className={styles.flat}>
      <h2 className={styles.flatTitle}>{memory.title}</h2>
      <p className={styles.flatLine}>{memory.dialogue[0]}</p>
      <div className={styles.flatGrid}>
        {memory.photos.map((p, i) => (
          <button key={p.src} type="button" className={styles.flatPhoto} onClick={() => setOpen(i)}>
            <span className={styles.flatImage}>
              <Image src={p.src} alt={p.caption} fill sizes="(min-width: 720px) 300px, 46vw" />
              {p.videoId && (
                <span className={styles.flatPlay} aria-hidden>
                  {"▶︎"}
                </span>
              )}
            </span>
            <span className={styles.flatCaption}>{p.caption}</span>
          </button>
        ))}
      </div>
      <p className={styles.flatLine}>{memory.dialogue[memory.dialogue.length - 1]}</p>
      <button type="button" className={styles.flatNext} onClick={onNext}>
        {STORY.ui.next}
      </button>
      <SoundToggle />
      {open !== null && <Lightbox photo={memory.photos[open]} onClose={close} />}
    </div>
  );
}
