"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./SpeechBubble.module.css";

gsap.registerPlugin(useGSAP);

type Props = {
  text: string;
  /** Small italic caption above the text (who is speaking) */
  speaker?: string;
  /**
   * true: the bubble runs its own typewriter effect on mount.
   * false (default): the scene drives it from its timeline — each character has data-char.
   */
  autoType?: boolean;
  /** Typing speed (seconds per character) when autoType is on */
  charDelay?: number;
};

/** Hand-drawn outline (viewBox 0 0 200 100, stretched to the bubble). Slightly irregular on purpose. */
const OUTLINE =
  "M14 3 C 60 1.2, 140 4.2, 186 2.4 Q 198 3 197.2 16 C 198.6 40, 196.4 70, 198 85 Q 197 97.6 184 97 " +
  "C 140 98.8, 60 96.4, 15 98.2 Q 2.4 98 3 85 C 1.4 60, 3.8 35, 2.2 15 Q 3 3.2 14 3 Z";

/** Speech bubble; text is split into characters so it can be revealed typewriter-style. */
export function SpeechBubble({ text, speaker, autoType = false, charDelay = 0.03 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chars = Array.from(text.normalize("NFC"));

  useGSAP(
    () => {
      if (!autoType) return;
      gsap.fromTo("[data-char]", { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: charDelay, ease: "none" });
    },
    { scope: ref, dependencies: [text, autoType, charDelay], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={styles.bubble} role="status" aria-label={text}>
      <svg className={styles.frame} viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden>
        <path d={OUTLINE} className={styles.fill} />
        <path d={OUTLINE} className={styles.line} />
        <path d={OUTLINE} className={styles.lineEcho} transform="translate(1.2 1)" />
      </svg>
      <svg className={styles.tail} viewBox="0 0 22 14" aria-hidden>
        <path d="M-1 -2 L23 -2 L21 0.6 L8.5 13 L1 0.6 Z" className={styles.fill} />
        <path d="M1 0.6 L8.5 13 L21 0.6" className={styles.line} />
      </svg>
      {speaker && <span className={styles.speaker}>{speaker}</span>}
      <p className={styles.text} aria-hidden>
        {chars.map((c, i) => (
          <span key={i} data-char="">
            {c}
          </span>
        ))}
      </p>
    </div>
  );
}
