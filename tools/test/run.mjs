// Behaviour tests for Harvest's scripts, run against the mock API and the
// generated block JSON. Run with: npm test (after npm run generate).

import { readdirSync, readFileSync } from "node:fs";
import * as mc from "@minecraft/server";

const { world, system, ItemStack, Player, GameMode, __advance, __place, __randomTick, __interact, __break, __reset, __registerComponents, __setLootRandom } = mc;
const overworld = world.getDimension("overworld");

const results = [];
function test(name, body) {
  try {
    __reset();
    setRandom(() => 0);
    __setLootRandom(() => 0);
    body();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

await import("../../packs/BP/scripts/main.js");
const COMPONENTS = __registerComponents();
__advance(2); // startup: api_ping and guidebook_ping go out
const PINGED = ["kaleidoscope_cookery:api_ping", "kaleidoscope_cookery:guidebook_ping"].every((id) => system.sentEvents.some((e) => e.id === id));
const { setRandom } = await import("../../packs/BP/scripts/utils/blocks.js");
const { CROPS } = await import("../../packs/BP/scripts/data/crops.js");
const { TREE_SHAPE } = await import("../../packs/BP/scripts/data/trees.js");
const { ITEMS } = await import("../../packs/BP/scripts/data/items.js");
const { climateMultiplier, climateOfBiome } = await import("../../packs/BP/scripts/data/climate.js");
const { guideEntries } = await import("../../packs/BP/scripts/data/guidebook.js");
const { RECIPES } = await import("../../packs/BP/scripts/data/dishes.js");
const { guidebookMessages } = await import("../../packs/BP/scripts/api/cookeryContent.js");
const { brokeCrop } = await import("../../packs/BP/scripts/growth/crops.js");

const NS = "kaleidoscope_harvest";
const r = (id) => `${NS}:${id}`;
const S = (name) => `${NS}:${name}`;
const at = (x, y = 64, z = 0) => ({ x, y, z });

function player(holding, amount = 1) {
  const p = new Player(overworld);
  if (holding) p.hand = new ItemStack(holding, amount);
  return p;
}
/** Farmland at y 63 and a crop on it. */
function plant(cropBlock, x = 0, states = {}) {
  __place(overworld, at(x, 63), "minecraft:farmland");
  return __place(overworld, at(x), r(cropBlock), states);
}
const growth = (block) => block.permutation.getState(S("growth"));
function tick(block, n) {
  for (let i = 0; i < n; i++) __randomTick(overworld.getBlock(block.location));
  return overworld.getBlock(block.location);
}

// --- Wiring -------------------------------------------------------------------------------

test("every custom component named in the block JSON is registered at startup", () => {
  for (const file of readdirSync("packs/BP/blocks")) {
    const def = JSON.parse(readFileSync(`packs/BP/blocks/${file}`, "utf8"))["minecraft:block"];
    for (const key of Object.keys(def.components)) if (key.startsWith(`${NS}:`)) assert(COMPONENTS[key], `${file}: ${key} is not registered`);
  }
  equal(Object.keys(COMPONENTS).length, 4, "component count");
});

// --- Climate --------------------------------------------------------------------------------

test("climate: same ×1, one step ×0.5, two steps 0", () => {
  equal(climateMultiplier("warm", "warm"), 1, "same");
  equal(climateMultiplier("warm", "hot"), 0.5, "one step");
  equal(climateMultiplier("cold", "warm"), 0, "two steps");
  equal(climateOfBiome("minecraft:jungle"), "hot", "jungle");
  equal(climateOfBiome("minecraft:windswept_savanna"), "hot", "windswept savanna is a savanna");
  equal(climateOfBiome("minecraft:cherry_grove"), "temperate", "cherry grove");
  equal(climateOfBiome("minecraft:snowy_slopes"), "cold", "snowy slopes");
  equal(climateOfBiome("someaddon:unknown"), "temperate", "unknown biome");
});

// --- Once crops ------------------------------------------------------------------------------

test("napa cabbage grows 8 stages on farmland and drops cabbage and seeds when ripe", () => {
  let crop = plant("napa_cabbage_crop");
  crop = tick(crop, 20);
  equal(growth(crop), 7, "stage after many ticks");
  __break(player(), crop);
  assert(overworld.dropped(r("napa_cabbage")) >= 1, "cabbage dropped");
  assert(overworld.dropped(r("napa_cabbage_seeds")) >= 1, "seeds dropped");
  equal(overworld.getBlock(at(0)).typeId, "minecraft:air", "block gone");
});

test("a young crop only gives its seed back", () => {
  const crop = plant("napa_cabbage_crop", 0, { [S("growth")]: 3 });
  __break(player(), crop);
  equal(overworld.dropped(r("napa_cabbage")), 0, "no cabbage");
  equal(overworld.dropped(r("napa_cabbage_seeds")), 1, "one seed");
});

test("a crop off farmland does not grow", () => {
  const crop = __place(overworld, at(0), r("napa_cabbage_crop"));
  equal(growth(tick(crop, 10)), 0, "no growth on air");
});

test("off-climate crops stop growing and turn grey; a greenhouse lets them grow", () => {
  overworld.biome = "minecraft:desert"; // hot, two steps from temperate
  let crop = tick(plant("napa_cabbage_crop"), 10);
  equal(growth(crop), 0, "no growth in the desert");
  equal(crop.permutation.getState(S("off_climate")), true, "grey leaves");

  // Glass roof and walls of any block around the crop.
  __place(overworld, at(0, 67), "minecraft:glass");
  for (const [x, z] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) __place(overworld, at(x, 64, z), "minecraft:glass");
  crop = tick(crop, 10);
  equal(crop.permutation.getState(S("off_climate")), false, "colour back in the greenhouse");
  equal(growth(crop), 7, "grows in the greenhouse");
});

test("half-speed climate halves the chance", () => {
  overworld.biome = "minecraft:plains"; // temperate; corn likes warm
  setRandom(() => 0.3); // corn: 0.4 × 0.5 = 0.2 < 0.3, no growth
  equal(growth(tick(plant("corn_crop"), 10)), 0, "no growth at roll 0.3 in plains");
  overworld.biome = "minecraft:swamp"; // warm: 0.4 > 0.3
  equal(growth(tick(overworld.getBlock(at(0)), 1)), 1, "grows at roll 0.3 in a swamp");
});

test("a ripe crop sometimes gives off a particle; no text ever shows", () => {
  const crop = plant("napa_cabbage_crop", 0, { [S("growth")]: 7 });
  tick(crop, 1);
  assert(overworld.particles.length === 1, "particle on a ripe crop");
  __advance(400);
  equal(world.messages.length, 0, "no chat text");
});

// --- Bone meal ---------------------------------------------------------------------------------

test("bone meal adds two stages and is used up (not in creative)", () => {
  const crop = plant("napa_cabbage_crop");
  const p = player("minecraft:bone_meal", 3);
  __interact(p, crop);
  equal(growth(overworld.getBlock(at(0))), 2, "two stages");
  equal(p.hand.amount, 2, "one bone meal used");
  p.gameMode = GameMode.Creative;
  __interact(p, overworld.getBlock(at(0)));
  equal(p.hand.amount, 2, "creative keeps it");
  equal(overworld.sounds.at(-1).id, "item.bone_meal.use", "sound");
});

// --- Repeatable ----------------------------------------------------------------------------------

test("scallion: pick a ripe one, it drops back to harvestResetAge", () => {
  let crop = plant("scallion_crop", 0, { [S("growth")]: 6 });
  __interact(player(), crop);
  equal(overworld.dropped(r("scallion")), 0, "not ripe, nothing picked");
  crop = tick(crop, 1);
  __interact(player(), crop);
  assert(overworld.dropped(r("scallion")) >= 1, "scallion picked");
  equal(growth(overworld.getBlock(at(0))), 4, "back to stage 4");
  equal(overworld.sounds.at(-1).id, "block.sweet_berry_bush.pick", "pick sound");
});

// --- Tall --------------------------------------------------------------------------------------------

test("corn grows its upper block from stage 4", () => {
  overworld.biome = "minecraft:swamp";
  const crop = tick(plant("corn_crop"), 4);
  equal(growth(crop), 4, "lower at 4");
  const upper = overworld.getBlock(at(0, 65));
  equal(upper.typeId, r("corn_crop"), "upper block placed");
  equal(upper.permutation.getState(S("upper")), true, "upper state");
  tick(crop, 10);
  equal(growth(overworld.getBlock(at(0, 65))), 7, "upper follows the lower stage");
});

test("corn waits at stage 3 while something blocks the upper block", () => {
  overworld.biome = "minecraft:swamp";
  __place(overworld, at(0, 65), "minecraft:stone");
  equal(growth(tick(plant("corn_crop"), 10)), 3, "stopped short");
});

test("breaking either half of ripe corn harvests the plant once", () => {
  overworld.biome = "minecraft:swamp";
  for (const half of [65, 64]) {
    __reset();
    overworld.biome = "minecraft:swamp";
    tick(plant("corn_crop"), 10);
    __break(player(), overworld.getBlock(at(0, half)));
    equal(overworld.getBlock(at(0, 64)).typeId, "minecraft:air", `lower gone (broke y${half})`);
    equal(overworld.getBlock(at(0, 65)).typeId, "minecraft:air", `upper gone (broke y${half})`);
    equal(overworld.dropped(r("corn")), 1, `corn dropped once (broke y${half})`);
  }
});

// --- Trellis --------------------------------------------------------------------------------------------

test("cucumber seeds go on a Bamboo Trellis; picking and breaking work", () => {
  overworld.biome = "minecraft:swamp";
  __place(overworld, at(0, 63), "minecraft:farmland");
  const trellis = __place(overworld, at(0), r("bamboo_trellis"));
  const p = player(r("cucumber_seeds"), 2);
  __interact(p, trellis);
  let crop = overworld.getBlock(at(0));
  equal(crop.typeId, r("cucumber_crop"), "planted");
  equal(p.hand.amount, 1, "seed used");
  crop = tick(crop, 10);
  __interact(player(), crop);
  assert(overworld.dropped(r("cucumber")) >= 1, "picked");
  equal(growth(overworld.getBlock(at(0))), 5, "back to stage 5");
  __break(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("bamboo_trellis")), 1, "trellis back");
});

test("other items do nothing to a trellis", () => {
  __place(overworld, at(0, 63), "minecraft:farmland");
  const trellis = __place(overworld, at(0), r("bamboo_trellis"));
  __interact(player(r("napa_cabbage_seeds")), trellis);
  equal(overworld.getBlock(at(0)).typeId, r("bamboo_trellis"), "still a trellis");
});

// --- Underground (no M1 crop yet: checked with a made-up row) ---------------------------------------------

test("underground crops give the hoe bonus only when ripe and dug with a hoe", () => {
  const fake = { form: "underground", maxGrowth: 7, produce: "napa_cabbage", hoeBonus: 2 };
  const ripe = { type: { id: r("napa_cabbage_crop") }, getState: (n) => (n === S("growth") ? 7 : undefined) };
  const block = overworld.getBlock(at(0));
  brokeCrop(block, fake, ripe, player("minecraft:iron_hoe"));
  equal(overworld.dropped(r("napa_cabbage")), 2, "hoe bonus");
  brokeCrop(block, fake, ripe, player());
  equal(overworld.dropped(r("napa_cabbage")), 2, "no bonus by hand");
});

// --- Fruit trees -------------------------------------------------------------------------------------------

function plantSapling(x = 0) {
  __place(overworld, at(x, 63), "minecraft:grass_block");
  return __place(overworld, at(x), r("mandarin_sapling"));
}

test("a mandarin sapling grows into a tree of the fixed shape", () => {
  overworld.biome = "minecraft:swamp";
  tick(plantSapling(), 4);
  equal(overworld.getBlock(at(0)).typeId, r("fruit_log"), "trunk at the sapling");
  for (const [x, y, z] of TREE_SHAPE.trunk) equal(overworld.getBlock(at(x, 64 + y, z)).typeId, r("fruit_log"), `trunk ${y}`);
  const leaves = [...overworld.blocks.values()].filter((p) => p.type.id === r("mandarin_fruit_leaves")).length;
  equal(leaves, 21, "fruit leaves");
});

test("a sapling with no room waits", () => {
  overworld.biome = "minecraft:swamp";
  __place(overworld, at(1, 66), "minecraft:stone");
  const sapling = tick(plantSapling(), 10);
  equal(sapling.typeId, r("mandarin_sapling"), "still a sapling");
});

test("bone meal moves a sapling on one stage only", () => {
  overworld.biome = "minecraft:swamp";
  const p = player("minecraft:bone_meal", 5);
  __interact(p, plantSapling());
  equal(growth(overworld.getBlock(at(0))), 1, "one stage");
});

test("fruit leaves blossom, ripen, are picked and fruit again", () => {
  overworld.biome = "minecraft:swamp";
  tick(plantSapling(), 4);
  let leaf = overworld.getBlock(at(1, 66));
  equal(leaf.typeId, r("mandarin_fruit_leaves"), "a leaf");
  leaf = tick(leaf, 3);
  equal(leaf.permutation.getState(S("fruit_stage")), 3, "ripe");
  __interact(player(), leaf);
  assert(overworld.dropped(r("mandarin")) >= 1, "mandarin picked");
  equal(overworld.getBlock(at(1, 66)).permutation.getState(S("fruit_stage")), 0, "back to no fruit");
  const p = player("minecraft:bone_meal", 2);
  __interact(p, overworld.getBlock(at(1, 66)));
  equal(overworld.getBlock(at(1, 66)).permutation.getState(S("fruit_stage")), 1, "bone meal: one stage");
});

test("off-climate fruit leaves turn grey and do not fruit", () => {
  overworld.biome = "minecraft:swamp";
  tick(plantSapling(), 4);
  overworld.biome = "minecraft:snowy_plains";
  const leaf = tick(overworld.getBlock(at(1, 66)), 5);
  equal(leaf.permutation.getState(S("off_climate")), true, "grey");
  equal(leaf.permutation.getState(S("fruit_stage")), 0, "no fruit");
});

test("chopping the trunk away makes the fruit leaves fall", () => {
  overworld.biome = "minecraft:swamp";
  tick(plantSapling(), 4);
  for (const [x, y, z] of TREE_SHAPE.trunk) __break(player("minecraft:iron_axe"), overworld.getBlock(at(x, 64 + y, z)));
  equal(overworld.dropped(r("fruit_log")), 3, "logs dropped");
  tick(overworld.getBlock(at(1, 66)), 1);
  equal(overworld.getBlock(at(1, 66)).typeId, "minecraft:air", "leaf fell");
});

// --- Cookery --------------------------------------------------------------------------------------------------

test("recipes go to Cookery once it reports its capabilities; unknown kinds are skipped", () => {
  assert(PINGED, "api_ping and guidebook_ping sent at startup");
  system.sendScriptEvent("kaleidoscope_cookery:api_ready", JSON.stringify({ api: 1, capabilities: ["chopping_board", "wok", "steamer"] }));
  const sent = system.sentEvents.filter((e) => e.id === "kaleidoscope_cookery:register_recipe").map((e) => JSON.parse(e.message));
  equal(sent.length, RECIPES.filter((row) => row.station !== "stockpot").length, "stockpot skipped");
  const board = sent.find((p) => p.recipe.result === r("chopped_scallion"));
  equal(board.kind, "chopping_board", "kind");
  equal(board.source, NS, "source");
  equal(board.recipe.input, r("scallion"), "input");
  const wok = sent.find((p) => p.kind === "wok");
  assert(Array.isArray(wok.recipe.ingredients[0]), "wok slots are lists");
});

test("the guidebook chapter goes out as begin / chunks / end and reads back as JSON", () => {
  const messages = guidebookMessages();
  equal(messages[0][0], "kaleidoscope_cookery:guidebook_begin", "begin");
  equal(messages.at(-1)[0], "kaleidoscope_cookery:guidebook_end", "end");
  const begin = JSON.parse(messages[0][1]);
  const chunks = messages.slice(1, -1).map(([, m]) => m.split("\n").slice(4).join("\n"));
  equal(chunks.length, begin.chunks, "chunk count");
  const chapter = JSON.parse(chunks.join(""));
  assert(chapter.entries.length > 0, "entries");
  for (const entry of chapter.entries) {
    assert(entry.mechanics.length >= 1 && entry.mechanics.length <= 8, `${entry.id}: 1-8 lines`);
    for (const line of [...entry.mechanics, ...entry.mechanicsByLocale.zh_TW]) assert(line.length <= 512, `${entry.id}: line too long`);
  }
});

test("every item and placeable block has a guidebook entry", () => {
  const ids = new Set(guideEntries().map((row) => row.id));
  for (const item of ITEMS) assert(ids.has(item.id), `no entry for ${item.id}`);
  for (const id of ["bamboo_trellis", "mandarin_sapling", "fruit_log"]) assert(ids.has(id), `no entry for ${id}`);
  for (const crop of CROPS) assert(ids.has(crop.seed), `no entry for ${crop.seed}`);
});

// --- Report ------------------------------------------------------------------------------------------------------

let failed = 0;
for (const result of results) {
  if (result.ok) console.log(`ok   ${result.name}`);
  else {
    failed++;
    console.log(`FAIL ${result.name}\n     ${result.error?.stack ?? result.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
