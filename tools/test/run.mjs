// Behaviour tests for Harvest's scripts, run against the mock API and the
// generated block JSON. Run with: npm test (after npm run generate).

import { readdirSync, readFileSync } from "node:fs";
import * as mc from "@minecraft/server";

const { world, system, ItemStack, Player, GameMode, __skipTime, __advance, __place, __randomTick, __interact, __break, __reset, __registerComponents, __setLootRandom } = mc;
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
const { recipePayload, oilContainers } = await import("../../packs/BP/scripts/api/cookeryContent.js");
const { MENU, activeMenu } = await import("../../packs/BP/scripts/data/menu.js");

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
  equal(Object.keys(COMPONENTS).length, 6, "component count");
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

// --- M2: spices, underground crops, wild plants ------------------------------------------------------------

test("garlic is planted from a clove, and a hoe digs up one more when its leaves are yellow", () => {
  const garlic = JSON.parse(readFileSync("packs/BP/items/garlic.json", "utf8"))["minecraft:item"].components["minecraft:block_placer"];
  equal(garlic.block, r("garlic_crop"), "garlic plants garlic");
  let crop = tick(plant("garlic_crop"), 20);
  equal(growth(crop), 7, "ripe");
  __break(player("minecraft:iron_hoe"), crop);
  equal(overworld.dropped(r("garlic")), 2, "1 from loot + 1 hoe bonus");
  crop = tick(plant("garlic_crop", 2), 20);
  __break(player(), crop);
  equal(overworld.dropped(r("garlic")), 3, "by hand only the loot");
});

test("black pepper is planted on a trellis from a seedling and picked again and again", () => {
  overworld.biome = "minecraft:jungle";
  __place(overworld, at(0, 63), "minecraft:farmland");
  __interact(player(r("black_pepper_seedling")), __place(overworld, at(0), r("bamboo_trellis")));
  const crop = tick(overworld.getBlock(at(0)), 30);
  equal(crop.typeId, r("black_pepper_crop"), "planted");
  equal(growth(crop), 7, "ripe");
  __interact(player(), crop);
  assert(overworld.dropped(r("black_peppercorns")) >= 1, "picked");
});

test("every crop grows wild somewhere, and breaking the wild plant gives a first harvest", () => {
  for (const crop of CROPS) {
    __reset();
    const wild = `wild_${crop.id}`;
    const rules = readdirSync("packs/BP/feature_rules/wild").filter((f) => f.startsWith(`${wild}_`));
    assert(rules.length === crop.wild.biomes.length && rules.length > 0, `${crop.id}: one feature rule per biome`);
    for (const file of rules) {
      const rule = JSON.parse(readFileSync(`packs/BP/feature_rules/wild/${file}`, "utf8"))["minecraft:feature_rules"];
      const search = JSON.parse(readFileSync(`packs/BP/features/wild/${rule.description.places_feature.split(":")[1]}.json`, "utf8"))["minecraft:search_feature"];
      const single = JSON.parse(readFileSync(`packs/BP/features/wild/${search.places_feature.split(":")[1]}.json`, "utf8"))["minecraft:single_block_feature"];
      equal(single.places_block.name, r(wild), `${file} places the wild plant`);
    }
    __break(player(), __place(overworld, at(0), r(wild)));
    assert(overworld.dropped(r(crop.produce)) >= 1, `${crop.id}: produce from the wild plant`);
    if (crop.seed !== crop.produce) assert(overworld.dropped(r(crop.seed)) >= 1, `${crop.id}: seeds from the wild plant`);
  }
});

test("millstone payloads use Herbal's outputs list", () => {
  const sesame = recipePayload(RECIPES.find((row) => row.station === "millstone" && row.input === "sesame"));
  equal(sesame.kind, "millstone", "kind");
  equal(sesame.recipe.input, r("sesame"), "input");
  equal(JSON.stringify(sesame.recipe.outputs), JSON.stringify([{ id: r("sesame_powder"), count: 1, chance: 1 }, { id: r("sesame_oil"), count: 1, chance: 0.5 }]), "outputs");
});

// --- M4: menu, juicer, pickling jar --------------------------------------------------------------------------

const M3_FRUITS = ["strawberry", "blueberry", "grape", "passion_fruit", "pineapple", "sweet_orange", "lemon", "peach", "pear", "persimmon", "lychee", "mango", "banana", "star_anise", "cinnamon_bark"];

