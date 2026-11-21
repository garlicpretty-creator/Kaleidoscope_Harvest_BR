// The fruit-picking pole (摘果竿, data/gear.js). Used on a fruit tree's leaves or on a hanging
// fruit, it picks every ripe hanging fruit within PICKING_POLE.radius of that block, each as if
// picked by hand (growth/trees.js pickFruit), and strips every flushed cinnamon leaf there too.
// One use costs one point of durability; with nothing ripe in reach the player gets the refusal
// cue and the pole is not worn.
//
// ## Player use only: one look at the 7 × 7 × 7 blocks round the one used on, per use.

import { PICKING_POLE } from "../data/gear.js";
import { SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { getState, mainhand, particleAt, playAt, refuse, wearMainhand } from "../utils/blocks.js";
import { isRipeFruit, pickFruit, stripBark, treeOfFruit, treeOfLeaves } from "./trees.js";

const POLE = rid(PICKING_POLE.id);
const LEAVES = rid(PICKING_POLE.particle);

/** Offsets within the radius, the block used on first. */
const SPOTS = (() => {
  const r = PICKING_POLE.radius;
  const out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) out.push([dx, dy, dz]);
  return out.sort((a, b) => a.reduce((s, v) => s + Math.abs(v), 0) - b.reduce((s, v) => s + Math.abs(v), 0));
})();

export const holdsPole = (player) => mainhand(player)?.typeId === POLE;

/** Picks every ripe fruit and strips every flushed cinnamon leaf round `origin`; returns how many. */
export function shakeTree(origin) {
  const { x, y, z } = origin.location;
  let picked = 0;
  for (const [dx, dy, dz] of SPOTS) {
    let block;
    try {
      block = origin.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
    } catch {
      continue; // outside the world or not loaded
    }
    if (!block) continue;
    const fruitTree = treeOfFruit(block.typeId);
    if (fruitTree) {
      if (!isRipeFruit(block)) continue;
      particleAt(block, LEAVES);
      pickFruit(block, fruitTree);
      picked++;
      continue;
    }
    const leafTree = treeOfLeaves(block.typeId);
    if (leafTree?.bark && getState(block, "blossom")) {
      particleAt(block, LEAVES);
      stripBark(block, leafTree);
      picked++;
    }
  }
  return picked;
}

/** The pole used on a leaf or a fruit of a fruit tree. True when something was picked. */
export function usePole(block, player) {
  if (!holdsPole(player)) return false;
  const picked = shakeTree(block);
  if (!picked) return refuse(block);
  playAt(block, SOUND.rustle, { pitch: 1.2, volume: 0.9 });
  particleAt(block, LEAVES);
  if (wearMainhand(player) === "broke") playAt(block, SOUND.toolBreak);
  return true;
}
