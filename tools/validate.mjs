// Checks the packs before they are built or committed (npm run validate):
//   1. every JSON file under packs/ parses;
//   2. the data tables agree with each other;
//   3. every texture, language key and loot table the generated files name exists;
//   4. the manifests point at each other and at Cookery, and carry data/version.js's version;
//   5. M5: every language has every text, the partner tables name real items, no balance outlier.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hardOutliers } from "./balance.mjs";
import { LANG_LOCALES, langProblems } from "./lang.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(root, "packs", "BP");
const RP = join(root, "packs", "RP");
const load = (name) => import(pathToFileURL(join(BP, "scripts", "data", name)).href);

const errors = [];
const fail = (message) => errors.push(message);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// --- 1. JSON syntax -----------------------------------------------------------------------

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
for (const path of walk(join(root, "packs")).filter((p) => p.endsWith(".json"))) {
  try {
    readJson(path);
  } catch (error) {
    fail(`${relative(root, path)}: ${error.message}`);
  }
}

// --- 1b. Things the game rejects that JSON syntax does not show (found in game, 1.0.0) -------

// ## Java Edition names that do not exist in Bedrock: the game drops the filter entry or the
// ## whole feature. Bedrock name in the message.
const JAVA_ONLY_BLOCKS = { "minecraft:rooted_dirt": "minecraft:dirt_with_roots" };
// ## A block component and the lowest block format_version that accepts it without the
// ## "Upcoming Creator Features" toggle; below it the whole block fails to load.
const COMPONENT_MIN_FORMAT = { "minecraft:movable": [1, 21, 100] };
const formatOf = (text) => String(text).split(".").map(Number);
const below = (a, b) => {
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) < b[i];
  return false;
};
for (const path of walk(join(root, "packs")).filter((p) => p.endsWith(".json"))) {
  const text = readFileSync(path, "utf8");
  for (const [java, bedrock] of Object.entries(JAVA_ONLY_BLOCKS)) {
    if (text.includes(`"${java}"`)) fail(`${relative(root, path)}: ${java} does not exist in Bedrock, use ${bedrock}`);
  }
}
for (const path of walk(join(BP, "blocks")).filter((p) => p.endsWith(".json"))) {
  const block = readJson(path);
  const format = formatOf(block.format_version);
  const used = new Set([
    ...Object.keys(block["minecraft:block"]?.components ?? {}),
    ...(block["minecraft:block"]?.permutations ?? []).flatMap((p) => Object.keys(p.components ?? {})),
  ]);
  for (const [component, min] of Object.entries(COMPONENT_MIN_FORMAT)) {
    if (used.has(component) && below(format, min)) fail(`${relative(root, path)}: ${component} needs format_version ${min.join(".")} or later (has ${block.format_version})`);
  }
}
for (const path of walk(join(BP, "scripts")).filter((p) => p.endsWith(".js"))) {
  const text = readFileSync(path, "utf8");
  for (const [java, bedrock] of Object.entries(JAVA_ONLY_BLOCKS)) {
    if (text.includes(`"${java}"`)) fail(`${relative(root, path)}: ${java} does not exist in Bedrock, use ${bedrock}`);
  }
}

// --- 2. Data tables -------------------------------------------------------------------------

const { NAMESPACE, rid } = await load("ns.js");
const { CROPS, TRELLIS } = await load("crops.js");
const { TREES, TRUNKS, saplingBlockId, leavesBlockId, fruitBlockId, treeFeatureId } = await load("trees.js");
const { ITEMS } = await load("items.js");
const { RECIPES, inputsOf, outputsOf } = await load("dishes.js");
const { CLIMATES } = await load("climate.js");
const { guidebookPayload } = await load("guidebook.js");
const { HINTS } = await load("zh_cn.js");

const itemIds = new Set(ITEMS.map((i) => i.id));
const seen = new Set();
for (const id of [...ITEMS.map((i) => i.id), ...CROPS.map((c) => `${c.id}_crop`), ...TREES.flatMap((t) => [saplingBlockId(t), leavesBlockId(t), ...(t.bark ? [] : [fruitBlockId(t)])]), ...TRUNKS.map((t) => t.id), TRELLIS.id]) {
  if (seen.has(id)) fail(`duplicate id ${id}`);
  seen.add(id);
}