test("menu rows wait for their inputs, and with M3's fruit every row is in", () => {
  const base = ITEMS.filter((i) => ["seed", "produce"].includes(i.kind)).map((i) => i.id);
  const withoutStrawberry = activeMenu(base.filter((id) => id !== "strawberry"));
  assert(!withoutStrawberry.some((row) => row.item.id === "strawberry_jam"), "no jam without strawberries");
  equal(activeMenu(base).length, MENU.length, "every menu row active");
  for (const id of M3_FRUITS) assert(base.includes(id), `${id} exists`);
  const dishes = MENU.filter((row) => row.item.kind === "dish").length;
  assert(dishes >= 40, `40 dishes (企劃書), got ${dishes}`);
});

// --- M3: fruit crops and fruit trees ---------------------------------------------------------------------

test("strawberries are picked and grow back; pineapples start again from a small plant", () => {
  let crop = plant("strawberry_crop", 0, { [S("growth")]: 7 });
  __interact(player(), crop);
  assert(overworld.dropped(r("strawberry")) >= 1, "strawberry picked");
  equal(growth(overworld.getBlock(at(0))), 4, "strawberry back to 4");
  overworld.biome = "minecraft:savanna";
  crop = plant("pineapple_crop", 2, { [S("growth")]: 7 });
  __interact(player(), crop);
  equal(overworld.dropped(r("pineapple")), 1, "one pineapple");
  equal(growth(overworld.getBlock(at(2))), 2, "pineapple back to 2");
});

test("a blueberry bush grows on grass, not only farmland, and is picked again and again", () => {
  overworld.biome = "minecraft:taiga";
  const seedling = JSON.parse(readFileSync("packs/BP/items/blueberry_seedling.json", "utf8"))["minecraft:item"].components["minecraft:block_placer"];
  assert(seedling.use_on.includes("minecraft:grass_block"), "planted on grass");
  __place(overworld, at(0, 63), "minecraft:grass_block");
  const bush = tick(__place(overworld, at(0), r("blueberry_crop")), 40);
  equal(growth(bush), 7, "ripe on grass");
  __interact(player(), bush);
  assert(overworld.dropped(r("blueberry")) >= 2, "blueberries picked");
  equal(growth(overworld.getBlock(at(0))), 4, "back to 4");
});

test("grapes grow on a Bamboo Trellis from a cutting, drawn on the trellis model", () => {
  __place(overworld, at(0, 63), "minecraft:farmland");
  __interact(player(r("grape_cutting")), __place(overworld, at(0), r("bamboo_trellis")));
  const vine = tick(overworld.getBlock(at(0)), 40);
  equal(vine.typeId, r("grape_crop"), "planted");
  __interact(player(), vine);
  assert(overworld.dropped(r("grape")) >= 2, "grapes picked");
  const def = JSON.parse(readFileSync("packs/BP/blocks/grape_crop.json", "utf8"))["minecraft:block"];
  equal(def.components["minecraft:geometry"], "geometry.kaleidoscope_harvest.bamboo_trellis", "trellis model");
  assert(def.components["minecraft:material_instances"].vine, "vine material");
});

const TREES_ALL = (await import("../../packs/BP/scripts/data/trees.js"));

test("every fruit tree grows into its shape with its trunk, and its leaves give its fruit", () => {
  for (const t of TREES_ALL.TREES) {
    __reset();
    setRandom(() => 0);
    overworld.biome = { cold: "minecraft:taiga", temperate: "minecraft:forest", warm: "minecraft:swamp", hot: "minecraft:jungle" }[t.climate];
    __place(overworld, at(0, 63), "minecraft:grass_block");
    tick(__place(overworld, at(0), r(`${t.id}_sapling`)), 4);
    const shape = TREES_ALL.TREE_SHAPES[t.shape];
    for (const [x, y, z] of shape.trunk) equal(overworld.getBlock(at(x, 64 + y, z)).typeId, r(t.trunk), `${t.id}: trunk at y${y}`);
    const leaves = [...overworld.blocks.values()].filter((p) => p.type.id === r(`${t.id}_fruit_leaves`)).length;
    equal(leaves, shape.leaves.length, `${t.id}: leaf count`);
    const [lx, ly, lz] = shape.leaves[0];
    const leaf = tick(overworld.getBlock(at(lx, 64 + ly, lz)), 3);
    __interact(player(), leaf);
    assert(overworld.dropped(r(t.fruit)) >= 1, `${t.id}: picked ${t.fruit}`);
  }
});

test("a banana's leaves fall when its trunk is chopped", () => {
  overworld.biome = "minecraft:jungle";
  __place(overworld, at(0, 63), "minecraft:grass_block");
  tick(__place(overworld, at(0), r("banana_sapling")), 4);
  for (const [x, y, z] of TREES_ALL.TREE_SHAPES.palm.trunk) __break(player("minecraft:iron_axe"), overworld.getBlock(at(x, 64 + y, z)));
  equal(overworld.dropped(r("banana_trunk")), 4, "trunk dropped");
  tick(overworld.getBlock(at(0, 68)), 1);
  equal(overworld.getBlock(at(0, 68)).typeId, "minecraft:air", "crown fell");
});

