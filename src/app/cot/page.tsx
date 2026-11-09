import { Story } from "@/components/Story";
import { getGuest } from "@/lib/guests";
import { buildMetadata } from "@/lib/metadata";

const { guest, known } = getGuest("cot");

export const metadata = buildMetadata(guest, known);

/** The group's shared album, for a link without anyone's name in it. */
export default function GroupPage() {
  return <Story guest={guest} known={known} />;
}
