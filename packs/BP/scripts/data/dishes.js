// Every recipe in the add-on, made from the active menu rows (data/menu.js).
// Each recipe is the row's `make` plus `result` (the item it is the row of).
// Plain data: no @minecraft imports.
//
// Who handles which station:
//   Cookery (api/cookeryContent.js)   chopping_board, millstone, wok, stockpot, steamer, teapot, bamboo_tray
//   Harvest (stations/*.js)           juicer, pickling_jar
//   vanilla (tools/generate.mjs)      crafting, furnace

import { ACTIVE_MENU } from "./items.js";
import { rid } from "./ns.js";

export const COOKERY_STATIONS = ["chopping_board", "millstone", "wok", "stockpot", "steamer", "teapot", "bamboo_tray"];

export const RECIPES = ACTIVE_MENU.filter((row) => row.make).map((row) => ({ result: row.item.id, ...row.make }));

/** The ids a recipe takes in (namespaced; the juicer's "any fruit" gives none). */
export const inputsOf = (row) => {
  const ids = [];
  if (row.input && row.input !== "*") ids.push(row.input);
  for (const id of row.inputs ?? []) ids.push(id);
  for (const slot of row.slots ?? []) ids.push(...slot);
  return ids.map(rid);
};
/** The ids a recipe gives (without namespace). */
export const outputsOf = (row) => (row.outputs ? row.outputs.map(([id]) => id) : [row.result]);
/** The recipe that makes an item, if any. */
export const recipeMaking = (id) => RECIPES.find((row) => outputsOf(row).includes(id));
