// Every crop Harvest grows, one row each. Blocks, seed items, loot tables,
// wild plants, textures, language lines and the growth components all come
// from this table (tools/generate.mjs writes the JSON, growth/*.js reads the
// rules). Plain data: no @minecraft imports.
//
// form (企劃書「種植與生長系統」的六種型態):
//   once         8 stages; breaking a ripe crop drops the produce and seeds, the block is gone.
//   underground  like once, but the produce is under the soil: only the leaves show and
//                turn yellow when ripe; dug with a hoe it gives `hoeBonus` more.
//   repeatable   use the ripe crop to pick it; it drops back to `harvestResetAge`.
//   tall         two blocks high (corn): the lower block holds the stage, the upper block
//                appears from `tallFrom`; breaking either one breaks both.
//   trellis      planted on a Bamboo Trellis; picked like `repeatable`; breaking it gives
//                the trellis back.
//   bush         a shrub planted on grass or dirt, not farmland (blueberries); picked like
//                `repeatable`, never needs replanting.
//   aquatic      1.1: stands in water. Planted on Cookery's paddy field, or in one block of water
//                over mud, clay or dirt (the block is waterlogged); without water it stops and
//                greys like a crop off its climate. Once-harvested unless it has `pick`
//                (then picked like `repeatable`).
//   tree         see data/trees.js.
//
// Rule fields copy the names of Cookery's `crop_growth` (企劃書): growthChance (per random
// tick, before climate), minLightLevel, maxGrowth (last stage), harvestResetAge.
//
// seed: what plants it. When it is the produce itself (garlic cloves, ginger, peanuts…)
//   the crop is replanted from its own harvest, like vanilla carrots.
// climate: cold | temperate | warm | hot (data/climate.js).
// drops: what a ripe crop gives when broken; [min, max] counts.
// pick: what a ripe repeatable / trellis crop gives when used.
// extra: 1.1, other things a ripe crop gives when broken: [{ item, count: [min, max] }] (a lotus
//   pod with the root, corn leaves with the cob).
// wild: where its first seed is found (企劃書「第一份來源」): Bedrock biome tags, and
//   the soil the wild plant stands on (default: grass, dirt, podzol, coarse dirt).
//   Breaking a wild plant gives the produce and, for seed crops, seeds.
// village: village house chests that may hold its seed (plains, savanna, taiga, snowy,
//   desert). tools/generate.mjs overrides those vanilla chest tables, keeping every
//   vanilla entry and adding one Harvest pool (data/village.js).
// look: leaf / ripe colours, used for the block's map colour; textures come from the drawn art:
//   leaf / ripe colours as [r, g, b].

const GROWTH = { growthChance: 0.45, minLightLevel: 9, maxGrowth: 7 };
const SAND = ["minecraft:sand", "minecraft:red_sand", "minecraft:grass_block", "minecraft:coarse_dirt"];
const WET = ["minecraft:grass_block", "minecraft:dirt", "minecraft:mud", "minecraft:clay"];
/** What an aquatic crop's water stands on (wild plants and planting in plain water). */
export const WATER_SOIL = ["minecraft:mud", "minecraft:clay", "minecraft:dirt", "minecraft:grass_block", "minecraft:sand"];

