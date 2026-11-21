// Fruit trees (data/trees.js): saplings that grow into the tree's tree_feature, leaves
// that blossom, and the fruit blocks that hang under blossoming leaves and ripen.
//
// Components:
//   kaleidoscope_harvest:sapling        every sapling (state growth 0 … saplingStages-1)
//   kaleidoscope_harvest:tree_leaves    every <tree>_leaves block (states blossom, off_climate)
//   kaleidoscope_harvest:hanging_fruit  every <tree>_fruit block (state growth 0 … 2)
//
// ## All of it runs on random ticks and player use only, never a per-tick scan (企劃書 risk:
// ## 大果園掉幀). A leaf reads the block below it, a fruit the block above it; only a leaf's
// ## "is my trunk still there" check looks further, nearest blocks first.

import { BlockPermutation } from "@minecraft/server";
import { PARTICLE, RIPE_PARTICLE_CHANCE, SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { FRUIT_STAGES, LEAF_LOG_RANGE, TREES, TRUNKS, fruitBlockId, leavesBlockId, saplingBlockId, treeFeatureId } from "../data/trees.js";
import { consumeMainhand, destroyBlock, dropAt, getState, mainhand, particleAt, playAt, refuse, roll, rollRange, setStates } from "../utils/blocks.js";
import { bright, growthMultiplier } from "./environment.js";
import { holdsPole, usePole } from "./pole.js";

const RIPE = FRUIT_STAGES.length - 1;
const TRUNK_IDS = new Set(TRUNKS.map((t) => rid(t.id)));
const TREE_BY_SAPLING = new Map(TREES.map((tree) => [rid(saplingBlockId(tree)), tree]));
const TREE_BY_LEAVES = new Map(TREES.map((tree) => [rid(leavesBlockId(tree)), tree]));
const TREE_BY_FRUIT = new Map(TREES.filter((tree) => !tree.bark).map((tree) => [rid(fruitBlockId(tree)), tree]));
export const treeOfSapling = (typeId) => TREE_BY_SAPLING.get(typeId);
export const treeOfLeaves = (typeId) => TREE_BY_LEAVES.get(typeId);
export const treeOfFruit = (typeId) => TREE_BY_FRUIT.get(typeId);

const offset = (block, [dx, dy, dz]) => {
  const { x, y, z } = block.location;
  return block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
};

// --- Saplings ------------------------------------------------------------------------------

/**
 * Turns a grown sapling into its tree by placing the tree's feature where it stands (the
 * features list saplings in may_replace, so the trunk takes the sapling's place). False, and
 * the sapling stays to try again on a later tick, when the feature cannot be placed.
 */
export function growTree(block, tree) {
  let placed = false;
  try {
    placed = block.dimension.placeFeature(rid(treeFeatureId(tree)), block.location, false) === true;
  } catch {
    placed = false;
  }
  if (placed) playAt(block, SOUND.treeGrown);
  return placed;
}

/**
 * Moves a sapling on by `stages`; past its last stage it tries to become a tree.
 * False when it was at its last stage and the tree could not be placed (nothing changed).
 */
function advanceSapling(block, tree, stages) {
  const next = getState(block, "growth") + stages;
  if (next < tree.saplingStages) {
    setStates(block, { growth: next });
    return true;
  }
  return growTree(block, tree);
}

export function tickSapling(block, tree) {
  const multiplier = growthMultiplier(block, tree.climate);
  if (multiplier <= 0 || !bright(block, tree.minLightLevel)) return;
  if (roll() >= tree.saplingChance * multiplier) return;
  advanceSapling(block, tree, 1);
}

// --- Leaves ---------------------------------------------------------------------------------

/** Offsets within LEAF_LOG_RANGE, nearest first, so a leaf next to its trunk stops early. */
const LOG_SEARCH = (() => {
  const r = LEAF_LOG_RANGE;
  const out = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) if (dx || dy || dz) out.push([dx, dy, dz]);
  return out.sort((a, b) => a.reduce((s, v) => s + Math.abs(v), 0) - b.reduce((s, v) => s + Math.abs(v), 0));
})();

/** True when a trunk block is within reach of a leaf (otherwise the tree was chopped away). */
export function hasLog(block) {
  for (const spot of LOG_SEARCH) if (TRUNK_IDS.has(offset(block, spot)?.typeId)) return true;
  return false;
}

/** The fruit hanging under a leaf of this tree, if any. */
function fruitBelow(block, tree) {
  if (tree.bark) return undefined;
  const below = block.below();
  return below?.typeId === rid(fruitBlockId(tree)) ? below : undefined;
}

/**
 * A blossoming leaf sets a small green fruit in the air below it and goes back to bare.
 * False (and nothing changes) for cinnamon, or when the block below is not air.
 */
export function setFruit(block, tree) {
  if (tree.bark) return false;
  const below = block.below();
  if (!below || below.typeId !== "minecraft:air") return false;
  below.setPermutation(BlockPermutation.resolve(rid(fruitBlockId(tree))));
  setStates(block, { blossom: false });
  return true;
}