const FORMS = ["once", "underground", "repeatable", "tall", "trellis", "bush"];
for (const crop of CROPS) {
  const where = `crop ${crop.id}`;
  if (!FORMS.includes(crop.form)) fail(`${where}: unknown form ${crop.form}`);
  if (!CLIMATES.includes(crop.climate)) fail(`${where}: unknown climate ${crop.climate}`);
  if (!itemIds.has(crop.seed)) fail(`${where}: seed ${crop.seed} is not in data/items.js`);
  if (!itemIds.has(crop.produce)) fail(`${where}: produce ${crop.produce} is not in data/items.js`);
  if (!(crop.growthChance > 0 && crop.growthChance <= 1)) fail(`${where}: growthChance must be in (0, 1]`);
  if (["repeatable", "trellis", "bush"].includes(crop.form)) {
    if (!(crop.harvestResetAge >= 0 && crop.harvestResetAge < crop.maxGrowth)) fail(`${where}: harvestResetAge must be below maxGrowth`);
    if (!crop.pick) fail(`${where}: a ${crop.form} crop needs pick counts`);
  }
  if (crop.form === "tall" && !(crop.tallFrom > 0 && crop.tallFrom <= crop.maxGrowth)) fail(`${where}: tallFrom out of range`);
  if (crop.form === "underground" && !crop.hoeBonus) fail(`${where}: an underground crop needs hoeBonus`);
}
for (const tree of TREES) {
  if (!CLIMATES.includes(tree.climate)) fail(`tree ${tree.id}: unknown climate ${tree.climate}`);
  if (!itemIds.has(tree.fruit)) fail(`tree ${tree.id}: fruit ${tree.fruit} is not in data/items.js`);
  // ## Saplings grow by placing this feature (growth/trees.js); fruit blocks use the art's model.
  if (!existsSync(join(BP, "features", "trees", `${treeFeatureId(tree)}.json`))) fail(`tree ${tree.id}: features/trees/${treeFeatureId(tree)}.json missing (tools/art/tree_shapes.py)`);
  if (!tree.bark && !existsSync(join(RP, "models", "blocks", `${fruitBlockId(tree)}.geo.json`))) fail(`tree ${tree.id}: models/blocks/${fruitBlockId(tree)}.geo.json missing (tools/art/fruit_models.py)`);
}

// ## G4 (企劃書 M4 關卡：每種作物至少兩個用途), checked mechanically: every crop and fruit
// ## must end up in at least two different finished items, following prepared
// ## ingredients through (garlic → minced garlic → three dishes counts as three).
const usesFrom = (id, seen = new Set()) => {
  for (const row of RECIPES) {
    if (!inputsOf(row).includes(rid(id))) continue;
    for (const out of outputsOf(row)) {
      if (seen.has(out)) continue;
      seen.add(out);
      usesFrom(out, seen);
    }
  }
  return seen;
};
/** Something a player eats or drinks, or cooks with as oil (pickles and jams count). */
const finished = (id) => {
  const item = ITEMS.find((i) => i.id === id);
  return Boolean(item && (["dish", "drink"].includes(item.kind) || item.food || item.oil));
};
for (const id of [...CROPS.map((c) => c.produce), ...TREES.map((t) => t.fruit)]) {
  const ends = [...usesFrom(id)].filter(finished);
  if (ends.length < 2) fail(`G4: ${id} ends up in ${ends.length} dish(es) or drink(s) (${ends.join(", ") || "none"}); it needs two`);
}
for (const row of RECIPES) {
  for (const out of outputsOf(row)) if (!itemIds.has(out)) fail(`recipe ${row.result}: output ${out} is not in data/items.js`);
  for (const id of inputsOf(row)) if (id.startsWith(`${NAMESPACE}:`) && !itemIds.has(id.slice(NAMESPACE.length + 1))) fail(`recipe ${row.result}: unknown input ${id}`);
}
for (const item of ITEMS.filter((i) => i.kind === "dish" || i.kind === "ingredient")) if (!RECIPES.some((row) => outputsOf(row).includes(item.id))) fail(`${item.id}: no recipe makes it`);

