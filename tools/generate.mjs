// Writes every generated pack file from the data tables (npm run generate):
//
//   BP  blocks/, items/, loot_tables/kaleidoscope_harvest/, recipes/, item_catalog/, texts/,
//       features/, feature_rules/ (wild plants)
//   RP  blocks.json, models/blocks/, textures/*.json, texts/, grey copies of the drawn crop textures
//
// Generated folders are wiped and rewritten, so edit the data tables
// (packs/BP/scripts/data/), not the JSON.
//
// ## Textures and icons come only from the drawn art (packs/RP/textures/kaleidoscope_harvest/,
// ## tools/art/). Nothing is drawn here: a texture the art does not have yet is still named at
// ## the path the art will use, and listed in docs/art/MISSING_ART.md.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodePng, encodePng } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(root, "packs", "BP");
const RP = join(root, "packs", "RP");
const load = (name) => import(pathToFileURL(join(BP, "scripts", "data", name)).href);

const { NAMESPACE, rid, state } = await load("ns.js");
const { CROPS, TRELLIS, WILD_SOIL, WATER_SOIL, cropBlockId, wildBlockId } = await load("crops.js");
const { TREES, TRUNKS, FRUITWOOD_LOG, FRUITWOOD_PLANKS, BANANA_TRUNK, FRUIT_STAGES, saplingBlockId, leavesBlockId, fruitBlockId, wildSaplingFeature, saplingBiomes } = await load("trees.js");
const { ITEMS } = await load("items.js");
const { RECIPES, recipeMaking } = await load("dishes.js");
const { JUICER, PICKLING_JAR, VISUAL_PROPS, SPLASH_PARTICLE, BUBBLE_PARTICLE } = await load("stations.js");
const { VILLAGE_CHANCE, VILLAGE_HOUSES, villageItems } = await load("village.js");
const { PLACED_FOODS, MAX_CUPS, placedFood } = await load("placedFood.js");
const { toSimplified } = await load("zh_cn.js");

const NS = NAMESPACE;
const BLOCK_FORMAT = "1.21.100"; // minecraft:movable needs 1.21.100+
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
/** Icons drawn for the art set (tools/art/rd_icons.py). */
const ART_ICONS = join(RP, "textures", NS, "items");

// --- Output helpers ---------------------------------------------------------------------

const written = [];
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  written.push(path);
}
function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(join(dir, e.name)) : [join(dir, e.name)]));
}
function wipe(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

// ## PBR sets this script wrote next to drawn textures that have since been removed.
for (const path of walkFiles(join(RP, "textures", NS, "blocks"))) if (path.endsWith(".texture_set.json") && !existsSync(path.replace(/\.texture_set\.json$/, ".png"))) rmSync(path);
// ## Grey copies are regenerated each run; stale ones would linger otherwise.
rmSync(join(RP, "textures", "blocks", NS), { recursive: true, force: true });
for (const dir of [join(BP, "blocks"), join(BP, "items"), join(BP, "loot_tables", NS), join(BP, "recipes"), join(BP, "item_catalog"), join(BP, "features", "wild"), join(BP, "feature_rules", "wild")]) wipe(dir);
// ## Only Harvest's own generated folders are wiped. features/ and feature_rules/ hold other work
// ## too (features/trees from tools/art/tree_shapes.py), and RP/models/blocks holds the art models.

const terrain = {};
const itemTextures = {};
const blockSounds = {};
const names = {}; // lang key → [zh, en]
const catalog = { crops: [], trees: [], foods: [], drinks: [], ingredients: [], stations: [] };

const blockTex = (name) => `textures/blocks/${NS}/${name}`;
const itemTex = (name) => `textures/${NS}/items/${name}`;

/** Drawn art the packs name but that is not there yet: [kind, id, path]. */
const missingArt = [];

/** Desaturates a colour, for crops off their climate (the art has no grey leaves). */
function grey([r, g, b]) {
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  return [r, g, b].map((v) => (v + (l - v) * 0.75) * 0.85);
}
/** The drawn block textures (tools/art/crop_textures.py), with _normal and _mer maps. */
const ART_BLOCKS = join(RP, "textures", NS, "blocks");
const artBlockTex = (rel) => `textures/${NS}/blocks/${rel}`;

/** A PBR texture set next to a colour texture whose _normal and _mer maps exist (企劃書：比照草本提供 PBR). */
function textureSet(base) {
  const name = base.split(/[\\/]/).pop();
  if (!existsSync(`${base}_normal.png`) || !existsSync(`${base}_mer.png`)) return;
  writeJson(`${base}.texture_set.json`, {
    format_version: "1.16.100",
    "minecraft:texture_set": { color: name, normal: `${name}_normal`, metalness_emissive_roughness: `${name}_mer` },
  });
}

/**
 * A block texture. With `from` (a path under the drawn textures, no extension) the drawn
 * texture is used, and `grey` makes a desaturated copy for crops off their climate;
 * while that file is not drawn yet, the path is still named and listed as missing.
 */
function addTerrain(name, { from, grey: makeGrey = false }) {
  const src = join(ART_BLOCKS, from);
  if (existsSync(`${src}.png`)) {
    if (!makeGrey) {
      terrain[`kh_${name}`] = { textures: artBlockTex(from) };
      textureSet(src);
      return;
    }
    const out = join(RP, blockTex(name));
    const pic = decodePng(readFileSync(`${src}.png`));
    for (let i = 0; i < pic.data.length; i += 4) {
      if (!pic.data[i + 3]) continue;
      const [r, g, b] = grey([pic.data[i], pic.data[i + 1], pic.data[i + 2]]);
      pic.data.set([r, g, b].map((v) => Math.round(Math.min(255, v))), i);
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(`${out}.png`, encodePng(pic));
    for (const map of ["_normal", "_mer"]) if (existsSync(`${src}${map}.png`)) copyFileSync(`${src}${map}.png`, `${out}${map}.png`);
    textureSet(out);
    terrain[`kh_${name}`] = { textures: blockTex(name) };
    return;
  }
  // ## Not drawn yet: name the path the art will have (a grey copy is made once it exists).
  missingArt.push(["block", name, `${artBlockTex(from)}.png`]);
  terrain[`kh_${name}`] = { textures: artBlockTex(from) };
}
/** An item icon from the drawn icons (tools/art/rd_icons.py), named even before it is drawn. */
function addIcon(id) {
  itemTextures[`kh_${id}`] = { textures: itemTex(id) };
  if (!existsSync(join(ART_ICONS, `${id}.png`))) missingArt.push(["icon", id, `${itemTex(id)}.png`]);
}

// --- Shared block pieces ------------------------------------------------------------------

/** How often a wild plant appears: tries per chunk and the chance of each. */
const WILD_SPREAD = { iterations: 1, scatter_chance: 15 };
/** Wild saplings are rarer than wild crops: whole trees already grow wild too. */
const SAPLING_SPREAD = { iterations: 1, scatter_chance: 6 };

const CROSS_GEO = `geometry.${NS}.cross`;
const material = (texture) => ({ "*": { texture: `kh_${texture}`, render_method: "alpha_test", face_dimming: false, ambient_occlusion: false } });
const intRange = (max) => ({ values: { min: 0, max } });
const FARMLAND = ["minecraft:farmland", { tags: "q.any_tag('kaleidoscope_cookery:farmland')" }];
// ## 1.1 aquatic crops: Cookery's paddy field, or the bed of shallow water (growth/environment.js).
const PADDY = { tags: "q.any_tag('kaleidoscope_cookery:farmland')" };
const WATER_BED = [PADDY, ...WATER_SOIL];
/** Lets a block stand in water (waterlogged) instead of being washed away. */
const IN_WATER = { "minecraft:liquid_detection": { detection_rules: [{ liquid_type: "water", can_contain_liquid: true, on_liquid_touches: "no_reaction" }] } };
const SOIL = ["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:dirt_with_roots", "minecraft:moss_block", "minecraft:mud"];
/** Drawn crop textures have 4 stages; block state 0–7 shows stage floor(state / 2) (docs/art/CROP_TEXTURES.md). */
const artStage = (s) => Math.floor(s / 2);
const ART_STAGES = [0, 1, 2, 3];

// The plain Bamboo Trellis model (tools/art/station_models.py): the frame is "*"; its
// "vine" instance stays see-through until a vine is planted, which swaps in the vine's
// own model (bamboo_trellis_<vine>, tools/art/plant_models.py).
const TRELLIS_GEO = `geometry.${NS}.bamboo_trellis`;
terrain.kh_station_bamboo_trellis = { textures: `textures/${NS}/blocks/stations/bamboo_trellis` };
const trellisMaterial = () => ({
  "*": { texture: "kh_station_bamboo_trellis", render_method: "alpha_test" },
  vine: { texture: "kh_station_juice_empty", render_method: "alpha_test" },
});

/** A plant texture instance: see-through, no face shading (the drawn stages are flat planes). */
const plantTex = (texture) => ({ texture: `kh_${texture}`, render_method: "alpha_test", face_dimming: false, ambient_occlusion: false });

/**
 * The art's plant models (tools/art/plant_models.py) have one bone per drawn stage; a
 * permutation shows only the bone of its stage (docs/art/PLANT_MODELS.md).
 */
const stagedGeometry = (identifier, bones, shown) => ({ identifier, bone_visibility: Object.fromEntries(bones.map((b) => [`stage${b}`, b === shown])) });
/** stageN instances → `<name>_stage_N` textures (the "*" fallback shows the current stage). */
function stagedMaterials(name, stages, shown, grey, extra = {}) {
  const tex = (n) => plantTex(`${name}_stage_${n}${grey ? "_grey" : ""}`);
  return { "*": tex(shown), ...Object.fromEntries(stages.map((n) => [`stage${n}`, tex(n)])), ...extra };
}
/** The bounding box of a drawn model's bone, in block units, for selection boxes. */
function boneBounds(geoFile, bone) {
  const geo = JSON.parse(readFileSync(join(RP, "models", "blocks", geoFile), "utf8"))["minecraft:geometry"][0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const cube of geo.bones.find((b) => b.name === bone).cubes)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], cube.origin[i]);
      max[i] = Math.max(max[i], cube.origin[i] + cube.size[i]);
    }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const origin = [clamp(Math.floor(min[0]), -8, 8), clamp(Math.floor(min[1]), 0, 16), clamp(Math.floor(min[2]), -8, 8)];
  const top = [clamp(Math.ceil(max[0]), -8, 8), clamp(Math.ceil(max[1]), 0, 16), clamp(Math.ceil(max[2]), -8, 8)];
  return { origin, size: top.map((v, i) => Math.max(1, v - origin[i])) };
}

