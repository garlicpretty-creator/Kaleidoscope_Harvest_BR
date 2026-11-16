// Checks the packs before they are built or committed (npm run validate):
//   1. every JSON file under packs/ parses;
//   2. the data tables agree with each other;
//   3. every texture, language key and loot table the generated files name exists;
//   4. the manifests point at each other and at Cookery.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// --- 2. Data tables -------------------------------------------------------------------------

const { NAMESPACE, rid } = await load("ns.js");
const { CROPS, TRELLIS } = await load("crops.js");
const { TREES } = await load("trees.js");
const { ITEMS } = await load("items.js");
const { RECIPES } = await load("dishes.js");
const { CLIMATES } = await load("climate.js");
const { guidebookPayload } = await load("guidebook.js");
const { HINTS } = await load("zh_cn.js");

const itemIds = new Set(ITEMS.map((i) => i.id));
const seen = new Set();
for (const id of [...ITEMS.map((i) => i.id), ...CROPS.map((c) => `${c.id}_crop`), ...TREES.flatMap((t) => [`${t.id}_sapling`, `${t.id}_fruit_leaves`]), TRELLIS.id]) {
  if (seen.has(id)) fail(`duplicate id ${id}`);
  seen.add(id);
}

const FORMS = ["once", "underground", "repeatable", "tall", "trellis"];
for (const crop of CROPS) {
  const where = `crop ${crop.id}`;
  if (!FORMS.includes(crop.form)) fail(`${where}: unknown form ${crop.form}`);
  if (!CLIMATES.includes(crop.climate)) fail(`${where}: unknown climate ${crop.climate}`);
  if (!itemIds.has(crop.seed)) fail(`${where}: seed ${crop.seed} is not in data/items.js`);
  if (!itemIds.has(crop.produce)) fail(`${where}: produce ${crop.produce} is not in data/items.js`);
  if (!(crop.growthChance > 0 && crop.growthChance <= 1)) fail(`${where}: growthChance must be in (0, 1]`);
  if (["repeatable", "trellis"].includes(crop.form)) {
    if (!(crop.harvestResetAge >= 0 && crop.harvestResetAge < crop.maxGrowth)) fail(`${where}: harvestResetAge must be below maxGrowth`);
    if (!crop.pick) fail(`${where}: a ${crop.form} crop needs pick counts`);
  }
  if (crop.form === "tall" && !(crop.tallFrom > 0 && crop.tallFrom <= crop.maxGrowth)) fail(`${where}: tallFrom out of range`);
  if (crop.form === "underground" && !crop.hoeBonus) fail(`${where}: an underground crop needs hoeBonus`);
}
for (const tree of TREES) {
  if (!CLIMATES.includes(tree.climate)) fail(`tree ${tree.id}: unknown climate ${tree.climate}`);
  if (!itemIds.has(tree.fruit)) fail(`tree ${tree.id}: fruit ${tree.fruit} is not in data/items.js`);
}

// ## Two goals of the proposal checked mechanically: every crop has a use
// ## (企劃書：每種作物至少兩個用途 — M1 checks at least one Cookery use; the
// ## second use arrives with M2–M4 and the G4 gate then raises this to two).
const usedIn = new Set(RECIPES.flatMap((row) => (row.input ? [rid(row.input)] : row.slots.flat())));
for (const id of [...CROPS.map((c) => c.produce), ...TREES.map((t) => t.fruit)]) if (!usedIn.has(rid(id))) fail(`${id}: no Cookery recipe uses it`);
for (const row of RECIPES) {
  if (!itemIds.has(row.result)) fail(`recipe ${row.result}: result is not in data/items.js`);
  const inputs = row.input ? [rid(row.input)] : row.slots.flat();
  for (const id of inputs) if (id.startsWith(`${NAMESPACE}:`) && !itemIds.has(id.slice(NAMESPACE.length + 1))) fail(`recipe ${row.result}: unknown input ${id}`);
}
for (const item of ITEMS.filter((i) => i.kind === "dish" || i.kind === "ingredient")) if (!RECIPES.some((row) => row.result === item.id)) fail(`${item.id}: no recipe makes it`);

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
}

// --- 3. Generated files and what they name -------------------------------------------------------

if (!existsSync(join(BP, "blocks")) || !existsSync(join(RP, "textures", "terrain_texture.json"))) {
  fail("generated files missing: run npm run generate");
} else {
  const terrain = readJson(join(RP, "textures", "terrain_texture.json")).texture_data;
  const itemTex = readJson(join(RP, "textures", "item_texture.json")).texture_data;
  for (const [name, { textures }] of [...Object.entries(terrain), ...Object.entries(itemTex)]) if (!existsSync(join(RP, `${textures}.png`))) fail(`texture ${name}: ${textures}.png missing`);

  const langKeys = (pack, locale) =>
    new Set(
      readFileSync(join(pack, "texts", `${locale}.lang`), "utf8")
        .split("\n")
        .filter((line) => line.includes("=") && !line.startsWith("#"))
        .map((line) => line.slice(0, line.indexOf("=")))
    );
  const rpLang = Object.fromEntries(["en_US", "zh_TW", "zh_CN"].map((l) => [l, langKeys(RP, l)]));
  for (const line of readFileSync(join(RP, "texts", "zh_CN.lang"), "utf8").split("\n")) for (const c of line.slice(line.indexOf("=") + 1)) if (HINTS.has(c)) fail(`RP zh_CN.lang: 「${c}」 not converted in "${line}"`);

  const textures = (material) => Object.values(material ?? {}).map((m) => m.texture);
  for (const file of readdirSync(join(BP, "blocks"))) {
    const def = readJson(join(BP, "blocks", file))["minecraft:block"];
    const parts = [def.components, ...(def.permutations ?? []).map((p) => p.components)];
    for (const c of parts) {
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

// --- 4. Manifests ---------------------------------------------------------------------------------

const COOKERY_BP = "9944f731-cc4c-4299-bdd5-f8799c1d832e";
const bp = readJson(join(BP, "manifest.json"));
const rp = readJson(join(RP, "manifest.json"));
const deps = (m) => m.dependencies.map((d) => d.uuid).filter(Boolean);
if (!deps(bp).includes(rp.header.uuid)) fail("BP manifest does not depend on the RP");
if (!deps(rp).includes(bp.header.uuid)) fail("RP manifest does not depend on the BP");
if (!deps(bp).includes(COOKERY_BP)) fail("BP manifest does not depend on Cookery");
const uuids = [bp.header.uuid, rp.header.uuid, ...bp.modules.map((m) => m.uuid), ...rp.modules.map((m) => m.uuid)];
if (new Set(uuids).size !== uuids.length) fail("manifest UUIDs are not unique");

if (errors.length) {
  for (const message of errors) console.error(`✗ ${message}`);
  console.error(`\nvalidate: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log("validate: ok");