let payload;
try {
  payload = guidebookPayload();
} catch (error) {
  fail(`guidebook: ${error.message}`);
}
if (payload) {
  for (const entry of payload.entries) {
    if (entry.mechanics.length > 8) fail(`guidebook ${entry.id}: more than 8 lines`);
    for (const line of entry.mechanicsByLocale.zh_CN) for (const c of line) if (HINTS.has(c)) fail(`guidebook ${entry.id}: zh_CN still has 「${c}」 (add it to data/zh_cn.js)`);
  }
  for (const value of Object.values(payload.text.zh_CN)) for (const c of value) if (HINTS.has(c)) fail(`guidebook text: zh_CN still has 「${c}」`);
  // ## The chapter in all three languages: the same lines, names and labels in each.
  const LOCALES = ["en_US", "zh_TW", "zh_CN"];
  for (const entry of payload.entries) {
    for (const locale of LOCALES) {
      const lines = entry.mechanicsByLocale[locale];
      if (!Array.isArray(lines) || lines.length !== entry.mechanics.length) fail(`guidebook ${entry.id}: ${locale} has ${lines?.length ?? 0} lines, en has ${entry.mechanics.length}`);
      else if (lines.some((line) => typeof line !== "string" || !line.trim())) fail(`guidebook ${entry.id}: an empty ${locale} line`);
    }
  }
  for (const table of ["names", "text"]) {
    const keys = Object.keys(payload[table].zh_TW).sort().join();
    for (const locale of LOCALES) {
      if (Object.keys(payload[table][locale] ?? {}).sort().join() !== keys) fail(`guidebook ${table}: ${locale} keys differ from zh_TW`);
      // ## language_note is empty on purpose in every language (Cookery then shows none).
      for (const [key, value] of Object.entries(payload[table][locale] ?? {})) if (!value && key !== "language_note") fail(`guidebook ${table}.${locale}.${key} is empty`);
    }
  }
}

// --- 3. Generated files and what they name -------------------------------------------------------

