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
const { CROPS, TRELLIS, WILD_SOIL, cropBlockId, wildBlockId } = await load("crops.js");
const { TREES, TRUNKS, FRUITWOOD_LOG, BANANA_TRUNK, FRUIT_STAGES, saplingBlockId, leavesBlockId, fruitBlockId, wildSaplingFeature, saplingBiomes } = await load("trees.js");
const { ITEMS } = await load("items.js");
const { RECIPES, recipeMaking } = await load("dishes.js");
const { JUICER, PICKLING_JAR } = await load("stations.js");
const { VILLAGE_CHANCE, VILLAGE_HOUSES, villageItems } = await load("village.js");
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
const catalog = { crops: [], trees: [] };

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
  const bush = crop.form === "bush";
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
      "minecraft:placement_filter": { conditions: [{ allowed_faces: ["up"], block_filter: tall ? [...FARMLAND, rid(id)] : bush ? [...SOIL, "minecraft:farmland"] : FARMLAND }] },
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
      "minecraft:loot": lootTable(id, pools),
    },
  });
  blockSounds[rid(id)] = { sound: "grass" };

  wildFeature(id, id, soil, crop.wild.biomes);
}

/** World generation for one wild block: a rule per biome tag → a surface search → the block. */
function wildFeature(name, blockId, soil, biomes, spread = WILD_SPREAD) {
  const feature = `${name}_feature`;
  const search = `${name}_search`;
  writeJson(join(BP, "features", "wild", `${feature}.json`), {
    format_version: "1.21.60",
    "minecraft:single_block_feature": {
      description: { identifier: rid(feature) },
      places_block: { name: rid(blockId) },
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
  if (plants) components["minecraft:block_placer"] = { block: rid(cropBlockId(plants)), use_on: plants.form === "bush" ? [...SOIL, "minecraft:farmland"] : FARMLAND };
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
  const group = { dish: GROUP.foods, drink: GROUP.drinks, ingredient: GROUP.ingredients }[item.kind] ?? (TREE_FRUITS.has(item.id) ? GROUP.trees : GROUP.crops);
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
  addIcon(def.id);
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

// ## pack_icon.png is the art's (orange, grape, napa cabbage, corn); never touch it here.
// Copies of the icons used to live here; the item atlas now points at the drawn icons.
rmSync(join(RP, "textures", "items", NS), { recursive: true, force: true });

missingArt.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
writeFileSync(
  join(root, "docs", "art", "MISSING_ART.md"),
  ["# 尚缺的美術", "", "由 `npm run generate` 產生。這些貼圖與 icon 已在包裡以下列路徑命名，畫好放上去即可，不用改程式。", "",
    ...(missingArt.length ? ["| 類別 | ID | 路徑 |", "| --- | --- | --- |", ...missingArt.map(([kind, id, path]) => `| ${kind === "icon" ? "物品 icon" : "方塊貼圖"} | \`${id}\` | \`packs/RP/${path}\` |`)] : ["目前沒有缺。"]), ""].join("\n")
);

console.log(`generate: ${written.length} JSON files, ${Object.keys(terrain).length} block textures, ${Object.keys(itemTextures).length} item icons, ${missingArt.length} not drawn yet (docs/art/MISSING_ART.md)`);
