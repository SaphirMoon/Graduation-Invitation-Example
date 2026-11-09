import type { SceneDefinition } from "./types";
import Prologue from "./Prologue";
import Invitation from "./Invitation";
import Year from "./Year";
import YearBridge from "./YearBridge";
import YearSnow from "./YearSnow";
import YearSpace from "./YearSpace";

/**
 * SCENE ORDER. To add a scene: create a component that takes SceneProps and insert it here.
 * "prologue" = scenes 0 + 1 as one continuous 3D shot (curtain → valley → sapphire moon → guide).
 * "invitation" = envelope → invitation card (data in config/invitation.ts).
 * "year1" = the lake (photos and lines in data/memories.json).
 * "year2" = the train through space.
 * "year3" = the climb up the snow mountain, opening with a fall through the clouds.
 * "year4" = the bridge of light to the island, opening on year 3's summit.
 */
export const SCENES: SceneDefinition[] = [
  { id: "prologue", Component: Prologue },
  { id: "year1", Component: Year },
  { id: "year2", Component: YearSpace },
  { id: "year3", Component: YearSnow },
  { id: "year4", Component: YearBridge },
  { id: "invitation", Component: Invitation },
];