if (!existsSync(join(BP, "blocks")) || !existsSync(join(RP, "textures", "terrain_texture.json"))) {
  fail("generated files missing: run npm run generate");
} else {
  const terrain = readJson(join(RP, "textures", "terrain_texture.json")).texture_data;
  const itemTex = readJson(join(RP, "textures", "item_texture.json")).texture_data;
  // ## Art not drawn yet is allowed (docs/art/MISSING_ART.md lists it); any other missing file is a mistake.
  let notDrawn = 0;
  for (const [name, { textures }] of [...Object.entries(terrain), ...Object.entries(itemTex)]) {
    if (existsSync(join(RP, `${textures}.png`))) continue;
    if (textures.startsWith("textures/kaleidoscope_harvest/")) notDrawn++;
    else fail(`texture ${name}: ${textures}.png missing`);
  }
  if (notDrawn) console.warn(`validate: ${notDrawn} texture(s) not drawn yet, see docs/art/MISSING_ART.md`);

  const langKeys = (pack, locale) =>
    new Set(
      readFileSync(join(pack, "texts", `${locale}.lang`), "utf8")
        .split("\n")
        .filter((line) => line.includes("=") && !line.startsWith("#"))
        .map((line) => line.slice(0, line.indexOf("=")))
    );
  const rpLang = Object.fromEntries(["en_US", "zh_TW", "zh_CN"].map((l) => [l, langKeys(RP, l)]));
  // ## Three languages (企劃書：zh_TW、zh_CN、en_US): every key zh_TW has must be in the other two,
  // ## with some text, in both packs; and neither may have keys zh_TW lacks.
  for (const pack of [BP, RP]) {
    const where = relative(root, pack);
    const files = Object.fromEntries(LANG_LOCALES.map((l) => [l, readFileSync(join(pack, "texts", `${l}.lang`), "utf8")]));
    for (const problem of langProblems(files, where)) fail(problem);
    const listed = readJson(join(pack, "texts", "languages.json"));
    for (const locale of ["en_US", "zh_TW", "zh_CN"]) if (!listed.includes(locale)) fail(`${where} languages.json: ${locale} missing`);
  }
  for (const line of readFileSync(join(RP, "texts", "zh_CN.lang"), "utf8").split("\n")) for (const c of line.slice(line.indexOf("=") + 1)) if (HINTS.has(c)) fail(`RP zh_CN.lang: 「${c}」 not converted in "${line}"`);

  const textures = (material) => Object.values(material ?? {}).map((m) => m.texture);
  // ## Models the blocks name, with their bones and material instances (the art's models in RP/models/blocks).
  const models = new Map();
  for (const path of walk(join(RP, "models")).filter((p) => p.endsWith(".json")))
    for (const geo of readJson(path)["minecraft:geometry"] ?? []) {
      const bones = geo.bones ?? [];
      const instances = new Set(bones.flatMap((b) => (b.cubes ?? []).flatMap((c) => Object.values(typeof c.uv === "object" && !Array.isArray(c.uv) ? c.uv : {}).map((f) => f.material_instance).filter(Boolean))));
      models.set(geo.description.identifier, { bones: new Set(bones.map((b) => b.name)), instances });
    }
  for (const file of readdirSync(join(BP, "blocks"))) {
    const def = readJson(join(BP, "blocks", file))["minecraft:block"];
    const parts = [def.components, ...(def.permutations ?? []).map((p) => p.components)];
    for (const c of parts) {
      const geometry = c["minecraft:geometry"];
      const geoId = typeof geometry === "string" ? geometry : geometry?.identifier;
      if (geoId && !geoId.startsWith("minecraft:")) {
        const model = models.get(geoId);
        if (!model) fail(`${file}: geometry ${geoId} is not in RP/models`);
        else {
          for (const bone of Object.keys(geometry.bone_visibility ?? {})) if (!model.bones.has(bone)) fail(`${file}: ${geoId} has no bone ${bone}`);
          const mats = c["minecraft:material_instances"] ?? def.components["minecraft:material_instances"] ?? {};
          for (const instance of model.instances) if (!mats[instance]) fail(`${file}: ${geoId} instance ${instance} has no texture`);
        }
      }
      for (const t of textures(c["minecraft:material_instances"])) if (!terrain[t]) fail(`${file}: texture ${t} is not in terrain_texture.json`);
      if (c["minecraft:loot"] && !existsSync(join(BP, c["minecraft:loot"]))) fail(`${file}: loot table ${c["minecraft:loot"]} missing`);
    }
    const key = def.components["minecraft:display_name"];
    for (const [locale, keys] of Object.entries(rpLang)) if (!keys.has(key)) fail(`${file}: ${key} missing from ${locale}.lang`);
  }
  for (const file of readdirSync(join(BP, "items"))) {
    const item = readJson(join(BP, "items", file))["minecraft:item"];
    const icon = item.components["minecraft:icon"];
    if (!itemTex[icon]) fail(`${file}: icon ${icon} is not in item_texture.json`);
    const key = item.components["minecraft:display_name"].value;
    for (const [locale, keys] of Object.entries(rpLang)) if (!keys.has(key)) fail(`${file}: ${key} missing from ${locale}.lang`);
  }
  for (const path of walk(join(BP, "loot_tables")))
    for (const pool of readJson(path).pools)
      for (const entry of pool.entries)
        if (entry.type === "item" && entry.name.startsWith(`${NAMESPACE}:`)) {
          const id = entry.name.slice(NAMESPACE.length + 1);
          if (!itemIds.has(id) && !existsSync(join(BP, "blocks", `${id}.json`))) fail(`${relative(root, path)}: unknown item ${entry.name}`);
        }
}

// --- Village chest overrides keep every vanilla pool -----------------------------------------------

