"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { STORY } from "@/config/story";
import { sfx } from "@/lib/audio/sfx";
import type { MemoryPhoto } from "@/lib/memories";
import styles from "./Year.module.css";

/** Without any answer by then, the video counts as failed rather than loading forever. */
const VIDEO_TIMEOUT_MS = 20_000;
const SHORT_CLIP_SECONDS = 4;

/** Plays a video: asks the server for its signed URL only now, after the tap. */
function VideoFrame({ photo, videoId }: { photo: MemoryPhoto; videoId: string }) {
  const slug = usePathname().replace(/^\/|\/$/g, "");
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [ratio, setRatio] = useState((photo.videoWidth ?? 16) / (photo.videoHeight ?? 9));

  // The scene's sound stays silent while the video is open, and comes back on close.
  useEffect(() => {
    sfx.setHeld(true);
    return () => sfx.setHeld(false);
  }, []);

  useEffect(() => {
    const request = new AbortController();
    const query = new URLSearchParams({ slug, id: videoId });
    fetch(`/api/video-url?${query}`, { signal: request.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setUrl(((await res.json()) as { url: string }).url);
      })
      .catch(() => {
        if (!request.signal.aborted) setStatus("error");
      });
    return () => request.abort();
  }, [slug, videoId, attempt]);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus("error"), VIDEO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  // Removing the source is what actually stops the download when the lightbox closes.
  useEffect(() => {
    const el = video.current;
    if (!url || !el) return;
    return () => {
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [url]);

  const retry = () => {
    setUrl(null);
    setStatus("loading");
    setAttempt((a) => a + 1);
  };

  return (
    <figure className={styles.lightboxVideoFrame} style={{ "--video-ratio": ratio } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
      <div className={styles.lightboxVideo}>
        {url && status !== "error" ? (
          <video
            ref={video}
            src={url}
            poster={photo.src}
            playsInline
            controls
            preload="metadata"
            aria-label={photo.caption}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              if (el.videoWidth && el.videoHeight) setRatio(el.videoWidth / el.videoHeight);
              // A clip of a few seconds would be over before anyone has looked at it.
              el.loop = el.duration < SHORT_CLIP_SECONDS;
              setStatus("ready");
              // The tap came before the network call, so a browser may refuse: the controls remain.
              void el.play().catch(() => {});
            }}
            onError={() => setStatus("error")}
          />
        ) : (
          <Image src={photo.src} alt={photo.caption} fill sizes="(min-width: 720px) 720px, 92vw" priority />
        )}
        {status === "loading" && (
          <div className={styles.videoStatus} role="status">
            <span className={styles.videoSpinner} aria-hidden />
            {STORY.ui.videoLoading}
          </div>
        )}
        {status === "error" && (
          <div className={styles.videoStatus} role="alert">
            {STORY.ui.videoError}
            <button type="button" className={styles.videoRetry} onClick={retry}>
              {STORY.ui.retry}
            </button>
          </div>
        )}
      </div>
      <figcaption className={styles.lightboxVideoCaption}>{photo.caption}</figcaption>
    </figure>
  );
}

/** A photo or video enlarged over the scene: frame, handwritten caption, close button. */
export function Lightbox({ photo, onClose }: { photo: MemoryPhoto; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`${styles.lightbox} ${photo.videoId ? styles.lightboxForVideo : ""}`} role="dialog" aria-modal="true" aria-label={photo.caption} onClick={onClose}>
      {photo.videoId ? (
        <VideoFrame photo={photo} videoId={photo.videoId} />
      ) : (
        <figure className={styles.lightboxFrame} onClick={(e) => e.stopPropagation()}>
          <div className={styles.lightboxPhoto}>
            <Image src={photo.src} alt={photo.caption} fill sizes="(min-width: 720px) 640px, 92vw" priority />
          </div>
          <figcaption className={styles.lightboxCaption}>{photo.caption}</figcaption>
        </figure>
      )}
      <button ref={close} type="button" className={styles.lightboxClose} onClick={onClose} aria-label={STORY.ui.close}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M6 6 18 18M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
