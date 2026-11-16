// Harvest's plain items: seeds, produce, prepared ingredients and dishes.
// Crop and tree blocks live in data/crops.js and data/trees.js; this table is
// everything that is only an item. Plain data: no @minecraft imports.
//
// kind:
//   seed        plants a crop (the crop row names it as `seed`)
//   produce     what a crop or tree gives (may also be what plants it)
//   ingredient  prepared on a Cookery station, used in other recipes (企劃書「中間食材」)
//   dish        a finished dish
// data/dishes.js says how ingredients and dishes are made.
// food: [nutrition, saturation] when it can be eaten.
// look: placeholder icon (tools/art.mjs): [shape, [r, g, b]].

const seed = (id, zh, en, rgb) => ({ id, kind: "seed", zh, en, look: ["seeds", rgb] });

export const ITEMS = [
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

  // --- Prepared ingredients: chopping board -------------------------------------------------
  { id: "chopped_scallion", kind: "ingredient", zh: "蔥花", en: "Chopped Scallion", look: ["bits", [110, 186, 80]] },
  { id: "minced_garlic", kind: "ingredient", zh: "蒜末", en: "Minced Garlic", look: ["bits", [240, 234, 216]] },
  { id: "ginger_shreds", kind: "ingredient", zh: "薑絲", en: "Ginger Shreds", look: ["bits", [226, 196, 120]] },
  { id: "chopped_cilantro", kind: "ingredient", zh: "香菜末", en: "Chopped Cilantro", look: ["bits", [90, 170, 76]] },
  { id: "diced_onion", kind: "ingredient", zh: "洋蔥丁", en: "Diced Onion", look: ["bits", [226, 200, 160]] },
  { id: "daikon_slices", kind: "ingredient", zh: "蘿蔔塊", en: "Daikon Chunks", look: ["bits", [244, 244, 232]] },

  // --- Prepared ingredients: millstone --------------------------------------------------------
  { id: "sesame_powder", kind: "ingredient", zh: "芝麻粉", en: "Sesame Powder", look: ["powder", [80, 70, 64]] },
  { id: "sesame_oil", kind: "ingredient", zh: "芝麻油", en: "Sesame Oil", look: ["bottle", [170, 110, 40]] },
  { id: "peanut_oil", kind: "ingredient", zh: "花生油", en: "Peanut Oil", look: ["bottle", [230, 190, 80]] },
  { id: "soy_milk", kind: "ingredient", zh: "豆漿", en: "Soy Milk", food: [3, 0.4], look: ["bottle", [244, 238, 220]] },
  // ## 豆渣: left over from soy milk; Ranching's feed mixer takes it once its feed API is out (M5).
  { id: "okara", kind: "ingredient", zh: "豆渣", en: "Okara", look: ["powder", [236, 226, 196]] },
  { id: "ground_black_pepper", kind: "ingredient", zh: "黑胡椒粉", en: "Ground Black Pepper", look: ["powder", [70, 60, 56]] },
  { id: "ground_cumin", kind: "ingredient", zh: "孜然粉", en: "Ground Cumin", look: ["powder", [160, 120, 70]] },

  // --- Dishes ------------------------------------------------------------------------------------
  // ## M2 keeps one dish per crop that has no other use yet; the full menu is M4.
  { id: "smashed_cucumber", kind: "dish", zh: "拍黃瓜", en: "Smashed Cucumber Salad", food: [4, 0.5], bowl: true, look: ["bowl", [96, 160, 76]] },
  { id: "scallion_omelette", kind: "dish", zh: "蔥花炒蛋", en: "Scallion Omelette", food: [6, 0.6], bowl: true, look: ["bowl", [246, 214, 96]] },
  { id: "napa_cabbage_pork_stew", kind: "dish", zh: "白菜燉肉", en: "Napa Cabbage and Pork Stew", food: [10, 0.8], bowl: true, look: ["bowl", [226, 206, 170]] },
  { id: "steamed_corn", kind: "dish", zh: "蒸玉米", en: "Steamed Corn", food: [5, 0.6], look: ["cob", [250, 220, 100]] },
  { id: "mandarin_sweet_soup", kind: "dish", zh: "橘子糖水", en: "Mandarin Sweet Soup", food: [5, 0.5], bowl: true, look: ["bowl", [248, 176, 72]] },
  { id: "garlic_bok_choy", kind: "dish", zh: "蒜炒青菜", en: "Garlic Bok Choy", food: [5, 0.6], bowl: true, look: ["bowl", [100, 170, 80]] },
  { id: "garlic_spinach", kind: "dish", zh: "蒜炒菠菜", en: "Garlic Spinach", food: [5, 0.6], bowl: true, look: ["bowl", [60, 130, 60]] },
  { id: "onion_omelette", kind: "dish", zh: "洋蔥炒蛋", en: "Onion Omelette", food: [6, 0.6], bowl: true, look: ["bowl", [240, 210, 120]] },
  { id: "braised_eggplant", kind: "dish", zh: "紅燒茄子", en: "Braised Eggplant", food: [7, 0.6], bowl: true, look: ["bowl", [120, 60, 110]] },
  { id: "daikon_beef_stew", kind: "dish", zh: "蘿蔔燉牛腩", en: "Daikon and Beef Stew", food: [11, 0.8], bowl: true, look: ["bowl", [200, 150, 110]] },
  { id: "steamed_sweet_potato", kind: "dish", zh: "蒸地瓜", en: "Steamed Sweet Potato", food: [6, 0.6], look: ["root", [230, 140, 70]] },
  { id: "steamed_taro", kind: "dish", zh: "蒸芋頭", en: "Steamed Taro", food: [6, 0.6], look: ["root", [190, 170, 200]] },
];

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
