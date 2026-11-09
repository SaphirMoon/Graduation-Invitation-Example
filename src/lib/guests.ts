import guestsData from "@/data/guests.json";

export type Guest = {
  /** How the guest is addressed, in full: "quý anh/chị", "anh Huy"… */
  name: string;
  /** How the host refers to himself with this guest: "em", "mình"… (none = "mình") */
  self?: string;
  /** Their own photos: a key of `albums` in data/memories.json (none = the default set) */
  album?: string;
};

const GUESTS: Record<string, Guest> = guestsData;

/** The entry with an empty key in data/guests.json: used by `/` and by unknown links. */
export const GENERIC_GUEST: Guest = GUESTS[""];

/**
 * People in a group are keyed "group/name" and the group itself "group": they get the address
 * /group/name and share the group's album, and only the name on the card differs.
 */
const isGroup = (key: string) => Object.keys(GUESTS).some((k) => k.startsWith(`${key}/`));

/** Guests with an address of their own at the top level: /huy. */
export function guestSlugs(): string[] {
  return Object.keys(GUESTS).filter((k) => k && !k.includes("/") && !isGroup(k));
}

/** The names under a group: "cot" gives "huy", "hai"… */
export function groupSlugs(group: string): string[] {
  return Object.keys(GUESTS)
    .filter((k) => k.startsWith(`${group}/`))
    .map((k) => k.slice(group.length + 1));
}

export function getGuest(slug?: string): { guest: Guest; known: boolean } {
  const key = slug ? decodeURIComponent(slug).trim().toLowerCase() : "";
  const guest = key ? GUESTS[key] : undefined;
  if (guest) return { guest, known: true };
  // An unknown name under a group still sees that group's album, not the public one.
  const group = key.includes("/") ? GUESTS[key.split("/")[0]] : undefined;
  return { guest: group ?? GENERIC_GUEST, known: false };
}
