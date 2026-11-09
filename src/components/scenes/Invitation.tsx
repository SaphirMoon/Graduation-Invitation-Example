"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import type { SplitText } from "gsap/SplitText";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EnvelopeBack,
  EnvelopeFlap,
  EnvelopePocket,
  GradCap,
  PinIcon,
  RouteIcon,
  SapphireSeal,
  Shard,
  SHARD_SHAPES,
} from "@/components/invitation/Art";
import { HologramPhoto, type PortraitMode } from "@/components/invitation/HologramPhoto";
import { buildIntro, buildOpen, floatTween, type Beam } from "@/components/invitation/inviteTimeline";
import { createStageState } from "@/components/three/stage";
import { SkipButton } from "@/components/ui/Buttons";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { INVITATION } from "@/config/invitation";
import { STORY } from "@/config/story";
import { THEME } from "@/config/theme";
import { useWebGL } from "@/hooks/useWebGL";
import { sfx } from "@/lib/audio/sfx";
import { requestDeviceTilt } from "@/lib/deviceTilt";
import { fill } from "@/lib/format";
import { displayDate, downloadIcs } from "@/lib/ics";
import type { SceneProps } from "./types";
import styles from "./Invitation.module.css";

const InviteStage3D = dynamic(() => import("@/components/three/InviteStage3D"), { ssr: false });

/** Vertical position of the envelope's center (matches .envelopeWrap top) */
const ENVELOPE_Y = 0.52;
/** Horizontal start positions of the finale caps (fraction of the width): along the edges, never over the text */
const CAPS = [0.03, 0.97, 0.07, 0.93];
/** A name longer than this (in characters) uses the smaller size, to stay on one line */
const LONG_NAME = 13;

const all = <T extends Element>(root: Element | null, sel: string) =>
  Array.from(root?.querySelectorAll<T & HTMLElement>(sel) ?? []);

