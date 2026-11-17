// M4: the menu (企劃書「加工與料理整合」). Every prepared ingredient, dish and
// drink made from a Harvest crop, one row each: the item and how it is made.
// Plain data: no @minecraft imports.
//
// Ids follow the icon set in tools/art/icon_prompts.json, so the drawn icons drop in.
//
// make.station:
//   chopping_board  { input, count, cuts }
//   millstone       { input, outputs: [[id, count, chance?], …] } (the row's id is the first output)
//   wok, stockpot   { slots, time, carrier }   slots: each slot lists the items that may fill it
//   steamer         { input, time }
//   teapot          { input, time, count }     water as the base, poured into Cookery's cups
//   bamboo_tray     { input, time }            dried in the sun
//   juicer          { input }                  Harvest's own: two of one fruit, see data/stations.js
//   pickling_jar    { inputs, time, count }    Harvest's own: an exact set of 1–4 items, sealed
//   crafting        { inputs }                 vanilla shapeless crafting table recipe
//   furnace         { input }                  vanilla furnace and smoker
//
// ## Fruit rows wait for M3 (written in parallel): a row whose Harvest inputs are not all
// ## items yet is left out of everything — items, recipes, guidebook — until they are
// ## (activeMenu below). The ids they wait for are the art set's: strawberry, grape,
// ## sweet_orange, lemon, peach, pear, persimmon, lychee, mango, banana, star_anise,
// ## cinnamon_bark, blueberry, passion_fruit, pineapple.

const NS = "kaleidoscope_harvest";
const h = (id) => `${NS}:${id}`;
const mc = (id) => `minecraft:${id}`;
const BOWL = mc("bowl");
const CUP = "kaleidoscope_cookery:empty_cup";
const DAY = 24000;

const ing = (id, zh, en, look, make, extra = {}) => ({ item: { id, kind: "ingredient", zh, en, look, ...extra }, make });
const dish = (id, zh, en, food, look, make, extra = {}) => ({ item: { id, kind: "dish", zh, en, food, look, ...extra }, make });
const drink = (id, zh, en, food, look, make, converts) => ({ item: { id, kind: "drink", zh, en, food, look, converts }, make });

const wok = (slots, time = 200) => ({ station: "wok", slots, time, carrier: BOWL });
const pot = (slots, time = 400) => ({ station: "stockpot", slots, time, carrier: BOWL });
const S = (...ids) => ids.map((id) => [id.includes(":") ? id : h(id)]);

