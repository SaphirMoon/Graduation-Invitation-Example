"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { SCENES } from "@/components/scenes";
import type { SceneEntry } from "@/components/scenes/types";
import { SceneNav } from "@/components/ui/SceneNav";
import { SCENE_LINKS } from "@/config/scenes";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { sfx } from "@/lib/audio/sfx";
import type { Guest } from "@/lib/guests";
import styles from "./Story.module.css";

type Props = { guest: Guest; known: boolean };

type Current = { index: number; entry: SceneEntry; visit: number };

const noopSubscribe = () => () => {};

function indexFromHash() {
  const hash = window.location.hash.slice(1);
  return SCENES.findIndex((s) => SCENE_LINKS.find((l) => l.hash === hash)?.id === s.id);
}

/** The scene to open on: the address (#nam-3), or `?scene=invitation` for previewing one scene. */
function startFromUrl() {
  const fromHash = indexFromHash();
  if (fromHash >= 0) return fromHash;
  const id = new URLSearchParams(window.location.search).get("scene");
  return Math.max(0, SCENES.findIndex((s) => s.id === id));
}

const openedOnHash = () => indexFromHash() > 0;

/**
 * Scene manager. Each scene owns its timelines, sound and 3D objects, and releases them when it
 * unmounts (a lightbox or video goes with it), so changing the key is what ends the old scene:
 * two scenes' timelines can never overlap.
 *  - via "next": the scene's own hand-off, an immediate cut onto the matching first frame.
 *  - via "nav": any jump, under a short sweep of light. Further jumps wait until it has cleared.
 */
export function Story({ guest, known }: Props) {
  const startAt = useSyncExternalStore(noopSubscribe, startFromUrl, () => 0);
  const startedOnHash = useSyncExternalStore(noopSubscribe, openedOnHash, () => false);
  const [moved, setMoved] = useState<Current | null>(null);
  const [tapped, setTapped] = useState(false);
  const reducedMotion = useReducedMotion();

  const current: Current = moved ?? { index: startAt, entry: startedOnHash ? "nav" : "start", visit: 0 };
  const { index, entry, visit } = current;
  const { id, Component } = SCENES[index];

  const veilRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const moving = useRef<gsap.core.Timeline | null>(null);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const enter = useCallback((target: number, via: "next" | "nav") => {
    setMoved((m) => ({ index: target, entry: via, visit: (m?.visit ?? 0) + 1 }));
    // Once past the first scene the bar stays, even on the way back to it.
    setTapped(true);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${SCENE_LINKS[target].hash}`);
  }, []);

  const goTo = useCallback(
    (target: number, { via }: { via: "next" | "nav" }) => {
      if (moving.current) return;
      const to = ((target % SCENES.length) + SCENES.length) % SCENES.length;
      if (via === "next") {
        enter(to, "next");
        return;
      }
      if (to === indexRef.current) return;
      sfx.unlock();
      const veil = veilRef.current;
      const sweep = sweepRef.current;
      const tl = gsap.timeline({
        onComplete: () => {
          moving.current = null;
        },
      });
      moving.current = tl;
      if (veil) tl.fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 1, duration: reducedMotion ? 0.15 : 0.22, ease: "power1.in" }, 0);
      if (sweep && !reducedMotion) tl.fromTo(sweep, { xPercent: -100 }, { xPercent: 100, duration: 0.56, ease: "sine.inOut" }, 0);
      tl.call(() => enter(to, "nav"), undefined, reducedMotion ? 0.15 : 0.22);
      if (veil) tl.to(veil, { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, reducedMotion ? 0.2 : 0.26);
    },
    [enter, reducedMotion],
  );

  // Editing the address, or following a link to another stop on the same page.
  useEffect(() => {
    const onHash = () => {
      const to = indexFromHash();
      if (to >= 0) goTo(to, { via: "nav" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [goTo]);

  useEffect(() => () => void moving.current?.kill(), []);

  const next = useCallback(() => goTo(indexRef.current + 1, { via: "next" }), [goTo]);
  const onOpened = useCallback(() => setTapped(true), []);
  const onSelect = useCallback((i: number) => goTo(i, { via: "nav" }), [goTo]);

  // The bar appears with the first tap; opening straight on a later scene, there's no tap to wait for.
  const showNav = tapped || index > 0;

  return (
    <main className={styles.story}>
      <Component
        key={`${id}-${visit}`}
        sceneId={id}
        guest={guest}
        known={known}
        reducedMotion={reducedMotion}
        isLast={index === SCENES.length - 1}
        entry={entry}
        onNext={next}
        onOpened={onOpened}
      />
      {/* Hidden from the start, so a reload lands on the scene rather than on this veil */}
      <div ref={veilRef} className={styles.veil} aria-hidden>
        <div ref={sweepRef} className={styles.sweep} />
      </div>
      {showNav && <SceneNav active={index} onSelect={onSelect} reducedMotion={reducedMotion} />}
    </main>
  );
}
