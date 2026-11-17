// The Bamboo Trellis (竹藤架). It stands on farmland; using a trellis crop's
// seed on it turns it into that crop at stage 0. The crop block's loot table
// gives the trellis back when the crop is broken (tools/generate.mjs).

import { BlockPermutation } from "@minecraft/server";
import { CROPS, cropBlockId } from "../data/crops.js";
import { SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { consumeMainhand, mainhand, playAt } from "../utils/blocks.js";

const CROP_BY_SEED = new Map(CROPS.filter((crop) => crop.form === "trellis").map((crop) => [rid(crop.seed), crop]));

/** Plants the held seed on the trellis; true if it was a trellis seed. */
export function plantOnTrellis(block, player) {
  const crop = CROP_BY_SEED.get(mainhand(player)?.typeId);
  if (!crop) return false;
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
