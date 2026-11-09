"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { SpeechBubble } from "@/components/characters/SpeechBubble";
import { buildPrologueTimeline } from "@/components/three/prologueTimeline";
import { createStageState, type StageDom } from "@/components/three/stage";
import { NextButton, SkipButton } from "@/components/ui/Buttons";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { STORY } from "@/config/story";
import { IDLE_TIMING } from "@/config/timing";
import { useWebGL } from "@/hooks/useWebGL";
import { sfx } from "@/lib/audio/sfx";
import { requestDeviceTilt } from "@/lib/deviceTilt";
import { pick } from "@/lib/format";
import Scene0Curtain from "./Scene0Curtain";
import Scene1Moon from "./Scene1Moon";
import type { SceneProps } from "./types";
import styles from "./Prologue.module.css";

// three.js is only loaded on the client, and only for this scene.
const Stage3D = dynamic(() => import("@/components/three/Stage3D"), { ssr: false });


/** Scenes 0 + 1 as one continuous 3D shot (falls back to the flat SVG scenes without WebGL). */
export default function Prologue(props: SceneProps) {
  const webgl = useWebGL();
  return webgl ? <Prologue3D {...props} /> : <FlatPrologue {...props} />;
}

function FlatPrologue(props: SceneProps) {
  const [step, setStep] = useState(0);
  const open = () => {
    requestDeviceTilt();
    props.onOpened();
    setStep(1);
  };
  return step === 0 ? <Scene0Curtain {...props} onNext={open} /> : <Scene1Moon {...props} />;
}

function Prologue3D({ guest, known, entry, onNext, onOpened, reducedMotion }: SceneProps) {
  const [state] = useState(createStageState);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const dom = useMemo<StageDom>(() => ({ bubbleAnchor: anchorRef }), []);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const finishedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"closed" | "playing" | "done">("closed");

  const greeting = pick(STORY.scene1.greetingPersonal, STORY.scene1.greetingGeneric, guest, known);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("done");
    gsap.to(state, { idle: 1, duration: 1.2, ease: "sine.inOut" });
    gsap.to(state, { wave: 0, duration: 0.5, ease: "power2.inOut", delay: IDLE_TIMING.waveHold });
  }, [state]);

  const start = useCallback(
    (seekTo?: number) => {
      if (tlRef.current) return;
      const chars = Array.from(bubbleRef.current?.querySelectorAll("[data-char]") ?? []);
      const tl = buildPrologueTimeline(
        state,
        { bubble: bubbleRef.current, chars, next: nextRef.current, flash: flashRef.current },
        reducedMotion,
        finish,
        (cue) => sfx.play(cue),
      );
      tlRef.current = tl;
      setPhase("playing");
      if (seekTo !== undefined) tl.seek(seekTo).pause();
      else tl.play();
    },
    [state, reducedMotion, finish],
  );

  const skip = useCallback(() => {
    // suppressEvents = true: jump to the end without firing every queued sound cue at once.
    tlRef.current?.progress(1, true);
    finish();
  }, [finish]);

  // Dev helper: ?t=6 jumps to 6 s into the timeline and freezes there (used for screenshots).
  useEffect(() => {
    if (!ready) return;
    const t = new URLSearchParams(window.location.search).get("t");
    if (t !== null && !Number.isNaN(Number(t))) start(Number(t));
    else if (entry === "nav") start();
  }, [ready, start, entry]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
      gsap.killTweensOf(state);
    },
    [state],
  );

  return (
    <div className={styles.root}>
      <Stage3D state={state} dom={dom} onReady={() => setReady(true)} />

      {/* Moved every frame by StickFigure3D to sit above the figure's head */}
      <div ref={anchorRef} className={styles.bubbleAnchor}>
        <div className={styles.bubbleOffset}>
          <div ref={bubbleRef} className={styles.bubbleInner}>
            <SpeechBubble text={greeting} speaker={STORY.scene1.speaker} />
          </div>
        </div>
      </div>

      {/* White flash on impact (driven by the timeline) */}
      <div ref={flashRef} className={styles.flash} aria-hidden />

      {/* Velvet cover while three.js loads, so there is never a blank screen */}
      <div className={`${styles.cover} ${ready ? styles.coverHidden : ""}`} aria-hidden>
        <span className={styles.loader} />
      </div>

      {phase === "closed" && (
        <button
          type="button"
          className={styles.tapArea}
          onClick={() => {
            // Both may only be asked for inside a tap: sound, and on iOS the phone's tilt.
            sfx.unlock();
            requestDeviceTilt();
            onOpened();
            start();
          }}
          disabled={!ready}
          aria-label={STORY.scene0.tapHint}
        >
          <span className={`${styles.tapHint} ${ready ? styles.tapHintOn : ""}`}>
            <span className={styles.ornament} aria-hidden />
            {STORY.scene0.tapHint}
            <span className={styles.ornament} aria-hidden />
          </span>
        </button>
      )}

      <NextButton ref={nextRef} className={styles.hidden} onClick={onNext}>
        {STORY.ui.next}
      </NextButton>

      {phase === "playing" && <SkipButton onClick={skip}>{STORY.ui.skip}</SkipButton>}
      <SoundToggle />
    </div>
  );
}
