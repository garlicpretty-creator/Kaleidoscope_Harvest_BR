// The「豐收」chapter of Cookery's guidebook. Harvest shows no text on screen,
// so this chapter is where a player reads how each crop grows and what it is
// for. Lines about growing are written from data/crops.js and data/trees.js,
// so they follow a rule change. Plain data: no @minecraft imports.
//
// Every item and block must have an entry: tools/validate.mjs and the tests fail
// otherwise, so new content cannot go out unexplained.

import { CLIMATES } from "./climate.js";
import { CROPS, TRELLIS } from "./crops.js";
import { RECIPES, inputsOf, outputsOf, recipeMaking } from "./dishes.js";
import { ITEMS, ITEM_BY_ID } from "./items.js";
import { NAMESPACE, rid } from "./ns.js";
import { FRUIT_LOG, TREES, saplingBlockId } from "./trees.js";
import { toSimplified } from "./zh_cn.js";

const CLIMATE_NAME = {
  cold: ["寒冷", "cold"],
  temperate: ["溫和", "temperate"],
  warm: ["溫暖", "warm"],
  hot: ["炎熱", "hot"],
};

const STATION_NAME = {
  chopping_board: ["砧板", "Chopping Board"],
  millstone: ["石磨", "Millstone"],
  wok: ["炒鍋", "Wok"],
  stockpot: ["湯鍋", "Stockpot"],
  steamer: ["蒸籠", "Steamer"],
};
// ## Cookery translates these method names in its recipe box (as for Ranching).
const METHOD = { chopping_board: "Chopping Board", millstone: "Millstone", wok: "Wok", stockpot: "Stockpot", steamer: "Steamer" };

export const GUIDE_CATEGORIES = [
  { id: "crops", zh: "作物", en: "Crops", icon: "napa_cabbage" },
  { id: "trees", zh: "果樹", en: "Fruit Trees", icon: "mandarin" },
  { id: "ingredients", zh: "食材", en: "Ingredients", icon: "chopped_scallion" },
  { id: "dishes", zh: "料理", en: "Dishes", icon: "napa_cabbage_pork_stew" },
];

function climateLine(climate) {
  const i = CLIMATES.indexOf(climate);
  const near = CLIMATES.filter((_, j) => Math.abs(i - j) === 1);
  const [zh, en] = CLIMATE_NAME[climate];
  return [
    `喜歡${zh}氣候。${near.map((c) => CLIMATE_NAME[c][0]).join("、")}地區長得慢一半，再遠就不生長、葉子發灰；玻璃屋頂的溫室裡不論氣候都照常生長。`,
    `Likes a ${en} climate. It grows at half speed in ${near.map((c) => CLIMATE_NAME[c][1]).join(" or ")} areas and not at all further away, where its leaves turn grey; in a greenhouse with a glass roof it grows anywhere.`,
  ];
}

const FORM_LINE = {
  once: ["種在耕地上，長滿 8 個階段後打下，掉落作物與種子。", "Plant it on farmland. After 8 stages, break it for the crop and seeds."],
  underground: ["種在耕地上。地上只看得到葉子，葉子轉黃就熟了；用鋤頭挖收成更多。", "Plant it on farmland. Only the leaves show; when they turn yellow it is ready, and a hoe digs up more."],
  repeatable: ["種在耕地上。熟了之後空手或拿著東西點它採收，它會退回幾個階段繼續長，不用重種。", "Plant it on farmland. Once ripe, use it to pick; it drops back a few stages and grows again, no replanting."],
  tall: ["種在耕地上，長到一半會長出第二格。打掉上下任一格，整株一起收成。", "Plant it on farmland. Halfway through it grows a second block; break either block to harvest the whole plant."],
  trellis: ["先在耕地上放竹藤架，再拿種子點竹藤架種下。熟了點它採收，會再結果；打掉時竹藤架會還給你。", "Place a Bamboo Trellis on farmland, then use the seeds on it. Use the ripe vine to pick; it fruits again. Breaking it gives the trellis back."],
};

const BIOME_NAME = {
  plains: ["平原", "plains"],
  forest: ["森林", "forests"],
  flower_forest: ["繁花森林", "flower forests"],
  savanna: ["熱帶草原", "savannas"],
  jungle: ["叢林", "jungles"],
  swamp: ["沼澤", "swamps"],
  desert: ["沙漠", "deserts"],
  taiga: ["針葉林", "taigas"],
};

export function wildLine(wild) {
  const names = wild.biomes.map((b) => BIOME_NAME[b]);
  return [`野外：${names.map((n) => n[0]).join("、")}偶爾長著野生的，打下來就有第一份。`, `In the wild: it grows now and then in ${names.map((n) => n[1]).join(" and ")}; break one for your first harvest.`];
}

