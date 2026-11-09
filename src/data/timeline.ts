/* ---------------- Tune these ---------------- */

export const TIMELINE = {
  /** Where one photo gives way to the next, along the tilt t (0..1) */
  thresholds: [0.33, 0.66] as const,
  /** The change happens within this distance on each side of a threshold */
  transitionZone: 0.07,
  /** Width of one light + dark pair of lenticular stripes, in pixels */
  stripePx: 6,
  /** Card tilt at the extremes of t, in degrees */
  rotateY: 12,
  rotateX: 6,
  /** Tilt kept while nobody is touching the card (fraction): the text stays comfortable to read */
  restTilt: 0.35,
  /** How far the phone turns (degrees each way) to sweep through all the photos */
  gyroRange: 22,
  /** The opening run: pause on each photo, and the move between them, in seconds */
  introHold: 1,
  introMove: 0.9,
};

/* ---------------- The photos ---------------- */

export type TimelinePhoto = {
  id: "small" | "c3" | "now";
  /** Transparent WebP in public/images/me/, cut flat at the bottom so it stands on the frame's floor */
  src: string;
  width: number;
  height: number;
  label: string;
  /** Shown after the label; leave empty to hide */
  year: string;
  /** Where this photo is centered along t */
  stop: number;
  /** Displayed height at its stop, as a fraction of the frame */
  scale: number;
};

export const PHOTOS: TimelinePhoto[] = [
  { id: "small", src: "/images/me/small.webp", width: 794, height: 1024, label: "Mầm non", year: "", stop: 0, scale: 0.45 },
  { id: "c3", src: "/images/me/c3.webp", width: 708, height: 982, label: "Cấp 3", year: "", stop: 0.5, scale: 0.72 },
  { id: "now", src: "/images/me/now.webp", width: 628, height: 1400, label: "Đại học", year: "2026", stop: 1, scale: 1 },
];

/** The frame takes the shape of the full-length photo. */
export const FRAME_ASPECT = PHOTOS[2].width / PHOTOS[2].height;

/** Displayed height at t: continuous, so the narrator grows rather than jumping in steps. */
export function heightAt(t: number) {
  for (let i = 0; i < PHOTOS.length - 1; i++) {
    const a = PHOTOS[i];
    const b = PHOTOS[i + 1];
    if (t <= b.stop) return a.scale + ((b.scale - a.scale) * (t - a.stop)) / (b.stop - a.stop);
  }
  return PHOTOS[PHOTOS.length - 1].scale;
}

/** Which photo t mostly shows. */
export function photoIndexAt(t: number) {
  return t < TIMELINE.thresholds[0] ? 0 : t < TIMELINE.thresholds[1] ? 1 : 2;
}
