"use client";

import { useState } from "react";
import { useFrame } from "@react-three/fiber";

/** Fires onReady after the first rendered frame (shaders compiled, scene visible). */
export function ReadySignal({ onReady }: { onReady: () => void }) {
  const [fired, setFired] = useState(false);
  useFrame(() => {
    if (!fired) {
      setFired(true);
      requestAnimationFrame(onReady);
    }
  });
  return null;
}