const BONE_MEAL_LINE = ["骨粉一次推進兩個階段。", "Bone meal moves it on two stages."];

/** Lines saying where a crop goes on Cookery's stations. */
function usesOf(id) {
  const out = [];
  for (const row of RECIPES) {
    if (!inputsOf(row).includes(rid(id))) continue;
    const [zh, en] = STATION_NAME[row.station];
    const made = outputsOf(row).map((out) => ITEM_BY_ID.get(out));
    out.push([`${zh}：${made.map((m) => m.zh).join("＋")}`, `${en}: ${made.map((m) => m.en).join(" + ")}`]);
  }
  if (!out.length) return [];
  return [[`用途：${out.map((u) => u[0]).join("、")}。`, `Used for: ${out.map((u) => u[1]).join(", ")}.`]];
}

function entry(id, category, lines, extra = {}) {
  return { id, category, lines, ...extra };
}

/** One row per entry: id (without namespace), category, lines as [zh, en] pairs. */
export function guideEntries() {
  const rows = [];
  for (const crop of CROPS) {
    const lines = [FORM_LINE[crop.form], climateLine(crop.climate), BONE_MEAL_LINE, wildLine(crop.wild), ...usesOf(crop.produce)];
    rows.push(entry(crop.produce, "crops", lines));
    if (crop.seed !== crop.produce) rows.push(entry(crop.seed, "crops", [[`種下長成${ITEM_BY_ID.get(crop.produce).zh}。`, `Grows into ${ITEM_BY_ID.get(crop.produce).en}.`], FORM_LINE[crop.form]]));
  }
  rows.push(entry(TRELLIS.id, "crops", [FORM_LINE.trellis, ["用竹子與線在工作台合成。", "Crafted from bamboo and string."]], { block: true }));

  for (const tree of TREES) {
    rows.push(
      entry(saplingBlockId(tree), "trees", [
        ["種在草地或泥土上，長成一棵果樹。周圍要有空間，被擋住就會等到空出來。", "Plant it on grass or dirt and it grows into a fruit tree. It needs room; if something is in the way it waits."],
        climateLine(tree.climate),
        ["骨粉一次只推進一個階段。", "Bone meal moves it on one stage only."],
      ], { block: true })
    );
    rows.push(
      entry(tree.fruit, "trees", [
        ["果葉會開花、結青果，再轉為熟果。點熟果採收，果葉回到無果，之後會再結果，不用重種。", "Fruit leaves blossom, set green fruit, then ripen. Use a ripe leaf to pick; it starts over and fruits again."],
        ...usesOf(tree.fruit),
      ])
    );
  }
  rows.push(entry(FRUIT_LOG.id, "trees", [["果樹的樹幹。用斧頭砍下可得果木原木，但沒了樹幹，果葉會掉光，果樹就沒了。", "The trunk of a fruit tree. An axe takes it, but without its trunk the fruit leaves fall and the tree is gone."]], { block: true }));

  for (const item of ITEMS.filter((i) => i.kind === "ingredient" || i.kind === "dish")) {
    const row = recipeMaking(item.id);
    const [zh, en] = STATION_NAME[row.station];
    const inputs = (row.input ? [rid(row.input)] : row.slots.map((slot) => slot[0])).map(nameOf);
    const made = [`在${zh}上做：${inputs.map((n) => n[0]).join("＋")}。`, `Made on the ${en}: ${inputs.map((n) => n[1]).join(" + ")}.`];
    rows.push(entry(item.id, item.kind === "dish" ? "dishes" : "ingredients", [made, ...usesOf(item.id)], { recipe: row, makes: item.id }));
  }
  return rows;
}

const VANILLA_NAMES = {
  "minecraft:egg": ["雞蛋", "Egg"],
  "minecraft:porkchop": ["生豬排", "Raw Porkchop"],
  "minecraft:sugar": ["糖", "Sugar"],
  "minecraft:bowl": ["碗", "Bowl"],
  "minecraft:beef": ["生牛肉", "Raw Beef"],
};

/** [zh, en] name of any id the chapter mentions. */
export function nameOf(id) {
  if (VANILLA_NAMES[id]) return VANILLA_NAMES[id];
  const bare = id.replace(`${NAMESPACE}:`, "");
  const item = ITEM_BY_ID.get(bare);
  if (item) return [item.zh, item.en];
  if (bare === TRELLIS.id) return [TRELLIS.zh, TRELLIS.en];
  if (bare === FRUIT_LOG.id) return [FRUIT_LOG.zh, FRUIT_LOG.en];
  const tree = TREES.find((t) => saplingBlockId(t) === bare);
  if (tree) return [`${tree.zh}樹苗`, `${tree.en} Sapling`];
  throw new Error(`guidebook: no name for ${id}`);
}

