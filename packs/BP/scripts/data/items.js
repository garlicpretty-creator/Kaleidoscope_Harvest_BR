// Harvest's plain items: seeds, produce, prepared ingredients and dishes.
// Crop and tree blocks live in data/crops.js and data/trees.js; this table is
// everything that is only an item. Plain data: no @minecraft imports.
//
// kind:
//   seed        plants a crop (the crop row names it as `seed`)
//   produce     what a crop or tree gives
//   ingredient  prepared on a Cookery station, used in other recipes (企劃書「中間食材」)
//   dish        a finished dish (data/dishes.js holds the recipe)
// food: [nutrition, saturation] when it can be eaten.
// look: placeholder icon (tools/art.mjs): [shape, [r, g, b]].

export const ITEMS = [
  // --- Seeds ------------------------------------------------------------------------
  { id: "napa_cabbage_seeds", kind: "seed", zh: "大白菜種子", en: "Napa Cabbage Seeds", look: ["seeds", [186, 160, 96]] },
  { id: "corn_seeds", kind: "seed", zh: "玉米種子", en: "Corn Seeds", look: ["seeds", [236, 196, 80]] },
  { id: "cucumber_seeds", kind: "seed", zh: "小黃瓜種子", en: "Cucumber Seeds", look: ["seeds", [230, 222, 170]] },

  // --- Produce ----------------------------------------------------------------------
  { id: "napa_cabbage", kind: "produce", zh: "大白菜", en: "Napa Cabbage", food: [2, 0.3], look: ["head", [214, 232, 178]] },
  // ## The scallion is also what plants a scallion (data/crops.js).
  { id: "scallion", kind: "produce", zh: "蔥", en: "Scallion", look: ["stalk", [96, 176, 72]] },
  { id: "corn", kind: "produce", zh: "玉米", en: "Corn", food: [2, 0.3], look: ["cob", [242, 204, 72]] },
  { id: "cucumber", kind: "produce", zh: "小黃瓜", en: "Cucumber", food: [2, 0.4], look: ["long", [70, 140, 58]] },
  { id: "mandarin", kind: "produce", zh: "橘子", en: "Mandarin", food: [3, 0.4], look: ["round", [244, 150, 40]] },

  // --- Prepared ingredients ---------------------------------------------------------------
  { id: "chopped_scallion", kind: "ingredient", zh: "蔥花", en: "Chopped Scallion", look: ["bits", [110, 186, 80]] },

  // --- Dishes (recipes in data/dishes.js) ---------------------------------------------------
  { id: "smashed_cucumber", kind: "dish", zh: "拍黃瓜", en: "Smashed Cucumber Salad", food: [4, 0.5], bowl: true, look: ["bowl", [96, 160, 76]] },
  { id: "scallion_omelette", kind: "dish", zh: "蔥花炒蛋", en: "Scallion Omelette", food: [6, 0.6], bowl: true, look: ["bowl", [246, 214, 96]] },
  { id: "napa_cabbage_pork_stew", kind: "dish", zh: "白菜燉肉", en: "Napa Cabbage and Pork Stew", food: [10, 0.8], bowl: true, look: ["bowl", [226, 206, 170]] },
  { id: "steamed_corn", kind: "dish", zh: "蒸玉米", en: "Steamed Corn", food: [5, 0.6], look: ["cob", [250, 220, 100]] },
  { id: "mandarin_sweet_soup", kind: "dish", zh: "橘子糖水", en: "Mandarin Sweet Soup", food: [5, 0.5], bowl: true, look: ["bowl", [248, 176, 72]] },
];

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
