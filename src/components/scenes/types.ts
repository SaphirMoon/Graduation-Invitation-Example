import type { ComponentType } from "react";
import type { Guest } from "@/lib/guests";

/** How a scene was reached: the first scene opened, the previous scene's hand-off, or a jump. */
export type SceneEntry = "start" | "next" | "nav";

/** Common props every scene receives from Story. */
export type SceneProps = {
  sceneId: string;
  guest: Guest;
  /** Whether the guest exists in data/guests.json */
  known: boolean;
  reducedMotion: boolean;
  isLast: boolean;
  entry: SceneEntry;
  /** Go to the next scene (on the last scene: back to the start) */
  onNext: () => void;
  /** The viewer's first tap has happened */
  onOpened: () => void;
};

export type SceneDefinition = {
  id: string;
  Component: ComponentType<SceneProps>;
};
