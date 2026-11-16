// Writes every generated pack file from the data tables (npm run generate):
//
//   BP  blocks/, items/, loot_tables/kaleidoscope_harvest/, recipes/, item_catalog/, texts/,
//       features/, feature_rules/ (wild plants)
//   RP  blocks.json, models/blocks/, textures/*.json, texts/, placeholder textures
//
// Generated folders are wiped and rewritten, so edit the data tables
// (packs/BP/scripts/data/), not the JSON. Placeholder PNGs are only written where
// no file exists yet; pass --art to redraw them all.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as art from "./art.mjs";
import { encodePng } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(root, "packs", "BP");
const RP = join(root, "packs", "RP");
const load = (name) => import(pathToFileURL(join(BP, "scripts", "data", name)).href);

const { NAMESPACE, rid, state } = await load("ns.js");
const { CROPS, TRELLIS, WILD_SOIL, cropBlockId, wildBlockId } = await load("crops.js");
const { TREES, FRUIT_LOG, FRUIT_STAGES, saplingBlockId, fruitLeavesBlockId } = await load("trees.js");
const { ITEMS } = await load("items.js");
const { RECIPES, recipeMaking } = await load("dishes.js");
const { JUICER, PICKLING_JAR } = await load("stations.js");
const { toSimplified } = await load("zh_cn.js");

const REDRAW = process.argv.includes("--art");
const NS = NAMESPACE;
const BLOCK_FORMAT = "1.21.90";
const ITEM_FORMAT = "1.21.90";
const GROUP = {
  crops: `${NS}:itemGroup.name.harvest_crops`,
  trees: `${NS}:itemGroup.name.harvest_trees`,
  // ## Cookery's own groups, as Ranching (foods) and Herbal (ingredients, tea_drinks,
  // ## cooking_stations) use them against Cookery 1.6.6.
  foods: "kaleidoscope_cookery:itemGroup.name.foods",
  ingredients: "kaleidoscope_cookery:itemGroup.name.ingredients",
  drinks: "kaleidoscope_cookery:itemGroup.name.tea_drinks",
  stations: "kaleidoscope_cookery:itemGroup.name.cooking_stations",
};
const GROUP_NAMES = {
  [GROUP.crops]: ["豐收：作物", "Harvest: Crops"],
  [GROUP.trees]: ["豐收：果樹", "Harvest: Fruit Trees"],
};
/** Icons drawn for the art set (tools/art/rd_icons.py); they replace the placeholders. */
const ART_ICONS = join(RP, "textures", NS, "items");

// --- Output helpers ---------------------------------------------------------------------