const vanillaDir = join(root, "tools", "vanilla", "loot_tables", "chests", "village");
const villageDir = join(BP, "loot_tables", "chests", "village");
if (existsSync(villageDir)) {
  for (const file of readdirSync(villageDir)) {
    if (!existsSync(join(vanillaDir, file))) {
      fail(`village chest ${file}: no vanilla copy in tools/vanilla to build on`);
      continue;
    }
    const vanilla = readJson(join(vanillaDir, file)).pools;
    const ours = readJson(join(villageDir, file)).pools;
    if (JSON.stringify(ours.slice(0, vanilla.length)) !== JSON.stringify(vanilla)) fail(`village chest ${file}: the vanilla pools were changed`);
    if (ours.length !== vanilla.length + 1) fail(`village chest ${file}: expected exactly one Harvest pool`);
  }
}

// --- World generation names only blocks that exist ----------------------------------------------------
// ## features/trees and feature_rules/trees come from tools/art/tree_shapes.py; every block id they
// ## name (<tree>_leaves, fruitwood_log, banana_trunk, <tree>_sapling) must be a block the packs define.

const blockIdsAll = new Set(readdirSync(join(BP, "blocks")).map((f) => readJson(join(BP, "blocks", f))["minecraft:block"].description.identifier));
const unknownPlaced = new Map();
for (const dir of ["features", "feature_rules"]) {
  for (const path of walk(join(BP, dir)).filter((p) => p.endsWith(".json"))) {
    const unknown = new Set();
    for (const m of readFileSync(path, "utf8").matchAll(/"(kaleidoscope_harvest:[a-z0-9_]+)"/g)) {
      const id = m[1];
      if (!blockIdsAll.has(id) && !/_(feature|search|rule)$/.test(id) && !id.includes("_feature_") && !/wild_.+_(?:[a-z]+)$/.test(id)) unknown.add(id);
    }
    for (const id of unknown) unknownPlaced.set(id, (unknownPlaced.get(id) ?? 0) + 1);
  }
}
if (unknownPlaced.size) fail(`world generation names ${unknownPlaced.size} block id(s) the packs do not define: ${[...unknownPlaced.keys()].sort().join(", ")}`);

// ## Found in game (1.0.0): random_spread_canopy left bare trunks in world generation (on a plain
// ## trunk it placed no leaves at all), so it is not used.
// ## Also found in game: the game only registers a feature some feature rule (or another feature)
// ## references, so dimension.placeFeature cannot grow a sapling whose tree nothing references.
const featurePaths = walk(join(BP, "features")).filter((p) => p.endsWith(".json"));
const referencedFeatures = new Set();
for (const path of [...featurePaths, ...walk(join(BP, "feature_rules")).filter((p) => p.endsWith(".json"))]) {
  const text = readFileSync(path, "utf8");
  for (const m of text.matchAll(/"(?:places_feature|feature)"\s*:\s*"([^"]+)"/g)) referencedFeatures.add(m[1]);
  for (const m of text.matchAll(/"places_feature"\s*:\s*\[([^\]]*)\]/g)) for (const ref of m[1].matchAll(/"([^"]+)"/g)) referencedFeatures.add(ref[1]);
}
for (const path of featurePaths) {
  const body = Object.entries(readJson(path)).find(([k]) => k.startsWith("minecraft:"))?.[1];
  const id = body?.description?.identifier;
  if (id && !referencedFeatures.has(id)) fail(`${relative(root, path)}: nothing references ${id}, so the game will not register it`);
}
// ## Found in game: the game rejects a scatter_chance whose numerator is not below its denominator.
for (const path of walk(join(BP, "feature_rules")).filter((p) => p.endsWith(".json"))) {
  const chance = readJson(path)["minecraft:feature_rules"]?.distribution?.scatter_chance;
  if (chance && typeof chance === "object" && !(chance.numerator < chance.denominator))
    fail(`${relative(root, path)}: scatter_chance ${chance.numerator}/${chance.denominator} needs numerator < denominator`);
}
for (const path of featurePaths) {
  const body = readJson(path)["minecraft:tree_feature"];
  if (body?.random_spread_canopy)
    fail(`${relative(root, path)}: random_spread_canopy leaves bare trunks in world generation; use another canopy`);
}

// --- 4. Manifests ---------------------------------------------------------------------------------
for (const pack of [BP, RP]) if (!existsSync(join(pack, "pack_icon.png"))) fail(`${relative(root, pack)}/pack_icon.png missing (the game shows a blank icon)`);

