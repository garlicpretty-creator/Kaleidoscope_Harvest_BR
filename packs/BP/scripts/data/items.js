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
  seed("coriander_seeds", "香菜種子", "Coriander Seeds", [190, 170, 110]),
  seed("scallion_seeds", "蔥種子", "Scallion Seeds", [40, 36, 34]),
  { id: "black_pepper_seedling", kind: "seed", zh: "黑胡椒藤苗", en: "Black Pepper Seedling", look: ["leafy", [80, 150, 70]] },

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
  // ## Garlic, ginger, sesame and cumin are also what plant them.
  { id: "scallion", kind: "produce", zh: "蔥", en: "Scallion", look: ["stalk", [96, 176, 72]] },
  { id: "garlic", kind: "produce", zh: "大蒜", en: "Garlic", look: ["bulb", [236, 228, 210]] },
  { id: "ginger", kind: "produce", zh: "薑", en: "Ginger", look: ["root", [222, 190, 120]] },
  { id: "coriander", kind: "produce", zh: "香菜", en: "Coriander", look: ["leafy", [96, 176, 80]] },
  { id: "sesame", kind: "produce", zh: "芝麻", en: "Sesame", look: ["seeds", [236, 226, 200]] },
  { id: "black_peppercorns", kind: "produce", zh: "黑胡椒", en: "Black Peppercorns", look: ["seeds", [60, 40, 36]] },
  { id: "cumin", kind: "produce", zh: "孜然", en: "Cumin", look: ["seeds", [170, 140, 90]] },

  // --- Fruit (crops) ------------------------------------------------------------------------
  seed("strawberry_seeds", "草莓苗", "Strawberry Runner", [80, 150, 70]),
  { id: "blueberry_seedling", kind: "seed", zh: "藍莓苗", en: "Blueberry Seedling", look: ["leafy", [70, 120, 70]] },
  { id: "grape_cutting", kind: "seed", zh: "葡萄藤苗", en: "Grape Cutting", look: ["stalk", [120, 90, 60]] },
  seed("passion_fruit_seeds", "百香果種子", "Passion Fruit Seeds", [40, 34, 30]),
  { id: "pineapple_crown", kind: "seed", zh: "鳳梨冠芽", en: "Pineapple Crown", look: ["leafy", [90, 140, 80]] },
  { id: "strawberry", kind: "produce", zh: "草莓", en: "Strawberry", food: [2, 0.3], look: ["round", [220, 40, 50]] },
  { id: "blueberry", kind: "produce", zh: "藍莓", en: "Blueberry", food: [1, 0.3], look: ["pod", [60, 70, 150]] },
  { id: "grape", kind: "produce", zh: "葡萄", en: "Grape", food: [2, 0.3], look: ["pod", [110, 40, 100]] },
  { id: "passion_fruit", kind: "produce", zh: "百香果", en: "Passion Fruit", food: [2, 0.3], look: ["round", [90, 40, 90]] },
  { id: "pineapple", kind: "produce", zh: "鳳梨", en: "Pineapple", food: [3, 0.4], look: ["round", [230, 180, 60]] },

  // --- Fruit (trees, data/trees.js) ---------------------------------------------------------
  { id: "mandarin", kind: "produce", zh: "橘子", en: "Mandarin", food: [3, 0.4], look: ["round", [244, 150, 40]] },
  { id: "sweet_orange", kind: "produce", zh: "柳橙", en: "Orange", food: [3, 0.4], look: ["round", [250, 140, 30]] },
  { id: "lemon", kind: "produce", zh: "檸檬", en: "Lemon", look: ["round", [246, 226, 70]] },
  { id: "peach", kind: "produce", zh: "桃子", en: "Peach", food: [4, 0.4], look: ["round", [250, 170, 150]] },
  { id: "pear", kind: "produce", zh: "梨", en: "Pear", food: [4, 0.4], look: ["round", [220, 220, 130]] },
  { id: "persimmon", kind: "produce", zh: "柿子", en: "Persimmon", food: [3, 0.4], look: ["round", [240, 120, 30]] },
  { id: "lychee", kind: "produce", zh: "荔枝", en: "Lychee", food: [2, 0.4], look: ["pod", [200, 50, 60]] },
  { id: "mango", kind: "produce", zh: "芒果", en: "Mango", food: [4, 0.5], look: ["round", [244, 184, 40]] },
  { id: "banana", kind: "produce", zh: "香蕉", en: "Banana", food: [4, 0.4], look: ["long", [246, 220, 80]] },
  { id: "star_anise", kind: "produce", zh: "八角", en: "Star Anise", look: ["pod", [140, 70, 40]] },
  { id: "cinnamon_bark", kind: "produce", zh: "肉桂皮", en: "Cinnamon Bark", look: ["long", [150, 80, 50]] },
];

/** The menu rows (data/menu.js) whose Harvest inputs all exist. */
export const ACTIVE_MENU = activeMenu(BASE_ITEMS.map((item) => item.id));

export const ITEMS = [...BASE_ITEMS, ...ACTIVE_MENU.map((row) => row.item)];

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
