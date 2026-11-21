// Block and player containers (hoppers, chests, barrels, a player's inventory).
// Ported from Ranching's core/containers.js: Bedrock hoppers cannot push into or
// pull from custom blocks, so Harvest's stations reach into the container above
// them for inputs and put their outputs into the container below
// (stations/automation.js).

import { ItemStack } from "@minecraft/server";

/** The container of a block or an entity (a player's inventory), or undefined if it has none. */
export function containerOf(holder) {
  try {
    return holder?.getComponent("minecraft:inventory")?.container ?? undefined;
  } catch {
    return undefined;
  }
}

/** How many of the given item ids the container holds. */
export function countIn(container, ids) {
  let total = 0;
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (stack && ids.includes(stack.typeId)) total += stack.amount;
  }
  return total;
}

/** Removes `amount` items among `ids` (earlier ids first); returns the ids removed, one per item. */
export function takeFrom(container, ids, amount) {
  const removed = [];
  for (const id of ids) {
    for (let i = 0; i < container.size && removed.length < amount; i++) {
      const stack = container.getItem(i);
      if (!stack || stack.typeId !== id) continue;
      const n = Math.min(stack.amount, amount - removed.length);
      for (let k = 0; k < n; k++) removed.push(id);
      if (stack.amount > n) {
        stack.amount -= n;
        container.setItem(i, stack);
      } else container.setItem(i, undefined);
    }
  }
  return removed;
}

/** Takes every id in `ids` (repeats count: [a, a] is two a) or, when one is short, nothing. */
export function takeAll(container, ids) {
  const need = new Map();
  for (const id of ids) need.set(id, (need.get(id) ?? 0) + 1);
  for (const [id, n] of need) if (countIn(container, [id]) < n) return false;
  for (const [id, n] of need) takeFrom(container, [id], n);
  return true;
}

/** True when `amount` of an item fits (an empty slot, or room on stacks of the same item). */
export function roomFor(container, typeId, amount = 1) {
  let room = 0;
  for (let i = 0; i < container.size && room < amount; i++) {
    const stack = container.getItem(i);
    if (!stack) return true;
    if (stack.typeId === typeId) room += stack.maxAmount - stack.amount;
  }
  return room >= amount;
}

/** Adds items; returns how many did not fit. */
export function putInto(container, typeId, amount) {
  let left = amount;
  while (left > 0) {
    const stack = new ItemStack(typeId, 1);
    const size = Math.min(left, stack.maxAmount);
    stack.amount = size;
    const rest = container.addItem(stack);
    const notPlaced = rest?.amount ?? 0;
    left -= size - notPlaced;
    if (notPlaced) break;
  }
  return left;
}
