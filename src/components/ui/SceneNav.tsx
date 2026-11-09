"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SCENE_LINKS } from "@/config/scenes";
import styles from "./SceneNav.module.css";

const COMPACT_QUERY = "(max-width: 600px)";
const CELL = 30;
const ICON = 21;
const PADDING_FULL = 28;
const PADDING_COMPACT = 20;

function subscribeCompact(cb: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const noopSubscribe = () => () => {};

/** Refraction through an SVG filter only works in Chromium's backdrop-filter. */
function supportsRefraction() {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return Boolean(brands?.some((b) => b.brand === "Chromium")) && CSS.supports("backdrop-filter", "url(#a)");
}

function Glyph({ kind, text }: { kind: "moon" | "letter" | "number"; text?: string }) {
  if (kind === "number") return <span className={styles.number}>{text}</span>;
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      {kind === "moon" ? (
        <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3a5.6 5.6 0 1 0 6.6 6.6Z" />
      ) : (
        <>
          <rect x="2" y="3.5" width="12" height="9" rx="1.4" />
          <path d="m2.6 4.6 5.4 4.2 5.4-4.2" />
        </>
      )}
    </svg>
  );
}

/** The glass bar across the top: one stop per scene, with a lens that slides to the current one. */
export function SceneNav({ active, onSelect, reducedMotion }: { active: number; onSelect: (index: number) => void; reducedMotion: boolean }) {
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia(COMPACT_QUERY).matches, () => false);
  const refract = useSyncExternalStore(noopSubscribe, supportsRefraction, () => false);
  const [labels, setLabels] = useState<number[] | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Widths are worked out up front, so the lens and the items can spring in step.
  useEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive || !measureRef.current) return;
      setLabels(Array.from(measureRef.current.children).map((c) => Math.ceil((c as HTMLElement).getBoundingClientRect().width)));
    };
    void document.fonts.ready.then(measure);
    return () => {
      alive = false;
    };
  }, [compact]);

  // The lens stretches and settles as it arrives.
  const previous = useRef(active);
  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    if (!reducedMotion) lensRef.current?.animate([{ scale: "1 1" }, { scale: "1.14 0.88", offset: 0.35 }, { scale: "1 1" }], { duration: 520, easing: "ease-out" });
  }, [active, reducedMotion]);

  const widths = SCENE_LINKS.map((link, i) => {
    const label = labels?.[i] ?? 0;
    if (!compact) return label + PADDING_FULL;
    if (i !== active) return CELL;
    return label + PADDING_COMPACT + (link.glyph === "number" ? 0 : ICON);
  });
  const lensX = widths.slice(0, active).reduce((a, b) => a + b, 0);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    itemsRef.current[(i + step + SCENE_LINKS.length) % SCENE_LINKS.length]?.focus();
  };

  return (
    <nav className={styles.nav} aria-label="Các chặng" data-refract={refract} data-compact={compact}>
      <span className={styles.glass} aria-hidden />
      {labels && (
        <span ref={lensRef} className={styles.lens} style={{ transform: `translateX(${lensX}px)`, width: widths[active] }} aria-hidden>
          <span className={styles.lensFill} />
          <span className={styles.lensEdge} />
        </span>
      )}
      <div className={styles.items}>
        {SCENE_LINKS.map((link, i) => {
          const on = i === active;
          const showText = !compact || on;
          const showGlyph = compact && (!on || link.glyph !== "number");
          return (
            <button
              key={link.id}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              type="button"
              className={styles.item}
              style={labels ? { width: widths[i] } : undefined}
              aria-current={on ? "step" : undefined}
              aria-label={link.label}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className={styles.itemInner} aria-hidden>
                {showGlyph && <Glyph kind={link.glyph} text={link.short} />}
                {showText && <span className={styles.text}>{link.label}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div ref={measureRef} className={styles.measure} aria-hidden>
        {SCENE_LINKS.map((link) => (
          <span key={link.id} className={styles.text}>
            {link.label}
          </span>
        ))}
      </div>

      {refract && (
        <svg width="0" height="0" className={styles.defs} aria-hidden>
          <filter id="nav-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="4" />
            <feDisplacementMap in="SourceGraphic" scale="16" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
    </nav>
  );
}
