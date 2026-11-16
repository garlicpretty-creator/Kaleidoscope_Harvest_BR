// How Harvest's ingredients and dishes are made on Cookery's stations.
// api/cookeryContent.js turns each row into a `register_recipe` payload.
// Plain data: no @minecraft imports.
//
// station:
//   chopping_board  one `input` item, cut `cuts` times, gives `count` of the result
//   wok             `slots`: each slot lists the items that may fill it (any one)
//   stockpot        exact stockpot recipe, `slots` as above, water as the base
//   steamer         one `input` item becomes the result
// carrier: what the player holds to take the dish out ("" = by hand).
//
// ## M1 keeps to the four stations whose payloads Ranching already uses against
// ## Cookery 1.6.6; teapot, millstone and bamboo tray rows come with M2–M4 once
// ## their payload fields are checked against Cookery's API document.

import { rid } from "./ns.js";

const BOWL = "minecraft:bowl";

export const RECIPES = [
  { result: "chopped_scallion", station: "chopping_board", input: "scallion", count: 2, cuts: 2 },
  { result: "smashed_cucumber", station: "chopping_board", input: "cucumber", count: 1, cuts: 3 },
  {
    result: "scallion_omelette", station: "wok", carrier: BOWL, time: 200,
    slots: [[rid("chopped_scallion")], ["minecraft:egg"]],
  },
  {
    result: "napa_cabbage_pork_stew", station: "stockpot", carrier: BOWL, time: 400,
    slots: [[rid("napa_cabbage")], [rid("napa_cabbage")], ["minecraft:porkchop"]],
  },
  { result: "steamed_corn", station: "steamer", input: "corn", time: 200 },
  {
    result: "mandarin_sweet_soup", station: "stockpot", carrier: BOWL, time: 300,
    slots: [[rid("mandarin")], [rid("mandarin")], ["minecraft:sugar"]],
  },
];
