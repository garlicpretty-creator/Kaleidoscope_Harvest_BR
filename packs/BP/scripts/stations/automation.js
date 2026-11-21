// Hoppers and chests on the stations (owner's convenience update, phase 1).
//
// ## Bedrock hoppers do not push into or pull from custom blocks. So, as in Ranching
// ## (core/containers.js and its automated stations), a juicer or pickling jar reaches into
// ## the container directly ABOVE it for inputs and puts its outputs into the container
// ## directly BELOW it. A hopper above simply holds what it cannot push; a hopper below
// ## carries the results on into a chest.
//
// ## Cost. Harvest's rule is "random ticks and player use only, never a per-tick scan"
// ## (growth/trees.js). This keeps to it:
// ##  - there is no world or chunk scan: each station adds its own position to a small
// ##    tracked list (a world dynamic property) when it is placed, used or random-ticked,
// ##    and leaves it when broken, or when a pass finds the block gone;
// ##  - one pass every AUTOMATION.seconds (2 s) looks at no more than AUTOMATION.perPass
// ##    stations of that list (round robin): three getBlock calls each, and a station with no
// ##    container above or below costs nothing more. An unloaded station is skipped, not dropped.
// ## Stations from worlds before this update join the list on their next use or random tick.
//
// The stations themselves say what a pass does (registerAutomated): stations/juicer.js
// and stations/picklingJar.js.

import { system, world } from "@minecraft/server";
import { NAMESPACE } from "../data/ns.js";
import { AUTOMATION } from "../data/stations.js";
import { containerOf } from "../utils/containers.js";

const LIST = `${NAMESPACE}:automated_stations`;

/** block type id → (block, above container | undefined, below container | undefined) => void */
const HANDLERS = new Map();

/** A station says what one pass does for it. */
export function registerAutomated(typeId, handler) {
  HANDLERS.set(typeId, handler);
}

const keyOf = (block) => {
  const { x, y, z } = block.location;
  return `${block.dimension.id}|${x}|${y}|${z}`;
};

/** The tracked list, parsed once per change of the stored string. */
let cache = { raw: undefined, list: [] };
function tracked() {
  const raw = world.getDynamicProperty(LIST);
  if (raw !== cache.raw) {
    let list = [];
    try {
      list = typeof raw === "string" ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    cache = { raw, list: Array.isArray(list) ? list : [] };
  }
  return cache.list;
}
function store(list) {
  const raw = list.length ? JSON.stringify(list) : undefined;
  world.setDynamicProperty(LIST, raw);
  cache = { raw, list };
}

/** Adds a station's position to the tracked list (nothing to do when it is there already). */
export function track(block) {
  const key = keyOf(block);
  const list = tracked();
  if (list.includes(key)) return;
  // ## The oldest goes when the list is full; it comes back on its next use or random tick.
  store([...list, key].slice(-AUTOMATION.maxTracked));
}

export function untrack(block) {
  const key = keyOf(block);
  const list = tracked();
  if (list.includes(key)) store(list.filter((k) => k !== key));
}

/** Test hook and the one place the tracked list is read as positions. */
export function trackedStations() {
  return tracked().map((key) => {
    const [dimension, x, y, z] = key.split("|");
    return { dimension, location: { x: +x, y: +y, z: +z } };
  });
}

let cursor = 0;

/** One pass: up to AUTOMATION.perPass tracked stations, round robin. */
export function automationPass() {
  const list = tracked();
  if (!list.length) return;
  const n = Math.min(AUTOMATION.perPass, list.length);
  const gone = [];
  for (let i = 0; i < n; i++) {
    const key = list[(cursor + i) % list.length];
    const [dimensionId, x, y, z] = key.split("|");
    let block;
    try {
      block = world.getDimension(dimensionId).getBlock({ x: +x, y: +y, z: +z });
    } catch {
      continue; // unloaded: try again on a later pass
    }
    if (!block) continue;
    const handler = HANDLERS.get(block.typeId);
    if (!handler) {
      gone.push(key);
      continue;
    }
    try {
      const above = containerOf(block.above());
      const below = containerOf(block.below());
      if (above || below) handler(block, above, below);
    } catch {
      // ## The top or bottom of the world, or a container that went away mid-pass: next pass.
    }
  }
  cursor = (cursor + n) % Math.max(list.length, 1);
  if (gone.length) store(tracked().filter((k) => !gone.includes(k)));
}

export function startAutomation() {
  system.runInterval(automationPass, AUTOMATION.seconds * 20);
}
