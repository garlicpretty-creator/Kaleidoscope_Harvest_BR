// M5: what Harvest offers the optional partner packs (企劃書「選用聯動」). Each table is
// sent by api/ranching.js, api/herbal.js or api/tavern.js once that pack answers its
// handshake; without the partner nothing is sent and Harvest plays the same.
// Every id is a bare Harvest item id. Plain data: no @minecraft imports.

// --- 樂牧 Ranching: trough feed (kaleidoscope_ranching:register_feed) ---------------------
//
// kind: grass / grain / veg are tier 1, mixed tier 2, concentrate tier 3 (Ranching docs/API.md).
// units: how many trough portions one item fills (1–9). A Ranching hay bale's worth of food
// is the yardstick: a cob of corn is a big handful of grain, a seed or a bean a small one.
export const RANCHING_FEEDS = [
  { item: "corn", kind: "grain", units: 2, why: "整根玉米：份量足的穀物" },
  { item: "corn_seeds", kind: "grain", units: 1, why: "玉米粒，和小麥種子一樣算一份穀物" },
  { item: "soybean", kind: "grain", units: 1, why: "大豆是豆類穀物飼料" },
  // ## Okara is what soy milk leaves behind; without Ranching it has no other use.
  { item: "okara", kind: "mixed", units: 1, why: "豆渣蛋白質高，算二級的混合飼料" },
  { item: "napa_cabbage", kind: "veg", units: 2, why: "整顆大白菜，份量大" },
  { item: "bok_choy", kind: "veg", units: 1, why: "葉菜" },
  { item: "spinach", kind: "veg", units: 1, why: "葉菜" },
  { item: "daikon", kind: "veg", units: 2, why: "根莖類，份量大" },
  { item: "sweet_potato", kind: "veg", units: 2, why: "根莖類，份量大" },
  // --- 1.1 ---
  { item: "adzuki_bean", kind: "grain", units: 1, why: "豆類穀物飼料" },
  { item: "mung_bean", kind: "grain", units: 1, why: "豆類穀物飼料" },
  { item: "water_spinach", kind: "veg", units: 1, why: "葉菜，鄉下常拿來餵豬" },
  // ## Corn leaves are roughage for cattle and sheep: Ranching 1.1's ruminant feed, plain grass before it.
  { item: "corn_leaves", kind: "ruminant", fallback: "grass", units: 1, why: "玉米葉是牛羊的粗飼料（樂牧 1.1 的反芻飼料）" },
];

// --- 草本 Herbal: 寒熱 of Harvest foods (kaleidoscope_herbal:heat_register) -----------------
//
// −100 (cold) … +100 (hot). Herbal's own teas are ±35–40 and its tonics +30–40, so everyday
// food stays within ±30. Only foods whose nature is plain in 中醫 food lore are listed.
export const HERBAL_HEAT = [
  { id: "ginger_tea", heat: 25, why: "生薑辛溫，薑母茶是驅寒的熱飲" },
  { id: "cinnamon_tea", heat: 25, why: "肉桂辛甘大熱，溫中散寒" },
  { id: "cinnamon_apple", heat: 10, why: "加了肉桂粉烤，偏溫" },
  { id: "lychee", heat: 10, why: "荔枝性溫，多吃上火" },
  { id: "lychee_wine", heat: 20, why: "酒性溫熱，又是荔枝泡的" },
  { id: "peach_wine", heat: 15, why: "酒性溫熱；桃子本身性溫" },
  { id: "mango", heat: -5, why: "芒果甘酸性涼（本草記載），只略涼" },
  { id: "mango_shaved_ice", heat: -30, why: "刨冰，冰品最涼" },
  { id: "pear", heat: -10, why: "梨甘寒，清熱潤肺" },
  { id: "rock_sugar_pear", heat: -10, why: "冰糖燉梨潤肺止咳，燉過仍偏涼" },
  { id: "pear_honey_drink", heat: -15, why: "雪梨蜜清熱潤燥" },
  { id: "lemon_tea", heat: -10, why: "檸檬酸涼，生津解暑" },
  { id: "persimmon", heat: -10, why: "柿子性寒" },
  { id: "banana", heat: -10, why: "香蕉甘寒" },
  { id: "cucumber", heat: -10, why: "黃瓜甘涼，清熱" },
  { id: "smashed_cucumber", heat: -10, why: "涼拌黃瓜，生吃仍涼" },
  { id: "braised_pork", heat: 10, why: "五香粉、肉桂滷的肉，偏溫" },
  { id: "five_spice_tea_egg", heat: 10, why: "八角、五香滷的蛋，偏溫" },
  { id: "cumin_lamb_skewers", heat: 20, why: "羊肉性溫，孜然、胡椒辛熱" },
  { id: "black_pepper_steak", heat: 15, why: "黑胡椒辛熱" },
  // --- 1.1 ---
  { id: "mung_bean_soup", heat: -25, why: "綠豆甘寒，綠豆湯是消暑的涼品" },
  { id: "bitter_melon_salad", heat: -15, why: "苦瓜苦寒，涼拌生吃更涼" },
  { id: "bitter_melon_omelette", heat: -10, why: "苦瓜苦寒，炒過略減" },
  { id: "lotus_root_rib_soup", heat: -5, why: "蓮藕甘寒，燉排骨後只略涼" },
  { id: "loquat_syrup", heat: -10, why: "枇杷潤肺止咳，性涼" },
  { id: "star_fruit_juice", heat: -10, why: "楊桃酸甘性寒，生津止渴" },
  { id: "red_bean_soup", heat: 5, why: "紅豆性平偏溫，加糖煮成甜湯" },
  { id: "longan_tea", heat: 20, why: "桂圓甘溫，補氣血" },
  { id: "longan_wine", heat: 20, why: "龍眼性溫，泡成酒更熱" },
  { id: "lemongrass_tea", heat: 10, why: "香茅辛溫，暖胃" },
  { id: "mapo_tofu", heat: 20, why: "花椒、辣椒辛熱" },
  { id: "sichuan_pepper_chicken", heat: 15, why: "花椒辛溫" },
];

