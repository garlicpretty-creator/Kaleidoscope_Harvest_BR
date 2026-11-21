// The produce crate (果菜箱, data/gear.js): one kind of Harvest produce, up to nine stacks.
//
//   a stack of produce      puts the whole stack in (as much as fits); another kind is refused
//   an empty hand           takes one stack out into the hand
//   sneaking, empty hand    takes everything that fits into the inventory
//   anything else           nothing
//
// The contents live in a dynamic property (utils/blockStore.js); the block state `fill` only says
// how full the model looks. Breaking the crate drops what is in it. A hopper or chest above feeds
// it and a container below is filled from it, on the stations' hopper pass (stations/automation.js).

import { EquipmentSlot, ItemStack } from "@minecraft/server";
import { PRODUCE_CRATE, crateLevel } from "../data/gear.js";
import { SOUND } from "../data/feedback.js";
import { ITEMS } from "../data/items.js";
import { rid } from "../data/ns.js";
import { clearBlockData, getBlockData, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, getState, mainhand, playAt, refuse, setStates } from "../utils/blocks.js";
import { containerOf, putInto, takeFrom } from "../utils/containers.js";
import { registerAutomated, track, untrack } from "./automation.js";

/** Everything a crate takes: Harvest's produce (data/items.js kind "produce"). */
export const CRATE_ITEMS = new Set(ITEMS.filter((item) => item.kind === "produce").map((item) => rid(item.id)));
export const CRATE_CAPACITY = PRODUCE_CRATE.stacks * PRODUCE_CRATE.stackSize;

const EMPTY = { item: undefined, count: 0 };
export const crateContents = (block) => {
  const data = getBlockData(block, EMPTY);
  return data.item && data.count > 0 ? data : EMPTY;
};

function store(block, item, count) {
  if (count > 0) setBlockData(block, { item, count });
  else clearBlockData(block);
  const level = crateLevel(count);
  if (getState(block, "fill") !== level) setStates(block, { fill: level });
}

/** Puts up to `amount` of `item` in; returns how many went in (0 for another kind or a full crate). */
export function depositCrate(block, item, amount) {
  if (!CRATE_ITEMS.has(item)) return 0;
  const { item: held, count } = crateContents(block);
  if (held && held !== item) return 0;
  const n = Math.min(amount, CRATE_CAPACITY - count);
  if (n <= 0) return 0;
  store(block, item, count + n);
  return n;
}

/** Takes up to `amount` out; returns [item, how many]. */
export function withdrawCrate(block, amount) {
  const { item, count } = crateContents(block);
  const n = Math.min(amount, count);
  if (!item || n <= 0) return [undefined, 0];
  store(block, item, count - n);
  return [item, n];
}

export function useCrate(block, player) {
  track(block);
  const held = mainhand(player);
  if (held) {
    if (!CRATE_ITEMS.has(held.typeId)) return false;
    const n = depositCrate(block, held.typeId, held.amount);
    // ## Another kind of produce, or a full crate: the low note, and the stack stays in hand.
    if (!n) return refuse(block);
    consumeMainhand(player, n); // ## not in creative: a creative player keeps the stack and the crate still fills
    playAt(block, SOUND.crateIn);
    return true;
  }
  const { item, count } = crateContents(block);
  if (!item) return false;
  if (player.isSneaking) {
    const inventory = containerOf(player);
    if (!inventory) return false;
    const left = putInto(inventory, item, count);
    if (left === count) return refuse(block);
    store(block, item, left);
  } else {
    const [taken, n] = withdrawCrate(block, PRODUCE_CRATE.stackSize);
    player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Mainhand, new ItemStack(taken, n));
  }
  playAt(block, SOUND.crateOut);
  return true;
}

export function brokeCrate(block) {
  const { item, count } = crateContents(block);
  for (let left = count; left > 0; left -= PRODUCE_CRATE.stackSize) dropAt(block, item, Math.min(left, PRODUCE_CRATE.stackSize));
  clearBlockData(block);
  untrack(block);
}

/** The first produce a container holds, in slot order. */
function firstProduce(container) {
  for (let i = 0; i < container.size; i++) {
    const id = container.getItem(i)?.typeId;
    if (id && CRATE_ITEMS.has(id)) return id;
  }
  return undefined;
}

/**
 * One hopper pass: up to PRODUCE_CRATE.perPass of the crate's produce (or, empty, of the first
 * produce above) comes in from above, and up to as many goes out into the container below.
 */
export function automateCrate(block, above, below) {
  let moved = false;
  if (above) {
    const item = crateContents(block).item ?? firstProduce(above);
    const room = item ? CRATE_CAPACITY - crateContents(block).count : 0;
    const taken = item && room > 0 ? takeFrom(above, [item], Math.min(room, PRODUCE_CRATE.perPass)).length : 0;
    if (taken) moved = depositCrate(block, item, taken) > 0;
  }
  if (below) {
    const { item, count } = crateContents(block);
    if (item) {
      const n = Math.min(count, PRODUCE_CRATE.perPass);
      const left = putInto(below, item, n);
      if (left < n) {
        withdrawCrate(block, n - left);
        moved = true;
      }
    }
  }
  if (moved) playAt(block, SOUND.crateIn, { volume: 0.4 });
}
registerAutomated(rid(PRODUCE_CRATE.id), automateCrate);

export const crateComponent = {
  onPlace({ block }) {
    track(block);
  },
  onRandomTick({ block }) {
    track(block);
  },
  onPlayerInteract({ block, player }) {
    if (player) useCrate(block, player);
  },
  onPlayerBreak({ block }) {
    brokeCrate(block);
  },
};
