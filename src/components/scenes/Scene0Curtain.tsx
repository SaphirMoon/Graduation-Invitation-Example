"use client";

import { Curtain } from "@/components/svg/Curtain";
import { STORY } from "@/config/story";
import type { SceneProps } from "./types";
import styles from "./scenes.module.css";

/** Scene 0: closed curtain, tap to open. The curtain matches Scene 1's first frame, so the hand-off is seamless. */
export default function Scene0Curtain({ onNext }: SceneProps) {
  return (
    <div className={styles.scene}>
      <Curtain />
      <button type="button" className={styles.tapArea} onClick={onNext} aria-label={STORY.scene0.tapHint}>
        <span className={styles.tapHint}>
          <span className={styles.tapMoon} aria-hidden />
          {STORY.scene0.tapHint}
        </span>
      </button>
    </div>
  );
}
