import { Story } from "@/components/Story";
import { GENERIC_GUEST } from "@/lib/guests";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata(GENERIC_GUEST, false);

export default function Home() {
  return <Story guest={GENERIC_GUEST} known={false} />;
}
