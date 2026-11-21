// The Bamboo Trellis (竹藤架). It stands on farmland; using a trellis crop's
// seed on it turns it into that crop at stage 0. The crop block's loot table
// gives the trellis back when the crop is broken (tools/generate.mjs).

import { BlockPermutation } from "@minecraft/server";
import { CROPS, cropBlockId } from "../data/crops.js";
import { SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { consumeMainhand, mainhand, playAt, refuse } from "../utils/blocks.js";

const CROP_BY_SEED = new Map(CROPS.filter((crop) => crop.form === "trellis").map((crop) => [rid(crop.seed), crop]));
/** Seeds of Harvest's other crops: the player clearly meant to plant, but they do not climb. */
const OTHER_SEEDS = new Set(CROPS.filter((crop) => crop.form !== "trellis").map((crop) => rid(crop.seed)));

/** Plants the held seed on the trellis; true if it was a trellis seed. Another crop's seed is refused. */
export function plantOnTrellis(block, player) {
  const held = mainhand(player)?.typeId;
  const crop = CROP_BY_SEED.get(held);
  if (!crop) return OTHER_SEEDS.has(held) ? refuse(block) : false;
  block.setPermutation(BlockPermutation.resolve(rid(cropBlockId(crop))));
  consumeMainhand(player);
  playAt(block, SOUND.trellisPlant);
  return true;
}

export const trellisComponent = {
  onPlayerInteract({ block, player }) {
    if (player) plantOnTrellis(block, player);
  },
};
