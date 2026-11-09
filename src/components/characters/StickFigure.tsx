"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { THEME } from "@/config/theme";
import { IDLE_TIMING } from "@/config/timing";

gsap.registerPlugin(useGSAP);

export type FigureState = "idle" | "wave" | "walk" | "talk";

type Props = {
  state: FigureState;
  reducedMotion?: boolean;
  color?: string;
};

/**
 * Narrator stick figure. Origin is between the feet; the figure is ~106 units tall.
 * Place it in an SVG with <g transform="translate(x,y) scale(s)">.
 *
 * Parts carry data attributes so the parent scene can animate them:
 *   data-fig="stroke"  — drawn lines (for the draw-on effect; each has pathLength=1)
 *   data-fig="face"    — head fill, eyes + mouth (shown after the strokes are drawn)
 *   data-part="arm-r" | "arm-l" | "leg-l" | "leg-r" | "eyes" | "mouth" | "body"
 *
 * Each state runs its own loop:
 *   idle — blinks, bobs gently now and then
 *   wave — raises the right arm and waves
 *   walk — swings arms and legs in place (the scene moves the figure itself)
 *   talk — mouth opens and closes
 */
export function StickFigure({ state, reducedMotion = false, color = THEME.figure }: Props) {
  const rootRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef);
      const body = q('[data-part="body"]');
      const eyes = q('[data-part="eyes"]');
      const mouth = q('[data-part="mouth"]');
      const armR = q('[data-part="arm-r"]');
      const armL = q('[data-part="arm-l"]');
      const legL = q('[data-part="leg-l"]');
      const legR = q('[data-part="leg-r"]');

      // Blinking — in every state (subtle, kept even with reduced motion).
      // (A single repeating timeline so the GSAP context can clean it up on state change.)
      gsap
        .timeline({
          repeat: -1,
          repeatDelay: gsap.utils.random(IDLE_TIMING.blinkMin, IDLE_TIMING.blinkMax),
          delay: gsap.utils.random(0.8, IDLE_TIMING.blinkMin),
        })
        .to(eyes, { scaleY: 0.1, duration: 0.07, transformOrigin: "50% 50%", ease: "power1.in" })
        .to(eyes, { scaleY: 1, duration: 0.12, ease: "power1.out" });

      if (state === "wave") {
        gsap.set(armR, { transformOrigin: "0% 0%" });
        if (reducedMotion) {
          gsap.set(armR, { rotation: -100 });
        } else {
          // Raise the right arm up and to the right, then swing it back and forth
          gsap
            .timeline()
            .to(armR, { rotation: -118, duration: 0.3, ease: "back.out(2)" })
            .to(armR, { rotation: -78, duration: 0.28, ease: "sine.inOut", repeat: -1, yoyo: true });
        }
      }

      if (reducedMotion) return;

      if (state === "idle") {
        gsap
          .timeline({ repeat: -1, repeatDelay: IDLE_TIMING.bobEvery, delay: 1.2 })
          .to(body, { y: -3, duration: 0.3, ease: "sine.inOut" })
          .to(body, { y: 0, duration: 0.35, ease: "sine.inOut" });
      }

      if (state === "walk") {
        const step = 0.36;
        gsap.set(legL, { transformOrigin: "100% 0%" });
        gsap.set(legR, { transformOrigin: "0% 0%" });
        gsap.set(armL, { transformOrigin: "100% 0%" });
        gsap.set(armR, { transformOrigin: "0% 0%" });
        const swing = { duration: step, ease: "sine.inOut", repeat: -1, yoyo: true } as const;
        gsap.fromTo(legL, { rotation: -22 }, { rotation: 22, ...swing });
        gsap.fromTo(legR, { rotation: 22 }, { rotation: -22, ...swing });
        gsap.fromTo(armL, { rotation: 18 }, { rotation: -18, ...swing });
        gsap.fromTo(armR, { rotation: -18 }, { rotation: 18, ...swing });
        gsap.to(body, { y: -2.5, duration: step / 2, ease: "sine.inOut", repeat: -1, yoyo: true });
      }

      if (state === "talk") {
        gsap.to(mouth, {
          scaleY: 2.2,
          transformOrigin: "50% 0%",
          duration: 0.12,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
    },
    { scope: rootRef, dependencies: [state, reducedMotion], revertOnUpdate: true },
  );

  const stroke = {
    stroke: color,
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
    pathLength: 1,
    "data-fig": "stroke",
  };

  return (
    <g ref={rootRef} data-fig="root">
      <g data-part="body">
        {/* Torso + legs */}
        <path {...stroke} d="M0 -78 L0 -36" />
        <path {...stroke} data-part="leg-l" d="M0 -36 L-14 0" />
        <path {...stroke} data-part="leg-r" d="M0 -36 L14 0" />
        {/* Arms */}
        <path {...stroke} data-part="arm-l" d="M0 -70 L-22 -46" />
        <path {...stroke} data-part="arm-r" d="M0 -70 L22 -46" />
        {/* Head (drawn as a path so the draw-on effect is consistent) */}
        <g data-fig="face">
          <circle cx="0" cy="-92" r="14" fill={THEME.bg} />
        </g>
        <path {...stroke} d="M0 -106 A14 14 0 1 1 0 -78 A14 14 0 1 1 0 -106" />
        <g data-fig="face">
          <g data-part="eyes" fill={color}>
            <circle cx="-5" cy="-94" r="1.9" />
            <circle cx="5" cy="-94" r="1.9" />
          </g>
          <path
            data-part="mouth"
            d="M-4.5 -87 Q0 -83.5 4.5 -87"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </g>
    </g>
  );
}
