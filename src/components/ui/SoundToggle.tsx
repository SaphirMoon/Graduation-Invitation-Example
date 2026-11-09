"use client";

import { useSyncExternalStore } from "react";
import { STORY } from "@/config/story";
import { sfx } from "@/lib/audio/sfx";
import styles from "./Buttons.module.css";

const subscribe = (cb: () => void) => sfx.subscribe(cb);

/** Small sound on/off toggle in the top-left corner. The choice is remembered. */
export function SoundToggle() {
  const muted = useSyncExternalStore(subscribe, () => sfx.muted, () => false);
  const label = muted ? STORY.ui.soundOn : STORY.ui.soundOff;
  return (
    <button
      type="button"
      className={styles.sound}
      onClick={() => sfx.setMuted(!muted)}
      aria-label={label}
      aria-pressed={!muted}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        {muted ? (
          <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15.2 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M17.6 6.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
