import { useSyncExternalStore } from "react";

let webglCache: boolean | null = null;

function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

const noopSubscribe = () => () => {};

/** Whether WebGL is available (assumed true during SSR; checked once on the client). */
export function useWebGL() {
  return useSyncExternalStore(noopSubscribe, detectWebGL, () => true);
}
