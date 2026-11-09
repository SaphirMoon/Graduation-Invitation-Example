import type { Metadata } from "next";
import { Story } from "@/components/Story";
import { getGuest, guestSlugs } from "@/lib/guests";
import { buildMetadata } from "@/lib/metadata";

/** Pre-render a static page for every guest in data/guests.json. Unknown slugs still work (generic version). */
export function generateStaticParams() {
  return guestSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { guest, known } = getGuest(slug);
  return buildMetadata(guest, known);
}

export default async function GuestPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const { guest, known } = getGuest(slug);
  return <Story guest={guest} known={known} />;
}
