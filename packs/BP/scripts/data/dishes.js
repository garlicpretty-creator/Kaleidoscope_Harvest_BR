// How Harvest's ingredients and dishes are made on Cookery's stations.
// api/cookeryContent.js turns each row into a `register_recipe` payload.
// Plain data: no @minecraft imports.
//
// station:
//   chopping_board  one `input` item, cut `cuts` times, gives `count` of the result
//   millstone       one `input` item ground into `outputs` ([id, count, chance?] each);
//                   the first output is the row's `result`
//   wok             `slots`: each slot lists the items that may fill it (any one)
//   stockpot        exact stockpot recipe, `slots` as above, water as the base
//   steamer         one `input` item becomes the result
// carrier: what the player holds to take the dish out ("" = by hand).
//
// ## Payload fields follow what Ranching 1.1 (wok, stockpot, steamer, chopping board)
// ## and Herbal 1.2 (millstone) send to Cookery 1.6.6. Teapot and bamboo tray come in
// ## M3–M4 with the drinks and dried fruit that need them.

import { rid } from "./ns.js";

const BOWL = "minecraft:bowl";
const board = (input, result, count, cuts) => ({ result, station: "chopping_board", input, count, cuts });
const mill = (input, outputs) => ({ result: outputs[0][0], station: "millstone", input, outputs });
const wok = (result, slots, time = 200) => ({ result, station: "wok", carrier: BOWL, time, slots });
const pot = (result, slots, time = 400) => ({ result, station: "stockpot", carrier: BOWL, time, slots });
const steam = (input, result, time = 200) => ({ result, station: "steamer", input, time });
const r = (id) => [rid(id)];
const v = (id) => [`minecraft:${id}`];

export const RECIPES = [
  // --- Chopping board ----------------------------------------------------------------------
  board("scallion", "chopped_scallion", 2, 2),
  board("garlic", "minced_garlic", 3, 3),
  board("ginger", "ginger_shreds", 2, 3),
  board("cilantro", "chopped_cilantro", 2, 2),
  board("onion", "diced_onion", 2, 3),
  board("daikon", "daikon_slices", 3, 3),
  board("cucumber", "smashed_cucumber", 1, 3),

  // --- Millstone ------------------------------------------------------------------------------
  mill("sesame", [["sesame_powder", 1], ["sesame_oil", 1, 0.5]]),
  mill("peanut", [["peanut_oil", 1, 0.5]]),
  mill("soybean", [["soy_milk", 1], ["okara", 1]]),
  mill("black_pepper", [["ground_black_pepper", 2]]),
  mill("cumin", [["ground_cumin", 2]]),

  // --- Wok -------------------------------------------------------------------------------------
  wok("scallion_omelette", [r("chopped_scallion"), v("egg")]),
  wok("garlic_bok_choy", [r("bok_choy"), r("bok_choy"), r("minced_garlic")]),
  wok("garlic_spinach", [r("spinach"), r("spinach"), r("minced_garlic")]),
  wok("onion_omelette", [r("diced_onion"), v("egg")]),
  wok("braised_eggplant", [r("eggplant"), r("eggplant"), r("minced_garlic"), r("chopped_scallion")], 300),

  // --- Stockpot -----------------------------------------------------------------------------------
  pot("napa_cabbage_pork_stew", [r("napa_cabbage"), r("napa_cabbage"), v("porkchop")]),
  pot("mandarin_sweet_soup", [r("mandarin"), r("mandarin"), v("sugar")], 300),
  pot("daikon_beef_stew", [r("daikon_slices"), v("beef"), r("ginger_shreds")], 600),

  // --- Steamer --------------------------------------------------------------------------------------
  steam("corn", "steamed_corn"),
  steam("sweet_potato", "steamed_sweet_potato", 300),
  steam("taro", "steamed_taro", 300),
];

/** The ids a recipe takes in (namespaced). */
export const inputsOf = (row) => (row.input ? [rid(row.input)] : row.slots.flat());
/** The ids a recipe gives (without namespace). */
export const outputsOf = (row) => (row.outputs ? row.outputs.map(([id]) => id) : [row.result]);
/** The recipe that makes an item, if any. */
export const recipeMaking = (id) => RECIPES.find((row) => outputsOf(row).includes(id));