/** Final scene: the sealed envelope in the moonbeam, opened into the invitation card. */
export default function Invitation({ guest, reducedMotion }: SceneProps) {
  const webgl = useWebGL();
  const [state] = useState(() => {
    const s = createStageState();
    // The prologue's end state: sapphire moon, blue fog, no crystal / curtain / cone.
    Object.assign(s, { camT: 1, moonBlue: 1, moonGlow: 1, fogBlue: 1, coneBlue: 1, crystalOpacity: 0, curtainAlpha: 0, idle: 1 });
    return s;
  });

  const [ready, setReady] = useState(!webgl);
  const [phase, setPhase] = useState<"closed" | "opening" | "done">("closed");
  const [toast, setToast] = useState("");
  const [portrait, setPortrait] = useState<PortraitMode>("wait");
  const [moreBelow, setMoreBelow] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const beamLayerRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<SVGSVGElement>(null);
  const fallbackMoonRef = useRef<HTMLSpanElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const glossRef = useRef<HTMLSpanElement>(null);
  const capsRef = useRef<HTMLDivElement>(null);

  const beam = useRef<Beam>({ grow: 0 });
  const moon = useRef({ x: -1, y: -1 });
  const introRef = useRef<gsap.core.Timeline | null>(null);
  const openRef = useRef<gsap.core.Timeline | null>(null);
  const floatRef = useRef<gsap.core.Tween | null>(null);
  const splitsRef = useRef<SplitText[]>([]);
  const finishedRef = useRef(false);

  const guestLine = fill(INVITATION.guestLine, guest);
  const wish = fill(INVITATION.wish, guest);
  const e = INVITATION.event;

  const onMoon = useCallback((x: number, y: number) => {
    moon.current.x = x;
    moon.current.y = y;
  }, []);

  // Hang the HTML light beam from the moon toward the envelope, every frame.
  useEffect(() => {
    const tick = () => {
      const el = beamRef.current;
      if (!el) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!webgl) {
        const ms = w < h ? INVITATION.moonScreen.portrait : INVITATION.moonScreen.landscape;
        moon.current.x = ((ms.x + 1) / 2) * w;
        moon.current.y = ((1 - ms.y) / 2) * h;
        if (fallbackMoonRef.current)
          fallbackMoonRef.current.style.transform = `translate(${moon.current.x}px, ${moon.current.y}px)`;
      }
      if (moon.current.x < 0) return;
      const { x, y } = moon.current;
      const dx = w / 2 - x;
      const dy = h * ENVELOPE_Y - y;
      const len = Math.hypot(dx, dy) * 1.3;
      el.style.transform = `translate(${x - 150}px, ${y}px) rotate(${-Math.atan2(dx, dy)}rad) scaleY(${(len / 1000) * beam.current.grow})`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [webgl]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("done");
    // Give the text back its natural layout (lines re-flow on resize).
    splitsRef.current.forEach((s) => s.revert());
    splitsRef.current = [];
  }, []);

  /** Builds the opening timeline (after fonts are ready, so line splits are correct). */
  const open = useCallback(
    async (seek?: number | "end") => {
      if (openRef.current) return;
      introRef.current?.progress(1);
      floatRef.current?.kill();
      setPhase("opening");
      await document.fonts.ready;
      if (openRef.current) return;
      const root = rootRef.current;
      const env = envRef.current;
      if (!root || !env || !cardRef.current) return;
      // The card's shape depends on this guest's words. Measured before the opening reads its size.
      const card = cardRef.current;
      card.parentElement?.style.setProperty("--card-ratio", (card.offsetHeight / card.offsetWidth + 0.01).toFixed(3));
      const { tl, splits } = buildOpen(
        {
          beamLayer: beamLayerRef.current!,
          envelope: env,
          body: all(env, "[data-body]"),
          flap: flapRef.current!,
          seal: sealRef.current!,
          ring: ringRef.current!,
          shards: all(env, "[data-shard]"),
          mini: miniRef.current!,
          hint: hintRef.current!,
          card: cardRef.current,
          heading: headingRef.current!,
          lines: all(cardRef.current, "[data-line]"),
          rule: ruleRef.current!,
          photo: photoRef.current!,
          actions: all(root, "[data-action]"),
          caps: all(capsRef.current, "[data-cap]"),
        },
        state,
        reducedMotion,
        (cue) => sfx.play(cue),
        finish,
        () => setPortrait((m) => (m === "wait" ? "play" : m)),
      );
      splitsRef.current = splits;
      openRef.current = tl;
      if (seek === "end") {
        tl.progress(1, true);
        finish();
        setPortrait("end");
      } else if (seek !== undefined) tl.seek(seek).pause();
      else tl.play();
    },
    [state, reducedMotion, finish],
  );

  // Intro once the background is ready (or immediately without WebGL).
  useEffect(() => {
    if (!ready || introRef.current) return;
    const intro = buildIntro(
      { beam: beam.current, beamLayer: beamLayerRef.current!, envelope: envRef.current!, hint: hintRef.current! },
      reducedMotion,
    );
    introRef.current = intro;
    intro.eventCallback("onComplete", () => {
      if (!reducedMotion && !openRef.current && envRef.current) floatRef.current = floatTween(envRef.current);
    });
    // Dev helper: ?t=3 → envelope opened and frozen 3 s into the opening; ?t=end → the finished card.
    const t = new URLSearchParams(window.location.search).get("t");
    if (t !== null && !Number.isNaN(Number(t))) {
      intro.progress(1);
      queueMicrotask(() => void open(Number(t)));
    } else if (t === "end") {
      intro.progress(1);
      queueMicrotask(() => void open("end"));
    } else intro.play();
  }, [ready, reducedMotion, open]);

  useEffect(
    () => () => {
      introRef.current?.kill();
      openRef.current?.kill();
      floatRef.current?.kill();
      splitsRef.current.forEach((s) => s.revert());
      gsap.killTweensOf(state);
    },
    [state],
  );

  const skip = useCallback(() => {
    setPortrait("end");
    if (openRef.current) {
      openRef.current.progress(1, true);
      finish();
    } else void open("end");
  }, [open, finish]);

  // Once the card is written: is anything (the buttons) still below the fold?
  useEffect(() => {
    const scroller = scrollRef.current;
    if (portrait === "wait" || !scroller) return;
    const check = () => setMoreBelow(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 16);
    const size = new ResizeObserver(check);
    size.observe(scroller);
    scroller.addEventListener("scroll", check, { passive: true });
    return () => {
      size.disconnect();
      scroller.removeEventListener("scroll", check);
    };
  }, [portrait]);

  const scrollDown = useCallback(() => {
    const scroller = scrollRef.current;
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  const addToCalendar = useCallback(() => {
    if (downloadIcs()) return;
    setToast(INVITATION.ui.dateSoon);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      {webgl ? (
        <InviteStage3D state={state} reduced={reducedMotion} onReady={() => setReady(true)} onMoon={onMoon} />
      ) : (
        <div className={styles.skyFallback} aria-hidden>
          <span ref={fallbackMoonRef} className={styles.fallbackMoon} />
        </div>
      )}

      {/* Light beam from the moon (moved every frame by the ticker above) */}
      <div ref={beamLayerRef} className={styles.beamLayer} aria-hidden>
        <svg ref={beamRef} className={styles.beam} viewBox="0 0 300 1000" preserveAspectRatio="none">
          <defs>
            <linearGradient id="beam-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={THEME.sapphireGlow} stopOpacity="0" />
              <stop offset="0.07" stopColor={THEME.sapphireGlow} stopOpacity="0.6" />
              <stop offset="0.55" stopColor={THEME.sapphireBright} stopOpacity="0.3" />
              <stop offset="1" stopColor={THEME.sapphireBright} stopOpacity="0" />
            </linearGradient>
            <filter id="beam-blur" x="-20%" y="-5%" width="140%" height="110%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <polygon points="128,0 172,0 290,1000 10,1000" fill="url(#beam-fill)" filter="url(#beam-blur)" />
          <polygon points="143,0 157,0 205,1000 95,1000" fill="url(#beam-fill)" opacity="0.7" filter="url(#beam-blur)" />
        </svg>
      </div>

      {/* Card + actions */}
      <div ref={scrollRef} className={styles.scroll}>
        <div className={styles.stack}>
          <article ref={cardRef} className={styles.card} aria-label={INVITATION.heading}>
            <span ref={shadowRef} className={styles.tiltShadow} aria-hidden />
            <span className={styles.glossClip} aria-hidden>
              <span ref={glossRef} className={styles.gloss} />
            </span>
            <div className={styles.inner}>
              <p ref={headingRef} className={styles.heading}>
                <span className={styles.mark} aria-hidden />
                {INVITATION.heading}
              </p>
              <p className={styles.greet} data-line>
                {INVITATION.greeting}
              </p>
              <h1 className={`${styles.guest} ${guestLine.length > LONG_NAME ? styles.guestLong : ""}`} data-line data-split>
                {guestLine}
              </h1>
              <p className={styles.wish} data-line data-split>
                {wish}
              </p>
              <div className={styles.bottom}>
                <div className={styles.left}>
                  <span ref={ruleRef} className={styles.rule} aria-hidden />
                  <ul className={styles.info}>
                    <li data-line data-info>
                      <ClockIcon className={styles.icon} />
                      <span>
                        <span className={styles.infoMain}>
                          {e.start} – {e.end}
                        </span>
                        <span className={styles.infoSub}>{displayDate()}</span>
                      </span>
                    </li>
                    <li data-line data-info>
                      <PinIcon className={styles.icon} />
                      <span>
                        <span className={styles.infoMain}>{e.place}</span>
                        <span className={styles.infoSub}>{e.placeDetail}</span>
                      </span>
                    </li>
                  </ul>
                  <p className={styles.signoff} data-line>
                    {INVITATION.signOff}
                  </p>
                  <p className={styles.signature} data-line>
                    {INVITATION.signature}
                  </p>
                </div>
                <div ref={photoRef} className={styles.photo}>
                  <HologramPhoto cardRef={cardRef} shadowRef={shadowRef} glossRef={glossRef} mode={portrait} reducedMotion={reducedMotion} />
                </div>
              </div>
            </div>
          </article>

          <div className={styles.actions}>
            <a
              data-action
              className={`${styles.btn} ${styles.primary}`}
              href={e.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <RouteIcon />
              {INVITATION.ui.map}
            </a>
            <button data-action type="button" className={`${styles.btn} ${styles.ghost}`} onClick={addToCalendar}>
              <CalendarIcon />
              {INVITATION.ui.calendar}
            </button>
            {INVITATION.rsvp.enabled && INVITATION.rsvp.url && (
              <a
                data-action
                className={`${styles.btn} ${styles.ghost} ${styles.wide}`}
                href={INVITATION.rsvp.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CheckIcon />
                {INVITATION.ui.rsvp}
              </a>
            )}
          </div>
          <p className={styles.toast} role="status" aria-live="polite">
            {toast}
          </p>
        </div>
      </div>

      {/* Envelope (on top of the card area until it opens) */}
      <div className={styles.envelopeWrap} aria-hidden={phase === "done"}>
        <div ref={envRef} className={styles.envelope}>
          <div className={styles.envBack} data-body>
            <EnvelopeBack />
          </div>
          <div ref={miniRef} className={styles.mini} aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.envPocket} data-body>
            <EnvelopePocket />
          </div>
          <div ref={flapRef} className={styles.flap} data-body>
            <EnvelopeFlap />
          </div>
          <div className={styles.sealWrap}>
            <span ref={ringRef} className={styles.ring} />
            <div ref={sealRef} className={styles.seal}>
              {phase === "closed" && <span className={styles.sealGlow} />}
              <SapphireSeal />
            </div>
            {SHARD_SHAPES.map((p, i) => (
              <span key={i} className={styles.shard} data-shard>
                <Shard points={p} />
              </span>
            ))}
          </div>
        </div>
        <p ref={hintRef} className={styles.hint}>
          <span className={styles.ornament} aria-hidden />
          <span className={styles.hintText}>{INVITATION.ui.tapHint}</span>
          <span className={styles.ornament} aria-hidden />
        </p>
      </div>

      {phase === "closed" && (
        <button
          type="button"
          className={styles.tapArea}
          disabled={!ready}
          aria-label={INVITATION.ui.tapHint}
          onClick={() => {
            sfx.unlock();
            requestDeviceTilt();
            void open();
          }}
        />
      )}

      {moreBelow && (
        <button type="button" className={styles.scrollHint} onClick={scrollDown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v13M6 12.5 12 18.5l6-6" />
          </svg>
          {INVITATION.ui.scrollHint}
        </button>
      )}

      <div ref={capsRef} className={styles.caps} aria-hidden>
        {CAPS.map((x, i) => (
          <span key={i} className={styles.cap} style={{ left: `calc(${x * 100}% - 20px)` }} data-cap>
            <GradCap />
          </span>
        ))}
      </div>

      <div className={`${styles.cover} ${ready ? styles.coverHidden : ""}`} aria-hidden />
      {phase !== "done" && <SkipButton onClick={skip}>{STORY.ui.skip}</SkipButton>}
      <SoundToggle />
    </div>
  );
}
