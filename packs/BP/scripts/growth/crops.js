// One custom component, `kaleidoscope_harvest:crop`, grows every field crop
// in data/crops.js: once, underground, repeatable, tall and trellis forms all
// share it and differ only by their row's fields.
//
// Block states (tools/generate.mjs declares them):
//   kaleidoscope_harvest:growth       0 … maxGrowth
//   kaleidoscope_harvest:off_climate  true while the crop stands in a climate it cannot grow in
//                                     (its leaves turn grey: no text on screen)
//   kaleidoscope_harvest:upper        tall crops only: the upper block
//
// Breaking drops come from the blocks' loot tables (one per stage band), so the
// game's own rules for explosions, pistons and Cookery's sickle all apply.

import { CROPS, cropBlockId } from "../data/crops.js";
import { PARTICLE, RIPE_PARTICLE_CHANCE, SOUND } from "../data/feedback.js";
import { rid, state } from "../data/ns.js";
import { consumeMainhand, destroyBlock, dropAt, getState, mainhand, particleAt, playAt, roll, rollRange, setStates } from "../utils/blocks.js";
import { bright, growthMultiplier, isFarmland, isSoil } from "./environment.js";

/** Forms that are picked by using them and grow back. */
export const PICKED_FORMS = ["repeatable", "trellis", "bush"];

/** Stages a bone meal adds to a field crop. */
export const BONE_MEAL_STAGES = 2;

const CROP_BY_BLOCK = new Map(CROPS.map((crop) => [rid(cropBlockId(crop)), crop]));
export const cropOfBlock = (typeId) => CROP_BY_BLOCK.get(typeId);

const isUpper = (block, crop) => crop.form === "tall" && getState(block, "upper") === true;
const ripe = (block, crop) => getState(block, "growth") >= crop.maxGrowth;

/** The block above a tall crop's lower block when it is that crop's upper block. */
function upperOf(block) {
  const above = block.above();
  return above?.typeId === block.typeId && above.permutation.getState(state("upper")) === true ? above : undefined;
}

/**
 * Moves a crop to `stage`. A tall crop grows its upper block from `tallFrom` and
 * stops short of it while something is in the way. Returns the stage it reached.
 */
export function setStage(block, crop, stage) {
  stage = Math.min(stage, crop.maxGrowth);
  if (crop.form === "tall" && stage >= crop.tallFrom) {
    let upper = upperOf(block);
    if (!upper) {
      const above = block.above();
      if (!above || above.typeId !== "minecraft:air") {
        stage = Math.min(stage, crop.tallFrom - 1);
      } else {
        above.setPermutation(block.permutation.withState(state("upper"), true));
        upper = above;
      }
    }
    if (upper) setStates(upper, { growth: stage });
  }
  setStates(block, { growth: stage });
  return stage;
}

/** One random tick: climate, light and soil decide whether the crop grows a stage. */
export function tickCrop(block, crop) {
  if (isUpper(block, crop)) return;
  if (!(crop.form === "bush" ? isSoil(block.below()) : isFarmland(block.below()))) return;
  const multiplier = growthMultiplier(block, crop.climate);
  const offClimate = multiplier <= 0;
  if (getState(block, "off_climate") !== offClimate) {
    setStates(block, { off_climate: offClimate });
    const upper = crop.form === "tall" ? upperOf(block) : undefined;
    if (upper) setStates(upper, { off_climate: offClimate });
  }
  if (ripe(block, crop)) {
    if (roll() < RIPE_PARTICLE_CHANCE) particleAt(block, PARTICLE.ripe);
    return;
  }
  if (offClimate || !bright(block, crop.minLightLevel)) return;
  if (roll() >= crop.growthChance * multiplier) return;
  setStage(block, crop, getState(block, "growth") + 1);
}

/** Using a crop: bone meal, or picking a ripe repeatable / trellis crop. True if something happened. */
export function useCrop(block, crop, player) {
  // ## The upper block of a tall crop answers for the whole plant.
  if (isUpper(block, crop)) {
    const lower = block.below();
    return lower?.typeId === block.typeId ? useCrop(lower, crop, player) : false;
  }
  const held = mainhand(player);
  const stage = getState(block, "growth");

  if (held?.typeId === "minecraft:bone_meal") {
    if (stage >= crop.maxGrowth || getState(block, "off_climate")) return false;
    setStage(block, crop, stage + BONE_MEAL_STAGES);
    consumeMainhand(player);
    particleAt(block, PARTICLE.boneMeal);
    playAt(block, SOUND.boneMeal);
    return true;
  }

  const picked = PICKED_FORMS.includes(crop.form);
  if (!picked || stage < crop.maxGrowth) return false;
  dropAt(block, rid(crop.produce), rollRange(crop.pick));
  setStates(block, { growth: crop.harvestResetAge });
  playAt(block, SOUND.pick);
  return true;
}

/** A player broke a crop: the other half of a tall crop goes too; a hoe digs up more of an underground crop. */
export function brokeCrop(block, crop, brokenPermutation, player) {
  if (crop.form === "tall") {
    const wasUpper = brokenPermutation.getState(state("upper")) === true;
    const other = wasUpper ? block.below() : block.above();
    // ## Only the lower block has a loot table with drops, so breaking the upper
    // ## block breaks the lower one "as if mined" and the plant drops once.
    if (other?.typeId === brokenPermutation.type.id) destroyBlock(other);
  }
  if (crop.form === "underground" && crop.hoeBonus && player) {
    const ripeNow = brokenPermutation.getState(state("growth")) >= crop.maxGrowth;
    if (ripeNow && mainhand(player)?.hasTag("minecraft:is_hoe")) dropAt(block, rid(crop.produce), crop.hoeBonus);
  }
}

export const cropComponent = {
  onRandomTick({ block }) {
    const crop = cropOfBlock(block.typeId);
    if (crop) tickCrop(block, crop);
  },
  onPlayerInteract({ block, player }) {
    const crop = cropOfBlock(block.typeId);
    if (crop && player) useCrop(block, crop, player);
  },
  onPlayerBreak({ block, brokenBlockPermutation, player }) {
    const crop = cropOfBlock(brokenBlockPermutation.type.id);
    if (crop) brokeCrop(block, crop, brokenBlockPermutation, player);
  },
};
