import type { Metadata } from "next";
import { STORY } from "@/config/story";
import { pick } from "@/lib/format";
import type { Guest } from "@/lib/guests";

export function buildMetadata(guest: Guest, known: boolean): Metadata {
  const title = pick(STORY.meta.titlePersonal, STORY.meta.title, guest, known);
  const description = STORY.meta.description;
  // A photo of the closed envelope in the moonbeam, the same image for every guest.
  const images = [{ url: "/images/og-invite.jpg", width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    openGraph: { title, description, images, type: "website", locale: "vi_VN" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
