"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { StickFigure, type FigureState } from "@/components/characters/StickFigure";
import { SpeechBubble } from "@/components/characters/SpeechBubble";
import { Curtain } from "@/components/svg/Curtain";
import {
  BeamBlue,
  BeamWhite,
  Crystal,
  CRYSTAL_Y,
  GROUND_Y,
  HillBack,
  HillFront,
  ImpactRing,
  MOON,
  Moon,
  Pools,
  Scene1Defs,
  SHARDS,
  Shards,
  StarField,
  VIEWBOX,
} from "@/components/svg/scene1Art";
import { NextButton, SkipButton } from "@/components/ui/Buttons";
import { STORY } from "@/config/story";
import { IDLE_TIMING, SCENE1_REDUCED_TOTAL, SCENE1_TIMING, type Scene1Phase } from "@/config/timing";
import { pick } from "@/lib/format";
import type { SceneProps } from "./types";
import styles from "./scenes.module.css";

gsap.registerPlugin(useGSAP);

/** Point (in SVG coordinates) the bottom of the speech bubble anchors to — just above the figure's head. */
const BUBBLE_ANCHOR = { x: 200, y: 512 };
const FIGURE_SCALE = 1.05;

/** Selector by data-a (CSS Modules hash class names, so we target data attributes). */
const $ = (key: string) => `[data-a="${key}"]`;