// PBR: the pack declares it, so every colour texture has its texture set and the set's layers exist
// (tools/art/pbr_maps.py makes them for icons, placed foods and stations; the painters for the rest).
// Flat UI art (the guidebook's star) is never lit and has none.
{
  const dir = join(RP, "textures", NAMESPACE);
  const files = walk(dir);
  const isLayer = (path) => /_(mer|normal)\.png$/.test(path);
  for (const png of files.filter((path) => path.endsWith(".png") && !isLayer(path) && !/[\\/]ui[\\/]/.test(path))) {
    const base = png.replace(/\.png$/, "");
    if (!existsSync(`${base}.texture_set.json`)) fail(`${relative(root, png)}: no PBR texture set, run python tools/art/pbr_maps.py`);
    for (const layer of ["_normal", "_mer"]) if (!existsSync(`${base}${layer}.png`)) fail(`${relative(root, png)}: no ${layer} map, run python tools/art/pbr_maps.py`);
  }
  for (const layer of files.filter(isLayer)) if (!existsSync(layer.replace(/_(mer|normal)\.png$/, ".png"))) fail(`${relative(root, layer)}: PBR map without a colour texture`);
}

const COOKERY_BP = "9944f731-cc4c-4299-bdd5-f8799c1d832e";
const bp = readJson(join(BP, "manifest.json"));
const rp = readJson(join(RP, "manifest.json"));
const deps = (m) => m.dependencies.map((d) => d.uuid).filter(Boolean);
if (!deps(bp).includes(rp.header.uuid)) fail("BP manifest does not depend on the RP");
if (!deps(rp).includes(bp.header.uuid)) fail("RP manifest does not depend on the BP");
if (!deps(bp).includes(COOKERY_BP)) fail("BP manifest does not depend on Cookery");
const uuids = [bp.header.uuid, rp.header.uuid, ...bp.modules.map((m) => m.uuid), ...rp.modules.map((m) => m.uuid)];
if (new Set(uuids).size !== uuids.length) fail("manifest UUIDs are not unique");

const { VERSION } = await load("version.js");
const versionOf = (v) => (Array.isArray(v) ? v.join(".") : String(v));
for (const [name, m] of [["BP", bp], ["RP", rp]]) {
  if (versionOf(m.header.version) !== VERSION) fail(`${name} manifest version ${versionOf(m.header.version)} is not data/version.js's ${VERSION}`);
  for (const mod of m.modules) if (versionOf(mod.version) !== VERSION) fail(`${name} manifest module ${mod.type}: version ${versionOf(mod.version)} is not ${VERSION}`);
}
const npmVersion = readJson(join(root, "package.json")).version;
if (npmVersion !== VERSION) fail(`package.json version ${npmVersion} is not data/version.js's ${VERSION}`);
for (const [m, other] of [[bp, rp], [rp, bp]]) {
  const dep = m.dependencies.find((d) => d.uuid === other.header.uuid);
  if (dep && versionOf(dep.version) !== VERSION) fail(`manifest dependency on ${other.header.uuid}: version ${versionOf(dep.version)} is not ${VERSION}`);
}

// --- 5. M5: partner tables and balance -----------------------------------------------------------------