function block(id, { states, components, permutations = [], menu = { category: "none" }, traits }) {
  writeJson(join(BP, "blocks", `${id}.json`), {
    format_version: BLOCK_FORMAT,
    "minecraft:block": {
      description: { identifier: rid(id), menu_category: menu, ...(states ? { states } : {}), ...(traits ? { traits } : {}) },
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
  const bush = crop.form === "bush";
  const aquatic = crop.form === "aquatic";
  names[`tile.${rid(id)}.name`] = [crop.zh, crop.en];

  // ## The art's models: <crop>_crop (vines: bamboo_trellis_<vine>, with the frame as its
  // ## "trellis" instance); a tall crop's upper block is <crop>_upper, which only has the
  // ## stages it appears in (docs/art/PLANT_MODELS.md).
  const geo = trellis ? `geometry.${NS}.bamboo_trellis_${crop.id}` : `geometry.${NS}.${crop.id}_crop`;
  const upperGeo = `geometry.${NS}.${crop.id}_upper`;
  const upperStages = tall ? ART_STAGES.filter((n) => n >= artStage(crop.tallFrom)) : [];
  const frame = trellis ? { trellis: { texture: "kh_station_bamboo_trellis", render_method: "alpha_test" } } : {};
  const look = (s, grey) => stagedMaterials(crop.id, ART_STAGES, artStage(s), grey, frame);
  const lookUpper = (s, grey) => stagedMaterials(`${crop.id}_upper`, upperStages, artStage(s), grey);

  for (const n of ART_STAGES)
    for (const grey of [false, true]) {
      const suffix = grey ? "_grey" : "";
      addTerrain(`${crop.id}_stage_${n}${suffix}`, { from: `crops/${crop.id}_stage_${n}`, grey });
      if (upperStages.includes(n)) addTerrain(`${crop.id}_upper_stage_${n}${suffix}`, { from: `crops/${crop.id}_upper_stage_${n}`, grey });
    }

  // ## Young and ripe loot. Underground crops only differ when dug with a hoe
  // ## (growth/crops.js adds the bonus). A trellis crop always gives its trellis back.
  const back = trellis ? [countEntry(TRELLIS.id, [1, 1])] : [];
  const young = lootTable(`${id}_young`, [countEntry(crop.seed, [1, 1]), ...back]);
  const ripePools = [countEntry(crop.produce, crop.drops.produce), ...back];
  if (crop.drops.seed[1] > 0 && crop.seed !== crop.produce) ripePools.push(countEntry(crop.seed, crop.drops.seed));
  // ## 1.1: what else comes off a ripe plant (a lotus pod, corn leaves).
  for (const extra of crop.extra ?? []) ripePools.push(countEntry(extra.item, extra.count));
  const ripe = lootTable(`${id}_ripe`, ripePools);
  const none = tall ? lootTable(`${id}_upper`, []) : null;

  const states = { [state("growth")]: intRange(max), [state("off_climate")]: [false, true] };
  if (tall) states[state("upper")] = [false, true];

  const permutations = [];
  for (let s = 0; s <= max; s++)
    for (const grey of [false, true]) {
      const cond = `${S("growth")} == ${s} && ${S("off_climate")} == ${grey}`;
      const height = Math.min(16, 3 + 2 * s);
      const lower = {
        "minecraft:geometry": stagedGeometry(geo, ART_STAGES, artStage(s)),
        "minecraft:material_instances": look(s, grey),
        "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, trellis ? 16 : height, 16] },
      };
      if (tall) {
        permutations.push({ condition: `${cond} && ${S("upper")} == false`, components: lower });
        if (s >= crop.tallFrom)
          permutations.push({
            condition: `${cond} && ${S("upper")} == true`,
            components: { "minecraft:geometry": stagedGeometry(upperGeo, upperStages, artStage(s)), "minecraft:material_instances": lookUpper(s, grey), "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 16, 16] } },
          });
      } else {
        permutations.push({ condition: cond, components: lower });
      }
    }
  permutations.push({ condition: `${S("growth")} == ${max}`, components: { "minecraft:loot": ripe } });
  if (tall) permutations.push({ condition: `${S("upper")} == true`, components: { "minecraft:loot": none } });

  block(id, {
    states,
    components: {
      "minecraft:geometry": stagedGeometry(geo, ART_STAGES, 0),
      "minecraft:material_instances": look(0, false),
      "minecraft:collision_box": false,
      "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 4, 16] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:map_color": `#${crop.look.leaf.map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: tall ? [...FARMLAND, rid(id)] : bush ? [...SOIL, "minecraft:farmland"] : aquatic ? WATER_BED : FARMLAND }] },
      ...(aquatic ? IN_WATER : {}),
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
  const water = crop.wild.water === true;
  const soil = crop.wild.soil ?? (water ? WATER_SOIL : WILD_SOIL);
  names[`tile.${rid(id)}.name`] = [`野生${crop.zh}`, `Wild ${crop.en}`];
  const pools = [countEntry(crop.produce, [1, 2])];
  if (crop.seed !== crop.produce) pools.push(countEntry(crop.seed, [1, 2]));
  // ## The ripe stage of the crop's own model; a wild vine has no trellis, so it is a plain cross.
  const vine = crop.form === "trellis";
  block(id, {
    components: {
      "minecraft:geometry": vine ? CROSS_GEO : stagedGeometry(`geometry.${NS}.${crop.id}_crop`, ART_STAGES, 3),
      "minecraft:material_instances": vine ? material(`${crop.id}_stage_3`) : stagedMaterials(crop.id, ART_STAGES, 3, false),
      "minecraft:collision_box": false,
      "minecraft:selection_box": { origin: [-6, 0, -6], size: [12, 12, 12] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:movable": { movement_type: "popped" },
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: soil }] },
      ...(water ? IN_WATER : {}),
      "minecraft:loot": lootTable(id, pools),
    },
  });
  blockSounds[rid(id)] = { sound: "grass" };

  wildFeature(id, id, soil, crop.wild.biomes, WILD_SPREAD, water);
}

/** World generation for one wild block: a rule per biome tag → a surface search → the block. */
function wildFeature(name, blockId, soil, biomes, spread = WILD_SPREAD, water = false) {
  const feature = `${name}_feature`;
  const search = `${name}_search`;
  writeJson(join(BP, "features", "wild", `${feature}.json`), {
    format_version: "1.21.60",
    "minecraft:single_block_feature": {
      description: { identifier: rid(feature) },
      places_block: { name: rid(blockId) },
      enforce_placement_rules: false,
      enforce_survivability_rules: false,
      // ## An aquatic wild plant stands in the water over the bed (1.1), any other one in the air.
      may_replace: water ? ["minecraft:water"] : ["minecraft:air", "minecraft:short_grass"],
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
  for (const biome of biomes) {
    writeJson(join(BP, "feature_rules", "wild", `${name}_${biome}.json`), {
      format_version: "1.16.100",
      "minecraft:feature_rules": {
        description: { identifier: rid(`${name}_${biome}`), places_feature: rid(search) },
        conditions: {
          placement_pass: "after_surface_pass",
          "minecraft:biome_filter": { any_of: [{ test: "has_biome_tag", operator: "==", value: biome }] },
        },
        distribution: {
          ...spread,
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
addIcon(TRELLIS.id);
block(TRELLIS.id, {
  menu: { category: "items", group: GROUP.crops },
  components: {
    "minecraft:geometry": TRELLIS_GEO,
    "minecraft:material_instances": trellisMaterial(null),
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

// Trunks: Fruitwood Log for every tree but the banana, whose trunk has its own texture.
const TRUNK_ART = { [FRUITWOOD_LOG.id]: ["trees/fruitwood_log", "trees/fruitwood_log_top"], [BANANA_TRUNK.id]: ["trees/banana_trunk", "trees/banana_trunk"] };
for (const trunk of TRUNKS) {
  const [side, top] = TRUNK_ART[trunk.id];
  names[`tile.${rid(trunk.id)}.name`] = [trunk.zh, trunk.en];
  addTerrain(`${trunk.id}_side`, { from: side });
  addTerrain(`${trunk.id}_top`, { from: top });
  addIcon(trunk.id);
  block(trunk.id, {
    menu: { category: "nature", group: GROUP.trees },
    components: {
      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": {
        "*": { texture: `kh_${trunk.id}_side`, render_method: "opaque" },
        up: { texture: `kh_${trunk.id}_top`, render_method: "opaque" },
        down: { texture: `kh_${trunk.id}_top`, render_method: "opaque" },
      },
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: trunk === BANANA_TRUNK ? 1 : 3,
        item_specific_speeds: [{ item: { tags: "q.any_tag('minecraft:is_axe')" }, destroy_speed: 0.6 }],
      },
      "minecraft:flammable": { catch_chance_modifier: 5, destroy_chance_modifier: 5 },
      "minecraft:map_color": "#785638",
      "tag:wood": {},
      "tag:log": {},
    },
  });
  blockSounds[rid(trunk.id)] = { sound: trunk === BANANA_TRUNK ? "grass" : "wood" };
  catalog.trees.push(rid(trunk.id));
}

// 1.1: Fruitwood Planks. The block item is replaced by an item of the same id (as the placeable foods are)
// so it can carry the minecraft:planks tag: vanilla recipes that take any planks (sticks, crafting table,
// chests…) then take these too.
{
  const planks = FRUITWOOD_PLANKS;
  names[`tile.${rid(planks.id)}.name`] = [planks.zh, planks.en];
  names[`item.${rid(planks.id)}.name`] = [planks.zh, planks.en];
  addTerrain(planks.id, { from: `trees/${planks.id}` });
  addIcon(planks.id);
  block(planks.id, {
    components: {
      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": { "*": { texture: `kh_${planks.id}`, render_method: "opaque" } },
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 2,
        item_specific_speeds: [{ item: { tags: "q.any_tag('minecraft:is_axe')" }, destroy_speed: 0.5 }],
      },
      "minecraft:flammable": { catch_chance_modifier: 5, destroy_chance_modifier: 20 },
      "minecraft:map_color": "#9c7048",
      "tag:wood": {},
    },
  });
  blockSounds[rid(planks.id)] = { sound: "wood" };
  writeJson(join(BP, "items", `${planks.id}.json`), {
    format_version: ITEM_FORMAT,
    "minecraft:item": {
      description: { identifier: rid(planks.id), menu_category: { category: "construction", group: "minecraft:itemGroup.name.planks" } },
      components: {
        "minecraft:icon": `kh_${planks.id}`,
        "minecraft:display_name": { value: `item.${rid(planks.id)}.name` },
        "minecraft:block_placer": { block: rid(planks.id), replace_block_item: true },
        "minecraft:fuel": { duration: 15 },
        "minecraft:tags": { tags: ["minecraft:planks"] },
      },
    },
  });
  writeJson(join(BP, "recipes", `${planks.id}.json`), {
    format_version: "1.20.10",
    "minecraft:recipe_shapeless": {
      description: { identifier: rid(planks.id) },
      tags: ["crafting_table"],
      ingredients: [{ item: rid(planks.from) }],
      result: { item: rid(planks.id), count: planks.count },
      unlock: [{ item: rid(planks.from) }],
    },
  });
}

/** The leaves' two looks (企劃書 as revised in art PR #4): state blossom false → bare, true → blossom. */
const LEAF_LOOKS = [
  [false, "bare"],
  [true, "blossom"],
];
const SAPLING_GEO = `geometry.${NS}.sapling`;

for (const tree of TREES) {
  const sap = saplingBlockId(tree);
  const leaves = leavesBlockId(tree);
  names[`tile.${rid(sap)}.name`] = [`${tree.zh}樹苗`, `${tree.en} Sapling`];
  names[`tile.${rid(leaves)}.name`] = [`${tree.zh}樹葉`, `${tree.en} Leaves`];

  // ## One drawn sapling texture and model for every sapling stage. A grown sapling places the
  // ## tree's feature (packs/BP/features/trees/, tools/art/tree_shapes.py): growth/trees.js.
  addTerrain(sap, { from: `saplings/${tree.id}_sapling` });
  addIcon(sap);
  block(sap, {
    menu: { category: "nature", group: GROUP.trees },
    states: { [state("growth")]: intRange(tree.saplingStages - 1) },
    components: {
      "minecraft:geometry": SAPLING_GEO,
      "minecraft:material_instances": { "*": plantTex(sap), sapling: plantTex(sap) },
      "minecraft:collision_box": false,
      "minecraft:selection_box": { origin: [-6, 0, -6], size: [12, 12, 12] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: SOIL }] },
      // ## Without minecraft:loot a block drops itself, which is what a sapling should do.
      [`${NS}:sapling`]: {},
    },
  });
  blockSounds[rid(sap)] = { sound: "grass" };
  catalog.trees.push(rid(sap));
  // ## Wild saplings, besides the whole wild trees of feature_rules/trees: a sapling to dig up
  // and take home. Mandarin has none (village chests only).
  if (tree.wild) wildFeature(wildSaplingFeature(tree), sap, SOIL, saplingBiomes(tree), SAPLING_SPREAD);

  for (const [, look] of LEAF_LOOKS)
    for (const grey of [false, true]) addTerrain(`${leaves}_${look}${grey ? "_grey" : ""}`, { from: `trees/${tree.id}_leaves_${look}`, grey });
  addIcon(leaves);
  // ## Leaves drop a sapling now and then, like vanilla leaves: the way to start a second tree.
  const leafLoot = lootTable(leaves, [{ rolls: 1, entries: [{ type: "item", name: rid(sap), weight: 1 }, { type: "empty", weight: 19 }] }]);
  const leafMat = (name) => ({ "*": { texture: `kh_${name}`, render_method: "alpha_test" } });
  const leafPerms = [];
  for (const [blossom, look] of LEAF_LOOKS)
    for (const grey of [false, true])
      leafPerms.push({
        condition: `${S("blossom")} == ${blossom} && ${S("off_climate")} == ${grey}`,
        components: { "minecraft:material_instances": leafMat(`${leaves}_${look}${grey ? "_grey" : ""}`) },
      });
  block(leaves, {
    menu: { category: "nature", group: GROUP.trees },
    // ## The first value is the default: the tree feature places bare leaves (docs/art/TREE_SHAPES.md).
    states: { [state("blossom")]: [false, true], [state("off_climate")]: [false, true] },
    components: {
      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": leafMat(`${leaves}_bare`),
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 0.3,
        item_specific_speeds: [{ item: "minecraft:shears", destroy_speed: 0.05 }, { item: { tags: "q.any_tag('minecraft:is_hoe')" }, destroy_speed: 0.1 }],
      },
      "minecraft:flammable": { catch_chance_modifier: 30, destroy_chance_modifier: 60 },
      "minecraft:light_dampening": 1,
      "minecraft:map_color": "#408238",
      "minecraft:loot": leafLoot,
      "tag:leaves": {},
      [`${NS}:tree_leaves`]: {},
    },
    permutations: leafPerms,
  });
  blockSounds[rid(leaves)] = { sound: "grass" };
  catalog.trees.push(rid(leaves));

  if (!tree.bark) hangingFruit(tree);
}

/**
 * The fruit hanging under a blossoming leaf (tools/art/fruit_models.py): bones stage0 small
 * green, stage1 big green, stage2 ripe. Set by script only, so no item and no menu entry. It
 * hangs from its own tree's leaves (the placement filter pops it when they go); broken or
 * popped before it is ripe it gives nothing, once ripe it gives the fruit.
 */
function hangingFruit(tree) {
  const id = fruitBlockId(tree);
  const geoName = `geometry.${NS}.${id}`;
  const stages = FRUIT_STAGES.map((_, i) => i);
  names[`tile.${rid(id)}.name`] = [`${tree.zh}果實`, `${tree.en} Fruit`];
  addTerrain(id, { from: `fruit/${id}` });
  const fruitMat = { "*": { texture: `kh_${id}`, render_method: "alpha_test" } };
  const geometry = (shown) => ({ identifier: geoName, bone_visibility: Object.fromEntries(stages.map((n) => [`stage${n}`, n === shown])) });
  const unripe = lootTable(id, []);
  const ripe = lootTable(`${id}_ripe`, [countEntry(tree.fruit, tree.pick)]);
  block(id, {
    states: { [state("growth")]: intRange(stages.length - 1) },
    components: {
      "minecraft:geometry": geometry(0),
      "minecraft:material_instances": fruitMat,
      "minecraft:collision_box": false,
      "minecraft:selection_box": boneBounds(`${id}.geo.json`, "stage0"),
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0.2 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 0 },
      "minecraft:light_dampening": 0,
      "minecraft:movable": { movement_type: "popped" },
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["down"], block_filter: [rid(leavesBlockId(tree))] }] },
      "minecraft:loot": unripe,
      [`${NS}:hanging_fruit`]: {},
    },
    permutations: stages.slice(1).map((n) => ({
      condition: `${S("growth")} == ${n}`,
      components: {
        "minecraft:geometry": geometry(n),
        "minecraft:selection_box": boneBounds(`${id}.geo.json`, `stage${n}`),
        ...(n === stages.length - 1 ? { "minecraft:loot": ripe } : {}),
      },
    })),
  });
  blockSounds[rid(id)] = { sound: "grass" };
}

// --- Items ---------------------------------------------------------------------------------------------

const TREE_FRUITS = new Set(TREES.map((tree) => tree.fruit));
const PLANTS = new Map(CROPS.filter((crop) => crop.form !== "trellis").map((crop) => [crop.seed, crop]));

const placeableKind = new Map(); // item / block id -> "food" | "drink", for the tooltip line
for (const item of ITEMS) {
  names[`item.${rid(item.id)}.name`] = [item.zh, item.en];
  addIcon(item.id);
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
  if (plants) components["minecraft:block_placer"] = { block: rid(cropBlockId(plants)), use_on: plants.form === "bush" ? [...SOIL, "minecraft:farmland"] : plants.form === "aquatic" ? WATER_BED : FARMLAND };
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
  // ## Placeable food (data/placedFood.js): the block has the item's id, as Cookery's and Herbal's do.
  if (placedFood(item.id)) {
    components["minecraft:block_placer"] = { block: rid(item.id), replace_block_item: true };
    components["minecraft:tags"].tags.push("kaleidoscope_cookery:placeable_food");
  }
  const group = { dish: GROUP.foods, drink: GROUP.drinks, ingredient: GROUP.ingredients }[item.kind] ?? (TREE_FRUITS.has(item.id) ? GROUP.trees : GROUP.crops);
  // ## Tree fruit sits in the Nature tab with its sapling and leaves, where the catalog's harvest_trees group is.
  // ## Cookery's groups live in the Equipment tab; an item that names one from another tab is left loose there.
  const cookeryGroup = { dish: "foods", drink: "drinks", ingredient: "ingredients" }[item.kind];
  const category = cookeryGroup ? "equipment" : group === GROUP.trees ? "nature" : "items";
  if (placedFood(item.id)) placeableKind.set(rid(item.id), item.kind === "drink" ? "drink" : "food");
  writeJson(join(BP, "items", `${item.id}.json`), {
    format_version: ITEM_FORMAT,
    "minecraft:item": { description: { identifier: rid(item.id), menu_category: { category, group } }, components },
  });
  if (cookeryGroup) catalog[cookeryGroup].push(rid(item.id));
  else if (group === GROUP.trees) catalog.trees.push(rid(item.id));
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

// --- Juicer and pickling jar (models and textures from tools/art/stations.py) -------------------------------

const stationTex = (name) => `textures/${NS}/blocks/stations/${name}`;
// ## juice_empty is the jar's empty mouth; the juice itself is on the juicer's display entity.
for (const name of [JUICER.id, PICKLING_JAR.id, "juice_empty", ...PICKLING_JAR.contents.slice(1).map((c) => `contents_${c}`)])
  terrain[`kh_station_${name}`] = { textures: stationTex(name) };

function station(def, { states, materials, permutations, component, recipe, sound }) {
  names[`tile.${rid(def.id)}.name`] = [def.zh, def.en];
  // ## The block item shows the model; this icon is for the guidebook.
  addIcon(def.id);
  catalog.stations.push(rid(def.id));
  block(def.id, {
    menu: { category: "equipment", group: GROUP.stations },
    states,
    components: {
      "minecraft:geometry": `geometry.${NS}.${def.id}`,
      "minecraft:material_instances": materials,
      "minecraft:collision_box": { origin: [-6, 0, -6], size: [12, 12, 12] },
      "minecraft:selection_box": { origin: [-6, 0, -6], size: [12, 13, 12] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 1 },
      "minecraft:light_dampening": 0,
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"] }] },
      // ## A piston would leave the display entity behind (設計：station-animations).
      "minecraft:movable": { movement_type: "immovable" },
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

// ## Single-sided, as tools/art/stations.py paints them. Bedrock wants one render method per block, so the
// ## juicer's glass and the jar's contents are single-sided too.
const opaque = (name) => ({ texture: `kh_station_${name}`, render_method: "alpha_test_single_sided" });
station(JUICER, {
  states: { [state("fruit")]: intRange(JUICER.capacity), [state("juice")]: JUICER.colours },
  // ## The juice is drawn by the display entity (it rises and drains), so the block has no juice permutations.
  materials: { "*": opaque(JUICER.id), glass: opaque(JUICER.id) },
  permutations: [],
  recipe: { pattern: [" I ", "GGG", "PPP"], key: { I: { item: "minecraft:iron_ingot" }, G: { item: "minecraft:glass" }, P: { item: "minecraft:oak_planks" } }, unlock: [{ item: "minecraft:glass" }] },
  sound: "glass",
});
station(PICKLING_JAR, {
  states: { [state("contents")]: PICKLING_JAR.contents },
  materials: { "*": opaque(PICKLING_JAR.id), contents: { texture: "kh_station_juice_empty", render_method: "alpha_test_single_sided" } },
  permutations: PICKLING_JAR.contents.slice(1).map((c) => ({
    condition: `${S("contents")} == '${c}'`,
    components: { "minecraft:material_instances": { "*": opaque(PICKLING_JAR.id), contents: opaque(`contents_${c}`) } },
  })),
  recipe: { pattern: ["P", "C", "C"], key: { P: { item: "minecraft:oak_planks" }, C: { item: "minecraft:clay_ball" } }, unlock: [{ item: "minecraft:clay_ball" }] },
  sound: "stone",
});

// --- Placeable food (docs/superpowers/specs/2026-11-17-placeable-food-design.md) ---------------------------------
//
// Cookery's own components do the eating: food_bite (a bite per use; the last stage is the empty container,
// one more use gives the container back) and cup_stack (teas). Models per shape, textures per item
// (tools/art/food_models.py).

const COOKERY = "kaleidoscope_cookery";
const FOOD_STAGE = `${COOKERY}:food_stage`;
const CUP_COUNT = `${COOKERY}:cup_count`;
const TEA_COUNT = `${COOKERY}:tea_count`;
const foodTex = (id) => `textures/${NS}/blocks/food/${id}`;
const FOOD_BOX = {
  pot: { origin: [-6.5, 0, -5], size: [13, 7, 10] },
  pie: { origin: [-7.5, 0, -7.5], size: [15, 4.5, 15] },
  cakes: { origin: [-7.5, 0, -7.5], size: [15, 3, 15] },
  platter: { origin: [-7, 0, -7], size: [14, 3, 14] },
  bottle: { origin: [-3, 0, -3], size: [6, 11.5, 6] },
  wine: { origin: [-3.5, 0, -3.5], size: [7, 10.5, 7] },
  teacup: { origin: [-7, 0, -7], size: [14, 3.5, 14] },
};
const FACING = ["north", "east", "south", "west"].map((f, i) => ({
  condition: `q.block_state('minecraft:cardinal_direction') == '${f}'`,
  components: { "minecraft:transformation": { rotation: [0, [0, 270, 180, 90][i], 0] } },
}));
const BITTEN = `q.block_state('${FOOD_STAGE}')`;
/** The model for each state (tools/art/food_models.py writes one geometry per shape and stage). */
const foodGeo = (shape, suffix) => `geometry.${NS}.food_${shape}_${suffix}`;
const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

for (const row of PLACED_FOODS) {
  const item = ITEM_BY_ID.get(row.item);
  const food = JSON.parse(readFileSync(join(BP, "items", `${row.item}.json`), "utf8"))["minecraft:item"].components["minecraft:food"];
  const container = food.using_converts_to;
  names[`tile.${rid(row.item)}.name`] = [item.zh, item.en];
  terrain[`kh_food_${row.item}`] = { textures: foodTex(row.item) };
  // ## Single-sided, as the art kit assumes: no face fights the one behind it; glass is only clear or opaque pixels.
  const material = { texture: `kh_food_${row.item}`, render_method: "alpha_test_single_sided" };
  const box = FOOD_BOX[row.shape];
  const common = {
    "minecraft:geometry": foodGeo(row.shape, row.shape === "teacup" ? "1_1" : "0"),
    "minecraft:material_instances": { "*": material },
    "minecraft:selection_box": box,
    "minecraft:collision_box": row.shape === "teacup" ? false : box,
    "minecraft:destructible_by_mining": { seconds_to_destroy: 0.3 },
    "minecraft:destructible_by_explosion": { explosion_resistance: 1 },
    "minecraft:light_dampening": 0,
    "minecraft:movable": { movement_type: "immovable" },
    "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"] }] },
    [`${COOKERY}:placeable_food_placement_guard`]: {},
  };
  const traits = { "minecraft:placement_direction": { enabled_states: ["minecraft:cardinal_direction"], y_rotation_offset: 180 } };
  if (row.shape === "teacup") {
    block(row.item, {
      states: { [CUP_COUNT]: { values: { min: 1, max: MAX_CUPS } }, [TEA_COUNT]: { values: { min: 1, max: MAX_CUPS } } },
      components: {
        ...common,
        "minecraft:loot": lootTable("placed_nothing", []),
        // ## cup_stack drops the teas and empty cups itself.
        [`${COOKERY}:cup_stack`]: { filled: true, item: rid(row.item), empty_item: `${COOKERY}:empty_cup`, max_count: MAX_CUPS },
      },
      // ## cup_stack keeps tea_count <= cup_count; a larger one shows every cup filled.
      permutations: [
        ...[1, 2, 3, 4].flatMap((c) => [1, 2, 3, 4].map((t) => ({
          condition: `q.block_state('${CUP_COUNT}') == ${c} && q.block_state('${TEA_COUNT}') == ${t}`,
          components: { "minecraft:geometry": foodGeo("teacup", `${c}_${Math.min(t, c)}`) },
        }))),
        ...FACING,
      ],
      traits,
    });
    continue;
  }
  const full = lootTable(`placed_${row.item}_full`, [countEntry(row.item, [1, 1])]);
  const eaten = container ? lootTable(`placed_${container.split(":")[1]}`, [{ rolls: 1, entries: [{ type: "item", name: container, weight: 1 }] }]) : lootTable("placed_nothing", []);
  block(row.item, {
    states: { [FOOD_STAGE]: { values: { min: 0, max: row.bites } } },
    components: {
      ...common,
      "minecraft:loot": full,
      [`${COOKERY}:food_bite`]: {
        state: FOOD_STAGE,
        max_stage: row.bites,
        nutrition: Math.ceil(food.nutrition / row.bites),
        saturation_modifier: food.saturation_modifier,
        always_eat: true,
        ...(container ? { return_items: [container] } : {}),
      },
    },
    // ## Untouched: the whole dish back; started: only its container.
    permutations: [
      ...Array.from({ length: row.bites + 1 }, (_, n) => ({
        condition: `${BITTEN} == ${n}`,
        components: { "minecraft:geometry": foodGeo(row.shape, n), ...(n > 0 ? { "minecraft:loot": eaten } : {}) },
      })),
      ...FACING,
    ],
    traits,
  });
}

// --- Station display entities: the moving parts (docs/superpowers/specs/2026-11-17-station-animations-design.md) ---
//
// BP entities/, RP entity/, animations/, render_controllers/, particles/ hold only these, so they are rewritten
// each run. Models: RP/models/entity from tools/art/stations.py. The scripts only set the properties;
// every motion is eased on the client from them. Eased values start at the property in `initialize` (as
// Cookery's millstone does), so walking up to a full juicer does not replay the fill. ## q.life_time stays 0
// on these entities (found in game), so timed motions run on their own clock, v.clock.

for (const dir of [join(BP, "entities"), join(RP, "entity"), join(RP, "animations"), join(RP, "render_controllers"), join(RP, "particles")]) wipe(dir);
const P = (name) => `q.property('${rid(VISUAL_PROPS[name])}')`;
const visualTex = (def) => `textures/${NS}/entity/${def.visual}`;

function visualEntity(def, props, client) {
  const id = rid(def.visual);
  names[`entity.${id}.name`] = [def.zh, def.en];
  writeJson(join(BP, "entities", `${def.visual}.json`), {
    format_version: "1.21.0",
    "minecraft:entity": {
      description: {
        identifier: id,
        is_spawnable: false,
        is_summonable: true,
        is_experimental: false,
        properties: Object.fromEntries(Object.entries(props).map(([name, max]) => [rid(VISUAL_PROPS[name]), { type: "int", range: [0, max], default: 0, client_sync: true }])),
      },
      components: {
        "minecraft:type_family": { family: [`${NS}_visual`, "inanimate"] },
        "minecraft:collision_box": { width: 0, height: 0 },
        // ## No hitbox: clicks and hits go through to the station block.
        "minecraft:custom_hit_test": { hitboxes: [{ width: 0, height: 0, pivot: [0, 0, 0] }] },
        "minecraft:health": { value: 1, max: 1 },
        "minecraft:damage_sensor": { triggers: [{ cause: "all", deals_damage: "no" }] },
        "minecraft:physics": { has_gravity: false, has_collision: false },
        "minecraft:pushable": { is_pushable: false, is_pushable_by_piston: false },
        "minecraft:persistent": {},
      },
    },
  });
  const controller = `controller.render.${NS}.${def.visual}`;
  writeJson(join(RP, "render_controllers", `${def.visual}.render_controllers.json`), {
    format_version: "1.8.0",
    render_controllers: {
      [controller]: {
        geometry: "Geometry.default",
        materials: [{ "*": "Material.default" }],
        textures: ["Texture.default"],
        ...(client.parts ? { part_visibility: client.parts } : {}),
      },
    },
  });
  const animations = Object.fromEntries(Object.keys(client.animations).map((name) => [name, `animation.${NS}.${def.visual}.${name}`]));
  writeJson(join(RP, "animations", `${def.visual}.animation.json`), {
    format_version: "1.8.0",
    animations: Object.fromEntries(Object.entries(client.animations).map(([name, body]) => [animations[name], body])),
  });
  writeJson(join(RP, "entity", `${def.visual}.entity.json`), {
    format_version: "1.10.0",
    "minecraft:client_entity": {
      description: {
        identifier: id,
        materials: { default: "entity_alphablend" },
        textures: { default: visualTex(def) },
        geometry: { default: `geometry.${NS}.${def.visual}` },
        ...(client.particles ? { particle_effects: client.particles } : {}),
        animations,
        scripts: { initialize: client.initialize, pre_animation: client.pre, animate: client.animate },
        render_controllers: [controller],
        enable_attachables: false,
      },
    },
  });
}

// Juicer: the juice rises and drains (eased to the fruit count); while it rises the reamer spins and presses down.
// v.colour keeps the last juice colour, so a pour drains in its own colour instead of vanishing.
visualEntity(JUICER, { level: JUICER.capacity, juice: JUICER.colours.length - 1 }, {
  initialize: [`v.shown = ${P("level")};`, "v.spin = 0.0;", `v.colour = ${P("juice")};`],
  pre: [
    `v.level = ${P("level")};`,
    `v.colour = ${P("juice")} > 0 ? ${P("juice")} : v.colour;`,
    "v.shown = v.shown + (v.level - v.shown) * math.min(1.0, q.delta_time * 2.5);",
    "v.rising = math.clamp(v.level - v.shown, 0.0, 1.0);",
    "v.spin = math.mod(v.spin + q.delta_time * 900.0 * v.rising, 360.0);",
  ],
  animate: ["pose"],
  animations: {
    pose: {
      loop: true,
      bones: {
        reamer: { rotation: [0, "v.spin", 0], position: [0, "-1.5 * v.rising", 0] },
        ...Object.fromEntries(JUICER.colours.slice(1).map((c) => [`juice_${c}`, { scale: [1, `math.max(v.shown / ${JUICER.capacity}, 0.0)`, 1] }])),
      },
    },
  },
  parts: JUICER.colours.slice(1).map((c, i) => ({ [`juice_${c}`]: `v.colour == ${i + 1} && v.shown > 0.02` })),
});

// Pickling jar: the lid leans back on the rim while open and swings shut when sealed; while fermenting it
// rattles briefly every few seconds and the water seal bubbles; when done it hops every three seconds.
const STAGE = Object.fromEntries(PICKLING_JAR.contents.map((c, i) => [c, i]));
visualEntity(PICKLING_JAR, { stage: PICKLING_JAR.contents.length - 1 }, {
  initialize: [`v.seal = ${P("stage")} >= ${STAGE.fermenting} ? 1.0 : 0.0;`, "v.clock = 0.0;"],
  pre: [
    `v.stage = ${P("stage")};`,
    "v.clock = math.mod(v.clock + q.delta_time, 900.0);",
    `v.target = v.stage >= ${STAGE.fermenting} ? 1.0 : 0.0;`,
    "v.seal = v.seal + (v.target - v.seal) * math.min(1.0, q.delta_time * 6.0);",
    `v.rattle = (v.stage == ${STAGE.fermenting} && math.mod(v.clock, 4.5) < 0.45) ? math.sin(v.clock * 1500.0) * 3.0 : 0.0;`,
    `v.hop = (v.stage == ${STAGE.done} && math.mod(v.clock, 3.0) < 0.35) ? math.sin(math.mod(v.clock, 3.0) / 0.35 * 180.0) * 1.5 : 0.0;`,
  ],
  animate: ["pose", { bubbles: `v.stage == ${STAGE.fermenting}` }],
  particles: { bubble: rid(BUBBLE_PARTICLE) },
  animations: {
    pose: {
      loop: true,
      bones: {
        lid: {
          rotation: ["35.0 * (1.0 - v.seal) + v.rattle", 0, "v.rattle * 0.6"],
          position: [0, "(1.0 - v.seal) * 1.0 + v.hop", "(1.0 - v.seal) * 3.5"],
        },
      },
    },
    bubbles: {
      loop: true,
      animation_length: 1.6,
      particle_effects: { "0.0": { effect: "bubble", locator: "moat" }, "0.9": { effect: "bubble", locator: "moat" } },
    },
  },
});

// Particles, on the vanilla particle sheet (its round bubble frame at 0,16).
const sheet = { texture_width: 128, texture_height: 128, uv: [0, 16], uv_size: [8, 8] };
function particle(name, components) {
  writeJson(join(RP, "particles", `${name}.json`), {
    format_version: "1.10.0",
    particle_effect: { description: { identifier: rid(name), basic_render_parameters: { material: "particles_alpha", texture: "textures/particle/particles" } }, components },
  });
}
// Juice drops thrown up from the jug mouth and falling back; colour from variable.color (the script's MolangVariableMap).
particle(SPLASH_PARTICLE, {
  "minecraft:emitter_rate_instant": { num_particles: 12 },
  "minecraft:emitter_lifetime_once": { active_time: 0.1 },
  "minecraft:emitter_shape_point": { direction: ["math.random(-0.5, 0.5)", 1, "math.random(-0.5, 0.5)"] },
  "minecraft:particle_lifetime_expression": { max_lifetime: "math.random(0.45, 0.75)" },
  "minecraft:particle_initial_speed": "math.random(1.6, 2.4)",
  "minecraft:particle_motion_dynamic": { linear_acceleration: [0, -12, 0] },
  "minecraft:particle_motion_collision": { collision_radius: 0.03, expire_on_contact: true },
  "minecraft:particle_appearance_billboard": { size: ["0.07 + variable.particle_random_1 * 0.04", "0.07 + variable.particle_random_1 * 0.04"], facing_camera_mode: "rotate_xyz", uv: sheet },
  "minecraft:particle_appearance_tinting": { color: ["variable.color.r", "variable.color.g", "variable.color.b", 1] },
  "minecraft:particle_appearance_lighting": {},
});
// Small bubbles rising out of the water seal round the jar's neck.
particle(BUBBLE_PARTICLE, {
  "minecraft:emitter_rate_instant": { num_particles: "math.random_integer(2, 4)" },
  "minecraft:emitter_lifetime_once": { active_time: 0.1 },
  "minecraft:emitter_shape_disc": { radius: 0.235, surface_only: true, direction: [0, 1, 0] },
  "minecraft:particle_lifetime_expression": { max_lifetime: "math.random(0.5, 0.9)" },
  "minecraft:particle_initial_speed": 0.12,
  "minecraft:particle_motion_dynamic": { linear_acceleration: [0, 0.25, 0], linear_drag_coefficient: 2 },
  "minecraft:particle_appearance_billboard": { size: ["0.05 + variable.particle_random_1 * 0.03", "0.05 + variable.particle_random_1 * 0.03"], facing_camera_mode: "rotate_xyz", uv: sheet },
  "minecraft:particle_appearance_tinting": { color: [0.88, 0.92, 0.8, 0.85] },
  "minecraft:particle_appearance_lighting": {},
});

// --- Village house chests: vanilla tables plus one Harvest pool (data/village.js) --------------------

const VANILLA = join(root, "tools", "vanilla", "loot_tables", "chests", "village");
rmSync(join(BP, "loot_tables", "chests"), { recursive: true, force: true });
for (const house of VILLAGE_HOUSES) {
  const rows = villageItems(house);
  if (!rows.length) continue;
  const file = `village_${house}_house.json`;
  const table = JSON.parse(readFileSync(join(VANILLA, file), "utf8"));
  // ## One roll: each Harvest item weighs 1 and "nothing" makes up the rest, so the
  // ## chest holds one Harvest stack VILLAGE_CHANCE of the time.
  const empty = Math.max(1, Math.round((rows.length * (1 - VILLAGE_CHANCE)) / VILLAGE_CHANCE));
  table.pools.push({
    rolls: 1,
    entries: [
      ...rows.map(({ item, count: [min, max] }) => ({ type: "item", name: rid(item), weight: 1, functions: [{ function: "minecraft:set_count", count: { min, max } }] })),
      { type: "empty", weight: empty },
    ],
  });
  writeJson(join(BP, "loot_tables", "chests", "village", file), table);
}

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
        // ## Cookery's own groups, joined the way Herbal and Fishing Voyage join them: listed here under Equipment,
        // ## with the first item of each as the icon should Cookery be missing.
        category_name: "equipment",
        groups: ["ingredients", "foods", "drinks", "stations"]
          .filter((g) => catalog[g].length)
          .map((g) => ({ group_identifier: { icon: catalog[g][0], name: GROUP[g] }, items: catalog[g] })),
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
const PLACEABLE = { food: ["可放置的食物", "Placeable Food"], drink: ["可放置的飲品", "Placeable Drink"] };
for (const [key, value] of Object.entries(GROUP_NAMES)) names[key] = value;

function lang(index, convert = (s) => s) {
  const lines = ["## pack", `pack.name=${convert(PACK.name[index])}`, `pack.description=${convert(PACK.description[index])}`, "", "## generated from packs/BP/scripts/data — do not edit by hand"];
  // ## Series tooltip convention (as in Cookery): the add-on name on a second line of every item / block name,
  // ## and "placeable food / drink" on a third for anything that can be set down.
  for (const key of Object.keys(names).sort()) {
    let text = names[key][index];
    const id = /^(?:item|tile)\.(.+)\.name$/.exec(key)?.[1];
    if (id) {
      text += `\\n§9§o${PACK.name[index]}§r`;
      const kind = placeableKind.get(id);
      if (kind) text += `\\n§5${PLACEABLE[kind][index]}§r`;
    }
    lines.push(`${key}=${convert(text)}`);
  }
  return `${lines.join("\n")}\n`;
}
for (const pack of [BP, RP]) {
  mkdirSync(join(pack, "texts"), { recursive: true });
  writeFileSync(join(pack, "texts", "zh_TW.lang"), lang(0));
  writeFileSync(join(pack, "texts", "zh_CN.lang"), lang(0, toSimplified));
  writeFileSync(join(pack, "texts", "en_US.lang"), lang(1));
  writeJson(join(pack, "texts", "languages.json"), ["en_US", "zh_TW", "zh_CN"]);
}

// ## pack_icon.png is the art's; never touch it here.
// Copies of the icons used to live here; the item atlas now points at the drawn icons.
rmSync(join(RP, "textures", "items", NS), { recursive: true, force: true });

missingArt.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
writeFileSync(
  join(root, "docs", "art", "MISSING_ART.md"),
  ["# 尚缺的美術", "", "由 `npm run generate` 產生。這些貼圖與 icon 已在包裡以下列路徑命名，畫好放上去即可，不用改程式。", "",
    ...(missingArt.length ? ["| 類別 | ID | 路徑 |", "| --- | --- | --- |", ...missingArt.map(([kind, id, path]) => `| ${kind === "icon" ? "物品 icon" : "方塊貼圖"} | \`${id}\` | \`packs/RP/${path}\` |`)] : ["目前沒有缺。"]), ""].join("\n")
);

console.log(`generate: ${written.length} JSON files, ${Object.keys(terrain).length} block textures, ${Object.keys(itemTextures).length} item icons, ${missingArt.length} not drawn yet (docs/art/MISSING_ART.md)`);