export const MENU = [
  // --- Prepared ingredients -------------------------------------------------------------------
  ing("chopped_scallion", "蔥花", "Chopped Scallion", ["bits", [110, 186, 80]], { station: "chopping_board", input: "scallion", count: 2, cuts: 2 }),
  ing("minced_garlic", "蒜末", "Minced Garlic", ["bits", [240, 234, 216]], { station: "chopping_board", input: "garlic", count: 3, cuts: 3 }),
  ing("shredded_ginger", "薑絲", "Shredded Ginger", ["bits", [226, 196, 120]], { station: "chopping_board", input: "ginger", count: 2, cuts: 3 }),
  ing("chopped_coriander", "香菜末", "Chopped Coriander", ["bits", [90, 170, 76]], { station: "chopping_board", input: "coriander", count: 2, cuts: 2 }),
  ing("diced_onion", "洋蔥丁", "Diced Onion", ["bits", [226, 200, 160]], { station: "chopping_board", input: "onion", count: 2, cuts: 3 }),
  ing("daikon_slices", "蘿蔔塊", "Daikon Chunks", ["bits", [244, 244, 232]], { station: "chopping_board", input: "daikon", count: 3, cuts: 3 }),
  ing("sesame_powder", "芝麻粉", "Sesame Powder", ["powder", [80, 70, 64]], { station: "millstone", input: "sesame", outputs: [["sesame_powder", 1], ["sesame_oil", 1, 0.5]] }),
  // ## The two oils are Cookery wok oil (api/cookeryContent.js registers them as oil containers).
  ing("sesame_oil", "芝麻油", "Sesame Oil", ["bottle", [170, 110, 40]], null, { oil: true }),
  ing("peanut_butter", "花生醬", "Peanut Butter", ["powder", [176, 120, 60]], { station: "millstone", input: "peanut", outputs: [["peanut_butter", 1], ["peanut_oil", 1, 0.5]] }),
  ing("peanut_oil", "花生油", "Peanut Oil", ["bottle", [230, 190, 80]], null, { oil: true }),
  ing("soy_milk", "豆漿", "Soy Milk", ["bottle", [244, 238, 220]], { station: "millstone", input: "soybean", outputs: [["soy_milk", 1], ["okara", 1]] }, { food: [3, 0.4], converts: mc("glass_bottle") }),
  // ## 豆渣: left over from soy milk; with Ranching it is trough feed (data/integrations.js, M5).
  ing("okara", "豆渣", "Okara", ["powder", [236, 226, 196]], null),
  ing("ground_black_pepper", "黑胡椒粉", "Ground Black Pepper", ["powder", [70, 60, 56]], { station: "millstone", input: "black_peppercorns", outputs: [["ground_black_pepper", 2]] }),
  ing("ground_cumin", "孜然粉", "Ground Cumin", ["powder", [160, 120, 70]], { station: "millstone", input: "cumin", outputs: [["ground_cumin", 2]] }),
  ing("five_spice_powder", "五香粉", "Five-Spice Powder", ["powder", [150, 80, 50]], { station: "millstone", input: "star_anise", outputs: [["five_spice_powder", 2]] }),
  ing("tofu", "豆腐", "Tofu", ["head", [246, 244, 236]], { station: "stockpot", slots: S("soy_milk", "soy_milk"), time: 300, carrier: "", count: 2 }),
  ing("soy_sauce", "醬油", "Soy Sauce", ["bottle", [70, 40, 26]], { station: "pickling_jar", inputs: ["soybean", "soybean", mc("sugar")], time: 3 * DAY, count: 2 }),
  ing("dried_tangerine_peel", "陳皮", "Dried Tangerine Peel", ["bits", [190, 90, 30]], { station: "bamboo_tray", input: "mandarin", time: 12000 }),
  ing("dried_persimmon", "柿餅", "Dried Persimmon", ["round", [200, 110, 50]], { station: "bamboo_tray", input: "persimmon", time: 12000 }, { food: [4, 0.5] }),
  ing("ground_cinnamon", "肉桂粉", "Ground Cinnamon", ["powder", [160, 90, 50]], { station: "millstone", input: "cinnamon_bark", outputs: [["ground_cinnamon", 2]] }),
  ing("raisins", "葡萄乾", "Raisins", ["bits", [80, 40, 60]], { station: "bamboo_tray", input: "grape", time: 12000 }),

  // --- Pickling jar ----------------------------------------------------------------------------
  ing("pickled_napa_cabbage", "醃白菜", "Pickled Napa Cabbage", ["bowl", [230, 224, 170]], { station: "pickling_jar", inputs: ["napa_cabbage", "napa_cabbage"], time: DAY, count: 2 }, { food: [3, 0.4] }),
  ing("kimchi", "泡菜", "Kimchi", ["bowl", [200, 70, 50]], { station: "pickling_jar", inputs: ["napa_cabbage", "minced_garlic", "shredded_ginger"], time: DAY, count: 2 }, { food: [4, 0.5] }),
  ing("pickled_daikon", "醃蘿蔔", "Pickled Daikon", ["bowl", [244, 214, 80]], { station: "pickling_jar", inputs: ["daikon", mc("sugar")], time: DAY, count: 2 }, { food: [3, 0.4] }),
  ing("pickled_cucumber", "醃黃瓜", "Pickled Cucumber", ["bottle", [100, 150, 70]], { station: "pickling_jar", inputs: ["cucumber", "cucumber", "minced_garlic"], time: DAY, count: 2 }, { food: [3, 0.4] }),
  ing("strawberry_jam", "草莓果醬", "Strawberry Jam", ["bottle", [200, 30, 50]], { station: "pickling_jar", inputs: ["strawberry", "strawberry", mc("sugar")], time: DAY / 2, count: 2 }, { food: [4, 0.3], converts: mc("glass_bottle") }),
  ing("blueberry_jam", "藍莓果醬", "Blueberry Jam", ["bottle", [60, 50, 120]], { station: "pickling_jar", inputs: ["blueberry", "blueberry", mc("sugar")], time: DAY / 2, count: 2 }, { food: [4, 0.3], converts: mc("glass_bottle") }),
  ing("persimmon_jam", "柿子果醬", "Persimmon Jam", ["bottle", [230, 120, 40]], { station: "pickling_jar", inputs: ["persimmon", "persimmon", mc("sugar")], time: DAY / 2, count: 2 }, { food: [4, 0.3], converts: mc("glass_bottle") }),
  // ## Harvest's own fruit wines; M5 registers them with Tavern (企劃書：豐收自己的果酒透過握手登記到酒館).
  drink("lychee_wine", "荔枝酒", "Lychee Wine", [3, 0.3], ["bottle", [246, 220, 220]], { station: "pickling_jar", inputs: ["lychee", "lychee", mc("sugar")], time: 5 * DAY, count: 2 }, mc("glass_bottle")),
  drink("peach_wine", "桃子酒", "Peach Wine", [4, 0.3], ["bottle", [250, 190, 160]], { station: "pickling_jar", inputs: ["peach", "peach", mc("sugar")], time: 5 * DAY, count: 2 }, mc("glass_bottle")),
  ing("orange_marmalade", "橙皮果醬", "Orange Marmalade", ["bottle", [240, 140, 30]], { station: "pickling_jar", inputs: ["sweet_orange", "sweet_orange", mc("sugar")], time: DAY / 2, count: 2 }, { food: [4, 0.3], converts: mc("glass_bottle") }),

  // --- Drinks -----------------------------------------------------------------------------------
  drink("mandarin_juice", "橘子汁", "Mandarin Juice", [4, 0.4], ["bottle", [248, 160, 50]], { station: "juicer", input: "mandarin" }, mc("glass_bottle")),
  drink("orange_juice", "柳橙汁", "Orange Juice", [4, 0.4], ["bottle", [250, 150, 30]], { station: "juicer", input: "sweet_orange" }, mc("glass_bottle")),
  drink("grape_juice", "葡萄汁", "Grape Juice", [4, 0.4], ["bottle", [100, 36, 90]], { station: "juicer", input: "grape" }, mc("glass_bottle")),
  drink("mango_juice", "芒果汁", "Mango Juice", [5, 0.4], ["bottle", [244, 184, 40]], { station: "juicer", input: "mango" }, mc("glass_bottle")),
  // ## Two different fruits in the juicer make this (企劃書：可混兩種水果).
  drink("mixed_juice", "綜合果汁", "Mixed Fruit Juice", [5, 0.5], ["bottle", [236, 120, 80]], { station: "juicer", input: "*" }, mc("glass_bottle")),
  drink("passion_fruit_juice", "百香果汁", "Passion Fruit Juice", [4, 0.4], ["bottle", [240, 190, 60]], { station: "juicer", input: "passion_fruit" }, mc("glass_bottle")),
  drink("cinnamon_tea", "肉桂茶", "Cinnamon Tea", [2, 0.3], ["bowl", [170, 90, 50]], { station: "teapot", input: "cinnamon_bark", time: 240, count: 4 }, CUP),
  drink("ginger_tea", "薑母茶", "Ginger Tea", [2, 0.3], ["bowl", [150, 90, 40]], { station: "teapot", input: "shredded_ginger", time: 240, count: 4 }, CUP),
  drink("lemon_tea", "檸檬茶", "Lemon Tea", [2, 0.3], ["bowl", [220, 170, 60]], { station: "teapot", input: "lemon", time: 240, count: 4 }, CUP),
  drink("passion_fruit_tea", "百香果茶", "Passion Fruit Tea", [2, 0.3], ["bowl", [240, 190, 60]], { station: "teapot", input: "passion_fruit", time: 240, count: 4 }, CUP),

  // --- Wok ----------------------------------------------------------------------------------------
  dish("scallion_omelette", "蔥花炒蛋", "Scallion Omelette", [6, 0.6], ["bowl", [246, 214, 96]], wok(S("chopped_scallion", mc("egg")))),
  dish("garlic_bok_choy", "蒜炒青菜", "Garlic Bok Choy", [5, 0.6], ["bowl", [100, 170, 80]], wok(S("bok_choy", "bok_choy", "minced_garlic"))),
  dish("onion_omelette", "洋蔥炒蛋", "Onion Omelette", [6, 0.6], ["bowl", [240, 210, 120]], wok(S("diced_onion", mc("egg")))),
  dish("braised_eggplant", "紅燒茄子", "Braised Eggplant", [7, 0.6], ["bowl", [120, 60, 110]], wok(S("eggplant", "eggplant", "soy_sauce", "chopped_scallion"), 300)),
  dish("yuxiang_eggplant", "魚香茄子", "Yuxiang Eggplant", [9, 0.7], ["bowl", [150, 60, 70]], wok(S("eggplant", mc("porkchop"), "minced_garlic", "shredded_ginger"), 300)),
  dish("kung_pao_chicken", "宮保雞丁", "Kung Pao Chicken", [10, 0.8], ["bowl", [190, 90, 50]], wok(S(mc("chicken"), "peanut", "chopped_scallion", "minced_garlic"), 300)),
  dish("homestyle_tofu", "家常豆腐", "Homestyle Tofu", [8, 0.7], ["bowl", [210, 170, 90]], wok(S("tofu", "soy_sauce", "chopped_scallion"))),
  dish("cumin_lamb_skewers", "孜然羊肉串", "Cumin Lamb Skewers", [9, 0.8], ["long", [140, 80, 50]], { ...wok(S(mc("mutton"), "ground_cumin", "ground_black_pepper")), carrier: mc("stick") }),
  dish("black_pepper_steak", "黑胡椒牛排", "Black Pepper Steak", [11, 0.8], ["bowl", [110, 60, 40]], wok(S(mc("beef"), "ground_black_pepper", "diced_onion"), 300)),
  dish("orange_spare_ribs", "橙香排骨", "Orange Spare Ribs", [10, 0.8], ["bowl", [210, 110, 40]], wok(S(mc("porkchop"), "sweet_orange", mc("sugar")), 300)),
  dish("lemon_chicken", "檸檬雞", "Lemon Chicken", [10, 0.8], ["bowl", [230, 200, 80]], wok(S(mc("chicken"), "lemon", mc("egg")), 300)),
  dish("cumin_potatoes", "孜然馬鈴薯", "Cumin Potatoes", [7, 0.6], ["bowl", [210, 170, 90]], wok(S(mc("potato"), mc("potato"), "ground_cumin", "chopped_coriander"))),
  dish("pineapple_sweet_sour_pork", "鳳梨咕咾肉", "Pineapple Sweet and Sour Pork", [10, 0.8], ["bowl", [230, 140, 60]], wok(S(mc("porkchop"), "pineapple", mc("sugar")), 300)),
  dish("candied_banana", "拔絲香蕉", "Candied Banana", [6, 0.5], ["bowl", [220, 170, 60]], wok(S("banana", "banana", mc("sugar")))),

  // --- Stockpot -----------------------------------------------------------------------------------
  dish("cabbage_pork_stew", "白菜燉肉", "Napa Cabbage and Pork Stew", [10, 0.8], ["bowl", [226, 206, 170]], pot(S("napa_cabbage", "napa_cabbage", mc("porkchop")))),
  dish("daikon_beef_brisket", "蘿蔔燉牛腩", "Daikon and Beef Brisket", [11, 0.8], ["bowl", [200, 150, 110]], pot(S("daikon_slices", mc("beef"), "shredded_ginger"), 600)),
  dish("spinach_salad", "涼拌菠菜", "Sesame Spinach", [4, 0.5], ["bowl", [60, 130, 60]], pot(S("spinach", "spinach", "sesame_powder"), 100)),
  dish("corn_chowder", "玉米濃湯", "Corn Chowder", [7, 0.7], ["bowl", [244, 220, 120]], pot(S("corn", "corn", "diced_onion"))),
  dish("taro_spare_ribs", "芋頭蒸排骨", "Taro Spare Ribs", [10, 0.8], ["bowl", [180, 150, 160]], pot(S("taro", mc("porkchop"), "minced_garlic"))),
  dish("garlic_pork_slices", "蒜泥白肉", "Garlic Pork Slices", [9, 0.7], ["bowl", [230, 190, 170]], pot(S(mc("porkchop"), "minced_garlic", "minced_garlic"))),
  dish("sesame_tangyuan", "芝麻湯圓", "Sesame Tangyuan", [6, 0.6], ["bowl", [244, 240, 232]], pot(S("sesame_powder", mc("sugar"), mc("wheat")))),
  dish("tofu_vegetable_soup", "豆腐蔬菜湯", "Tofu and Vegetable Soup", [7, 0.7], ["bowl", [220, 230, 200]], pot(S("tofu", "bok_choy", "chopped_scallion"))),
  dish("soy_milk_pudding", "豆花", "Tofu Pudding", [5, 0.5], ["bowl", [240, 230, 210]], pot(S("soy_milk", "shredded_ginger", mc("sugar")), 300)),
  dish("spinach_dumplings", "菠菜餃子", "Spinach Dumplings", [8, 0.7], ["bowl", [110, 170, 90]], pot(S("spinach", mc("porkchop"), mc("wheat")))),
  dish("pickled_vegetable_noodles", "酸菜麵", "Pickled Cabbage Noodles", [9, 0.7], ["bowl", [220, 210, 160]], pot(S("pickled_napa_cabbage", mc("porkchop"), mc("wheat"), "chopped_coriander"))),
  dish("mandarin_sweet_soup", "橘子糖水", "Mandarin Sweet Soup", [5, 0.5], ["bowl", [248, 176, 72]], pot(S("mandarin", "mandarin", mc("sugar")), 300)),
  dish("five_spice_tea_egg", "五香茶葉蛋", "Five-Spice Tea Eggs", [5, 0.5], ["bowl", [150, 100, 60]], { ...pot(S(mc("egg"), mc("egg"), "soy_sauce", "five_spice_powder"), 600), carrier: "", count: 2 }),
  dish("braised_pork", "滷肉", "Five-Spice Braised Pork", [11, 0.8], ["bowl", [120, 70, 40]], pot(S(mc("porkchop"), "soy_sauce", "five_spice_powder", "ground_cinnamon"), 600)),
  dish("lychee_chicken", "荔枝雞球", "Lychee Chicken", [9, 0.7], ["bowl", [240, 210, 200]], wok(S(mc("chicken"), "lychee", mc("sugar")), 300)),
  dish("rock_sugar_pear", "冰糖燉梨", "Rock Sugar Pear", [6, 0.6], ["bowl", [236, 230, 170]], pot(S("pear", mc("sugar")), 300)),
  dish("peach_jelly", "蜜桃凍", "Peach Jelly", [5, 0.5], ["bowl", [250, 180, 170]], pot(S("peach", "peach", mc("sugar")), 300)),
  dish("lychee_jelly", "荔枝凍", "Lychee Jelly", [5, 0.5], ["bowl", [250, 240, 236]], pot(S("lychee", "lychee", mc("sugar")), 300)),
  dish("pear_honey_drink", "雪梨蜜", "Pear and Honey Drink", [6, 0.6], ["bowl", [240, 220, 150]], pot(S("pear", mc("honey_bottle")), 300)),

  // --- Steamer ---------------------------------------------------------------------------------------
  dish("steamed_corn", "蒸玉米", "Steamed Corn", [5, 0.6], ["cob", [250, 220, 100]], { station: "steamer", input: "corn", time: 200 }),
  dish("steamed_sweet_potato", "蒸地瓜", "Steamed Sweet Potato", [5, 0.7], ["root", [230, 140, 70]], { station: "steamer", input: "sweet_potato", time: 300 }),
  dish("taro_paste", "芋泥", "Taro Paste", [6, 0.6], ["bowl", [190, 170, 210]], { station: "steamer", input: "taro", time: 300 }),

  // --- Chopping board ---------------------------------------------------------------------------------
  dish("smashed_cucumber", "拍黃瓜", "Smashed Cucumber Salad", [4, 0.5], ["bowl", [96, 160, 76]], { station: "chopping_board", input: "cucumber", count: 1, cuts: 3 }),

  // --- Crafting table and furnace ------------------------------------------------------------------------
  dish("roasted_sweet_potato", "烤地瓜", "Roasted Sweet Potato", [5, 0.6], ["root", [200, 110, 60]], { station: "furnace", input: "sweet_potato" }),
  dish("scallion_pancake", "蔥油餅", "Scallion Pancake", [6, 0.6], ["round", [230, 190, 110]], { station: "crafting", inputs: [mc("wheat"), mc("wheat"), "chopped_scallion", "peanut_oil"] }),
  dish("pepper_bun", "胡椒餅", "Pepper Bun", [9, 0.7], ["round", [210, 160, 90]], { station: "crafting", inputs: [mc("wheat"), mc("porkchop"), "ground_black_pepper", "chopped_scallion", "sesame"] }),
  dish("strawberry_daifuku", "草莓大福", "Strawberry Daifuku", [5, 0.5], ["round", [246, 236, 236]], { station: "crafting", inputs: ["strawberry", mc("wheat"), mc("sugar")] }),
  dish("blueberry_pie", "藍莓派", "Blueberry Pie", [8, 0.3], ["round", [80, 60, 120]], { station: "crafting", inputs: ["blueberry", "blueberry", mc("wheat"), mc("egg"), mc("sugar")] }),
  dish("pineapple_cake", "鳳梨酥", "Pineapple Cake", [6, 0.5], ["round", [230, 180, 80]], { station: "crafting", inputs: ["pineapple", mc("wheat"), mc("egg"), mc("sugar")] }),
  dish("mango_shaved_ice", "芒果冰", "Mango Shaved Ice", [5, 0.4], ["bowl", [250, 200, 80]], { station: "crafting", inputs: ["mango", mc("snowball"), mc("sugar"), mc("bowl")] }),
  dish("cinnamon_apple", "肉桂烤蘋果", "Cinnamon Baked Apple", [6, 0.6], ["round", [200, 80, 50]], { station: "crafting", inputs: [mc("apple"), "ground_cinnamon", mc("sugar")] }),
  dish("banana_pancake", "香蕉煎餅", "Banana Pancake", [7, 0.6], ["round", [230, 200, 120]], { station: "crafting", inputs: ["banana", mc("wheat"), mc("egg")] }),
  dish("grape_raisin_bread", "葡萄乾麵包", "Raisin Bread", [6, 0.6], ["round", [190, 140, 90]], { station: "crafting", inputs: ["raisins", mc("wheat"), mc("wheat"), mc("wheat")] }),
  dish("fruit_platter", "水果拼盤", "Fruit Platter", [10, 0.8], ["bowl", [240, 140, 80]], { station: "crafting", inputs: ["sweet_orange", "grape", "strawberry", "mango", mc("bowl")] }),
];