export function tickLeaves(block, tree) {
  if (!hasLog(block)) {
    const fruit = fruitBelow(block, tree);
    destroyBlock(block);
    if (fruit) destroyBlock(fruit);
    return;
  }
  const multiplier = growthMultiplier(block, tree.climate);
  const offClimate = multiplier <= 0;
  if (getState(block, "off_climate") !== offClimate) setStates(block, { off_climate: offClimate });
  if (offClimate) return;
  if (!getState(block, "blossom")) {
    if (roll() < tree.fruitChance * multiplier) setStates(block, { blossom: true });
    return;
  }
  // ## Cinnamon's red-brown flush is ready to strip: it only glints now and then.
  if (tree.bark) {
    if (roll() < RIPE_PARTICLE_CHANCE) particleAt(block, PARTICLE.ripe);
    return;
  }
  if (roll() < tree.fruitChance * multiplier) setFruit(block, tree);
}

/**
 * Bone meal on a sapling, a leaf or a fruit: one step only (企劃書：避免一鍵成林). When it can do
 * nothing (off-climate leaves or fruit, no room for the tree or the fruit) the player gets the
 * refusal cue and keeps the bone meal.
 */
function boneMeal(block, player, advance) {
  if (mainhand(player)?.typeId !== "minecraft:bone_meal") return false;
  if (!advance()) return refuse(block);
  consumeMainhand(player);
  particleAt(block, PARTICLE.boneMeal);
  playAt(block, SOUND.boneMeal);
  return true;
}

// ## Bone meal works on every sapling in any biome (owner, 2026-11-21: 所有果樹苗可以骨粉催熟);
// ## only its own random-tick growth keeps the climate rule. A tree grown off-climate still
// ## does not blossom outside a greenhouse (its leaves keep the rule).
export function useSapling(block, tree, player) {
  return boneMeal(block, player, () => advanceSapling(block, tree, 1));
}

/** Strips a piece of bark from a flushed cinnamon leaf; it goes back to bare and flushes again. */
export function stripBark(block, tree) {
  dropAt(block, rid(tree.fruit), rollRange(tree.pick));
  setStates(block, { blossom: false });
  playAt(block, SOUND.strip);
  particleAt(block, PARTICLE.pick);
  return true;
}

export function useLeaves(block, tree, player) {
  const blossom = getState(block, "blossom");
  if (tree.bark && blossom) return stripBark(block, tree);
  return boneMeal(block, player, () => {
    if (getState(block, "off_climate")) return false;
    if (!blossom) {
      setStates(block, { blossom: true });
      return true;
    }
    return setFruit(block, tree);
  });
}

/** A broken leaf takes the fruit hanging under it along (the fruit's placement filter does too, in game). */
export function brokeLeaves(block, tree) {
  const fruit = fruitBelow(block, tree);
  if (fruit) destroyBlock(fruit);
}

// --- Hanging fruit ------------------------------------------------------------------------------

/** True while the fruit still hangs from its own tree's leaves. */
const hangs = (block, tree) => block.above()?.typeId === rid(leavesBlockId(tree));

export function tickFruit(block, tree) {
  if (!hangs(block, tree)) {
    destroyBlock(block);
    return;
  }
  const stage = getState(block, "growth");
  if (stage >= RIPE) {
    if (roll() < RIPE_PARTICLE_CHANCE) particleAt(block, PARTICLE.ripe);
    return;
  }
  const multiplier = growthMultiplier(block, tree.climate);
  if (multiplier <= 0 || roll() >= tree.fruitChance * multiplier) return;
  setStates(block, { growth: stage + 1 });
}

/** True for a hanging fruit at its last stage. */
export const isRipeFruit = (block) => getState(block, "growth") >= RIPE;

/** Picks a ripe fruit: the fruit drops and the block goes (the leaf above blossoms and fruits again). */
export function pickFruit(block, tree) {
  dropAt(block, rid(tree.fruit), rollRange(tree.pick));
  playAt(block, SOUND.pick);
  particleAt(block, PARTICLE.pick);
  block.setType("minecraft:air");
  return true;
}

/** Picking a ripe fruit gives the fruit and removes the block; bone meal moves a green one on a stage. */
export function useFruit(block, tree, player) {
  const stage = getState(block, "growth");
  if (stage >= RIPE) return pickFruit(block, tree);
  return boneMeal(block, player, () => {
    if (growthMultiplier(block, tree.climate) <= 0) return false;
    setStates(block, { growth: stage + 1 });
    return true;
  });
}

// --- Components ------------------------------------------------------------------------------------

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

export const leavesComponent = {
  onRandomTick({ block }) {
    const tree = treeOfLeaves(block.typeId);
    if (tree) tickLeaves(block, tree);
  },
  onPlayerInteract({ block, player }) {
    const tree = treeOfLeaves(block.typeId);
    if (!tree || !player) return;
    // ## The fruit-picking pole (growth/pole.js) answers for the whole tree round it.
    if (holdsPole(player)) usePole(block, player);
    else useLeaves(block, tree, player);
  },
  onPlayerBreak({ block, brokenBlockPermutation }) {
    const tree = treeOfLeaves(brokenBlockPermutation.type.id);
    if (tree) brokeLeaves(block, tree);
  },
};

export const hangingFruitComponent = {
  onRandomTick({ block }) {
    const tree = treeOfFruit(block.typeId);
    if (tree) tickFruit(block, tree);
  },
  onPlayerInteract({ block, player }) {
    const tree = treeOfFruit(block.typeId);
    if (!tree || !player) return;
    if (holdsPole(player)) usePole(block, player);
    else useFruit(block, tree, player);
  },
};
