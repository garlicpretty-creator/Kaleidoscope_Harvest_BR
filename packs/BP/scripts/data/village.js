// What Harvest adds to village house chests (企劃書「第一份來源：村莊箱子」).
// tools/generate.mjs writes each house table as the vanilla one (kept verbatim in
// tools/vanilla/) plus one pool made here, so no vanilla loot is lost.
// Plain data: no @minecraft imports.
//
// ## Overriding a vanilla loot table replaces it for the whole world, and another
// ## add-on that overrides the same file wins or loses by pack order. Approved by
// ## the project owner; keep the vanilla copies in tools/vanilla/ current.

import { CROPS } from "./crops.js";

/** The vanilla house chests that can be overridden. */
export const VILLAGE_HOUSES = ["plains", "savanna", "taiga", "snowy", "desert"];

/**
 * Items that are not a crop's seed but still come from village chests. M3 adds its
 * village saplings and cuttings here (the proposal: 柑橘 村莊樹苗, 葡萄 村莊箱子).
 */
export const VILLAGE_EXTRA = [{ item: "mandarin_sapling", houses: ["plains", "savanna"], count: [1, 1] }];

/** Chance that a house chest holds one Harvest stack. */
export const VILLAGE_CHANCE = 0.4;

/** [{ item, count }] for one house, from every crop's `village` field and VILLAGE_EXTRA. */
export function villageItems(house) {
  const fromCrops = CROPS.filter((crop) => crop.village?.includes(house)).map((crop) => ({ item: crop.seed, count: [1, 3] }));
  const extra = VILLAGE_EXTRA.filter((row) => row.houses.includes(house)).map(({ item, count }) => ({ item, count }));
  return [...fromCrops, ...extra];
}
