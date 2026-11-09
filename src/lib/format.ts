import { STORY } from "@/config/story";
import type { Guest } from "@/lib/guests";

/** How the host refers to himself when a guest's entry doesn't say. */
const DEFAULT_SELF = "mình";

/** Replace {name} and {self} in a template. */
export function fill(template: string, guest: Guest): string {
  return template
    .replaceAll("{name}", guest.name)
    .replaceAll("{self}", guest.self ?? DEFAULT_SELF)
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Whether to use the personalized version. */
export function isPersonal(known: boolean): boolean {
  return STORY.showGuestName && known;
}

/** Pick the personalized or the generic template. */
export function pick(personal: string, generic: string, guest: Guest, known: boolean): string {
  return isPersonal(known) ? fill(personal, guest) : fill(generic, guest);
}
