// Fruit trees (data/trees.js): saplings that grow into a fixed-shape tree, and
// fruit leaves that blossom, set fruit and ripen again after every picking.
//
// Components:
//   kaleidoscope_harvest:sapling       on every sapling (state growth 0 … saplingStages-1)
//   kaleidoscope_harvest:fruit_leaves  on every fruit-leaf block (state fruit_stage 0 … 3,
//                                      off_climate)
//
// ## Both work on random ticks only, never a per-tick scan (企劃書 risk: 大果園掉幀).

import { BlockPermutation } from "@minecraft/server";
import { PARTICLE, RIPE_PARTICLE_CHANCE, SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { FRUIT_LOG, FRUIT_STAGES, LEAF_LOG_RANGE, TREES, TREE_SHAPE, fruitLeavesBlockId, saplingBlockId } from "../data/trees.js";
import { consumeMainhand, destroyBlock, dropAt, getState, mainhand, particleAt, playAt, roll, rollRange, setStates } from "../utils/blocks.js";
import { bright, growthMultiplier } from "./environment.js";

const RIPE = FRUIT_STAGES.length - 1;
const LOG_ID = rid(FRUIT_LOG.id);
const TREE_BY_SAPLING = new Map(TREES.map((tree) => [rid(saplingBlockId(tree)), tree]));
const TREE_BY_LEAVES = new Map(TREES.map((tree) => [rid(fruitLeavesBlockId(tree)), tree]));
export const treeOfSapling = (typeId) => TREE_BY_SAPLING.get(typeId);
export const treeOfLeaves = (typeId) => TREE_BY_LEAVES.get(typeId);

const offset = (block, [dx, dy, dz]) => {
  const { x, y, z } = block.location;
  return block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
};

/** Blocks a growing tree may grow into. */
const REPLACEABLE = new Set(["minecraft:air", "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:snow_layer"]);

/** Turns a grown sapling into its tree. False (and nothing changes) when something is in the way. */
export function growTree(block, tree) {
  const spots = [...TREE_SHAPE.trunk.filter(([x, y, z]) => x || y || z), ...TREE_SHAPE.leaves];
  const targets = spots.map((spot) => offset(block, spot));
  if (targets.some((target) => !target || !REPLACEABLE.has(target.typeId))) return false;

  const log = BlockPermutation.resolve(LOG_ID);
  const leaves = BlockPermutation.resolve(rid(fruitLeavesBlockId(tree)));
  block.setPermutation(log);
  for (const spot of TREE_SHAPE.trunk) offset(block, spot).setPermutation(log);
  for (const spot of TREE_SHAPE.leaves) {
    const target = offset(block, spot);
    if (target.typeId !== LOG_ID) target.setPermutation(leaves);
  }
  playAt(block, SOUND.treeGrown);
  return true;
}

/** Moves a sapling on by `stages`; past its last stage it becomes a tree. */
function advanceSapling(block, tree, stages) {
  const next = getState(block, "growth") + stages;
  if (next < tree.saplingStages) setStates(block, { growth: next });
  else growTree(block, tree);
}

export function tickSapling(block, tree) {
  const multiplier = growthMultiplier(block, tree.climate);
  if (multiplier <= 0 || !bright(block, tree.minLightLevel)) return;
  if (roll() >= tree.saplingChance * multiplier) return;
  advanceSapling(block, tree, 1);
}

/** True when a Fruit Log is within reach of a leaf (otherwise the tree was chopped away). */
export function hasLog(block) {
  const r = LEAF_LOG_RANGE;
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++)
      for (let dz = -r; dz <= r; dz++) if (offset(block, [dx, dy, dz])?.typeId === LOG_ID) return true;
  return false;
}

export function tickLeaves(block, tree) {
  if (!hasLog(block)) {
    destroyBlock(block);
    return;
  }
  const multiplier = growthMultiplier(block, tree.climate);
  const offClimate = multiplier <= 0;
  if (getState(block, "off_climate") !== offClimate) setStates(block, { off_climate: offClimate });
  const stage = getState(block, "fruit_stage");
  if (stage >= RIPE) {
    if (roll() < RIPE_PARTICLE_CHANCE) particleAt(block, PARTICLE.ripe);
    return;
  }
  if (offClimate || roll() >= tree.fruitChance * multiplier) return;
  setStates(block, { fruit_stage: stage + 1 });
}

/** Bone meal on a sapling or a fruit leaf: one stage only (企劃書：避免一鍵成林). */
function boneMeal(block, player, advance) {
  if (mainhand(player)?.typeId !== "minecraft:bone_meal") return false;
  if (!advance()) return false;
  consumeMainhand(player);
  particleAt(block, PARTICLE.boneMeal);
  playAt(block, SOUND.boneMeal);
  return true;
}

export function useSapling(block, tree, player) {
  return boneMeal(block, player, () => {
    if (growthMultiplier(block, tree.climate) <= 0) return false;
    advanceSapling(block, tree, 1);
    return true;
  });
}

export function useLeaves(block, tree, player) {
  const stage = getState(block, "fruit_stage");
  if (stage >= RIPE) {
    dropAt(block, rid(tree.fruit), rollRange(tree.pick));
    setStates(block, { fruit_stage: 0 });
    playAt(block, SOUND.pick);
    return true;
  }
  return boneMeal(block, player, () => {
    if (getState(block, "off_climate")) return false;
    setStates(block, { fruit_stage: stage + 1 });
    return true;
  });
}

export const saplingComponent = {
  onRandomTick({ block }) {
    const tree = treeOfSapling(block.typeId);
    if (tree) tickSapling(block, tree);
  },
  onPlayerInteract({ block, player }) {
    const tree = treeOfSapling(block.typeId);
    if (tree && player) useSapling(block, tree, player);
  },
};

export const fruitLeavesComponent = {
  onRandomTick({ block }) {
    const tree = treeOfLeaves(block.typeId);
    if (tree) tickLeaves(block, tree);
  },
  onPlayerInteract({ block, player }) {
    const tree = treeOfLeaves(block.typeId);
    if (tree && player) useLeaves(block, tree, player);
  },
};
