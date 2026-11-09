"use client";

import { NextButton } from "@/components/ui/Buttons";
import { STORY } from "@/config/story";
import type { SceneProps } from "./types";
import styles from "./scenes.module.css";

/** Temporary scene for parts not built yet (Years 1–4, invitation card). */
export default function PlaceholderScene({ sceneId, onNext, isLast }: SceneProps) {
  return (
    <div className={`${styles.scene} ${styles.placeholder}`}>
      <div className={styles.placeholderBody}>
        <span className={styles.placeholderMoon} aria-hidden />
        <h2 className={styles.placeholderTitle}>{STORY.placeholders[sceneId] ?? sceneId}</h2>
        <p className={styles.placeholderNote}>{STORY.placeholderNote}</p>
      </div>
      <NextButton onClick={onNext}>{isLast ? STORY.ui.restart : STORY.ui.next}</NextButton>
    </div>
  );
}
