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
import { FISHING_BAITS, FISHING_POND_FEEDS, HERBAL_ADJUVANTS, HERBAL_HEAT, RANCHING_FEEDS, TAVERN_WINES } from "./integrations.js";
import { ITEMS, ITEM_BY_ID } from "./items.js";
import { NAMESPACE, rid } from "./ns.js";
import { JUICER, PICKLING_JAR } from "./stations.js";
import { VILLAGE_HOUSES, villageItems } from "./village.js";
import { BANANA_TRUNK, FRUITWOOD_LOG, FRUITWOOD_PLANKS, TREES, saplingBlockId } from "./trees.js";
import { VERSION } from "./version.js";
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
  teapot: ["茶壺", "Teapot"],
  bamboo_tray: ["竹篩", "Bamboo Tray"],
  juicer: [JUICER.zh, JUICER.en],
  pickling_jar: [PICKLING_JAR.zh, PICKLING_JAR.en],
  crafting: ["工作台", "Crafting Table"],
  furnace: ["熔爐", "Furnace"],
};
// ## Cookery translates its own station names in the recipe box (as for Ranching and
// ## Herbal) and shows any other method string as it is. No box for the furnace:
// ## Cookery has no "furnace only" label.
const METHOD = {
  chopping_board: "Chopping Board", millstone: "Millstone", wok: "Wok", stockpot: "Stockpot", steamer: "Steamer",
  teapot: "Teapot", bamboo_tray: "Bamboo Tray", juicer: JUICER.en, pickling_jar: PICKLING_JAR.en, crafting: "Crafting Table",
};

export const GUIDE_CATEGORIES = [
  { id: "crops", zh: "作物", en: "Crops", icon: "napa_cabbage" },
  { id: "trees", zh: "果樹", en: "Fruit Trees", icon: "mandarin" },
  { id: "ingredients", zh: "食材", en: "Ingredients", icon: "chopped_scallion" },
  { id: "dishes", zh: "料理", en: "Dishes", icon: "cabbage_pork_stew" },
  { id: "drinks", zh: "飲品", en: "Drinks", icon: "mandarin_juice" },
  { id: "stations", zh: "器具", en: "Stations", icon: JUICER.id },
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
  bush: ["灌木，種在草地或泥土上（不用耕地）。熟了點它採收，會再結果，不用重種。", "A shrub: plant it on grass or dirt, no farmland needed. Use it when ripe to pick; it fruits again, no replanting."],
  trellis: ["先在耕地上放竹藤架，再拿種子點竹藤架種下。熟了點它採收，會再結果；打掉時竹藤架會還給你。", "Place a Bamboo Trellis on farmland, then use the seeds on it. Use the ripe vine to pick; it fruits again. Breaking it gives the trellis back."],
  aquatic: ["水生作物：種在廚房的水田上，或一格深、底下是泥巴、黏土或泥土的水裡。沒有水就不長、葉子發灰。", "A water crop: plant it on Cookery's paddy field, or in water one block deep over mud, clay or dirt. Out of water it stops growing and its leaves turn grey."],
};
/** The second line of an aquatic crop: broken once ripe, or picked and growing back. */
const AQUATIC_HARVEST = {
  once: ["長滿 8 個階段後打下收成。", "After 8 stages, break it to harvest."],
  picked: ["熟了點它採收，它會退回幾個階段繼續長，不用重種。", "Once ripe, use it to pick; it drops back a few stages and grows again."],
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
  roofed: ["黑森林", "dark forests"],
  bamboo: ["竹林", "bamboo jungles"],
  jungle_edge: ["叢林邊緣", "sparse jungles"],
  // --- 1.1 ---
  river: ["河邊", "rivers"],
  mangrove_swamp: ["紅樹林沼澤", "mangrove swamps"],
  meadow: ["草甸", "meadows"],
  birch: ["樺木森林", "birch forests"],
};

const HOUSE_NAME = {
  plains: ["平原", "plains"],
  savanna: ["熱帶草原", "savanna"],
  taiga: ["針葉林", "taiga"],
  snowy: ["雪原", "snowy"],
  desert: ["沙漠", "desert"],
};