const written = [];
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  written.push(path);
}
function writeArt(path, img) {
  if (existsSync(path) && !REDRAW) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(img));
}
function wipe(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

for (const dir of [join(BP, "blocks"), join(BP, "items"), join(BP, "loot_tables", NS), join(BP, "recipes"), join(BP, "item_catalog"), join(BP, "features"), join(BP, "feature_rules")]) wipe(dir);
// ## RP/models/blocks is not wiped: the station models there are hand-made (tools/art/station_models.py).

const terrain = {};
const itemTextures = {};
const blockSounds = {};
const names = {}; // lang key → [zh, en]
const catalog = { crops: [], trees: [] };

const blockTex = (name) => `textures/blocks/${NS}/${name}`;
const itemTex = (name) => `textures/items/${NS}/${name}`;
function addTerrain(name, img) {
  terrain[`kh_${name}`] = { textures: blockTex(name) };
  writeArt(join(RP, `${blockTex(name)}.png`), img);
}
/** An item icon; `img` is drawn only when no file is there yet. */
function addIcon(id, img) {
  itemTextures[`kh_${id}`] = { textures: itemTex(id) };
  const drawn = join(ART_ICONS, `${id}.png`);
  if (existsSync(drawn)) {
    mkdirSync(dirname(join(RP, `${itemTex(id)}.png`)), { recursive: true });
    copyFileSync(drawn, join(RP, `${itemTex(id)}.png`));
  } else writeArt(join(RP, `${itemTex(id)}.png`), img);
}

// --- Shared block pieces ------------------------------------------------------------------

/** How often a wild plant appears: tries per chunk and the chance of each. */
const WILD_SPREAD = { iterations: 1, scatter_chance: 15 };

const CROSS_GEO = `geometry.${NS}.cross`;
const material = (texture) => ({ "*": { texture: `kh_${texture}`, render_method: "alpha_test", face_dimming: false, ambient_occlusion: false } });
const intRange = (max) => ({ values: { min: 0, max } });
const FARMLAND = ["minecraft:farmland", { tags: "q.any_tag('kaleidoscope_cookery:farmland')" }];
const SOIL = ["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:rooted_dirt", "minecraft:moss_block", "minecraft:mud"];

function block(id, { states, components, permutations = [], menu = { category: "none" } }) {
  writeJson(join(BP, "blocks", `${id}.json`), {
    format_version: BLOCK_FORMAT,
    "minecraft:block": {
      description: { identifier: rid(id), menu_category: menu, ...(states ? { states } : {}) },
      components: { "minecraft:display_name": `tile.${rid(id)}.name`, ...components },
      permutations,
    },
  });
}

function lootTable(name, pools) {
  writeJson(join(BP, "loot_tables", NS, `${name}.json`), { pools });
  return `loot_tables/${NS}/${name}.json`;
}
const countEntry = (id, [min, max], extra = {}) => ({
  rolls: 1,
  ...extra,
  entries: [{ type: "item", name: rid(id), weight: 1, functions: [{ function: "set_count", count: { min, max } }] }],
});

// --- Field crops ------------------------------------------------------------------------------

const S = (name) => `q.block_state('${state(name)}')`;

for (const crop of CROPS) {
  const id = cropBlockId(crop);
  const max = crop.maxGrowth;
  const tall = crop.form === "tall";
  const trellis = crop.form === "trellis";
  names[`tile.${rid(id)}.name`] = [crop.zh, crop.en];

  for (let s = 0; s <= max; s++)
    for (const grey of [false, true]) {
      const suffix = `${s}${grey ? "_grey" : ""}`;
      addTerrain(`${crop.id}_stage${suffix}`, art.cropStage(crop.look, s, max, { grey, trellis, underground: crop.form === "underground" }));
      if (tall && s >= crop.tallFrom) addTerrain(`${crop.id}_top_stage${suffix}`, art.cropStage(crop.look, s, max, { grey, top: true }));
    }

  // ## Young and ripe loot. Underground crops only differ when dug with a hoe
  // ## (growth/crops.js adds the bonus). A trellis crop always gives its trellis back.
  const back = trellis ? [countEntry(TRELLIS.id, [1, 1])] : [];
  const young = lootTable(`${id}_young`, [countEntry(crop.seed, [1, 1]), ...back]);
  const ripePools = [countEntry(crop.produce, crop.drops.produce), ...back];
  if (crop.drops.seed[1] > 0 && crop.seed !== crop.produce) ripePools.push(countEntry(crop.seed, crop.drops.seed));
  const ripe = lootTable(`${id}_ripe`, ripePools);
  const none = tall ? lootTable(`${id}_upper`, []) : null;

  const states = { [state("growth")]: intRange(max), [state("off_climate")]: [false, true] };
  if (tall) states[state("upper")] = [false, true];

  const permutations = [];
  for (let s = 0; s <= max; s++)
    for (const grey of [false, true]) {
      const suffix = `${s}${grey ? "_grey" : ""}`;
      const cond = `${S("growth")} == ${s} && ${S("off_climate")} == ${grey}`;
      const height = Math.min(16, 3 + 2 * s);
      if (tall) {
        permutations.push({ condition: `${cond} && ${S("upper")} == false`, components: { "minecraft:material_instances": material(`${crop.id}_stage${suffix}`), "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, height, 16] } } });
        if (s >= crop.tallFrom) permutations.push({ condition: `${cond} && ${S("upper")} == true`, components: { "minecraft:material_instances": material(`${crop.id}_top_stage${suffix}`) } });
      } else {
        permutations.push({ condition: cond, components: { "minecraft:material_instances": material(`${crop.id}_stage${suffix}`), "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, trellis ? 16 : height, 16] } } });
      }
    }
  permutations.push({ condition: `${S("growth")} == ${max}`, components: { "minecraft:loot": ripe } });
  if (tall) permutations.push({ condition: `${S("upper")} == true`, components: { "minecraft:loot": none } });

  block(id, {
    states,
    components: {
      "minecraft:geometry": CROSS_GEO,
      "minecraft:material_instances": material(`${crop.id}_stage0`),
      "minecraft:collision_box": false,
      "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 4, 16] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:map_color": `#${crop.look.leaf.map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: tall ? [...FARMLAND, rid(id)] : FARMLAND }] },
      "minecraft:loot": young,
      // ## So Cookery's sickle reaps Harvest crops too (企劃書; to be checked in game).
      "tag:kaleidoscope_cookery:crop": {},
      [`${NS}:crop`]: {},
    },
    permutations,
  });
  blockSounds[rid(id)] = { sound: trellis ? "bamboo" : "grass" };
  wildPlant(crop);
}

// --- Wild plants (企劃書「第一份來源」) ---------------------------------------------------------
//
// One block per crop that never grows, placed by world generation the way Herbal places
// its wild herbs: a feature rule per biome tag → a search feature that finds the surface →
// a single-block feature. Breaking it gives the produce, and seeds for seed crops.

function wildPlant(crop) {
  const id = wildBlockId(crop);
  const soil = crop.wild.soil ?? WILD_SOIL;
  names[`tile.${rid(id)}.name`] = [`野生${crop.zh}`, `Wild ${crop.en}`];
  addTerrain(id, art.cropStage(crop.look, crop.maxGrowth, crop.maxGrowth, { underground: crop.form === "underground" }));
  const pools = [countEntry(crop.produce, [1, 2])];
  if (crop.seed !== crop.produce) pools.push(countEntry(crop.seed, [1, 2]));
  block(id, {
    components: {
      "minecraft:geometry": CROSS_GEO,
      "minecraft:material_instances": material(id),
      "minecraft:collision_box": false,
      "minecraft:selection_box": { origin: [-6, 0, -6], size: [12, 12, 12] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:movable": { movement_type: "popped" },
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: soil }] },
      "minecraft:loot": lootTable(id, pools),
    },
  });
  blockSounds[rid(id)] = { sound: "grass" };

  const feature = `${id}_feature`;
  const search = `${id}_search`;
  writeJson(join(BP, "features", "wild", `${feature}.json`), {
    format_version: "1.21.60",
    "minecraft:single_block_feature": {
      description: { identifier: rid(feature) },
      places_block: { name: rid(id) },
      enforce_placement_rules: false,
      enforce_survivability_rules: false,
      may_replace: ["minecraft:air", "minecraft:short_grass"],
      may_attach_to: { bottom: soil },
    },
  });
  writeJson(join(BP, "features", "wild", `${search}.json`), {
    format_version: "1.21.60",
    "minecraft:search_feature": {
      description: { identifier: rid(search) },
      places_feature: rid(feature),
      search_volume: { min: [-1, -32, -1], max: [1, 0, 1] },
      search_axis: "-y",
      required_successes: 1,
    },
  });
  for (const biome of crop.wild.biomes) {
    writeJson(join(BP, "feature_rules", "wild", `${id}_${biome}.json`), {
      format_version: "1.16.100",
      "minecraft:feature_rules": {
        description: { identifier: rid(`${id}_${biome}`), places_feature: rid(search) },
        conditions: {
          placement_pass: "after_surface_pass",
          "minecraft:biome_filter": { any_of: [{ test: "has_biome_tag", operator: "==", value: biome }] },
        },
        distribution: {
          ...WILD_SPREAD,
          x: { distribution: "uniform", extent: [0, 16] },
          y: "query.heightmap(variable.worldx, variable.worldz)",
          z: { distribution: "uniform", extent: [0, 16] },
        },
      },
    });
  }
}

// --- Bamboo Trellis -------------------------------------------------------------------------------

names[`tile.${rid(TRELLIS.id)}.name`] = [TRELLIS.zh, TRELLIS.en];
addTerrain(TRELLIS.id, art.trellis());
addIcon(TRELLIS.id, art.trellis());
block(TRELLIS.id, {
  menu: { category: "items", group: GROUP.crops },
  components: {
    "minecraft:geometry": CROSS_GEO,
    "minecraft:material_instances": material(TRELLIS.id),
    "minecraft:collision_box": false,
    "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 16, 16] },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 0.2 },
    "minecraft:light_dampening": 0,
    "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: FARMLAND }] },
    [`${NS}:trellis`]: {},
  },
});
blockSounds[rid(TRELLIS.id)] = { sound: "bamboo" };
catalog.crops.push(rid(TRELLIS.id));
writeJson(join(BP, "recipes", `${TRELLIS.id}.json`), {
  format_version: "1.20.10",
  "minecraft:recipe_shaped": {
    description: { identifier: rid(TRELLIS.id) },
    tags: ["crafting_table"],
    pattern: ["B B", "BSB", "B B"],
    key: { B: { item: "minecraft:bamboo" }, S: { item: "minecraft:string" } },
    result: { item: rid(TRELLIS.id), count: 2 },
    unlock: [{ item: "minecraft:bamboo" }],
  },
});

// --- Fruit trees -------------------------------------------------------------------------------------

names[`tile.${rid(FRUIT_LOG.id)}.name`] = [FRUIT_LOG.zh, FRUIT_LOG.en];
addTerrain(`${FRUIT_LOG.id}_side`, art.logSide());
addTerrain(`${FRUIT_LOG.id}_top`, art.logTop());
addIcon(FRUIT_LOG.id, art.logSide());
block(FRUIT_LOG.id, {
  menu: { category: "nature", group: GROUP.trees },
  components: {
    "minecraft:geometry": "minecraft:geometry.full_block",
    "minecraft:material_instances": {
      "*": { texture: `kh_${FRUIT_LOG.id}_side`, render_method: "opaque" },
      up: { texture: `kh_${FRUIT_LOG.id}_top`, render_method: "opaque" },
      down: { texture: `kh_${FRUIT_LOG.id}_top`, render_method: "opaque" },
    },
    "minecraft:destructible_by_mining": {
      seconds_to_destroy: 3,
      item_specific_speeds: [{ item: { tags: "q.any_tag('minecraft:is_axe')" }, destroy_speed: 0.6 }],
    },
    "minecraft:flammable": { catch_chance_modifier: 5, destroy_chance_modifier: 5 },
    "minecraft:map_color": "#785638",
    "tag:wood": {},
    "tag:log": {},
  },
});
blockSounds[rid(FRUIT_LOG.id)] = { sound: "wood" };
catalog.trees.push(rid(FRUIT_LOG.id));

for (const tree of TREES) {
  const sap = saplingBlockId(tree);
  const leaves = fruitLeavesBlockId(tree);
  names[`tile.${rid(sap)}.name`] = [`${tree.zh}樹苗`, `${tree.en} Sapling`];
  names[`tile.${rid(leaves)}.name`] = [`${tree.zh}果葉`, `${tree.en} Fruit Leaves`];

  for (let s = 0; s < tree.saplingStages; s++) addTerrain(`${sap}_stage${s}`, art.sapling(tree.look, s, tree.saplingStages));
  addIcon(sap, art.sapling(tree.look, tree.saplingStages - 1, tree.saplingStages));
  block(sap, {
    menu: { category: "nature", group: GROUP.trees },
    states: { [state("growth")]: intRange(tree.saplingStages - 1) },
    components: {
      "minecraft:geometry": CROSS_GEO,
      "minecraft:material_instances": material(`${sap}_stage0`),
      "minecraft:collision_box": false,
      "minecraft:selection_box": { origin: [-6, 0, -6], size: [12, 12, 12] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: SOIL }] },
      // ## Without minecraft:loot a block drops itself, which is what a sapling should do.
      [`${NS}:sapling`]: {},
    },
    permutations: Array.from({ length: tree.saplingStages - 1 }, (_, i) => ({
      condition: `${S("growth")} == ${i + 1}`,
      components: { "minecraft:material_instances": material(`${sap}_stage${i + 1}`) },
    })),
  });
  blockSounds[rid(sap)] = { sound: "grass" };
  catalog.trees.push(rid(sap));

  for (let s = 0; s < FRUIT_STAGES.length; s++)
    for (const grey of [false, true]) addTerrain(`${leaves}_${FRUIT_STAGES[s]}${grey ? "_grey" : ""}`, art.fruitLeaves(tree.look, s, grey));
  addIcon(leaves, art.fruitLeaves(tree.look, FRUIT_STAGES.length - 1));
  // ## Leaves drop a sapling now and then, like vanilla leaves: the way to start a second tree.
  const leafLoot = lootTable(leaves, [{ rolls: 1, entries: [{ type: "item", name: rid(sap), weight: 1 }, { type: "empty", weight: 19 }] }]);
  const ripeLeafLoot = lootTable(`${leaves}_ripe`, [{ rolls: 1, entries: [{ type: "item", name: rid(sap), weight: 1 }, { type: "empty", weight: 19 }] }, countEntry(tree.fruit, tree.pick)]);
  const leafMat = (name) => ({ "*": { texture: `kh_${name}`, render_method: "alpha_test" } });
  const leafPerms = [];
  for (let s = 0; s < FRUIT_STAGES.length; s++)
    for (const grey of [false, true])
      leafPerms.push({
        condition: `${S("fruit_stage")} == ${s} && ${S("off_climate")} == ${grey}`,
        components: { "minecraft:material_instances": leafMat(`${leaves}_${FRUIT_STAGES[s]}${grey ? "_grey" : ""}`) },
      });
  leafPerms.push({ condition: `${S("fruit_stage")} == ${FRUIT_STAGES.length - 1}`, components: { "minecraft:loot": ripeLeafLoot } });
  block(leaves, {
    menu: { category: "nature", group: GROUP.trees },
    states: { [state("fruit_stage")]: intRange(FRUIT_STAGES.length - 1), [state("off_climate")]: [false, true] },
    components: {
      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": leafMat(`${leaves}_none`),
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 0.3,
        item_specific_speeds: [{ item: "minecraft:shears", destroy_speed: 0.05 }, { item: { tags: "q.any_tag('minecraft:is_hoe')" }, destroy_speed: 0.1 }],
      },
      "minecraft:flammable": { catch_chance_modifier: 30, destroy_chance_modifier: 60 },
      "minecraft:light_dampening": 1,
      "minecraft:map_color": "#408238",
      "minecraft:loot": leafLoot,
      "tag:leaves": {},
      [`${NS}:fruit_leaves`]: {},
    },
    permutations: leafPerms,
  });
  blockSounds[rid(leaves)] = { sound: "grass" };
  catalog.trees.push(rid(leaves));
}

// --- Items ---------------------------------------------------------------------------------------------

const PLANTS = new Map(CROPS.filter((crop) => crop.form !== "trellis").map((crop) => [crop.seed, crop]));

for (const item of ITEMS) {
  names[`item.${rid(item.id)}.name`] = [item.zh, item.en];
  addIcon(item.id, art.icon(item.look));
  const made = recipeMaking(item.id);
  const prepared = ["ingredient", "dish", "drink"].includes(item.kind);
  // ## Eating gives back what the dish was served in: the bowl it was carried out in
  // ## or crafted with, or the drink's own bottle / Cookery cup.
  const bowl = made && (made.carrier === "minecraft:bowl" || (made.inputs ?? []).includes("minecraft:bowl"));
  const converts = item.converts ?? (bowl ? "minecraft:bowl" : undefined);
  const components = {
    "minecraft:icon": `kh_${item.id}`,
    "minecraft:display_name": { value: `item.${rid(item.id)}.name` },
    // ## An oil bottle keeps its uses left in a dynamic property, so it cannot stack.
    "minecraft:max_stack_size": item.oil ? 1 : item.kind === "drink" ? 16 : 64,
  };
  const plants = PLANTS.get(item.id);
  if (plants) components["minecraft:block_placer"] = { block: rid(cropBlockId(plants)), use_on: FARMLAND };
  if (item.food) {
    const drink = item.kind === "drink" || converts === "minecraft:glass_bottle";
    components["minecraft:food"] = {
      nutrition: item.food[0],
      saturation_modifier: item.food[1],
      ...(prepared ? { can_always_eat: true } : {}),
      ...(converts ? { using_converts_to: converts } : {}),
    };
    components["minecraft:use_animation"] = drink ? "drink" : "eat";
    components["minecraft:use_modifiers"] = { use_duration: 1.6, movement_modifier: 0.33 };
    components["minecraft:tags"] = { tags: ["minecraft:is_food"] };
  }
  const group = { dish: GROUP.foods, drink: GROUP.drinks, ingredient: GROUP.ingredients }[item.kind] ?? (item.id === "mandarin" ? GROUP.trees : GROUP.crops);
  const category = item.kind === "dish" || item.kind === "drink" ? "equipment" : "items";
  writeJson(join(BP, "items", `${item.id}.json`), {
    format_version: ITEM_FORMAT,
    "minecraft:item": { description: { identifier: rid(item.id), menu_category: { category, group } }, components },
  });
  if (group === GROUP.trees) catalog.trees.push(rid(item.id));
  else if (group === GROUP.crops) catalog.crops.push(rid(item.id));
}

// --- Vanilla recipes from the menu (crafting table, furnace) ----------------------------------------------

for (const row of RECIPES) {
  const result = { item: rid(row.result), count: row.count ?? 1 };
  const asItem = (id) => ({ item: id.includes(":") ? id : rid(id) });
  if (row.station === "crafting") {
    const counts = new Map();
    for (const id of row.inputs) counts.set(id, (counts.get(id) ?? 0) + 1);
    writeJson(join(BP, "recipes", `${row.result}.json`), {
      format_version: "1.20.10",
      "minecraft:recipe_shapeless": {
        description: { identifier: rid(row.result) },
        tags: ["crafting_table"],
        ingredients: [...counts].map(([id, count]) => ({ ...asItem(id), count })),
        result,
        unlock: [asItem(row.inputs.find((id) => !id.startsWith("minecraft:")) ?? row.inputs[0])],
      },
    });
  } else if (row.station === "furnace") {
    writeJson(join(BP, "recipes", `${row.result}.json`), {
      format_version: "1.20.10",
      "minecraft:recipe_furnace": {
        description: { identifier: rid(row.result) },
        tags: ["furnace", "smoker", "campfire", "soul_campfire"],
        input: asItem(row.input),
        output: rid(row.result),
      },
    });
  }
}

// --- Juicer and pickling jar (models and textures from tools/art/station_models.py) -----------------------

const stationTex = (name) => `textures/${NS}/blocks/stations/${name}`;
for (const name of [JUICER.id, PICKLING_JAR.id, ...JUICER.colours.map((c) => `juice_${c}`), ...PICKLING_JAR.contents.slice(1).map((c) => `contents_${c}`)])
  terrain[`kh_station_${name}`] = { textures: stationTex(name) };

function station(def, { states, materials, permutations, component, recipe, sound }) {
  names[`tile.${rid(def.id)}.name`] = [def.zh, def.en];
  // ## The block item shows the model; this icon is for the guidebook.
  addIcon(def.id, art.icon(def.look));
  block(def.id, {
    menu: { category: "items", group: GROUP.stations },
    states,
    components: {
      "minecraft:geometry": `geometry.${NS}.${def.id}`,
      "minecraft:material_instances": materials,
      "minecraft:collision_box": { origin: [-6, 0, -6], size: [12, 12, 12] },
      "minecraft:selection_box": { origin: [-6, 0, -6], size: [12, 13, 12] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 1 },
      "minecraft:light_dampening": 0,
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"] }] },
      [`${NS}:${def.id}`]: {},
    },
    permutations,
  });
  blockSounds[rid(def.id)] = { sound };
  writeJson(join(BP, "recipes", `${def.id}.json`), {
    format_version: "1.20.10",
    "minecraft:recipe_shaped": { description: { identifier: rid(def.id) }, tags: ["crafting_table"], ...recipe, result: { item: rid(def.id), count: 1 } },
  });
}

const opaque = (name) => ({ texture: `kh_station_${name}`, render_method: "alpha_test" });
station(JUICER, {
  states: { [state("fruit")]: intRange(JUICER.capacity), [state("juice")]: JUICER.colours },
  materials: { "*": opaque(JUICER.id), glass: { texture: `kh_station_${JUICER.id}`, render_method: "blend" }, juice: { texture: "kh_station_juice_empty", render_method: "blend" } },
  permutations: JUICER.colours.slice(1).map((colour) => ({
    condition: `${S("juice")} == '${colour}'`,
    components: {
      "minecraft:material_instances": { "*": opaque(JUICER.id), glass: { texture: `kh_station_${JUICER.id}`, render_method: "blend" }, juice: { texture: `kh_station_juice_${colour}`, render_method: "blend" } },
    },
  })),
  recipe: { pattern: [" I ", "GGG", "PPP"], key: { I: { item: "minecraft:iron_ingot" }, G: { item: "minecraft:glass" }, P: { item: "minecraft:oak_planks" } }, unlock: [{ item: "minecraft:glass" }] },
  sound: "glass",
});
station(PICKLING_JAR, {
  states: { [state("contents")]: PICKLING_JAR.contents },
  materials: { "*": opaque(PICKLING_JAR.id), contents: { texture: "kh_station_juice_empty", render_method: "alpha_test" } },
  permutations: PICKLING_JAR.contents.slice(1).map((c) => ({
    condition: `${S("contents")} == '${c}'`,
    components: { "minecraft:material_instances": { "*": opaque(PICKLING_JAR.id), contents: opaque(`contents_${c}`) } },
  })),
  recipe: { pattern: ["P", "C", "C"], key: { P: { item: "minecraft:oak_planks" }, C: { item: "minecraft:clay_ball" } }, unlock: [{ item: "minecraft:clay_ball" }] },
  sound: "stone",
});

// --- Creative inventory groups -----------------------------------------------------------------------

const groupIcon = { crops: rid("napa_cabbage"), trees: rid("mandarin") };
writeJson(join(BP, "item_catalog", "crafting_item_catalog.json"), {
  format_version: "1.21.60",
  "minecraft:crafting_items_catalog": {
    categories: [
      {
        category_name: "items",
        groups: ["crops"].map((g) => ({ group_identifier: { icon: groupIcon[g], name: GROUP[g] }, items: catalog[g] })),
      },
      {
        category_name: "nature",
        groups: [{ group_identifier: { icon: groupIcon.trees, name: GROUP.trees }, items: catalog.trees }],
      },
    ],
  },
});

// --- Resource pack ----------------------------------------------------------------------------------------

writeJson(join(RP, "models", "blocks", `${NS}.cross.geo.json`), {
  format_version: "1.12.0",
  "minecraft:geometry": [
    {
      description: { identifier: CROSS_GEO, texture_width: 16, texture_height: 16 },
      bones: [
        {
          name: "cross",
          pivot: [0, 0, 0],
          cubes: [45, -45].map((angle) => ({
            origin: [-8, 0, 0],
            size: [16, 16, 0],
            pivot: [0, 0, 0],
            rotation: [0, angle, 0],
            uv: { north: { uv: [0, 0], uv_size: [16, 16] }, south: { uv: [16, 0], uv_size: [-16, 16] } },
          })),
        },
      ],
    },
  ],
});
writeJson(join(RP, "textures", "terrain_texture.json"), { resource_pack_name: NS, texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4, texture_data: terrain });
writeJson(join(RP, "textures", "item_texture.json"), { resource_pack_name: NS, texture_name: "atlas.items", texture_data: itemTextures });
writeJson(join(RP, "blocks.json"), { format_version: "1.21.40", ...blockSounds });

// --- Language files ---------------------------------------------------------------------------------------

const PACK = {
  name: ["森羅物語：豐收", "Kaleidoscope Harvest"],
  description: ["非官方的森羅物語擴充：為廚房加入新的蔬菜、香料、水果與果樹。需要《森羅物語：廚房》。", "An unofficial Kaleidoscope expansion: new vegetables, spices, fruit and fruit trees for Cookery. Requires Kaleidoscope Cookery."],
};
for (const [key, value] of Object.entries(GROUP_NAMES)) names[key] = value;

function lang(index, convert = (s) => s) {
  const lines = ["## pack", `pack.name=${convert(PACK.name[index])}`, `pack.description=${convert(PACK.description[index])}`, "", "## generated from packs/BP/scripts/data — do not edit by hand"];
  for (const key of Object.keys(names).sort()) lines.push(`${key}=${convert(names[key][index])}`);
  return `${lines.join("\n")}\n`;
}
for (const pack of [BP, RP]) {
  mkdirSync(join(pack, "texts"), { recursive: true });
  writeFileSync(join(pack, "texts", "zh_TW.lang"), lang(0));
  writeFileSync(join(pack, "texts", "zh_CN.lang"), lang(0, toSimplified));
  writeFileSync(join(pack, "texts", "en_US.lang"), lang(1));
  writeJson(join(pack, "texts", "languages.json"), ["en_US", "zh_TW", "zh_CN"]);
}

for (const pack of [BP, RP]) writeArt(join(pack, "pack_icon.png"), art.packIcon());

console.log(`generate: ${written.length} JSON files, ${Object.keys(terrain).length} block textures, ${Object.keys(itemTextures).length} item icons`);