export default function Scene1Moon({ guest, known, onNext, reducedMotion }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [figureState, setFigureState] = useState<FigureState>("idle");
  const [done, setDone] = useState(false);

  const greeting = pick(STORY.scene1.greetingPersonal, STORY.scene1.greetingGeneric, guest, known);

  /* Position the bubble above the figure's head (the SVG uses "slice", so SVG coords must be mapped to screen). */
  useEffect(() => {
    const place = () => {
      const svg = svgRef.current;
      const anchor = anchorRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !anchor || !ctm) return;
      const p = new DOMPoint(BUBBLE_ANCHOR.x, BUBBLE_ANCHOR.y).matrixTransform(ctm);
      const box = rootRef.current!.getBoundingClientRect();
      anchor.style.left = `${p.x - box.left}px`;
      anchor.style.top = `${p.y - box.top}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  useGSAP(
    (_ctx, contextSafe) => {
      const safe = contextSafe!;
      let finished = false;
      let twinkling = false;

      /* ---------- Idle loops (infinite, so they live OUTSIDE the master timeline) ---------- */

      const startTwinkle = safe(() => {
        if (twinkling || reducedMotion) return;
        twinkling = true;
        gsap.utils.toArray<SVGElement>($("star")).forEach((star) => {
          gsap.to(star, {
            opacity: gsap.utils.random(0.15, 0.55),
            duration: gsap.utils.random(0.7, 1.8),
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: gsap.utils.random(0, 3),
            repeatDelay: gsap.utils.random(0.3, 2.5),
          });
        });
        gsap.utils.toArray<SVGElement>($("sparkle")).forEach((s) => {
          gsap.fromTo(
            s,
            { scale: 0.4, rotation: 0, transformOrigin: "50% 50%" },
            {
              scale: 1.15,
              rotation: 45,
              duration: gsap.utils.random(1.2, 2),
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
              delay: gsap.utils.random(0, 2),
            },
          );
        });
      });

      const startIdle = safe(() => {
        startTwinkle();
        if (reducedMotion) return;
        // Blue moon "breathing": glow swells and fades
        gsap.fromTo(
          $("glow-blue"),
          { scale: 1, opacity: 1 },
          {
            scale: 1.09,
            opacity: 0.72,
            transformOrigin: "50% 50%",
            duration: IDLE_TIMING.moonBreath,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
        );
        // Blue beam flickers very slightly
        gsap.to($("beam-blue"), {
          opacity: 0.75,
          duration: IDLE_TIMING.moonBreath,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });

      const finish = safe(() => {
        if (finished) return;
        finished = true;
        setDone(true);
        setFigureState("wave");
        gsap.delayedCall(IDLE_TIMING.waveHold, () => setFigureState("idle"));
        startIdle();
      });

      /* ---------- Initial state ---------- */

      gsap.set([$("sky"), $("star-layer"), $("hills")], { opacity: 0 });
      gsap.set($("moon"), { opacity: 0, scale: 0.85, transformOrigin: "50% 50%" });
      gsap.set($("glow-white"), { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" });
      gsap.set([$("beam-white"), $("beam-blue")], { scaleY: 0, transformOrigin: "50% 0%" });
      gsap.set([$("pool-white"), $("pool-blue")], { opacity: 0, scale: 0.3, transformOrigin: "50% 50%" });
      gsap.set($("crystal-fly"), { opacity: 0, transformOrigin: "50% 50%" });
      gsap.set($("crystal-glow"), { opacity: 0, transformOrigin: "50% 50%" });
      gsap.set($("crystal-sparkle"), { opacity: 0, scale: 0, transformOrigin: "50% 50%" });
      gsap.set($("figure"), { opacity: 0 });
      gsap.set('[data-fig="stroke"]', { strokeDasharray: "1 1", strokeDashoffset: 1 });
      gsap.set('[data-fig="face"]', { opacity: 0 });
      gsap.set($("bubble"), { autoAlpha: 0, scale: 0.85 });
      gsap.set("[data-char]", { opacity: 0 });
      gsap.set($("next"), { autoAlpha: 0, y: 10 });

      const tl = gsap.timeline({ onComplete: finish });

      /* ---------- Reduced-motion version ---------- */
      if (reducedMotion) {
        const u = SCENE1_REDUCED_TOTAL / 2.4;
        tl.to($("curtain"), { opacity: 0, duration: 0.6 * u }, 0)
          .to([$("sky"), $("star-layer"), $("hills")], { opacity: 1, duration: 0.6 * u }, 0.2 * u)
          .set($("moon-white"), { opacity: 0 }, 0)
          .set([$("moon-blue"), $("glow-blue")], { opacity: 1 }, 0)
          .to($("moon"), { opacity: 1, scale: 1, duration: 0.6 * u }, 0.4 * u)
          .set($("beam-blue"), { scaleY: 1, opacity: 0 }, 0)
          .to($("beam-blue"), { opacity: 1, duration: 0.5 * u }, 1 * u)
          .to($("pool-blue"), { opacity: 1, scale: 1, duration: 0.5 * u }, 1 * u)
          .set('[data-fig="stroke"]', { strokeDashoffset: 0 }, 0)
          .set('[data-fig="face"]', { opacity: 1 }, 0)
          .to($("figure"), { opacity: 1, duration: 0.5 * u }, 1.1 * u)
          .set("[data-char]", { opacity: 1 }, 0)
          .to($("bubble"), { autoAlpha: 1, scale: 1, duration: 0.3 * u }, 1.6 * u)
          .to($("next"), { autoAlpha: 1, y: 0, duration: 0.3 * u }, 2.1 * u);
        skipRef.current = safe(() => {
          tl.progress(1);
          finish();
        });
        return;
      }

      /* ---------- Full version: one timeline, one label per phase ---------- */
      const T = SCENE1_TIMING;
      let cursor = 0;
      (Object.keys(T) as Scene1Phase[]).forEach((phase) => {
        tl.addLabel(phase, cursor);
        cursor += T[phase];
      });
      /** Position inside a phase: at("crystal", 0.5) = halfway through the crystal phase */
      const at = (phase: Scene1Phase, frac = 0) => `${phase}+=${T[phase] * frac}`;
      const dur = (phase: Scene1Phase, frac: number) => T[phase] * frac;

      // 1) Curtains part — inner strips lead, the wavy edge ripples vertically
      tl.to(
        $("strip-l"),
        {
          xPercent: (i: number) => -(i + 1) * 100 - 25,
          duration: dur("curtain", 0.8),
          ease: "power2.inOut",
          stagger: { each: dur("curtain", 0.035), from: "end" },
        },
        at("curtain"),
      )
        .to(
          $("strip-r"),
          {
            xPercent: (i: number) => (i + 1) * 100 + 25,
            duration: dur("curtain", 0.8),
            ease: "power2.inOut",
            stagger: { each: dur("curtain", 0.035), from: "end" },
          },
          at("curtain"),
        )
        .to(
          $("strip-l"),
          { skewX: -5, duration: dur("curtain", 0.35), ease: "sine.inOut", yoyo: true, repeat: 1 },
          at("curtain", 0.05),
        )
        .to(
          $("strip-r"),
          { skewX: 5, duration: dur("curtain", 0.35), ease: "sine.inOut", yoyo: true, repeat: 1 },
          at("curtain", 0.05),
        )
        .fromTo(
          $("curtain-edge"),
          { yPercent: 0 },
          { yPercent: -25, duration: dur("curtain", 1), ease: "none" },
          at("curtain"),
        )
        .to($("valance"), { yPercent: -130, duration: dur("curtain", 0.45), ease: "power2.in" }, at("curtain", 0.55))
        .set($("curtain"), { autoAlpha: 0 }, at("sky"));

      // 2) Night sky, stars, white moon with glow
      tl.to($("sky"), { opacity: 1, duration: dur("sky", 0.8), ease: "power1.out" }, at("curtain", 0.25))
        .to($("hills"), { opacity: 1, duration: dur("sky", 0.6) }, at("curtain", 0.35))
        .to(
          $("star-layer"),
          { opacity: 1, duration: dur("sky", 0.55), stagger: dur("sky", 0.18), ease: "power1.out" },
          at("sky"),
        )
        .call(startTwinkle, [], at("sky", 0.4))
        .to($("moon"), { opacity: 1, scale: 1, duration: dur("sky", 0.8), ease: "power2.out" }, at("sky", 0.25))
        .to($("glow-white"), { opacity: 1, scale: 1, duration: dur("sky", 0.9), ease: "power2.out" }, at("sky", 0.3))
        .to($("crystal-fly"), { opacity: 0.45, duration: dur("sky", 0.5) }, at("sky", 0.5));

      // 3) Cone of light from the moon onto the crystal
      tl.to($("beam-white"), { scaleY: 1, duration: dur("beam", 0.55), ease: "power2.out" }, at("beam"))
        .to($("pool-white"), { opacity: 1, scale: 1, duration: dur("beam", 0.4), ease: "power2.out" }, at("beam", 0.4))
        .to($("crystal-fly"), { opacity: 1, duration: dur("beam", 0.3) }, at("beam", 0.45))
        .to($("crystal-glow"), { opacity: 0.55, duration: dur("beam", 0.4) }, at("beam", 0.5));

      // 4) Crystal flashes, shakes, then flies up to the moon (ease-in, slight spin)
      tl.to(
        $("crystal-glow"),
        { opacity: 1, scale: 1.8, duration: dur("crystal", 0.1), ease: "power2.out" },
        at("crystal"),
      )
        .to($("crystal-glow"), { scale: 1.15, opacity: 0.75, duration: dur("crystal", 0.14) }, at("crystal", 0.1))
        .to(
          $("crystal-sparkle"),
          { opacity: 1, scale: 1, rotation: 45, duration: dur("crystal", 0.08), ease: "power2.out" },
          at("crystal"),
        )
        .to(
          $("crystal-sparkle"),
          { opacity: 0, scale: 0, rotation: 90, duration: dur("crystal", 0.12), ease: "power2.in" },
          at("crystal", 0.08),
        )
        .to(
          $("crystal-shape"),
          { x: 2.2, duration: dur("crystal", 0.028), ease: "sine.inOut", repeat: 11, yoyo: true },
          at("crystal", 0.2),
        )
        .set($("crystal-shape"), { x: 0 }, at("crystal", 0.54))
        .to([$("beam-white"), $("pool-white")], { opacity: 0, duration: dur("crystal", 0.3) }, at("crystal", 0.5))
        .to(
          $("crystal-fly"),
          {
            y: MOON.y - CRYSTAL_Y,
            rotation: 40,
            scale: 0.85,
            duration: dur("crystal", 0.46),
            ease: "power3.in",
          },
          at("crystal", 0.54),
        );

      // 5) Impact: shatter, shards get pulled in, moon turns sapphire and pulses once
      tl.set($("crystal-fly"), { opacity: 0 }, at("shatter"))
        .set($("shard"), { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }, at("shatter"))
        .to(
          $("shard"),
          {
            x: (i: number) => SHARDS[i].dx,
            y: (i: number) => SHARDS[i].dy,
            rotation: (i: number) => SHARDS[i].rot,
            duration: dur("shatter", 0.3),
            ease: "power2.out",
          },
          at("shatter"),
        )
        .to(
          $("shard"),
          {
            x: 0,
            y: 0,
            scale: 0,
            opacity: 0,
            duration: dur("shatter", 0.3),
            ease: "power2.in",
            stagger: { each: dur("shatter", 0.012), from: "random" },
          },
          at("shatter", 0.32),
        )
        .fromTo(
          $("ring"),
          { opacity: 0.9, scale: 0.7, transformOrigin: "50% 50%" },
          { opacity: 0, scale: 2.1, duration: dur("shatter", 0.45), ease: "power2.out", immediateRender: false },
          at("shatter"),
        )
        .to($("moon-blue"), { opacity: 1, duration: dur("shatter", 0.4), ease: "power1.inOut" }, at("shatter", 0.45))
        .to($("moon-white"), { opacity: 0, duration: dur("shatter", 0.4) }, at("shatter", 0.5))
        .to($("glow-white"), { opacity: 0, duration: dur("shatter", 0.4) }, at("shatter", 0.45))
        .to($("glow-blue"), { opacity: 1, duration: dur("shatter", 0.4) }, at("shatter", 0.45))
        .to(
          $("moon"),
          { scale: 1.12, duration: dur("shatter", 0.14), ease: "power2.out", yoyo: true, repeat: 1 },
          at("shatter", 0.62),
        );

      // 6) Blue moon casts a beam; the figure appears (fade + draw-on)
      tl.to($("beam-blue"), { scaleY: 1, duration: dur("reveal", 0.4), ease: "power2.out" }, at("reveal"))
        .to($("pool-blue"), { opacity: 1, scale: 1, duration: dur("reveal", 0.35), ease: "power2.out" }, at("reveal", 0.3))
        .to($("figure"), { opacity: 1, duration: dur("reveal", 0.3) }, at("reveal", 0.35))
        .to(
          '[data-fig="stroke"]',
          { strokeDashoffset: 0, duration: dur("reveal", 0.4), ease: "power1.inOut", stagger: dur("reveal", 0.05) },
          at("reveal", 0.35),
        )
        .to('[data-fig="face"]', { opacity: 1, duration: dur("reveal", 0.15) }, at("reveal", 0.85));

      // 7) Wave, typewriter speech bubble, Next button
      tl.call(() => setFigureState("wave"), [], at("greet"))
        .to($("bubble"), { autoAlpha: 1, scale: 1, duration: dur("greet", 0.15), ease: "back.out(2)" }, at("greet", 0.05))
        .to(
          "[data-char]",
          { opacity: 1, duration: 0.01, ease: "none", stagger: { amount: dur("greet", 0.55) } },
          at("greet", 0.18),
        )
        .to($("next"), { autoAlpha: 1, y: 0, duration: dur("greet", 0.2), ease: "power2.out" }, at("greet", 0.8));

      skipRef.current = safe(() => {
        tl.progress(1);
        finish();
      });
    },
    { scope: rootRef, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className={styles.scene}>
      <div className={styles.sky} data-a="sky" />

      <svg className={styles.layer} viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" aria-hidden>
        <StarField />
      </svg>

      <svg
        ref={svgRef}
        className={styles.layer}
        viewBox={VIEWBOX}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Trăng sáng trên đồi, pha lê sapphire bay lên trăng"
      >
        <Scene1Defs />
        <HillBack />
        <BeamWhite />
        <BeamBlue />
        <Moon />
        <ImpactRing />
        <Shards />
        <HillFront />
        <Pools />
        <Crystal />
        <g transform={`translate(200 ${GROUND_Y + 2}) scale(${FIGURE_SCALE})`}>
          <g data-a="figure">
            <StickFigure state={figureState} reducedMotion={reducedMotion} />
          </g>
        </g>
      </svg>

      <div ref={anchorRef} className={styles.bubbleAnchor}>
        <div className={styles.bubbleInner} data-a="bubble">
          <SpeechBubble text={greeting} />
        </div>
      </div>

      <Curtain />

      <NextButton data-a="next" className={styles.hidden} onClick={onNext}>
        {STORY.ui.next}
      </NextButton>

      {!done && <SkipButton onClick={() => skipRef.current()}>{STORY.ui.skip}</SkipButton>}
    </div>
  );
}
