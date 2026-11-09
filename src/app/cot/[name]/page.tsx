import type { Metadata } from "next";
import { Story } from "@/components/Story";
import { getGuest, groupSlugs } from "@/lib/guests";
import { buildMetadata } from "@/lib/metadata";

/** Pre-render one page per person in the group. Unknown names still work (the group's own wording). */
export function generateStaticParams() {
  return groupSlugs("cot").map((name) => ({ name }));
}

export async function generateMetadata({ params }: PageProps<"/cot/[name]">): Promise<Metadata> {
  const { name } = await params;
  const { guest, known } = getGuest(`cot/${name}`);
  return buildMetadata(guest, known);
}

export default async function GroupGuestPage({ params }: PageProps<"/cot/[name]">) {
  const { name } = await params;
  const { guest, known } = getGuest(`cot/${name}`);
  return <Story guest={guest} known={known} />;
}