export const CROPS = [
  // --- Vegetables (12) -----------------------------------------------------------------------
  {
    id: "napa_cabbage", zh: "大白菜", en: "Napa Cabbage", form: "once", climate: "temperate", ...GROWTH,
    seed: "napa_cabbage_seeds", produce: "napa_cabbage", drops: { produce: [1, 1], seed: [1, 2] },
    wild: { biomes: ["plains", "forest"] },
    look: { leaf: [150, 196, 98], ripe: [226, 236, 196] },
  },
  {
    id: "bok_choy", zh: "青江菜", en: "Bok Choy", form: "once", climate: "temperate", ...GROWTH,
    seed: "bok_choy_seeds", produce: "bok_choy", drops: { produce: [1, 2], seed: [1, 2] },
    wild: { biomes: ["plains"] },
    look: { leaf: [96, 170, 84], ripe: [196, 230, 170] },
  },
  {
    id: "spinach", zh: "菠菜", en: "Spinach", form: "once", climate: "temperate", ...GROWTH,
    seed: "spinach_seeds", produce: "spinach", drops: { produce: [1, 2], seed: [1, 2] },
    wild: { biomes: ["forest"] },
    look: { leaf: [64, 130, 60], ripe: [44, 110, 50] },
  },
  {
    id: "onion", zh: "洋蔥", en: "Onion", form: "once", climate: "temperate", ...GROWTH,
    seed: "onion_seeds", produce: "onion", drops: { produce: [1, 2], seed: [1, 2] },
    // ## 企劃書: 村莊箱子; also wild on plains for players who meet no village.
    wild: { biomes: ["plains"] }, village: ["plains", "taiga", "snowy"],
    look: { leaf: [110, 170, 90], ripe: [200, 150, 90] },
  },
  {
    id: "daikon", zh: "白蘿蔔", en: "Daikon", form: "once", climate: "temperate", ...GROWTH,
    seed: "daikon_seeds", produce: "daikon", drops: { produce: [1, 1], seed: [1, 2] },
    wild: { biomes: ["plains"] },
    look: { leaf: [100, 168, 80], ripe: [240, 240, 228] },
  },
  {
    id: "eggplant", zh: "茄子", en: "Eggplant", form: "repeatable", climate: "hot", ...GROWTH, harvestResetAge: 5,
    seed: "eggplant_seeds", produce: "eggplant", drops: { produce: [1, 2], seed: [1, 2] }, pick: [1, 2],
    wild: { biomes: ["savanna"] },
    look: { leaf: [84, 140, 70], ripe: [100, 50, 120] },
  },
  {
    id: "cucumber", zh: "小黃瓜", en: "Cucumber", form: "trellis", climate: "warm", ...GROWTH, growthChance: 0.4, harvestResetAge: 5,
    seed: "cucumber_seeds", produce: "cucumber", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 3],
    wild: { biomes: ["jungle"] },
    look: { leaf: [84, 150, 64], ripe: [60, 120, 50] },
  },
  {
    id: "corn", zh: "玉米", en: "Corn", form: "tall", climate: "warm", ...GROWTH, growthChance: 0.4, tallFrom: 4,
    seed: "corn_seeds", produce: "corn", drops: { produce: [1, 2], seed: [1, 2] }, extra: [{ item: "corn_leaves", count: [0, 1] }],
    wild: { biomes: ["plains"] },
    look: { leaf: [118, 170, 70], ripe: [240, 200, 70] },
  },
  {
    id: "soybean", zh: "大豆", en: "Soybean", form: "once", climate: "temperate", ...GROWTH,
    seed: "soybean", produce: "soybean", drops: { produce: [2, 3], seed: [0, 0] },
    wild: { biomes: ["plains"] },
    look: { leaf: [120, 160, 70], ripe: [214, 196, 120] },
  },
  {
    id: "peanut", zh: "花生", en: "Peanut", form: "underground", climate: "hot", ...GROWTH, hoeBonus: 1,
    seed: "peanut", produce: "peanut", drops: { produce: [2, 3], seed: [0, 0] },
    wild: { biomes: ["savanna"] },
    look: { leaf: [110, 160, 70], ripe: [200, 170, 110] },
  },
  {
    id: "sweet_potato", zh: "地瓜", en: "Sweet Potato", form: "underground", climate: "hot", ...GROWTH, hoeBonus: 1,
    seed: "sweet_potato", produce: "sweet_potato", drops: { produce: [1, 3], seed: [0, 0] },
    // ## 企劃書: 村莊箱子; also wild on savannas, as for onions.
    wild: { biomes: ["savanna"] }, village: ["savanna", "desert"],
    look: { leaf: [96, 150, 70], ripe: [170, 80, 90] },
  },
  {
    id: "taro", zh: "芋頭", en: "Taro", form: "once", climate: "warm", ...GROWTH,
    seed: "taro", produce: "taro", drops: { produce: [1, 2], seed: [0, 0] },
    wild: { biomes: ["swamp"], soil: WET },
    look: { leaf: [70, 140, 90], ripe: [170, 150, 170] },
  },

  // --- Spices (7) ----------------------------------------------------------------------------
  {
    id: "scallion", zh: "蔥", en: "Scallion", form: "repeatable", climate: "temperate", ...GROWTH, harvestResetAge: 4,
    seed: "scallion_seeds", produce: "scallion", drops: { produce: [1, 2], seed: [1, 2] }, pick: [1, 2],
    wild: { biomes: ["plains"] },
    look: { leaf: [92, 168, 70], ripe: [70, 150, 60] },
  },
  {
    id: "garlic", zh: "大蒜", en: "Garlic", form: "underground", climate: "temperate", ...GROWTH, hoeBonus: 1,
    seed: "garlic", produce: "garlic", drops: { produce: [1, 2], seed: [0, 0] },
    wild: { biomes: ["plains"] },
    look: { leaf: [120, 176, 90], ripe: [236, 228, 210] },
  },
  {
    id: "ginger", zh: "薑", en: "Ginger", form: "underground", climate: "hot", ...GROWTH, hoeBonus: 1,
    seed: "ginger", produce: "ginger", drops: { produce: [1, 2], seed: [0, 0] },
    wild: { biomes: ["jungle"] },
    look: { leaf: [90, 160, 70], ripe: [222, 190, 120] },
  },
  {
    id: "coriander", zh: "香菜", en: "Coriander", form: "once", climate: "temperate", ...GROWTH,
    seed: "coriander_seeds", produce: "coriander", drops: { produce: [1, 2], seed: [1, 2] },
    wild: { biomes: ["forest"] },
    look: { leaf: [96, 176, 80], ripe: [80, 160, 70] },
  },
  {
    id: "sesame", zh: "芝麻", en: "Sesame", form: "once", climate: "hot", ...GROWTH,
    seed: "sesame", produce: "sesame", drops: { produce: [2, 4], seed: [0, 0] },
    wild: { biomes: ["savanna"] },
    look: { leaf: [110, 160, 80], ripe: [236, 226, 200] },
  },
  {
    id: "black_pepper", zh: "黑胡椒", en: "Black Pepper", form: "trellis", climate: "hot", ...GROWTH, growthChance: 0.35, harvestResetAge: 5,
    seed: "black_pepper_seedling", produce: "black_peppercorns", drops: { produce: [1, 2], seed: [0, 0] }, pick: [1, 2],
    wild: { biomes: ["jungle"] },
    look: { leaf: [60, 130, 60], ripe: [60, 40, 36] },
  },
  {
    id: "cumin", zh: "孜然", en: "Cumin", form: "once", climate: "hot", ...GROWTH,
    seed: "cumin", produce: "cumin", drops: { produce: [2, 3], seed: [0, 0] },
    wild: { biomes: ["desert"], soil: SAND },
    look: { leaf: [130, 160, 90], ripe: [170, 140, 90] },
  },

  // --- Fruit (5) -----------------------------------------------------------------------------
  {
    id: "strawberry", zh: "草莓", en: "Strawberry", form: "repeatable", climate: "temperate", ...GROWTH, harvestResetAge: 4,
    seed: "strawberry_seeds", produce: "strawberry", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 3],
    wild: { biomes: ["flower_forest"] },
    look: { leaf: [80, 150, 70], ripe: [220, 40, 50] },
  },
  {
    id: "blueberry", zh: "藍莓", en: "Blueberry", form: "bush", climate: "cold", ...GROWTH, growthChance: 0.35, harvestResetAge: 4,
    seed: "blueberry_seedling", produce: "blueberry", drops: { produce: [1, 2], seed: [1, 1] }, pick: [2, 4],
    wild: { biomes: ["taiga"] },
    look: { leaf: [70, 120, 70], ripe: [60, 70, 150] },
  },
  {
    id: "grape", zh: "葡萄", en: "Grape", form: "trellis", climate: "temperate", ...GROWTH, growthChance: 0.35, harvestResetAge: 5,
    seed: "grape_cutting", produce: "grape", drops: { produce: [1, 2], seed: [0, 0] }, pick: [2, 3],
    // ## 企劃書: 村莊箱子 (data/village.js); also wild in forests, as for onions.
    wild: { biomes: ["forest"] }, village: ["plains", "taiga"],
    look: { leaf: [90, 150, 70], ripe: [110, 40, 100] },
  },
  {
    id: "passion_fruit", zh: "百香果", en: "Passion Fruit", form: "trellis", climate: "hot", ...GROWTH, growthChance: 0.35, harvestResetAge: 5,
    seed: "passion_fruit_seeds", produce: "passion_fruit", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 2],
    wild: { biomes: ["jungle"] },
    look: { leaf: [70, 140, 60], ripe: [90, 40, 90] },
  },
  {
    // ## 一次性，原株再生: the plant gives one pineapple and starts again from a small
    // ## plant, so it works like a repeatable crop with a long way back.
    id: "pineapple", zh: "鳳梨", en: "Pineapple", form: "repeatable", climate: "hot", ...GROWTH, growthChance: 0.3, harvestResetAge: 2,
    seed: "pineapple_crown", produce: "pineapple", drops: { produce: [1, 1], seed: [1, 1] }, pick: [1, 1],
    wild: { biomes: ["savanna"] },
    look: { leaf: [90, 140, 80], ripe: [230, 180, 60] },
  },
  // --- 1.1: aquatic (3) --------------------------------------------------------------------------
  {
    id: "lotus_root", zh: "蓮藕", en: "Lotus Root", form: "aquatic", climate: "warm", ...GROWTH, growthChance: 0.35,
    seed: "lotus_root", produce: "lotus_root", drops: { produce: [1, 2], seed: [0, 0] }, extra: [{ item: "lotus_pod", count: [0, 1] }],
    wild: { biomes: ["swamp"], water: true },
    look: { leaf: [80, 150, 90], ripe: [240, 160, 190] },
  },
  {
    id: "water_bamboo", zh: "茭白筍", en: "Water Bamboo", form: "aquatic", climate: "warm", ...GROWTH, harvestResetAge: 4,
    seed: "water_bamboo", produce: "water_bamboo", drops: { produce: [1, 2], seed: [0, 0] }, pick: [1, 2],
    wild: { biomes: ["river"], water: true },
    look: { leaf: [100, 160, 80], ripe: [236, 234, 210] },
  },
  {
    id: "water_spinach", zh: "空心菜", en: "Water Spinach", form: "aquatic", climate: "hot", ...GROWTH, harvestResetAge: 4,
    seed: "water_spinach_seeds", produce: "water_spinach", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 3],
    wild: { biomes: ["mangrove_swamp", "swamp"], water: true },
    look: { leaf: [70, 150, 60], ripe: [50, 130, 50] },
  },

  // --- 1.1: gourds (2) ---------------------------------------------------------------------------
  {
    id: "bitter_melon", zh: "苦瓜", en: "Bitter Melon", form: "trellis", climate: "hot", ...GROWTH, growthChance: 0.4, harvestResetAge: 5,
    seed: "bitter_melon_seeds", produce: "bitter_melon", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 2],
    wild: { biomes: ["jungle"] },
    look: { leaf: [80, 150, 60], ripe: [120, 180, 80] },
  },
  {
    id: "luffa", zh: "絲瓜", en: "Luffa", form: "trellis", climate: "warm", ...GROWTH, growthChance: 0.4, harvestResetAge: 5,
    seed: "luffa_seeds", produce: "luffa", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 2],
    // ## 1.1 企劃: 村莊箱子; also wild in swamps for players who meet no village.
    wild: { biomes: ["swamp"] }, village: ["plains", "savanna"],
    look: { leaf: [90, 160, 70], ripe: [90, 140, 70] },
  },

  // --- 1.1: beans (2) ----------------------------------------------------------------------------
  {
    id: "adzuki_bean", zh: "紅豆", en: "Adzuki Bean", form: "once", climate: "temperate", ...GROWTH,
    seed: "adzuki_bean", produce: "adzuki_bean", drops: { produce: [2, 3], seed: [0, 0] },
    wild: { biomes: ["plains"] },
    look: { leaf: [110, 160, 70], ripe: [150, 40, 50] },
  },
  {
    id: "mung_bean", zh: "綠豆", en: "Mung Bean", form: "once", climate: "hot", ...GROWTH,
    seed: "mung_bean", produce: "mung_bean", drops: { produce: [2, 3], seed: [0, 0] },
    wild: { biomes: ["savanna"] },
    look: { leaf: [100, 160, 70], ripe: [80, 130, 60] },
  },

  // --- 1.1: spices (3) ---------------------------------------------------------------------------
  {
    id: "garlic_chives", zh: "韭菜", en: "Garlic Chives", form: "repeatable", climate: "temperate", ...GROWTH, harvestResetAge: 4,
    seed: "garlic_chive_seeds", produce: "garlic_chives", drops: { produce: [1, 2], seed: [1, 2] }, pick: [1, 2],
    wild: { biomes: ["plains"] },
    look: { leaf: [80, 160, 70], ripe: [60, 140, 60] },
  },
  {
    id: "lemongrass", zh: "香茅", en: "Lemongrass", form: "repeatable", climate: "hot", ...GROWTH, harvestResetAge: 4,
    seed: "lemongrass", produce: "lemongrass", drops: { produce: [1, 2], seed: [0, 0] }, pick: [1, 2],
    // ## 1.1 企劃「叢林邊緣」: jungle edge is jungle + edge; the wild-crop rules take one tag, so jungle.
    wild: { biomes: ["jungle"] },
    look: { leaf: [150, 190, 90], ripe: [180, 200, 110] },
  },
  {
    // ## A shrub like the blueberry (1.1 企劃：花椒是小灌木). Wild in meadows and birch woods:
    // ## the hill country it grows in has no vanilla biome of its own.
    id: "sichuan_pepper", zh: "花椒", en: "Sichuan Pepper", form: "bush", climate: "temperate", ...GROWTH, growthChance: 0.35, harvestResetAge: 4,
    seed: "sichuan_pepper_seedling", produce: "sichuan_peppercorns", drops: { produce: [1, 2], seed: [1, 1] }, pick: [1, 3],
    wild: { biomes: ["meadow", "birch"] },
    look: { leaf: [70, 130, 60], ripe: [180, 50, 40] },
  },
];


/** The block id of a crop (the lower block for tall crops). */
export const cropBlockId = (crop) => `${crop.id}_crop`;
/** The wild plant of a crop, placed by world generation. */
export const wildBlockId = (crop) => `wild_${crop.id}`;

/** Soil a wild plant stands on unless its row says otherwise. */
export const WILD_SOIL = ["minecraft:grass_block", "minecraft:dirt", "minecraft:podzol", "minecraft:coarse_dirt"];

/** The Bamboo Trellis every trellis crop is planted on. */
export const TRELLIS = { id: "bamboo_trellis", zh: "竹藤架", en: "Bamboo Trellis" };