const { RANCHING_FEEDS, HERBAL_HEAT, HERBAL_ADJUVANTS, TAVERN_WINES, FISHING_BAITS, FISHING_POND_FEEDS } = await load("integrations.js");
const { tavernPayload } = await load("tavern.js");
const itemOf = (id) => ITEMS.find((i) => i.id === id);
const FEED_KINDS = ["grass", "grain", "veg", "mixed", "concentrate", "ruminant", "calcium"];
for (const feed of RANCHING_FEEDS) {
  if (!itemOf(feed.item)) fail(`Ranching feed ${feed.item}: not a Harvest item`);
  if (!FEED_KINDS.includes(feed.kind)) fail(`Ranching feed ${feed.item}: unknown kind ${feed.kind}`);
  if (!(Number.isInteger(feed.units) && feed.units >= 1 && feed.units <= 9)) fail(`Ranching feed ${feed.item}: units must be 1–9`);
}
for (const row of HERBAL_HEAT) {
  // ## Herbal applies 寒熱 when an item is eaten, so it must be food.
  if (!itemOf(row.id)?.food) fail(`Herbal heat ${row.id}: not a Harvest food or drink`);
  if (!(Number.isInteger(row.heat) && row.heat !== 0 && Math.abs(row.heat) <= 100)) fail(`Herbal heat ${row.id}: heat must be a non-zero integer −100..100`);
  if (!row.why) fail(`Herbal heat ${row.id}: say why (data/integrations.js)`);
}
if (HERBAL_HEAT.length > 32) fail(`Herbal heat: ${HERBAL_HEAT.length} rows; keep the list modest`);
// ## Herbal's adjuvant limit (32) is shared by every pack.
if (HERBAL_ADJUVANTS.length > 4) fail(`Herbal adjuvants: ${HERBAL_ADJUVANTS.length}; all packs together get 32, keep Harvest's to a few`);
for (const row of HERBAL_ADJUVANTS) if (!itemOf(row.id)) fail(`Herbal adjuvant ${row.id}: not a Harvest item`);
// ## Fishing docs/API.md: biteFactor 0.5–1, pond feed 1–4 meals, 1–32 rows a message.
for (const row of FISHING_BAITS) {
  if (!itemOf(row.id)) fail(`Fishing bait ${row.id}: not a Harvest item`);
  if (!(typeof row.biteFactor === "number" && row.biteFactor >= 0.5 && row.biteFactor <= 1)) fail(`Fishing bait ${row.id}: biteFactor must be 0.5–1`);
  if (!row.why) fail(`Fishing bait ${row.id}: say why (data/integrations.js)`);
}
for (const row of FISHING_POND_FEEDS) {
  if (!itemOf(row.id)) fail(`Fishing pond feed ${row.id}: not a Harvest item`);
  if (!(Number.isInteger(row.meals) && row.meals >= 1 && row.meals <= 4)) fail(`Fishing pond feed ${row.id}: meals must be 1–4`);
  if (!row.why) fail(`Fishing pond feed ${row.id}: say why (data/integrations.js)`);
}
if (FISHING_BAITS.length > 32 || FISHING_POND_FEEDS.length > 32) fail("Fishing: at most 32 rows a message");
for (const table of [RANCHING_FEEDS.map((f) => f.item), HERBAL_HEAT.map((h) => h.id), HERBAL_ADJUVANTS.map((a) => a.id), FISHING_BAITS.map((b) => b.id), FISHING_POND_FEEDS.map((f) => f.id)])
  if (new Set(table).size !== table.length) fail(`partner table lists an item twice: ${table.join(", ")}`);
for (const wine of TAVERN_WINES) {
  if (itemOf(wine.id)?.kind !== "drink") fail(`Tavern wine ${wine.id}: not a Harvest drink`);
  for (const id of wine.ingredients) if (!id.includes(":") && !itemOf(id)) fail(`Tavern wine ${wine.id}: unknown ingredient ${id}`);
  if (!RECIPES.some((r) => r.result === wine.id && r.station === "pickling_jar")) fail(`Tavern wine ${wine.id}: keep its pickling-jar recipe`);
}
const tavern = tavernPayload();
for (const page of tavern.pages)
  for (const field of ["title", "body"])
    for (const locale of ["zh_TW", "zh_CN", "en_US"]) {
      const text = page[field]?.[locale];
      if (typeof text !== "string" || !text.trim()) fail(`Tavern page ${page.id}: ${field}.${locale} is empty`);
      else if (locale === "zh_CN") for (const c of text) if (HINTS.has(c)) fail(`Tavern page ${page.id}: zh_CN still has 「${c}」`);
    }
for (const recipe of tavern.recipes) for (const locale of ["zh_TW", "zh_CN", "en_US"]) if (!recipe.title?.[locale]) fail(`Tavern recipe ${recipe.id}: no ${locale} title`);

for (const row of hardOutliers()) fail(`balance: ${row.id} ${row.flags.join(" ")} (npm run balance)`);

if (errors.length) {
  for (const message of errors) console.error(`✗ ${message}`);
  console.error(`\nvalidate: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log("validate: ok");