// --- 草本 Herbal: adjuvants for the clay pot (kaleidoscope_herbal:adjuvant_register) --------
//
// ## Herbal takes only 32 adjuvants from all packs together, so Harvest registers two:
// ## 陳皮 and 肉桂, the two classic 佐使 among its crops (企劃書 also names ginger and
// ## star anise; they stay out to leave room for other packs).
export const HERBAL_ADJUVANTS = [
  { id: "dried_tangerine_peel", why: "陳皮理氣健脾，常見的佐藥" },
  { id: "cinnamon_bark", why: "肉桂溫中，藥膳常用" },
];

// --- 酒館 Tavern: Harvest's fruit wines as barrel recipes (api/tavernSdk) --------------------
//
// ## The pickling-jar recipe in data/menu.js stays; the Tavern barrel is a second way to make
// ## the same bottle. Grape wine is Tavern's own: Harvest only grows the grapes (企劃書 已定決策).
// The barrel batch follows Herbal's Tavern recipes: 4 water buckets, one of each ingredient
// per bottle, glass bottles under the tap.
export const TAVERN_WINES = [
  {
    id: "lychee_wine",
    fruit: "lychee",
    ingredients: ["lychee", "minecraft:sugar", "minecraft:wheat"],
    title: { zh_TW: "荔枝酒", zh_CN: "荔枝酒", en_US: "Lychee Wine" },
  },
  {
    id: "peach_wine",
    fruit: "peach",
    ingredients: ["peach", "minecraft:sugar", "minecraft:wheat"],
    title: { zh_TW: "桃子酒", zh_CN: "桃子酒", en_US: "Peach Wine" },
  },
  // --- 1.1 ---
  {
    id: "longan_wine",
    fruit: "longan",
    ingredients: ["longan", "minecraft:sugar", "minecraft:wheat"],
    title: { zh_TW: "龍眼酒", zh_CN: "龙眼酒", en_US: "Longan Wine" },
  },
];
export const TAVERN_BATCH = { waterBuckets: 4, fluidAmount: 4000, maxBatch: 16, carrier: "minecraft:glass_bottle", unitTime: 4800 };

// --- 酒館 Tavern: grapes (1.2) ---------------------------------------------------------------
//
// ## Harvest and Tavern both grow a purple grape; with both packs either one works anywhere a
// ## grape does. Harvest's grape goes in Tavern's pressing tub (into Tavern's own grape juice, so
// ## Tavern's grape wine stays Tavern's); Tavern's grape goes in Harvest's juicer and in Cookery's
// ## bamboo tray for raisins. Harvest registers no grape wine of its own.
export const TAVERN_GRAPE = {
  harvest: "grape",
  tavern: "kaleidoscope_tavern:grape",
  juice: "kaleidoscope_tavern:grape_juice",
  // ## Tavern's own grape presses 125 mB: eight fill a bucket. Harvest's presses the same.
  amount: 125,
  title: { zh_TW: "葡萄（豐收）", zh_CN: "葡萄（丰收）", en_US: "Grape (Harvest)" },
};

// --- 漁歌 Fishing Voyage: baits (kaleidoscope_fishing:register_bait) -------------------------
//
// biteFactor: the wait for a bite is multiplied by it, 0.5–1 (Fishing docs/API.md); Fishing's
// own best bait is 0.5 and Ranching's offal baits 0.75–0.85. Corn kernels are the classic
// carp bait, so they are the best of Harvest's; soybeans come next.
export const FISHING_BAITS = [
  { id: "corn_seeds", biteFactor: 0.7, why: "玉米粒是釣鯉魚的老餌" },
  { id: "soybean", biteFactor: 0.8, why: "泡過的黃豆也是常見的底餌" },
  { id: "mung_bean", biteFactor: 0.7, why: "1.1：綠豆煮過是鯽魚的好餌" },
];

// --- 漁歌 Fishing Voyage: fish-pond feed (kaleidoscope_fishing:register_pond_feed) ------------
//
// meals: how many feedings one item gives, 1–4 (Fishing's fish meal 4, small dried fish 1).
export const FISHING_POND_FEEDS = [
  // ## Okara's only other use is Ranching's trough; fish farms feed it too.
  { id: "okara", meals: 2, why: "豆渣是魚塭常用的飼料，蛋白質高" },
  { id: "corn_seeds", meals: 1, why: "玉米粒，一把一餐" },
  { id: "red_bean_paste", meals: 1, why: "1.1：豆餡揉成餌團，一團一餐" },
];