/** Harvest item ids a row needs (bare ids), whatever the station. */
export function harvestInputs(make) {
  if (!make) return [];
  const ids = [];
  if (make.input && make.input !== "*") ids.push(make.input);
  for (const id of make.inputs ?? []) ids.push(id);
  for (const slot of make.slots ?? []) ids.push(slot[0]);
  return ids.map((id) => (id.startsWith(`${NS}:`) ? id.slice(NS.length + 1) : id)).filter((id) => !id.includes(":"));
}

/** Bare ids a row's recipe gives. */
export const madeBy = (row) => (row.make?.outputs ? row.make.outputs.map(([id]) => id) : [row.item.id]);

/**
 * The rows that can be made with `baseIds` (items that exist without the menu): a row is
 * in when every Harvest item it needs exists, counting what other rows in the menu make.
 * Rows with no recipe of their own (oils, okara) come in with the row that makes them.
 */
export function activeMenu(baseIds) {
  const have = new Set(baseIds);
  const active = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of MENU) {
      if (active.has(row) || !row.make) continue;
      if (harvestInputs(row.make).every((id) => have.has(id))) {
        active.add(row);
        for (const id of madeBy(row)) have.add(id);
        grew = true;
      }
    }
  }
  // ## Juice from two different fruits needs at least two fruits the juicer takes.
  const juicer = [...active].filter((row) => row.make.station === "juicer" && row.make.input !== "*");
  if (juicer.length < 2) for (const row of [...active]) if (row.make.input === "*") active.delete(row);
  return MENU.filter((row) => (row.make ? active.has(row) : have.has(row.item.id)));
}