export const iconPath = (id) => `textures/items/${NAMESPACE}/${id.replace(`${NAMESPACE}:`, "")}`;

export const GUIDE_TEXT = {
  zh: {
    title: "森羅物語：豐收",
    intro: [
      "豐收為廚房加入新的作物與果樹。作物的成熟度只看外觀：顏色變了、葉子轉黃、果實上色，就是熟了。",
      "每種作物都有喜歡的氣候。種在對的地方長得最快；用玻璃當屋頂、四周圍起來的溫室，什麼作物都能照常生長。",
      "畫面上不會跳出提示文字，各樣東西怎麼種、怎麼用，都寫在本章的條目裡。",
    ].join("\n\n"),
    all: "全部條目",
    select: "請選擇條目。",
    language_note: "",
    back: "返回",
  },
  en: {
    title: "Kaleidoscope Harvest",
    intro: [
      "Harvest adds new crops and fruit trees to Cookery. You tell a ripe crop by its look alone: its colour changes, its leaves turn yellow, its fruit colours up.",
      "Every crop likes a climate. It grows fastest in the right place; in a greenhouse — glass roof, walls all round — every crop grows as usual.",
      "No hint text appears on screen: how to grow and use each thing is written in this chapter.",
    ].join("\n\n"),
    all: "All entries",
    select: "Choose an entry.",
    language_note: "",
    back: "Back",
  },
};

const LOCALES = ["en_US", "zh_TW", "zh_CN"];

function recipeOf(row, makes) {
  const ingredients = row.input ? [rid(row.input)] : row.slots.map((slot) => slot[0]);
  const count = row.outputs ? row.outputs.find(([id]) => id === makes)[1] : row.count ?? 1;
  return {
    method: METHOD[row.station],
    ingredients,
    count,
    time: row.time ?? 0,
    result: rid(makes),
    ...(row.station === "stockpot" ? { base: "minecraft:water" } : {}),
  };
}

/** The chapter as Cookery's guidebook extension takes it (fields as in Ranching 1.1). */
export function guidebookPayload() {
  const rows = guideEntries();
  const entries = rows.map((row) => {
    const zh = row.lines.map((line) => line[0]);
    const out = {
      id: rid(row.id),
      category: row.category,
      categories: [row.category],
      kinds: row.block ? ["item", "block"] : ["item"],
      icon: iconPath(row.id),
      mechanics: row.lines.map((line) => line[1]),
      mechanicsByLocale: { zh_TW: zh, zh_CN: zh.map(toSimplified) },
    };
    const item = ITEM_BY_ID.get(row.id);
    if (item?.food) Object.assign(out, { stack: 64, food: { nutrition: item.food[0], saturation: item.food[1] } });
    if (row.recipe) out.recipes = [recipeOf(row.recipe, row.makes)];
    return out;
  });

  const named = new Set(entries.map((e) => e.id));
  for (const e of entries) for (const r of e.recipes ?? []) for (const id of r.ingredients) named.add(id);
  const names = Object.fromEntries(LOCALES.map((locale) => [locale, {}]));
  for (const id of named) {
    const [zh, en] = nameOf(id);
    names.en_US[id] = en;
    names.zh_TW[id] = zh;
    names.zh_CN[id] = toSimplified(zh);
  }

  const text = {
    en_US: { ...GUIDE_TEXT.en },
    zh_TW: { ...GUIDE_TEXT.zh },
    zh_CN: Object.fromEntries(Object.entries(GUIDE_TEXT.zh).map(([k, v]) => [k, toSimplified(v)])),
  };
  for (const c of GUIDE_CATEGORIES) {
    text.en_US[c.id] = c.en;
    text.zh_TW[c.id] = c.zh;
    text.zh_CN[c.id] = toSimplified(c.zh);
  }

  return {
    api: 1,
    version: "0.1.0",
    order: 210,
    icon: iconPath("napa_cabbage"),
    titleKey: "title",
    introKey: "intro",
    allKey: "all",
    selectKey: "select",
    languageNoteKey: "language_note",
    backKey: "back",
    showAll: false,
    showIds: false,
    showKinds: false,
    categories: GUIDE_CATEGORIES.map(({ id, en, icon }) => ({ id, labelKey: id, fallback: en, icon: iconPath(icon) })),
    entries,
    names,
    text,
  };
}
