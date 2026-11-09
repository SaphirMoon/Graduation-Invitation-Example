import type { ComponentPropsWithRef } from "react";
import styles from "./Buttons.module.css";

type Props = ComponentPropsWithRef<"button">;

/** "Next →" button — bottom center of the screen. */
export function NextButton({ className = "", ...rest }: Props) {
  return <button type="button" className={`${styles.next} ${className}`} {...rest} />;
}

/** Small "Skip" button in the top-right corner. */
export function SkipButton({ className = "", children, ...rest }: Props) {
  return (
    <button type="button" className={`${styles.skip} ${className}`} {...rest}>
      <svg className={styles.skipIcon} viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m3 3.5 5 4.5-5 4.5zM9 3.5l0 0M13 3.5v9M8.2 3.5l4.8 4.5-4.8 4.5" />
      </svg>
      <span className={styles.skipLabel}>{children}</span>
    </button>
  );
}