test("wild saplings, village grape cuttings and the drawn textures are wired up", () => {
  for (const t of TREES_ALL.TREES.filter((t) => t.wild)) {
    const rules = readdirSync("packs/BP/feature_rules/wild").filter((f) => f.startsWith(`wild_${t.id}_sapling_`));
    equal(rules.length, t.wild.length, `${t.id}: wild sapling rules`);
  }
  const plains = JSON.parse(readFileSync("packs/BP/loot_tables/chests/village/village_plains_house.json", "utf8")).pools.at(-1);
  assert(plains.entries.some((e) => e.name === r("grape_cutting")), "grape cuttings in plains houses");
  const terrain = JSON.parse(readFileSync("packs/RP/textures/terrain_texture.json", "utf8")).texture_data;
  equal(terrain.kh_corn_stage7.textures, "textures/kaleidoscope_harvest/blocks/crops/corn_stage_3", "state 7 shows drawn stage 3");
  // Stopgap until the hanging fruit blocks exist (art PR #4): leaves with fruit show the blossom texture.
  equal(terrain.kh_mandarin_fruit_leaves_green.textures, "textures/kaleidoscope_harvest/blocks/trees/mandarin_leaves_blossom", "leaf art");
  assert(readdirSync("packs/RP/textures/kaleidoscope_harvest/blocks/crops").includes("corn_stage_3.texture_set.json"), "PBR texture set");
  assert(terrain.kh_corn_stage7_grey.textures.startsWith("textures/blocks/"), "grey copy made from the art");
});

const contents = (block) => block.permutation.getState(S("contents"));

test("juicer: two mandarins and a glass bottle make mandarin juice", () => {
  const juicer = __place(overworld, at(0), r("juicer"));
  const p = player(r("mandarin"), 3);
  __interact(p, juicer);
  equal(overworld.getBlock(at(0)).permutation.getState(S("juice")), "orange", "jug shows orange");
  __interact(player(r("mandarin_juice")), overworld.getBlock(at(0))); // not a fruit: nothing
  __interact(player("minecraft:glass_bottle"), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("mandarin_juice")), 0, "one fruit is not enough");
  __interact(p, overworld.getBlock(at(0)));
  __interact(p, overworld.getBlock(at(0)));
  equal(p.hand.amount, 1, "only two fruits go in");
  const bottle = player("minecraft:glass_bottle", 2);
  __interact(bottle, overworld.getBlock(at(0)));
  equal(overworld.dropped(r("mandarin_juice")), 1, "juice");
  equal(bottle.hand.amount, 1, "bottle used");
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 0, "empty again");
  equal(overworld.getBlock(at(0)).permutation.getState(S("juice")), "empty", "jug empty");
});

test("juicer: an empty hand or breaking it gives the fruit back", () => {
  const juicer = __place(overworld, at(0), r("juicer"));
  __interact(player(r("mandarin")), juicer);
  __interact(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("mandarin")), 1, "taken back by hand");
  __interact(player(r("mandarin")), overworld.getBlock(at(0)));
  __break(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("mandarin")), 2, "dropped on breaking");
});

test("pickling jar: fill, seal, wait a day, open", () => {
  const jar = __place(overworld, at(0), r("pickling_jar"));
  const p = player(r("napa_cabbage"), 2);
  __interact(p, jar);
  __interact(p, overworld.getBlock(at(0)));
  equal(contents(overworld.getBlock(at(0))), "fresh", "fresh");
  __interact(player(), overworld.getBlock(at(0)));
  equal(contents(overworld.getBlock(at(0))), "fermenting", "sealed");
  __interact(player(r("napa_cabbage")), overworld.getBlock(at(0)));
  __interact(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("pickled_napa_cabbage")), 0, "not done yet");
  __skipTime(24000);
  __randomTick(overworld.getBlock(at(0)));
  equal(contents(overworld.getBlock(at(0))), "done", "done after a day");
  __interact(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("pickled_napa_cabbage")), 2, "two pickles");
  equal(contents(overworld.getBlock(at(0))), "empty", "empty again");
});

