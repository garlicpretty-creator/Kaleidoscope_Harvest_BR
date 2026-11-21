// Harvest's tools and storage (owner's convenience update, phase 3): the fruit-picking pole,
// the harvest basket and the produce crate. Plain data: no @minecraft imports.
//
// ## All three keep Harvest's rule "random ticks and player use only, no per-tick scans":
// ##  - the pole looks round the block it is used on, once per use;
// ##  - the basket only looks at the blocks round the feet of players holding one, on a light
// ##    interval, and a player is only on that list while holding it (growth/basket.js);
// ##  - the crate is a block with its contents in a dynamic property, moved by player use and
// ##    by the hopper pass the stations already have (stations/automation.js).

/** 摘果竿: used on a fruit tree's leaves or hanging fruit, picks every ripe fruit within `radius`. */
export const PICKING_POLE = {
  id: "fruit_picking_pole",
  zh: "摘果竿",
  en: "Fruit-Picking Pole",
  /** Blocks from the one used on, on every axis (a 7 × 7 × 7 cube). */
  radius: 3,
  durability: 128,
  /** Fruitwood planks mend it on an anvil. */
  repairAmount: 32,
  /** Leaf bits shaken off (tools/generate.mjs writes the particle). */
  particle: "leaf_rustle",
};

/** 採收籃: held in either hand, it picks the ripe repeatable and trellis crops the player walks past. */
export const HARVEST_BASKET = {
  id: "harvest_basket",
  zh: "採收籃",
  en: "Harvest Basket",
  /** Blocks round the player's feet, sideways. */
  reach: 1,
  /** Ticks between two looks for a player holding one. */
  ticks: 8,
  /** Ticks between two checks of who is holding one (equipment only, no blocks). */
  rosterTicks: 40,
  /** A player who stands still is not looked at again until they move this far. */
  moved: 0.35,
};

/** 果菜箱: holds up to `stacks` stacks of one kind of Harvest produce. */
export const PRODUCE_CRATE = {
  id: "produce_crate",
  zh: "果菜箱",
  en: "Produce Crate",
  stacks: 9,
  stackSize: 64,
  /** Fill looks of the model: 0 empty, then thirds (tools/art/stations.py draws produce_crate_<n>). */
  levels: 3,
  /** Items moved per hopper pass, in and out. */
  perPass: 16,
};

/** How full a crate looks for `count` items. */
export function crateLevel(count) {
  if (count <= 0) return 0;
  const cap = PRODUCE_CRATE.stacks * PRODUCE_CRATE.stackSize;
  return Math.min(PRODUCE_CRATE.levels, Math.ceil((count / cap) * PRODUCE_CRATE.levels));
}
