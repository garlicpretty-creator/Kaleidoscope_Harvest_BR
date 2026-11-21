// The harvest basket (採收籃, data/gear.js). Held in the main hand or the off hand, it picks the
// ripe repeatable, trellis and bush crops (growth/crops.js isPicked) the player walks past, within
// HARVEST_BASKET.reach blocks of their feet, as if each were picked by hand; the produce goes into
// the player's inventory and only what does not fit drops.
//
// ## Cost (Harvest's rule: random ticks and player use only, no per-tick scans). Only players
// ## holding a basket are looked at, on a light interval:
// ##  - who holds one is learnt from the hotbar and inventory events, and from a check of each
// ##    player's two hands every HARVEST_BASKET.rosterTicks (the off hand has no event); no blocks;
// ##  - every HARVEST_BASKET.ticks a holder who has moved since the last look gets one look at the
// ##    3 × 2 × 3 blocks round their feet. A holder standing still costs nothing; nobody holding a
// ##    basket, nothing at all.

import { EquipmentSlot, system, world } from "@minecraft/server";
import { HARVEST_BASKET } from "../data/gear.js";
import { rid } from "../data/ns.js";
import { containerOf } from "../utils/containers.js";
import { cropOfBlock, pickCrop, ripeForPicking } from "./crops.js";

const BASKET = rid(HARVEST_BASKET.id);

/** player id → { player, at } (at: where they stood at the last look). */
const holders = new Map();

/** Test hook and the roster: who is holding a basket now. */
export const basketHolders = () => [...holders.values()].map((h) => h.player);

export function holdsBasket(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    return [EquipmentSlot.Mainhand, EquipmentSlot.Offhand].some((slot) => equippable?.getEquipment(slot)?.typeId === BASKET);
  } catch {
    return false;
  }
}

/** Adds or drops one player from the holders by what is in their hands now. */
export function checkHolder(player) {
  if (!player) return;
  if (player.isValid !== false && holdsBasket(player)) {
    if (!holders.has(player.id)) holders.set(player.id, { player, at: undefined });
  } else holders.delete(player.id);
}

export function rosterPass() {
  for (const player of world.getAllPlayers()) checkHolder(player);
  for (const [id, { player }] of holders) if (player.isValid === false) holders.delete(id);
}

const moved = (a, b) => !a || Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= HARVEST_BASKET.moved;

/** Picks what is ripe round one player's feet; returns how many crops were picked. */
export function pickAround(player) {
  const { x, y, z } = player.location;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);
  const into = containerOf(player);
  const r = HARVEST_BASKET.reach;
  let picked = 0;
  // ## dy 0 and 1: standing on farmland (15/16 high) the feet are inside the farmland block, so
  // ## the crops are one up; on a path or grass they are level with the feet.
  for (let dy = 0; dy <= 1; dy++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        let block;
        try {
          block = player.dimension.getBlock({ x: fx + dx, y: fy + dy, z: fz + dz });
        } catch {
          continue;
        }
        const crop = block && cropOfBlock(block.typeId);
        if (!crop || !ripeForPicking(block, crop)) continue;
        pickCrop(block, crop, into);
        picked++;
      }
  return picked;
}

export function basketPass() {
  for (const [id, holder] of holders) {
    const { player } = holder;
    if (player.isValid === false || !holdsBasket(player)) {
      holders.delete(id);
      continue;
    }
    const here = { ...player.location };
    if (!moved(holder.at, here)) continue;
    holder.at = here;
    try {
      pickAround(player);
    } catch {
      // ## A player changing dimension mid-pass: next pass.
    }
  }
}

/** Test hook. */
export function resetBasket() {
  holders.clear();
}

export function startBasket() {
  const hotbar = world.afterEvents?.playerHotbarSelectedSlotChange;
  const inventory = world.afterEvents?.playerInventoryItemChange;
  hotbar?.subscribe(({ player }) => checkHolder(player));
  inventory?.subscribe(({ player }) => checkHolder(player));
  world.afterEvents?.playerLeave?.subscribe(({ playerId }) => holders.delete(playerId));
  system.runInterval(rosterPass, HARVEST_BASKET.rosterTicks);
  system.runInterval(() => {
    if (holders.size) basketPass();
  }, HARVEST_BASKET.ticks);
}
