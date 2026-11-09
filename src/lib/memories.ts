import data from "@/data/memories.json";
import catalog from "@/data/photos.json";

export type MemoryPhoto = {
  /** WebP in public/, at most ~1200 px on the long edge. For a video, its poster. */
  src: string;
  caption: string;
  /** Year 3: shown at each station, e.g. "1.400 m" */
  altitude?: string;
  /** Where a square crop sits along the long side: 0 = start, 0.5 = middle (default), 1 = end */
  focus?: number;
  /** Set when this item plays as a video (it has been uploaded): an id in data/photos.json */
  videoId?: string;
  videoWidth?: number;
  videoHeight?: number;
};

export type YearMemory = {
  title: string;
  /** First line = opening, last line = closing, lines in between are spread among the photos */
  dialogue: string[];
  photos: MemoryPhoto[];
};

/** A video in data/photos.json, written by scripts/upload-videos.mjs. */
type VideoItem = {
  id: string;
  type: "video";
  /** Empty until uploaded: the item then shows as a plain photo of its poster */
  cloudinaryPublicId: string;
  poster: string;
  caption: string;
  /** Second of the video the poster is taken from (default: the first second) */
  posterAt?: number;
  width?: number;
  height?: number;
};

/** An album entry: a photo, or `{ "video": "<id>" }` plus any per-scene fields. */
type RawPhoto = Partial<MemoryPhoto> & { video?: string };
type RawYear = Omit<Partial<YearMemory>, "photos"> & { photos?: RawPhoto[] };

/** Each year shows at most this many photos (keeps the scene light on phones). */
export const MAX_PHOTOS = 8;

type Memories = {
  default: Record<string, RawYear>;
  /** One album per person or group: only the years (and fields) that differ from the default */
  albums: Record<string, Record<string, RawYear>>;
};

const MEMORIES = data as unknown as Memories;
const VIDEOS = catalog as VideoItem[];

function resolvePhoto({ video, ...raw }: RawPhoto): MemoryPhoto | null {
  if (!video) return raw as MemoryPhoto;
  const item = VIDEOS.find((v) => v.id === video);
  if (!item) return null;
  // An album may caption a shared video its own way.
  const photo: MemoryPhoto = { ...raw, src: item.poster, caption: raw.caption ?? item.caption };
  return item.cloudinaryPublicId ? { ...photo, videoId: item.id, videoWidth: item.width, videoHeight: item.height } : photo;
}

/** A year's memories: the album's version where it has one, otherwise the default. */
export function getMemory(id: string, album?: string): YearMemory | null {
  const base = MEMORIES.default[id];
  if (!base) return null;
  const m = { ...base, ...(album ? MEMORIES.albums[album]?.[id] : undefined) } as Omit<YearMemory, "photos"> & { photos: RawPhoto[] };
  const photos = m.photos.map(resolvePhoto).filter((p): p is MemoryPhoto => p !== null);
  return { ...m, photos: photos.slice(0, MAX_PHOTOS) };
}

/** Whether a guest with this album actually sees this video in one of the years. */
export function albumHasVideo(album: string | undefined, videoId: string) {
  return Object.keys(MEMORIES.default).some((year) => getMemory(year, album)?.photos.some((p) => p.videoId === videoId));
}

export function videoPublicId(videoId: string) {
  return VIDEOS.find((v) => v.id === videoId)?.cloudinaryPublicId || null;
}