/** Where village house chests hold an item, from data/village.js. */
export function villageLine(id) {
  const houses = VILLAGE_HOUSES.filter((house) => villageItems(house).some((row) => row.item === id)).map((h) => HOUSE_NAME[h]);
  if (!houses.length) return [];
  return [[`村莊：${houses.map((h) => h[0]).join("、")}村莊的民宅箱子裡有時找得到。`, `Villages: sometimes found in house chests of ${houses.map((h) => h[1]).join(", ")} villages.`]];
}

export function wildTreeLine(biomes) {
  const names = biomes.map((b) => BIOME_NAME[b]);
  return [`野外：${names.map((n) => n[0]).join("、")}偶爾長著野生的果樹，打下樹葉有機會掉樹苗。`, `In the wild: the tree grows now and then in ${names.map((n) => n[1]).join(" and ")}; its leaves sometimes drop a sapling.`];
}

export function wildLine(wild) {
  const names = wild.biomes.map((b) => BIOME_NAME[b]);
  const where = wild.water ? ["的淺水裡", "the shallows of "] : ["", ""];
  return [`野外：${names.map((n) => n[0]).join("、")}${where[0]}偶爾長著野生的，打下來就有第一份。`, `In the wild: it grows now and then in ${where[1]}${names.map((n) => n[1]).join(" and ")}; break one for your first harvest.`];
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

const FEED_KIND = {
  grass: ["牧草", "grass"], grain: ["穀物", "grain"], veg: ["蔬菜", "vegetable"], mixed: ["混合", "mixed"],
  concentrate: ["精料", "concentrate"], ruminant: ["反芻", "ruminant"], calcium: ["鈣質", "calcium"],
};

/**
 * What the optional partner packs do with an item (data/integrations.js). Each line says
 * which pack it needs: without that pack the use is simply not there (企劃書「選用聯動」).
 */
export function partnerLines(id) {
  const lines = [];
  const feed = RANCHING_FEEDS.find((f) => f.item === id);
  if (feed) {
    const [zh, en] = FEED_KIND[feed.kind];
    lines.push([`裝了《樂牧》時，可放進飼槽當${zh}飼料，一個算 ${feed.units} 份。`, `With Kaleidoscope Ranching, it goes in a trough as ${en} feed, ${feed.units} portion${feed.units > 1 ? "s" : ""} each.`]);
  }
  const heat = HERBAL_HEAT.find((h) => h.id === id);
  if (heat) {
    const n = Math.abs(heat.heat);
    lines.push(heat.heat > 0 ? [`裝了《草本》時，吃了身子偏熱（寒熱 +${n}）。`, `With Kaleidoscope Herbal, it warms the body (heat +${n}).`] : [`裝了《草本》時，吃了身子偏涼（寒熱 −${n}）。`, `With Kaleidoscope Herbal, it cools the body (heat −${n}).`]);
  }
  if (HERBAL_ADJUVANTS.some((a) => a.id === id)) lines.push(["裝了《草本》時，可多放一個進砂鍋當佐使，整鍋湯劑多一份。", "With Kaleidoscope Herbal, one more in the clay pot works as an adjuvant: the brew gives one more serving."]);
  if (FISHING_BAITS.some((b) => b.id === id)) lines.push(["裝了《漁歌》時，可以掛在釣竿上當魚餌，魚比較快上鉤。", "With Kaleidoscope Fishing Voyage, it works as bait on a rod: fish bite sooner."]);
  const pond = FISHING_POND_FEEDS.find((f) => f.id === id);
  if (pond) lines.push([`裝了《漁歌》時，可放進魚池的餵食台，一個算 ${pond.meals} 餐。`, `With Kaleidoscope Fishing Voyage, it goes in a fish pond feeder, ${pond.meals} meal${pond.meals > 1 ? "s" : ""} each.`]);
  const wine = TAVERN_WINES.find((w) => w.id === id);
  if (wine) {
    const names = wine.ingredients.map((i) => nameOf(rid(i)));
    lines.push([`裝了《酒館》時，也能用酒館的酒桶釀：加水，再放${names.map((n) => n[0]).join("、")}各一份。`, `With Kaleidoscope Tavern, it can also be brewed in a Tavern barrel: water, then one each of ${names.map((n) => n[1]).join(", ")}.`]);
  }
  return lines;
}

function entry(id, category, lines, extra = {}) {
  return { id, category, lines: [...lines, ...partnerLines(id)], ...extra };
}

/** One row per entry: id (without namespace), category, lines as [zh, en] pairs. */
export function guideEntries() {
  const rows = [];
  for (const crop of CROPS) {
    const harvest = crop.form === "aquatic" ? [AQUATIC_HARVEST[crop.pick ? "picked" : "once"]] : [];
    const lines = [FORM_LINE[crop.form], ...harvest, climateLine(crop.climate), BONE_MEAL_LINE, wildLine(crop.wild), ...villageLine(crop.seed), ...usesOf(crop.produce)];
    rows.push(entry(crop.produce, "crops", lines));
    // ## 1.1: what else comes off a ripe plant (a lotus pod, corn leaves) gets its own entry.
    for (const extra of crop.extra ?? []) {
      const item = ITEM_BY_ID.get(extra.item);
      rows.push(entry(extra.item, "crops", [[`收成成熟的${crop.zh}時，有時會一起掉落${item.zh}。`, `Ripe ${crop.en} sometimes drops ${item.en} as well.`], ...usesOf(extra.item)]));
    }
    if (crop.seed !== crop.produce) rows.push(entry(crop.seed, "crops", [[`種下長成${ITEM_BY_ID.get(crop.produce).zh}。`, `Grows into ${ITEM_BY_ID.get(crop.produce).en}.`], FORM_LINE[crop.form]]));
  }
  rows.push(entry(TRELLIS.id, "crops", [FORM_LINE.trellis, ["用竹子與線在工作台合成。", "Crafted from bamboo and string."]], { block: true }));

  for (const tree of TREES) {
    rows.push(
      entry(saplingBlockId(tree), "trees", [
        ["種在草地或泥土上，長成一棵果樹。周圍要有空間，被擋住就會等到空出來。", "Plant it on grass or dirt and it grows into a fruit tree. It needs room; if something is in the way it waits."],
        climateLine(tree.climate),
        ["骨粉一次只推進一個階段。", "Bone meal moves it on one stage only."],
        ...(tree.wild ? [wildTreeLine(tree.wild)] : []),
        ...villageLine(saplingBlockId(tree)),
        ...(tree.trunk === BANANA_TRUNK.id ? [["香蕉長成單幹的香蕉假莖，頂上一叢葉子；假莖砍掉，葉子一樣會掉光。", "A banana grows a single banana trunk with a tuft of leaves on top; chop the trunk and the leaves fall."]] : []),
      ], { block: true })
    );
    rows.push(
      entry(tree.fruit, "trees", [
        tree.bark
          ? ["肉桂不結果：葉子長出紅褐色的嫩葉時，點它剝下一片肉桂皮，葉子回到原樣後會再長。", "Cinnamon bears no fruit: when its leaves put out red-brown new growth, use one to strip a piece of bark; it grows back again."]
          : ["葉子會開花；開花的葉子下方是空的，就會垂下一顆小青果，長大後轉為熟果。點熟果摘下，之後會再開花結果，不用重種。", "The leaves blossom; a blossoming leaf with nothing below it hangs a small green fruit, which grows and ripens. Use a ripe fruit to pick it; the tree blossoms and fruits again."],
        ...(tree.bark ? [] : [["熟果之前打掉果實什麼都不會掉；上面的葉子沒了，果實也會掉下來。", "A fruit broken before it is ripe gives nothing; if the leaves above it go, it falls."]]),
        ...usesOf(tree.fruit),
      ])
    );
  }
  rows.push(entry(FRUITWOOD_LOG.id, "trees", [["果樹的樹幹。用斧頭砍下可得果木原木，但沒了樹幹，葉子會掉光，果樹就沒了。", "The trunk of a fruit tree. An axe takes it, but without its trunk the leaves fall and the tree is gone."]], { block: true }));
  rows.push(entry(FRUITWOOD_PLANKS.id, "trees", [["一根果木原木在工作台鋸成四塊果木木板，原版需要木板的配方（木棍、工作台、箱子……）都能用。", "A Fruitwood Log makes four Fruitwood Planks at the crafting table; any vanilla recipe that takes planks (sticks, crafting tables, chests…) takes them."]], { block: true }));
  rows.push(entry(BANANA_TRUNK.id, "trees", [["香蕉的假莖。砍下可得香蕉假莖，但沒了假莖，香蕉的葉子會掉光。", "The trunk of a banana plant. It can be chopped, but without it the banana's leaves fall."]], { block: true }));

  rows.push(
    entry(JUICER.id, "stations", [
      ["拿水果點榨汁機放進去，最多兩顆；裝滿後拿空玻璃瓶點它，就得到一瓶果汁。", "Use fruit on the juicer to put it in, two at most; when it is full, use an empty glass bottle on it for a bottle of juice."],
      ["兩顆同樣的水果榨出那種果汁，兩顆不同的水果榨出綜合果汁。空手點它把水果拿回來。", "Two of the same fruit give that fruit's juice; two different fruits give mixed juice. An empty hand takes the fruit back."],
      ["木瓜或香蕉配一桶牛奶，榨出木瓜牛奶、香蕉牛奶；放牛奶時會還你空桶。", "Papaya or banana with a milk bucket makes papaya or banana milk; the empty bucket comes straight back."],
      ["用木板、玻璃與鐵錠在工作台合成。", "Crafted from planks, glass and an iron ingot."],
    ], { block: true })
  );
  rows.push(
    entry(PICKLING_JAR.id, "stations", [
      ["拿食材點醃漬缸放進去，最多四樣。缸裡剛好是某道醃漬品的材料時，空手點它封缸。", "Use ingredients on the jar to put them in, four at most. When what is inside is exactly one recipe, use it with an empty hand to seal it."],
      ["封缸後缸口的顏色會慢慢變深，變成紅褐色就好了，空手點它開缸取出。材料對不上時，空手點它會把東西還給你。", "Once sealed, the colour in its mouth slowly deepens; when it turns red-brown it is done, and an empty hand opens it. If the contents match nothing, an empty hand gives them back."],
      ["發酵靠世界時間，人不在附近也會繼續。用陶土（黏土球）與木板在工作台合成。", "Fermenting follows the world clock and goes on while you are away. Crafted from clay balls and planks."],
    ], { block: true })
  );

  for (const item of ITEMS.filter((i) => ["ingredient", "dish", "drink"].includes(i.kind))) {
    const row = recipeMaking(item.id);
    const lines = [madeLine(row, item.id)];
    if (row.station === "pickling_jar") lines.push([`封缸 ${days(row.time)} 天。`, `Sealed for ${days(row.time)} day${row.time > 24000 ? "s" : ""}.`]);
    if (item.oil) lines.push([`可當炒鍋用油，一瓶可用 ${OIL_USES} 次，用完留下空瓶。`, `Works as wok oil: one bottle lasts ${OIL_USES} uses and leaves an empty bottle.`]);
    const category = item.kind === "dish" ? "dishes" : item.kind === "drink" ? "drinks" : "ingredients";
    rows.push(entry(item.id, category, [...lines, ...usesOf(item.id)], { recipe: row, makes: item.id }));
  }
  return rows;
}

const OIL_USES = 256;
const days = (ticks) => String(Math.round((ticks / 24000) * 10) / 10);

/** Ingredient names of a recipe, as [zh, en] pairs. */
function inputNames(row) {
  if (row.input === "*") return [["任兩種不同的水果", "any two different fruits"]];
  const ids = row.input ? [rid(row.input)] : row.inputs ? row.inputs.map(rid) : row.slots.map((slot) => slot[0]);
  const names = ids.map(nameOf);
  if (row.station === "juicer") return row.milk ? [names[0], nameOf("minecraft:milk_bucket")] : [names[0], names[0]];
  return names;
}

function madeLine(row, id) {
  const [zh, en] = STATION_NAME[row.station];
  const names = inputNames(row);
  const extra = row.outputs && row.outputs[0][0] !== id ? ["（副產物）", " (a by-product)"] : ["", ""];
  return [`在${zh}${row.station === "furnace" ? "裡烤" : "上做"}：${names.map((n) => n[0]).join("＋")}${extra[0]}。`, `Made ${row.station === "furnace" ? "in" : "on"} the ${en}: ${names.map((n) => n[1]).join(" + ")}${extra[1]}.`];
}

const VANILLA_NAMES = {
  "minecraft:wheat": ["小麥", "Wheat"],
  "minecraft:potato": ["馬鈴薯", "Potato"],
  "minecraft:apple": ["蘋果", "Apple"],
  "minecraft:chicken": ["生雞肉", "Raw Chicken"],
  "minecraft:mutton": ["生羊肉", "Raw Mutton"],
  "minecraft:snowball": ["雪球", "Snowball"],
  "minecraft:honey_bottle": ["蜂蜜瓶", "Honey Bottle"],
  "minecraft:glass_bottle": ["玻璃瓶", "Glass Bottle"],
  "minecraft:stick": ["木棒", "Stick"],
  "minecraft:egg": ["雞蛋", "Egg"],
  "minecraft:porkchop": ["生豬排", "Raw Porkchop"],
  "minecraft:sugar": ["糖", "Sugar"],
  "minecraft:bowl": ["碗", "Bowl"],
  "minecraft:beef": ["生牛肉", "Raw Beef"],
  "minecraft:chicken": ["生雞肉", "Raw Chicken"],
  "minecraft:milk_bucket": ["牛奶桶", "Milk Bucket"],
  "minecraft:honey_bottle": ["蜂蜜瓶", "Honey Bottle"],
  "kaleidoscope_cookery:rice": ["米", "Rice"],
  "kaleidoscope_cookery:cooked_rice": ["白飯", "Cooked Rice"],
  "kaleidoscope_cookery:red_chili": ["紅辣椒", "Red Chili"],
};

/** [zh, en] name of any id the chapter mentions. */
export function nameOf(id) {
  if (VANILLA_NAMES[id]) return VANILLA_NAMES[id];
  const bare = id.replace(`${NAMESPACE}:`, "");
  const item = ITEM_BY_ID.get(bare);
  if (item) return [item.zh, item.en];
  if (bare === TRELLIS.id) return [TRELLIS.zh, TRELLIS.en];
  if (bare === FRUITWOOD_LOG.id) return [FRUITWOOD_LOG.zh, FRUITWOOD_LOG.en];
  if (bare === BANANA_TRUNK.id) return [BANANA_TRUNK.zh, BANANA_TRUNK.en];
  if (bare === FRUITWOOD_PLANKS.id) return [FRUITWOOD_PLANKS.zh, FRUITWOOD_PLANKS.en];
  for (const station of [JUICER, PICKLING_JAR]) if (bare === station.id) return [station.zh, station.en];
  const tree = TREES.find((t) => saplingBlockId(t) === bare);
  if (tree) return [`${tree.zh}樹苗`, `${tree.en} Sapling`];
  throw new Error(`guidebook: no name for ${id}`);
}

/** The drawn icon (tools/art/rd_icons.py); docs/art/MISSING_ART.md lists the ones not drawn yet. */
export const iconPath = (id) => `textures/${NAMESPACE}/items/${id.replace(`${NAMESPACE}:`, "")}`;

export const GUIDE_TEXT = {
  zh: {
    title: "森羅物語：豐收",
    intro: [
      "豐收為廚房加入新的作物與果樹。作物的成熟度只看外觀：顏色變了、葉子轉黃、果實上色，就是熟了。",
      "每種作物都有喜歡的氣候。種在對的地方長得最快；用玻璃當屋頂、四周圍起來的溫室，什麼作物都能照常生長。",
      "收成可以在廚房的砧板、石磨、炒鍋、湯鍋、蒸籠、茶壺與竹篩上處理，也能用豐收自己的榨汁機和醃漬缸。",
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
      "The harvest goes onto Cookery's chopping board, millstone, wok, stockpot, steamer, teapot and bamboo tray, and into Harvest's own juicer and pickling jar.",
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
  if (!METHOD[row.station] || row.input === "*") return null;
  const ingredients = row.input ? [rid(row.input)] : row.inputs ? row.inputs.map(rid) : row.slots.map((slot) => slot[0]);
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
      mechanicsByLocale: { en_US: row.lines.map((line) => line[1]), zh_TW: zh, zh_CN: zh.map(toSimplified) },
    };
    const item = ITEM_BY_ID.get(row.id);
    if (item?.food) Object.assign(out, { stack: 64, food: { nutrition: item.food[0], saturation: item.food[1] } });
    const recipe = row.recipe && recipeOf(row.recipe, row.makes);
    if (recipe) out.recipes = [recipe];
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
    version: VERSION,
    order: 210,
    icon: "textures/kaleidoscope_harvest/ui/guidebook", // the series star, as every Kaleidoscope add-on shows in the guidebook list
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
