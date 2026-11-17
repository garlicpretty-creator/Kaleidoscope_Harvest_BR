// Per-block data for stations, kept in world dynamic properties keyed by the
// block's dimension and position (same idea as Ranching's core/blockStore.js).
// Stations record a start time when they begin and compare it when used, so
// nothing runs every tick.

import { world } from "@minecraft/server";
import { NAMESPACE } from "../data/ns.js";

const keyOf = (block) => {
  const { x, y, z } = block.location;
  return `${NAMESPACE}:block:${block.dimension.id}:${x},${y},${z}`;
};

export function getBlockData(block, fallback) {
  const raw = world.getDynamicProperty(keyOf(block));
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setBlockData(block, data) {
  world.setDynamicProperty(keyOf(block), JSON.stringify(data));
}

export function clearBlockData(block) {
  world.setDynamicProperty(keyOf(block), undefined);
}

/** The world's absolute time in ticks; survives reloads, unlike system.currentTick. */
export function now() {
  try {
    return world.getAbsoluteTime();
  } catch {
    return 0;
  }
}
