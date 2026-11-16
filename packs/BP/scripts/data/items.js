// Harvest's plain items: seeds, produce, prepared ingredients and dishes.
// Crop and tree blocks live in data/crops.js and data/trees.js; this table is
// everything that is only an item. Plain data: no @minecraft imports.
//
// kind:
//   seed        plants a crop (the crop row names it as `seed`)
//   produce     what a crop or tree gives (may also be what plants it)
//   ingredient  prepared on a station, used in other recipes (企劃書「中間食材」)  ┐ from
//   dish        a finished dish                                                 ├ data/menu.js
//   drink       juice and tea                                                   ┘
// food: [nutrition, saturation] when it can be eaten.
// look: placeholder icon (tools/art.mjs): [shape, [r, g, b]].

import { activeMenu } from "./menu.js";

const seed = (id, zh, en, rgb) => ({ id, kind: "seed", zh, en, look: ["seeds", rgb] });

const BASE_ITEMS = [
  // --- Seeds ------------------------------------------------------------------------
  seed("napa_cabbage_seeds", "大白菜種子", "Napa Cabbage Seeds", [186, 160, 96]),
  seed("bok_choy_seeds", "青江菜種子", "Bok Choy Seeds", [120, 90, 60]),
  seed("spinach_seeds", "菠菜種子", "Spinach Seeds", [150, 140, 90]),
  seed("onion_seeds", "洋蔥種子", "Onion Seeds", [60, 50, 46]),
  seed("daikon_seeds", "白蘿蔔種子", "Daikon Seeds", [170, 120, 80]),
  seed("eggplant_seeds", "茄子種子", "Eggplant Seeds", [220, 200, 150]),
  seed("cucumber_seeds", "小黃瓜種子", "Cucumber Seeds", [230, 222, 170]),
  seed("corn_seeds", "玉米種子", "Corn Seeds", [236, 196, 80]),
  seed("cilantro_seeds", "香菜種子", "Cilantro Seeds", [190, 170, 110]),

  // --- Produce (vegetables) -------------------------------------------------------------
  { id: "napa_cabbage", kind: "produce", zh: "大白菜", en: "Napa Cabbage", food: [2, 0.3], look: ["head", [214, 232, 178]] },
  { id: "bok_choy", kind: "produce", zh: "青江菜", en: "Bok Choy", food: [1, 0.3], look: ["leafy", [110, 180, 90]] },
  { id: "spinach", kind: "produce", zh: "菠菜", en: "Spinach", food: [1, 0.3], look: ["leafy", [56, 126, 56]] },
  { id: "onion", kind: "produce", zh: "洋蔥", en: "Onion", look: ["bulb", [196, 140, 80]] },
  { id: "daikon", kind: "produce", zh: "白蘿蔔", en: "Daikon", food: [2, 0.3], look: ["root", [240, 240, 228]] },
  { id: "eggplant", kind: "produce", zh: "茄子", en: "Eggplant", look: ["long", [100, 50, 120]] },
  { id: "cucumber", kind: "produce", zh: "小黃瓜", en: "Cucumber", food: [2, 0.4], look: ["long", [70, 140, 58]] },
  { id: "corn", kind: "produce", zh: "玉米", en: "Corn", food: [2, 0.3], look: ["cob", [242, 204, 72]] },
  { id: "soybean", kind: "produce", zh: "大豆", en: "Soybean", look: ["pod", [214, 196, 120]] },
  { id: "peanut", kind: "produce", zh: "花生", en: "Peanut", food: [1, 0.2], look: ["pod", [200, 170, 110]] },
  { id: "sweet_potato", kind: "produce", zh: "地瓜", en: "Sweet Potato", food: [1, 0.3], look: ["root", [170, 80, 90]] },
  { id: "taro", kind: "produce", zh: "芋頭", en: "Taro", look: ["root", [150, 130, 120]] },

  // --- Produce (spices) -------------------------------------------------------------------
  // ## The scallion, garlic, ginger, sesame, black pepper and cumin are also what plant them.
  { id: "scallion", kind: "produce", zh: "蔥", en: "Scallion", look: ["stalk", [96, 176, 72]] },
  { id: "garlic", kind: "produce", zh: "大蒜", en: "Garlic", look: ["bulb", [236, 228, 210]] },
  { id: "ginger", kind: "produce", zh: "薑", en: "Ginger", look: ["root", [222, 190, 120]] },
  { id: "cilantro", kind: "produce", zh: "香菜", en: "Cilantro", look: ["leafy", [96, 176, 80]] },
  { id: "sesame", kind: "produce", zh: "芝麻", en: "Sesame", look: ["seeds", [236, 226, 200]] },
  { id: "black_pepper", kind: "produce", zh: "黑胡椒", en: "Black Pepper", look: ["seeds", [60, 40, 36]] },
  { id: "cumin", kind: "produce", zh: "孜然", en: "Cumin", look: ["seeds", [170, 140, 90]] },

  // --- Fruit -------------------------------------------------------------------------------
  { id: "mandarin", kind: "produce", zh: "橘子", en: "Mandarin", food: [3, 0.4], look: ["round", [244, 150, 40]] },
];

/** The menu rows (data/menu.js) whose Harvest inputs all exist. */
export const ACTIVE_MENU = activeMenu(BASE_ITEMS.map((item) => item.id));

export const ITEMS = [...BASE_ITEMS, ...ACTIVE_MENU.map((row) => row.item)];

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