test("pickling jar: kimchi in any order; a set that matches nothing comes back", () => {
  let jar = __place(overworld, at(0), r("pickling_jar"));
  for (const id of ["shredded_ginger", "napa_cabbage", "minced_garlic"]) __interact(player(r(id)), overworld.getBlock(at(0)));
  __interact(player(), overworld.getBlock(at(0)));
  equal(contents(overworld.getBlock(at(0))), "fermenting", "kimchi sealed");

  jar = __place(overworld, at(2), r("pickling_jar"));
  for (const id of ["daikon", "cucumber"]) __interact(player(r(id)), overworld.getBlock(at(2)));
  __interact(player(), overworld.getBlock(at(2)));
  equal(contents(overworld.getBlock(at(2))), "empty", "no match: emptied");
  equal(overworld.dropped(r("daikon")) + overworld.dropped(r("cucumber")), 2, "both back");
});

test("breaking a sealed jar gives the ingredients back", () => {
  __place(overworld, at(0), r("pickling_jar"));
  for (let i = 0; i < 2; i++) __interact(player(r("napa_cabbage")), overworld.getBlock(at(0)));
  __interact(player(), overworld.getBlock(at(0)));
  __break(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("napa_cabbage")), 2, "ingredients back");
  equal(world.getDynamicPropertyIds().length, 0, "no data left behind");
});

test("teapot, bamboo tray and oil payloads use Herbal's and Ranching's shapes", () => {
  const tea = recipePayload(RECIPES.find((row) => row.result === "ginger_tea"));
  equal(tea.kind, "teapot", "teapot");
  equal(tea.recipe.ingredient, r("shredded_ginger"), "tea ingredient");
  equal(tea.recipe.base, "minecraft:water", "tea base");
  const tray = recipePayload(RECIPES.find((row) => row.result === "dried_tangerine_peel"));
  equal(tray.recipe.process, "dry", "dried");
  equal(tray.recipe.duration, 12000, "duration");
  const oils = oilContainers();
  equal(oils.length, 2, "two plant oils");
  equal(oils[0].container.capacity, 256, "capacity 256");
});

test("generated items: oils do not stack, drinks give their bottle or cup back, bowls come back", () => {
  const item = (id) => JSON.parse(readFileSync(`packs/BP/items/${id}.json`, "utf8"))["minecraft:item"].components;
  equal(item("sesame_oil")["minecraft:max_stack_size"], 1, "oil stack");
  equal(item("mandarin_juice")["minecraft:food"].using_converts_to, "minecraft:glass_bottle", "juice bottle");
  equal(item("ginger_tea")["minecraft:food"].using_converts_to, "kaleidoscope_cookery:empty_cup", "tea cup");
  equal(item("cabbage_pork_stew")["minecraft:food"].using_converts_to, "minecraft:bowl", "stew bowl");
  equal(item("mandarin_juice")["minecraft:use_animation"], "drink", "drinking");
  for (const id of ["scallion_pancake", "pepper_bun", "roasted_sweet_potato", "juicer", "pickling_jar"]) assert(readdirSync("packs/BP/recipes").includes(`${id}.json`), `${id} recipe file`);
});

// --- Village chests ---------------------------------------------------------------------------------------------

test("village house chests keep their vanilla loot and add onion seeds, sweet potatoes and mandarin saplings", () => {
  const read = (dir, house) => JSON.parse(readFileSync(`${dir}/village_${house}_house.json`, "utf8")).pools;
  const names = (pools) => pools.flatMap((pool) => pool.entries.map((e) => e.name)).filter(Boolean);
  const want = { plains: ["onion_seeds", "mandarin_sapling"], taiga: ["onion_seeds"], snowy: ["onion_seeds"], savanna: ["sweet_potato", "mandarin_sapling"], desert: ["sweet_potato"] };
  for (const [house, items] of Object.entries(want)) {
    const vanilla = read("tools/vanilla/loot_tables/chests/village", house);
    const ours = read("packs/BP/loot_tables/chests/village", house);
    equal(JSON.stringify(ours.slice(0, vanilla.length)), JSON.stringify(vanilla), `${house}: vanilla pools untouched`);
    for (const id of items) assert(names(ours.slice(vanilla.length)).includes(r(id)), `${house}: ${id}`);
  }
});

// --- Cookery --------------------------------------------------------------------------------------------------

test("recipes go to Cookery once it reports its capabilities; unknown kinds are skipped", () => {
  assert(PINGED, "api_ping and guidebook_ping sent at startup");
  system.sendScriptEvent("kaleidoscope_cookery:api_ready", JSON.stringify({ api: 1, capabilities: ["chopping_board", "wok", "steamer"] }));
  const sent = system.sentEvents.filter((e) => e.id === "kaleidoscope_cookery:register_recipe").map((e) => JSON.parse(e.message));
  equal(sent.length, RECIPES.filter((row) => ["chopping_board", "wok", "steamer"].includes(row.station)).length, "stockpot and millstone skipped");
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
