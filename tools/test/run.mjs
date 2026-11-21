// Behaviour tests for Harvest's scripts, run against the mock API and the
// generated block JSON. Run with: npm test (after npm run generate).

import { readdirSync, readFileSync } from "node:fs";
import * as mc from "@minecraft/server";

const { world, system, ItemStack, Player, GameMode, __skipTime, __advance, __place, __placeByPlayer, __randomTick, __interact, __break, __reset, __registerComponents, __setLootRandom, __componentsOf, BlockPermutation } = mc;
const overworld = world.getDimension("overworld");

const results = [];
function test(name, body) {
  try {
    __reset();
    resetRefusals();
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
/** Every script event sent while the packs started. */
const STARTUP = system.sentEvents.map((e) => e.id);
const PINGED = ["kaleidoscope_cookery:api_ping", "kaleidoscope_cookery:guidebook_ping"].every((id) => system.sentEvents.some((e) => e.id === id));
// ## Harvest's own api_ready goes out by itself a little later (api/harvestApi.js ANNOUNCE_TICKS).
__advance(20);
const ANNOUNCED = system.sentEvents.filter((e) => e.id === "kaleidoscope_harvest:api_ready").map((e) => JSON.parse(e.message));
const { setRandom, resetRefusals } = await import("../../packs/BP/scripts/utils/blocks.js");
const { CROPS } = await import("../../packs/BP/scripts/data/crops.js");
const { TREES } = await import("../../packs/BP/scripts/data/trees.js");
const { ITEMS } = await import("../../packs/BP/scripts/data/items.js");
const { climateMultiplier, climateOfBiome, CLIMATES } = await import("../../packs/BP/scripts/data/climate.js");
const { guideEntries, guidebookPayload } = await import("../../packs/BP/scripts/data/guidebook.js");
const { RECIPES } = await import("../../packs/BP/scripts/data/dishes.js");
const { guidebookMessages } = await import("../../packs/BP/scripts/api/cookeryContent.js");
const { brokeCrop } = await import("../../packs/BP/scripts/growth/crops.js");
const { recipePayload, oilContainers, partnerRows } = await import("../../packs/BP/scripts/api/cookeryContent.js");
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
  equal(Object.keys(COMPONENTS).length, 8, "component count");
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
  // ## wax_particle reads variable.color and variable.direction; without them the game logs
  // ## an error every frame (found in game, 1.0.0).
  const vars = overworld.particles[0].variables ?? {};
  assert(vars["variable.color"] && vars["variable.direction"], "ripe particle carries its Molang variables");
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

const blockDef = (id) => JSON.parse(readFileSync(`packs/BP/blocks/${id}.json`, "utf8"))["minecraft:block"];
const blossom = (block) => block.permutation.getState(S("blossom"));
/** Shortest trunk of a tree's feature: the mock places that many logs (tools/test/mock-server.mjs). */
const trunkHeight = (t) => {
  const feature = JSON.parse(readFileSync(`packs/BP/features/trees/${t.id}_tree_feature.json`, "utf8"))["minecraft:tree_feature"];
  const trunk = feature[Object.keys(feature).find((k) => k.endsWith("trunk"))];
  return trunk.trunk_height.range_min ?? trunk.trunk_height.base;
};

function plantSapling(x = 0, tree = "mandarin") {
  __place(overworld, at(x, 63), "minecraft:grass_block");
  return __place(overworld, at(x), r(`${tree}_sapling`));
}
/** A grown mandarin (mock feature): fruitwood log y64–66, a ring of leaves at y66, a layer at y67. */
function grownMandarin() {
  overworld.biome = "minecraft:swamp";
  tick(plantSapling(), 4);
}
// ## The mock grows the trunk at its shortest height with leaves round the top log, so the test
// ## leaf follows mandarin's trunk height in its feature file.
const MANDARIN_TRUNK = (() => {
  const tree = JSON.parse(readFileSync("packs/BP/features/trees/mandarin_tree_feature.json", "utf8"))["minecraft:tree_feature"];
  const trunk = tree[Object.keys(tree).find((k) => k.endsWith("trunk"))];
  return trunk.trunk_height.range_min ?? trunk.trunk_height.base;
})();
const LEAF = at(1, 64 + MANDARIN_TRUNK - 1);
const UNDER = at(1, 64 + MANDARIN_TRUNK - 2);

test("tree block ids follow the art: <tree>_leaves, fruitwood_log, banana_trunk, <tree>_fruit", () => {
  const ids = new Set(readdirSync("packs/BP/blocks").map((f) => f.replace(/\.json$/, "")));
  for (const t of TREES) {
    assert(ids.has(`${t.id}_leaves`), `${t.id}_leaves`);
    assert(!ids.has(`${t.id}_fruit_leaves`), `${t.id}_fruit_leaves is gone`);
    equal(ids.has(`${t.id}_fruit`), !t.bark, `${t.id}_fruit block`);
  }
  assert(ids.has("fruitwood_log") && ids.has("banana_trunk") && !ids.has("fruit_log"), "trunks");
  equal(blockDef("mandarin_leaves").description.states[S("blossom")][0], false, "leaves are bare by default");
  for (const dir of ["packs/BP/features/trees", "packs/BP/feature_rules/trees"])
    for (const file of readdirSync(dir))
      for (const [, id] of readFileSync(`${dir}/${file}`, "utf8").matchAll(/"kaleidoscope_harvest:([a-z0-9_]+)"/g))
        if (!/_tree_feature(_rule)?$/.test(id)) assert(ids.has(id), `${file} names ${id}, which is a block`);
  const lang = readFileSync("packs/RP/texts/en_US.lang", "utf8");
  assert(lang.includes("tile.kaleidoscope_harvest:fruitwood_log.name=Fruitwood Log") && lang.includes("tile.kaleidoscope_harvest:mandarin_leaves.name="), "names");
  // ## The old names were <tree>_fruit_leaves (star_fruit_leaves is a 1.1 tree's leaves, not one of them).
  for (const t of TREES) assert(!lang.includes(`:${t.id}_fruit_leaves`), `no old name ${t.id}_fruit_leaves left`);
  assert(!lang.includes(":fruit_log"), "no old log name left");
});

test("a grown sapling places its tree feature where it stands", () => {
  grownMandarin();
  equal(overworld.placedFeatures.at(-1)?.name, r("mandarin_tree_feature"), "feature");
  equal(JSON.stringify(overworld.placedFeatures.at(-1).location), JSON.stringify(at(0)), "at the sapling");
  equal(overworld.getBlock(at(0)).typeId, r("fruitwood_log"), "trunk took the sapling's place");
  equal(overworld.getBlock(LEAF).typeId, r("mandarin_leaves"), "leaves");
  equal(blossom(overworld.getBlock(LEAF)), false, "bare leaves");
  equal(overworld.sounds.at(-1).id, "block.azalea.place", "sound");
});

test("when placeFeature fails the sapling stays and tries again later", () => {
  overworld.biome = "minecraft:swamp";
  overworld.featureFails = true;
  let sapling = tick(plantSapling(), 10);
  equal(sapling.typeId, r("mandarin_sapling"), "still a sapling");
  equal(growth(sapling), 3, "waiting at its last stage");
  overworld.featureFails = false;
  sapling = tick(sapling, 1);
  equal(sapling.typeId, r("fruitwood_log"), "grew once it could");
});

test("a sapling with something in the way waits", () => {
  overworld.biome = "minecraft:swamp";
  __place(overworld, LEAF, "minecraft:stone");
  const sapling = tick(plantSapling(), 10);
  equal(sapling.typeId, r("mandarin_sapling"), "still a sapling");
});

test("bone meal moves a sapling on one stage only", () => {
  overworld.biome = "minecraft:swamp";
  const p = player("minecraft:bone_meal", 5);
  __interact(p, plantSapling());
  equal(growth(overworld.getBlock(at(0))), 1, "one stage");
});

test("bone meal grows a sapling in a biome its tree does not like (it would not grow there by itself)", () => {
  overworld.biome = "minecraft:snowy_plains";
  let sapling = tick(plantSapling(), 20);
  equal(growth(sapling), 0, "no growth of its own off-climate");
  const p = player("minecraft:bone_meal", 5);
  for (let i = 0; i < 4; i++) __interact(p, overworld.getBlock(at(0)));
  equal(overworld.getBlock(at(0)).typeId, r("fruitwood_log"), "four bone meal: a tree");
  equal(p.hand.amount, 1, "four used");
});

test("bone meal is not used up when the tree cannot be placed", () => {
  overworld.biome = "minecraft:swamp";
  const p = player("minecraft:bone_meal", 5);
  plantSapling();
  for (let i = 0; i < 3; i++) __interact(p, overworld.getBlock(at(0)));
  overworld.featureFails = true;
  __interact(p, overworld.getBlock(at(0)));
  equal(overworld.getBlock(at(0)).typeId, r("mandarin_sapling"), "still a sapling");
  equal(p.hand.amount, 2, "the failed try cost nothing");
  overworld.featureFails = false;
});

test("blossoming leaves hang a small green fruit below them, only into air", () => {
  grownMandarin();
  let leaf = tick(overworld.getBlock(LEAF), 1);
  equal(blossom(leaf), true, "blossom");
  __place(overworld, UNDER, "minecraft:stone");
  leaf = tick(leaf, 5);
  equal(overworld.getBlock(UNDER).typeId, "minecraft:stone", "no fruit into stone");
  equal(blossom(leaf), true, "still in blossom");
  overworld.getBlock(UNDER).setType("minecraft:air");
  leaf = tick(leaf, 1);
  const fruit = overworld.getBlock(UNDER);
  equal(fruit.typeId, r("mandarin_fruit"), "fruit below");
  equal(growth(fruit), 0, "small green");
  equal(blossom(leaf), false, "leaf back to bare");
  // Leaves with a leaf below (the top layer over the ring round the top log) blossom but never fruit.
  const top = tick(overworld.getBlock(at(1, 64 + MANDARIN_TRUNK)), 5);
  equal(blossom(top), true, "top leaf in blossom");
  equal(overworld.getBlock(LEAF).typeId, r("mandarin_leaves"), "nothing replaced the leaf below");
});

test("hanging fruit grows small green → big green → ripe, each stage its own bone", () => {
  grownMandarin();
  tick(overworld.getBlock(LEAF), 2);
  let fruit = tick(overworld.getBlock(UNDER), 1);
  equal(growth(fruit), 1, "big green");
  fruit = tick(fruit, 5);
  equal(growth(fruit), 2, "ripe, and no further");
  for (const stage of [0, 1, 2]) {
    const geometry = __componentsOf(BlockPermutation.resolve(r("mandarin_fruit"), { [S("growth")]: stage }))["minecraft:geometry"];
    equal(geometry.identifier, "geometry.kaleidoscope_harvest.mandarin_fruit", "art model");
    for (const bone of [0, 1, 2]) equal(geometry.bone_visibility[`stage${bone}`], bone === stage, `stage ${stage}: bone stage${bone}`);
  }
  const def = blockDef("mandarin_fruit");
  equal(def.components["minecraft:collision_box"], false, "no collision");
  equal(def.components["minecraft:material_instances"]["*"].render_method, "alpha_test", "alpha test");
  equal(JSON.parse(readFileSync("packs/RP/textures/terrain_texture.json", "utf8")).texture_data.kh_mandarin_fruit.textures, "textures/kaleidoscope_harvest/blocks/fruit/mandarin_fruit", "fruit texture");
  assert(readdirSync("packs/RP/textures/kaleidoscope_harvest/blocks/fruit").includes("mandarin_fruit.texture_set.json"), "PBR texture set");
});

test("picking a ripe fruit gives the fruit and removes the block, with no text; the leaf fruits again", () => {
  grownMandarin();
  tick(overworld.getBlock(LEAF), 2);
  const fruit = tick(overworld.getBlock(UNDER), 3);
  __interact(player(), fruit);
  assert(overworld.dropped(r("mandarin")) >= 1, "mandarin picked");
  equal(overworld.getBlock(UNDER).typeId, "minecraft:air", "fruit block gone");
  equal(overworld.sounds.at(-1).id, "block.sweet_berry_bush.pick", "pick sound");
  assert(overworld.particles.some((p) => p.id === "minecraft:villager_happy"), "pick particles");
  equal(world.messages.length, 0, "no chat text");
  tick(overworld.getBlock(LEAF), 2);
  equal(overworld.getBlock(UNDER).typeId, r("mandarin_fruit"), "fruits again");
});

test("an unripe fruit is not picked; bone meal moves it one stage; broken unripe it gives nothing", () => {
  grownMandarin();
  __place(overworld, UNDER, r("mandarin_fruit"));
  __interact(player(), overworld.getBlock(UNDER));
  equal(overworld.dropped(r("mandarin")), 0, "nothing picked");
  equal(growth(overworld.getBlock(UNDER)), 0, "unchanged");
  __interact(player("minecraft:bone_meal", 2), overworld.getBlock(UNDER));
  equal(growth(overworld.getBlock(UNDER)), 1, "bone meal: one stage");
  __break(player(), overworld.getBlock(UNDER));
  equal(overworld.dropped(r("mandarin")), 0, "unripe gives nothing");
  equal(overworld.dropped(r("mandarin_fruit")), 0, "and not itself");
});

test("a fruit falls when the leaves above it go; a ripe one still gives its fruit", () => {
  grownMandarin();
  __place(overworld, UNDER, r("mandarin_fruit"), { [S("growth")]: 2 });
  __break(player(), overworld.getBlock(LEAF));
  equal(overworld.getBlock(UNDER).typeId, "minecraft:air", "ripe fruit fell with its leaf");
  equal(overworld.dropped(r("mandarin")), 1, "and gave its fruit");
  // Leaves gone without a break event (an explosion, a command): the fruit's own tick notices.
  __place(overworld, at(-1, 65), r("mandarin_fruit"));
  overworld.getBlock(at(-1, 66)).setType("minecraft:air");
  tick(overworld.getBlock(at(-1, 65)), 1);
  equal(overworld.getBlock(at(-1, 65)).typeId, "minecraft:air", "unripe fruit fell");
  equal(overworld.dropped(r("mandarin")), 1, "and gave nothing");
  const filter = blockDef("mandarin_fruit").components["minecraft:placement_filter"].conditions[0];
  equal(JSON.stringify(filter), JSON.stringify({ allowed_faces: ["down"], block_filter: [r("mandarin_leaves")] }), "only under its own leaves");
});

test("off-climate leaves turn grey and do not blossom; fruit off its climate stops growing", () => {
  grownMandarin();
  overworld.biome = "minecraft:snowy_plains";
  const leaf = tick(overworld.getBlock(LEAF), 5);
  equal(leaf.permutation.getState(S("off_climate")), true, "grey");
  equal(blossom(leaf), false, "no blossom");
  const underRing = at(-1, 64 + MANDARIN_TRUNK - 2);
  __place(overworld, underRing, r("mandarin_fruit"));
  equal(growth(tick(overworld.getBlock(underRing), 5)), 0, "fruit waits");
});

test("bone meal on leaves: bare → blossom, then a fruit below", () => {
  grownMandarin();
  const p = player("minecraft:bone_meal", 3);
  __interact(p, overworld.getBlock(LEAF));
  equal(blossom(overworld.getBlock(LEAF)), true, "blossom");
  __interact(p, overworld.getBlock(LEAF));
  equal(overworld.getBlock(UNDER).typeId, r("mandarin_fruit"), "fruit");
  equal(p.hand.amount, 1, "two bone meal used");
});

test("chopping the trunk away makes the leaves fall", () => {
  grownMandarin();
  for (let y = 64; y < 64 + MANDARIN_TRUNK; y++) __break(player("minecraft:iron_axe"), overworld.getBlock(at(0, y)));
  equal(overworld.dropped(r("fruitwood_log")), MANDARIN_TRUNK, "logs dropped");
  tick(overworld.getBlock(LEAF), 1);
  equal(overworld.getBlock(LEAF).typeId, "minecraft:air", "leaf fell");
});

test("cinnamon has no fruit block: its flushed leaves give bark and go back to bare", () => {
  overworld.biome = "minecraft:swamp";
  tick(plantSapling(0, "cinnamon"), 4);
  const h = trunkHeight(TREES.find((t) => t.id === "cinnamon"));
  const leafAt = at(1, 64 + h - 1);
  const leaf = tick(overworld.getBlock(leafAt), 5);
  equal(blossom(leaf), true, "red-brown flush");
  equal(overworld.getBlock(at(1, 64 + h - 2)).typeId, "minecraft:air", "nothing hangs below");
  __interact(player(), leaf);
  equal(overworld.dropped(r("cinnamon_bark")), 1, "a piece of bark");
  equal(blossom(overworld.getBlock(leafAt)), false, "back to bare");
  assert(!readdirSync("packs/BP/blocks").includes("cinnamon_fruit.json"), "no cinnamon fruit block");
});

test("every fruit tree grows by its own feature and fruits (cinnamon: bark)", () => {
  for (const t of TREES) {
    __reset();
    setRandom(() => 0);
    overworld.biome = { cold: "minecraft:taiga", temperate: "minecraft:forest", warm: "minecraft:swamp", hot: "minecraft:jungle" }[t.climate];
    tick(plantSapling(0, t.id), 4);
    equal(overworld.placedFeatures.at(-1)?.name, r(`${t.id}_tree_feature`), `${t.id}: feature`);
    equal(overworld.getBlock(at(0)).typeId, r(t.trunk), `${t.id}: trunk`);
    const h = trunkHeight(t);
    const leaf = tick(overworld.getBlock(at(1, 64 + h - 1)), 2);
    if (t.bark) __interact(player(), leaf);
    else __interact(player(), tick(overworld.getBlock(at(1, 64 + h - 2)), 2));
    assert(overworld.dropped(r(t.fruit)) >= 1, `${t.id}: picked ${t.fruit}`);
  }
});

test("a banana's leaves fall when its trunk is chopped", () => {
  overworld.biome = "minecraft:jungle";
  tick(plantSapling(0, "banana"), 4);
  const h = trunkHeight(TREES.find((t) => t.id === "banana"));
  for (let y = 0; y < h; y++) __break(player("minecraft:iron_axe"), overworld.getBlock(at(0, 64 + y)));
  equal(overworld.dropped(r("banana_trunk")), h, "trunk dropped");
  tick(overworld.getBlock(at(0, 64 + h)), 1);
  equal(overworld.getBlock(at(0, 64 + h)).typeId, "minecraft:air", "crown fell");
});

test("wild fruit trees come from feature_rules/trees and wild saplings; mandarins come from villages", () => {
  const rules = readdirSync("packs/BP/feature_rules/trees");
  for (const t of TREES) {
    const file = `${t.id}_tree_feature_rule.json`;
    // ## Every tree has a rule: the game only registers a feature a rule references. A tree with
    // ## no wild spawn (mandarin) gets one whose biome tag no biome has, so it never places.
    assert(rules.includes(file), `${t.id}: tree rule`);
    const filter = JSON.stringify(JSON.parse(readFileSync(`packs/BP/feature_rules/trees/${file}`, "utf8"))["minecraft:feature_rules"].conditions["minecraft:biome_filter"]);
    equal(filter.includes("kaleidoscope_harvest_never"), !t.wild, `${t.id}: rule never places only without a wild spawn`);
    if (rules.includes(file)) equal(JSON.parse(readFileSync(`packs/BP/feature_rules/trees/${file}`, "utf8"))["minecraft:feature_rules"].description.places_feature, r(`${t.id}_tree_feature`), `${t.id}: rule places the tree`);
  }
  const saplingRules = readdirSync("packs/BP/feature_rules/wild").filter((f) => f.includes("_sapling_"));
  for (const t of TREES) {
    const mine = saplingRules.filter((f) => f.startsWith(`wild_${t.id}_sapling_`));
    assert(t.wild ? mine.length > 0 : mine.length === 0, `${t.id}: wild sapling rules`);
    for (const file of mine) {
      const rule = JSON.parse(readFileSync(`packs/BP/feature_rules/wild/${file}`, "utf8"))["minecraft:feature_rules"];
      const search = JSON.parse(readFileSync(`packs/BP/features/wild/${rule.description.places_feature.split(":")[1]}.json`, "utf8"))["minecraft:search_feature"];
      const single = JSON.parse(readFileSync(`packs/BP/features/wild/${search.places_feature.split(":")[1]}.json`, "utf8"))["minecraft:single_block_feature"];
      equal(single.places_block.name, r(`${t.id}_sapling`), `${file} places the sapling`);
    }
  }
  const plains = JSON.parse(readFileSync("packs/BP/loot_tables/chests/village/village_plains_house.json", "utf8")).pools.at(-1);
  assert(plains.entries.some((e) => e.name === r("grape_cutting")), "grape cuttings in plains houses");
  assert(plains.entries.some((e) => e.name === r("mandarin_sapling")), "mandarin saplings in plains houses");
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
    // ## By name, biome by biome: wild_garlic_ is also the start of wild_garlic_chives_ (1.1).
    const all = readdirSync("packs/BP/feature_rules/wild");
    const rules = crop.wild.biomes.map((biome) => `${wild}_${biome}.json`).filter((f) => all.includes(f));
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

test("grapes grow on a Bamboo Trellis from a cutting", () => {
  __place(overworld, at(0, 63), "minecraft:farmland");
  __interact(player(r("grape_cutting")), __place(overworld, at(0), r("bamboo_trellis")));
  const vine = tick(overworld.getBlock(at(0)), 40);
  equal(vine.typeId, r("grape_crop"), "planted");
  __interact(player(), vine);
  assert(overworld.dropped(r("grape")) >= 2, "grapes picked");
});

test("crops use the art's models: one bone per drawn stage, state 0–7 → stage floor(state / 2)", () => {
  const terrain = JSON.parse(readFileSync("packs/RP/textures/terrain_texture.json", "utf8")).texture_data;
  const look = (id, states) => __componentsOf(BlockPermutation.resolve(r(id), Object.fromEntries(Object.entries(states).map(([k, v]) => [S(k), v]))));
  for (let s = 0; s <= 7; s++) {
    const c = look("napa_cabbage_crop", { growth: s });
    equal(c["minecraft:geometry"].identifier, "geometry.kaleidoscope_harvest.napa_cabbage_crop", "crop model");
    for (let n = 0; n < 4; n++) equal(c["minecraft:geometry"].bone_visibility[`stage${n}`], n === Math.floor(s / 2), `state ${s}: bone stage${n}`);
    equal(c["minecraft:material_instances"][`stage${Math.floor(s / 2)}`].texture, `kh_napa_cabbage_stage_${Math.floor(s / 2)}`, `state ${s}: texture`);
  }
  equal(terrain.kh_corn_stage_3.textures, "textures/kaleidoscope_harvest/blocks/crops/corn_stage_3", "drawn stage texture");
  equal(look("napa_cabbage_crop", { growth: 7, off_climate: true })["minecraft:material_instances"].stage3.texture, "kh_napa_cabbage_stage_3_grey", "grey when off climate");
  assert(terrain.kh_corn_stage_3_grey.textures.startsWith("textures/blocks/"), "grey copy made from the art");
  assert(readdirSync("packs/RP/textures/kaleidoscope_harvest/blocks/crops").includes("corn_stage_3.texture_set.json"), "PBR texture set");

  const upper = look("corn_crop", { growth: 6, upper: true });
  equal(upper["minecraft:geometry"].identifier, "geometry.kaleidoscope_harvest.corn_upper", "corn upper model");
  equal(JSON.stringify(upper["minecraft:geometry"].bone_visibility), JSON.stringify({ stage2: false, stage3: true }), "upper bones");
  equal(upper["minecraft:material_instances"].stage3.texture, "kh_corn_upper_stage_3", "upper texture");
  equal(look("corn_crop", { growth: 6 })["minecraft:geometry"].identifier, "geometry.kaleidoscope_harvest.corn_crop", "corn lower model");

  const grape = look("grape_crop", { growth: 2 });
  equal(grape["minecraft:geometry"].identifier, "geometry.kaleidoscope_harvest.bamboo_trellis_grape", "vine on its trellis model");
  equal(grape["minecraft:material_instances"].trellis.texture, "kh_station_bamboo_trellis", "trellis frame");
  equal(grape["minecraft:material_instances"].stage1.texture, "kh_grape_stage_1", "vine stage");
  equal(look("blueberry_crop", { growth: 0 })["minecraft:geometry"].identifier, "geometry.kaleidoscope_harvest.blueberry_crop", "shrub model");

  const sapling = blockDef("mandarin_sapling").components;
  equal(sapling["minecraft:geometry"], "geometry.kaleidoscope_harvest.sapling", "sapling model");
  equal(sapling["minecraft:material_instances"].sapling.texture, "kh_mandarin_sapling", "sapling texture");
  equal(terrain.kh_mandarin_sapling.textures, "textures/kaleidoscope_harvest/blocks/saplings/mandarin_sapling", "drawn sapling");
  equal(terrain.kh_mandarin_leaves_blossom.textures, "textures/kaleidoscope_harvest/blocks/trees/mandarin_leaves_blossom", "leaf art");
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

test("juicer: Tavern's grape counts as a grape (1.2) and comes back out as Tavern's", () => {
  const T = "kaleidoscope_tavern:grape";
  __place(overworld, at(0), r("juicer"));
  __interact(player(T), overworld.getBlock(at(0)));
  equal(overworld.getBlock(at(0)).permutation.getState(S("juice")), "grape", "jug shows grape");
  __interact(player(r("grape")), overworld.getBlock(at(0)));
  __interact(player("minecraft:glass_bottle"), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("grape_juice")), 1, "a Tavern and a Harvest grape make grape juice");
  __interact(player(T), overworld.getBlock(at(0)));
  __interact(player(r("mandarin")), overworld.getBlock(at(0)));
  __interact(player(null), overworld.getBlock(at(0)));
  equal(overworld.dropped(T), 1, "an empty hand gives Tavern's grape back as it was");
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

// --- Station display entities (docs/superpowers/specs/2026-11-17-station-animations-design.md) ---------------
const visuals = (type) => overworld.getEntities({ type: r(type) });
const prop = (entity, name) => entity.getProperty(S(name));

test("juicer visual: placing spawns one; fruit and pours drive level, colour and splashes", () => {
  __placeByPlayer(overworld, at(0), r("juicer"));
  equal(visuals("juicer_visual").length, 1, "spawned on place");
  const v = visuals("juicer_visual")[0];
  equal(v.location.x, 0.5, "stands at the block centre");
  equal(v.location.y, 64, "on the block floor");
  equal(prop(v, "level"), 0, "empty");
  __interact(player(r("grape"), 2), overworld.getBlock(at(0)));
  equal(prop(v, "level"), 1, "one fruit: half full");
  equal(prop(v, "juice"), 2, "grape colour index");
  const splash = overworld.particles.filter((p) => p.id === r("splash"));
  equal(splash.length, 1, "a splash when the fruit goes in");
  equal(splash[0].variables["variable.color"].red, 0.41, "grape-coloured drops");
  __interact(player(r("grape")), overworld.getBlock(at(0)));
  equal(prop(v, "level"), 2, "full");
  __interact(player("minecraft:glass_bottle"), overworld.getBlock(at(0)));
  equal(prop(v, "level"), 0, "poured out");
  equal(prop(v, "juice"), 0, "no colour left");
  equal(overworld.particles.filter((p) => p.id === r("splash")).length, 3, "a splash on the pour too");
  equal(visuals("juicer_visual").length, 1, "still one entity");
});

test("juicer visual: breaking removes it; a random tick brings back a missing one and removes extras", () => {
  const juicer = __place(overworld, at(0), r("juicer"), { [S("fruit")]: 1, [S("juice")]: "mango" });
  equal(visuals("juicer_visual").length, 0, "an old-world juicer has none yet");
  __randomTick(juicer);
  equal(visuals("juicer_visual").length, 1, "random tick spawns it");
  equal(prop(visuals("juicer_visual")[0], "juice"), 3, "and copies the block's state");
  overworld.spawnEntity(r("juicer_visual"), { x: 0.5, y: 64, z: 0.5 });
  __randomTick(overworld.getBlock(at(0)));
  equal(visuals("juicer_visual").length, 1, "duplicate removed");
  __break(player(), overworld.getBlock(at(0)));
  equal(visuals("juicer_visual").length, 0, "gone with the block");
});

test("pickling jar visual: stage follows fill, seal, done and open", () => {
  __placeByPlayer(overworld, at(0), r("pickling_jar"));
  const v = visuals("pickling_jar_visual")[0];
  equal(prop(v, "stage"), 0, "empty");
  const p = player(r("napa_cabbage"), 2);
  __interact(p, overworld.getBlock(at(0)));
  __interact(p, overworld.getBlock(at(0)));
  equal(prop(v, "stage"), 1, "fresh");
  __interact(player(), overworld.getBlock(at(0)));
  equal(prop(v, "stage"), 2, "sealed: fermenting");
  __skipTime(24000);
  __randomTick(overworld.getBlock(at(0)));
  equal(prop(v, "stage"), 3, "done");
  __interact(player(), overworld.getBlock(at(0)));
  equal(prop(v, "stage"), 0, "opened");
  __break(player(), overworld.getBlock(at(0)));
  equal(visuals("pickling_jar_visual").length, 0, "gone with the block");
});

test("station visuals: the sweep removes entities left without their block", () => {
  __placeByPlayer(overworld, at(0), r("pickling_jar"));
  __placeByPlayer(overworld, at(3), r("juicer"));
  overworld.getBlock(at(0)).setType("minecraft:air"); // blown up: no break event
  __advance(5 * 20);
  equal(visuals("pickling_jar_visual").length, 0, "orphan swept");
  equal(visuals("juicer_visual").length, 1, "the juicer's stays");
});

test("station visuals: entity, client entity, model, animations and particles all line up", () => {
  for (const name of ["juicer_visual", "pickling_jar_visual"]) {
    const bp = JSON.parse(readFileSync(`packs/BP/entities/${name}.json`, "utf8"))["minecraft:entity"];
    const rp = JSON.parse(readFileSync(`packs/RP/entity/${name}.entity.json`, "utf8"))["minecraft:client_entity"].description;
    equal(rp.identifier, bp.description.identifier, `${name} ids`);
    for (const [prop, def] of Object.entries(bp.description.properties)) assert(def.client_sync, `${prop} reaches the client`);
    const geo = JSON.parse(readFileSync(`packs/RP/models/entity/${name}.geo.json`, "utf8"))["minecraft:geometry"][0];
    equal(geo.description.identifier, rp.geometry.default, `${name} geometry`);
    const bones = new Set(geo.bones.map((b) => b.name));
    const anims = JSON.parse(readFileSync(`packs/RP/animations/${name}.animation.json`, "utf8")).animations;
    for (const id of Object.values(rp.animations)) {
      assert(anims[id], `${id} defined`);
      for (const bone of Object.keys(anims[id].bones ?? {})) assert(bones.has(bone), `${id} moves ${bone}, which the model has`);
      for (const fx of Object.values(anims[id].particle_effects ?? {})) {
        assert(rp.particle_effects?.[fx.effect], `${fx.effect} named in the client entity`);
        assert(geo.bones.some((b) => b.locators?.[fx.locator]), `locator ${fx.locator}`);
      }
    }
    for (const fx of Object.values(rp.particle_effects ?? {})) assert(readdirSync("packs/RP/particles").includes(`${fx.split(":")[1]}.json`), `${fx} file`);
  }
  assert(readdirSync("packs/RP/particles").includes("splash.json"), "splash particle file");
  const juicer = JSON.parse(readFileSync("packs/BP/blocks/juicer.json", "utf8"))["minecraft:block"].components;
  equal(juicer["minecraft:movable"].movement_type, "immovable", "pistons cannot split block and entity");
});

// --- Placeable food (docs/superpowers/specs/2026-11-17-placeable-food-design.md) -----------------------------------
const { PLACED_FOODS } = await import("../../packs/BP/scripts/data/placedFood.js");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const lootItems = (path) => (path ? json(`packs/BP/${path}`).pools.flatMap((p) => p.entries.map((e) => e.name)) : []);

test("placed food: the foods of the design (21 in 1.0, 13 more in 1.1), each a block with the item's id", () => {
  // ## 1.0's 21 (6 pots, 3 desserts, 8 drinks, 4 teas) and 1.1's 13 (5 pots, 2 desserts, 4 drinks, 2 teas).
  equal(PLACED_FOODS.length, 34, "1.0's 21 and 1.1's 13");
  for (const [shape, n] of [["pot", 11], ["pie", 1], ["cakes", 3], ["platter", 1], ["bottle", 9], ["wine", 3], ["teacup", 6]]) equal(PLACED_FOODS.filter((f) => f.shape === shape).length, n, `${shape} count`);
  for (const { item } of PLACED_FOODS) {
    const it = json(`packs/BP/items/${item}.json`)["minecraft:item"].components;
    equal(it["minecraft:block_placer"]?.block, r(item), `${item} places its block`);
    equal(it["minecraft:block_placer"].replace_block_item, true, `${item} is the block's item`);
    assert(it["minecraft:tags"].tags.includes("kaleidoscope_cookery:placeable_food"), `${item} has Cookery's placeable_food tag`);
    assert(it["minecraft:food"], `${item} can still be eaten in hand`);
    const b = json(`packs/BP/blocks/${item}.json`)["minecraft:block"];
    equal(b.description.identifier, r(item), `${item} block id`);
    assert(b.components["kaleidoscope_cookery:placeable_food_placement_guard"], `${item} honours Cookery's sneak-to-place setting`);
    equal(b.description.traits["minecraft:placement_direction"].y_rotation_offset, 180, `${item} faces the player`);
  }
});

test("placed food: pots, desserts and drinks use Cookery's food_bite with a fair bite and their container", () => {
  for (const { item, bites } of PLACED_FOODS.filter((f) => f.bites > 0)) {
    const food = json(`packs/BP/items/${item}.json`)["minecraft:item"].components["minecraft:food"];
    const b = json(`packs/BP/blocks/${item}.json`)["minecraft:block"];
    const bite = b.components["kaleidoscope_cookery:food_bite"];
    equal(bite.state, "kaleidoscope_cookery:food_stage", `${item} stage state`);
    equal(bite.max_stage, bites, `${item} bites`);
    equal(bite.nutrition, Math.ceil(food.nutrition / bites), `${item} hunger per bite`);
    equal(bite.saturation_modifier, food.saturation_modifier, `${item} saturation`);
    equal(bite.always_eat, true, `${item} can be eaten when full, as in hand`);
    equal(JSON.stringify(bite.return_items ?? []), JSON.stringify(food.using_converts_to ? [food.using_converts_to] : []), `${item} gives back its container`);
    equal(b.description.states["kaleidoscope_cookery:food_stage"].values.max, bites, `${item} stage range`);
    assert(lootItems(b.components["minecraft:loot"]).includes(r(item)), `${item} untouched: the whole dish back`);
    const started = b.permutations.find((p) => p.condition.includes("food_stage") && p.condition.endsWith("== 1"));
    equal(JSON.stringify(lootItems(started.components["minecraft:loot"])), JSON.stringify(food.using_converts_to ? [food.using_converts_to] : []), `${item} started: only the container`);
  }
  equal(PLACED_FOODS.filter((f) => f.shape === "bottle" || f.shape === "wine").every((f) => f.bites === 1), true, "drinks are drunk in one");
});

test("placed food: teas use Cookery's cup_stack like Herbal's", () => {
  for (const { item } of PLACED_FOODS.filter((f) => f.shape === "teacup")) {
    const b = json(`packs/BP/blocks/${item}.json`)["minecraft:block"];
    const cups = b.components["kaleidoscope_cookery:cup_stack"];
    equal(cups.filled, true, `${item} filled`);
    equal(cups.item, r(item), `${item} stacks with itself`);
    equal(cups.empty_item, "kaleidoscope_cookery:empty_cup", `${item} cup`);
    equal(cups.max_count, 4, `${item} four cups`);
    for (const s of ["cup_count", "tea_count"]) equal(b.description.states[`kaleidoscope_cookery:${s}`].values.max, 4, `${item} ${s}`);
    equal(lootItems(b.components["minecraft:loot"]).length, 0, `${item}: cup_stack drops the cups, not the loot`);
  }
});

test("placed food: every state has its model, every model its texture, and states cover every stage", () => {
  const models = new Map(readdirSync("packs/RP/models/blocks").filter((f) => f.startsWith("food_")).map((f) => {
    const geo = json(`packs/RP/models/blocks/${f}`)["minecraft:geometry"][0];
    return [geo.description.identifier, geo];
  }));
  for (const { item, bites, shape } of PLACED_FOODS) {
    const b = json(`packs/BP/blocks/${item}.json`)["minecraft:block"];
    const geos = [b.components["minecraft:geometry"], ...b.permutations.map((p) => p.components["minecraft:geometry"]).filter(Boolean)];
    for (const id of geos) assert(models.has(id), `${item}: model ${id} exists`);
    const states = shape === "teacup" ? 16 : bites + 1;
    equal(b.permutations.filter((p) => p.components["minecraft:geometry"]).length, states, `${item}: a model for every state`);
    const tex = b.components["minecraft:material_instances"]["*"];
    equal(tex.render_method, "alpha_test_single_sided", `${item}: single-sided, as the art kit draws it`);
    assert(readdirSync("packs/RP/textures/kaleidoscope_harvest/blocks/food").includes(`${item}.png`), `${item} texture`);
    assert(json("packs/RP/textures/terrain_texture.json").texture_data[tex.texture], `${item} terrain entry`);
    for (const id of geos) {
      const geo = models.get(id);
      const png = readFileSync(`packs/RP/textures/kaleidoscope_harvest/blocks/food/${item}.png`);
      equal(png.readUInt32BE(16), geo.description.texture_width, `${item}: ${id} texture width`);
      equal(png.readUInt32BE(20), geo.description.texture_height, `${item}: ${id} texture height`);
    }
  }
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

test("Cookery: Tavern's grape dries into raisins too, sent only when Tavern is installed (1.2)", () => {
  equal(partnerRows().length, 0, "no Tavern: nothing extra");
  mc.__addItemType("kaleidoscope_tavern:grape");
  const rows = partnerRows();
  assert(rows.length >= 1, "a row for each grape recipe");
  const tray = recipePayload(rows.find((row) => row.station === "bamboo_tray"));
  equal(tray.recipe.input, "kaleidoscope_tavern:grape", "Tavern's grape");
  equal(tray.recipe.result, r("raisins"), "raisins");
  equal(tray.recipe.id, `${NS}:bamboo_tray/raisins_from_tavern_grape`, "its own id, apart from Harvest's grape");
  mc.__reset();
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
  for (const id of ["bamboo_trellis", "mandarin_sapling", "fruitwood_log", "fruitwood_planks", "banana_trunk", "fruit_picking_pole", "harvest_basket", "produce_crate"]) assert(ids.has(id), `no entry for ${id}`);
  for (const crop of CROPS) assert(ids.has(crop.seed), `no entry for ${crop.seed}`);
});

// --- M5: partner packs ----------------------------------------------------------------------------------------

const { feedPayloads, __resetRanching } = await import("../../packs/BP/scripts/api/ranching.js");
const { herbalMessages, __resetHerbal } = await import("../../packs/BP/scripts/api/herbal.js");
const { tavernClient } = await import("../../packs/BP/scripts/api/tavern.js");
const { tavernPayload } = await import("../../packs/BP/scripts/data/tavern.js");
const { packetsFor } = await import("../../packs/BP/scripts/api/tavernSdk/protocol.js");
const { canonical, utf8Bytes } = await import("../../packs/BP/scripts/api/tavernSdk/util.js");
const { RANCHING_FEEDS, HERBAL_HEAT, HERBAL_ADJUVANTS, TAVERN_WINES } = await import("../../packs/BP/scripts/data/integrations.js");
const { langProblems } = await import("../lang.mjs");
const { hardOutliers } = await import("../balance.mjs");

/** Script events carry at most 2048 characters (Ranching and Herbal docs/API.md). */
const SCRIPT_EVENT_LIMIT = 2048;
const sent = (id) => system.sentEvents.filter((e) => e.id === id);
const sentJson = (id) => sent(id).map((e) => JSON.parse(e.message));
/** Runs body and returns what it wrote to console.warn. */
function warnings(body) {
  const original = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.join(" "));
  try {
    body();
  } finally {
    console.warn = original;
  }
  return lines;
}
const fire = (id, message, sourceType = "Server") => system.afterEvents.scriptEventReceive.fire({ id, message: typeof message === "string" ? message : JSON.stringify(message), sourceType });

test("startup pings Ranching, Herbal and Tavern, and registers nothing before they answer", () => {
  for (const id of ["kaleidoscope_ranching:api_ping", "kaleidoscope_herbal:api_ping", "kaleidoscope_tavern:api_ping"]) assert(STARTUP.includes(id), `${id} sent at startup`);
  for (const id of ["kaleidoscope_ranching:register_feed", "kaleidoscope_herbal:heat_register", "kaleidoscope_herbal:adjuvant_register", "kaleidoscope_tavern:extension_begin"]) assert(!STARTUP.includes(id), `${id} waits for api_ready`);
});

test("Ranching: feeds go out only once api_ready lists register_feed", () => {
  __resetRanching();
  system.sendScriptEvent("kaleidoscope_ranching:api_ready", JSON.stringify({ api: 1, version: "1.0.0", capabilities: ["register_animal", "api_result"] }));
  equal(sent("kaleidoscope_ranching:register_feed").length, 0, "no register_feed without the capability");
  system.sendScriptEvent("kaleidoscope_ranching:api_ready", "not json");
  equal(sent("kaleidoscope_ranching:register_feed").length, 0, "a broken api_ready is ignored");
  system.sendScriptEvent("kaleidoscope_ranching:api_ready", JSON.stringify({ api: 1, version: "1.1.0", capabilities: ["register_feed", "api_result", "feed_1_1"] }));
  const feeds = sentJson("kaleidoscope_ranching:register_feed");
  equal(feeds.length, RANCHING_FEEDS.length, "one message per feed");
  for (const feed of feeds) {
    assert(feed.item.startsWith(`${NS}:`), `${feed.item} is in Harvest's namespace`);
    assert(["grass", "grain", "veg", "mixed", "concentrate", "ruminant"].includes(feed.kind), `${feed.item} kind`);
    assert(Number.isInteger(feed.units) && feed.units >= 1 && feed.units <= 9, `${feed.item} units`);
  }
  for (const e of sent("kaleidoscope_ranching:register_feed")) assert(e.message.length < SCRIPT_EVENT_LIMIT, "under 2048 characters");
  const corn = feeds.find((f) => f.item === r("corn"));
  equal(corn.kind, "grain", "corn is grain");
  equal(corn.units, 2, "corn counts twice");
  equal(feeds.find((f) => f.item === r("okara")).kind, "mixed", "okara is mixed feed");
  // ## Registering again on the next api_ready is safe (Ranching docs/API.md).
  system.sendScriptEvent("kaleidoscope_ranching:api_ready", JSON.stringify({ api: 1, capabilities: ["register_feed"] }));
  equal(sent("kaleidoscope_ranching:register_feed").length, 2 * RANCHING_FEEDS.length, "sent again on the second api_ready");
  equal(feedPayloads([]).length, 0, "no capabilities, no feeds");
});

test("Ranching: only Harvest's own refusals are logged, once, and never shown to players", () => {
  __resetRanching();
  const lines = warnings(() => {
    fire("kaleidoscope_ranching:api_result", { event: "register_feed", id: "other_pack:oats", ok: false, error: "nope" });
    fire("kaleidoscope_ranching:api_result", { event: "register_feed", id: r("corn"), ok: true });
    fire("kaleidoscope_ranching:api_result", { event: "register_feed", id: r("okara"), ok: false, error: "unknown feed kind" });
    fire("kaleidoscope_ranching:api_result", { event: "register_feed", id: r("okara"), ok: false, error: "unknown feed kind" });
    fire("kaleidoscope_ranching:api_result", "{broken");
  });
  equal(lines.length, 1, "one log line");
  assert(lines[0].includes(r("okara")) && !lines[0].includes("other_pack"), "about our okara only");
  equal(world.messages.length, 0, "no chat text");
});

test("Herbal: heat and adjuvants wait for API 1 and their capabilities", () => {
  __resetHerbal();
  fire("kaleidoscope_herbal:api_ready", { api: 2, capabilities: ["external_heat", "external_adjuvants"] });
  fire("kaleidoscope_herbal:api_ready", { api: 1, source: "kaleidoscope_herbal", capabilities: ["events"] });
  equal(sent("kaleidoscope_herbal:heat_register").length + sent("kaleidoscope_herbal:adjuvant_register").length, 0, "nothing without the capabilities");
  fire("kaleidoscope_herbal:api_ready", { api: 1, source: "kaleidoscope_herbal", capabilities: ["external_heat"] });
  assert(sent("kaleidoscope_herbal:heat_register").length >= 1, "heat sent");
  equal(sent("kaleidoscope_herbal:adjuvant_register").length, 0, "no adjuvants without external_adjuvants");
  system.sentEvents = [];
  fire("kaleidoscope_herbal:api_ready", { api: 1, source: "kaleidoscope_herbal", version: "1.1.0", capabilities: ["external_heat", "external_adjuvants"], limits: { itemsPerMessage: 32, adjuvantServingsMax: 1 } });
  const heat = sentJson("kaleidoscope_herbal:heat_register").flatMap((m) => {
    equal(m.api, 1, "api");
    equal(m.source, NS, "source");
    return m.items;
  });
  equal(heat.length, HERBAL_HEAT.length, "every heat row");
  for (const row of heat) {
    assert(row.id.startsWith(`${NS}:`), `${row.id} in our namespace`);
    assert(Number.isInteger(row.heat) && row.heat >= -100 && row.heat <= 100 && row.heat !== 0, `${row.id} heat`);
  }
  assert(heat.find((h) => h.id === r("ginger_tea")).heat > 0, "ginger tea warms");
  assert(heat.find((h) => h.id === r("mango_shaved_ice")).heat < 0, "shaved ice cools");
  const adjuvants = sentJson("kaleidoscope_herbal:adjuvant_register").flatMap((m) => m.items);
  equal(adjuvants.map((a) => a.id).sort().join(), [r("cinnamon_bark"), r("dried_tangerine_peel")].join(), "only cinnamon bark and dried tangerine peel");
  assert(adjuvants.every((a) => a.servings === 1), "one serving each");
  for (const e of [...sent("kaleidoscope_herbal:heat_register"), ...sent("kaleidoscope_herbal:adjuvant_register")]) assert(e.message.length < SCRIPT_EVENT_LIMIT, "under 2048 characters");
});

test("Herbal: messages follow limits.itemsPerMessage and stay under 2048 characters", () => {
  const messages = herbalMessages({ api: 1, capabilities: ["external_heat"], limits: { itemsPerMessage: 5 } });
  const items = messages.map(([, m]) => JSON.parse(m).items);
  assert(items.every((batch) => batch.length >= 1 && batch.length <= 5), "at most 5 per message");
  equal(items.flat().length, HERBAL_HEAT.length, "nothing dropped");
  assert(messages.every(([, m]) => m.length < SCRIPT_EVENT_LIMIT), "under 2048 characters");
  equal(herbalMessages(null).length, 0, "nothing before api_ready");
});

test("Herbal: only acks addressed to Harvest, sent by a script, are logged", () => {
  __resetHerbal();
  const lines = warnings(() => {
    fire("kaleidoscope_herbal:heat_ack", { api: 1, to: "other_pack", ok: true, accepted: 0, rejected: [{ id: "other_pack:tea", code: "TAKEN" }] });
    fire("kaleidoscope_herbal:heat_ack", { api: 1, to: NS, ok: true, accepted: 19, rejected: [{ id: r("lychee"), code: "TAKEN" }] }, "Entity");
    fire("kaleidoscope_herbal:heat_ack", { api: 1, to: NS, ok: true, accepted: 19, rejected: [{ id: r("lychee"), code: "TAKEN" }] });
    fire("kaleidoscope_herbal:adjuvant_ack", { api: 1, to: NS, ok: true, accepted: 2, rejected: [] });
    fire("kaleidoscope_herbal:heat_ack", { api: 1, to: NS, ok: true, accepted: 19, rejected: [{ id: r("lychee"), code: "TAKEN" }] });
  });
  equal(lines.length, 1, "one line");
  assert(lines[0].includes(r("lychee")) && lines[0].includes("TAKEN"), "the lychee refusal");
  equal(world.messages.length, 0, "no chat text");
});

test("Tavern: the payload registers every wine (lychee, peach, 1.1 longan) as barrel recipes with pages in three languages", () => {
  const payload = tavernPayload();
  equal(payload.api, 1, "api");
  equal(payload.source, NS, "source");
  const barrels = payload.recipes.filter((rc) => rc.kind === "barrel");
  equal(barrels.length, TAVERN_WINES.length, "one barrel recipe per wine");
  equal(barrels.map((rc) => rc.output.item).sort().join(), [r("longan_wine"), r("lychee_wine"), r("peach_wine")].join(), "longan, lychee and peach wine");
  assert(!JSON.stringify(payload.recipes.map((rc) => rc.output ?? null)).includes("grape"), "no grape wine: that is Tavern's own");
  for (const recipe of barrels) {
    equal(recipe.kind, "barrel", "barrel");
    assert(recipe.id.startsWith(`${NS}:barrel/`), "own recipe id");
    for (const [id] of recipe.ingredients) assert(id.startsWith("minecraft:") || ITEMS.some((i) => r(i.id) === id), `${id} exists`);
    assert(ITEMS.some((i) => r(i.id) === recipe.output.item), "output exists");
  }
  for (const page of payload.pages) for (const locale of ["zh_TW", "zh_CN", "en_US"]) assert(page.title[locale] && page.body[locale], `${page.id} ${locale}`);
  // ## 1.2: Harvest's grape presses into Tavern's own grape juice, at Tavern's own 125 mB.
  const press = payload.recipes.filter((rc) => rc.kind === "pressing");
  equal(press.length, 1, "one pressing recipe");
  equal(press[0].id, r("pressing/grape"), "own id");
  equal(press[0].input.join(), r("grape"), "Harvest's grape");
  equal(press[0].fluid, "kaleidoscope_tavern:grape_juice", "Tavern's grape juice");
  equal(1000 % press[0].amount, 0, "a whole number of grapes fills a bucket");
  assert(payload.requires.includes("pressing_recipes"), "needs the pressing capability");
  assert(payload.pages.some((pg) => pg.item === r("grape") && pg.recipeIds.includes(r("pressing/grape"))), "grape page");
  // ## The pickling jar keeps making them too.
  for (const wine of TAVERN_WINES) assert(RECIPES.some((row) => row.result === wine.id && row.station === "pickling_jar"), `${wine.id} jar recipe`);
});

test("Tavern: packets are begin / chunks / commit, each under the SDK's 1900 bytes, and read back as the payload", () => {
  const packets = packetsFor(tavernPayload(), "r1");
  equal(packets[0].id, "kaleidoscope_tavern:extension_begin", "begin first");
  equal(packets.at(-1).id, "kaleidoscope_tavern:extension_commit", "commit last");
  const begin = JSON.parse(packets[0].message);
  const chunks = packets.slice(1, -1);
  equal(chunks.length, begin.parts, "part count");
  for (const p of packets) assert(utf8Bytes(p.message) <= 1900 && p.message.length < SCRIPT_EVENT_LIMIT, `${p.id} small enough`);
  const data = chunks.map((p) => JSON.parse(p.message)).sort((a, b) => a.index - b.index).map((c) => c.data).join("");
  equal(data, canonical(tavernPayload()), "chunks join back into the payload");
});

test("Tavern: guidebook shows the partner uses, in all three languages", () => {
  const { entries } = guidebookPayload();
  const lines = (id) => entries.find((e) => e.id === r(id)).mechanicsByLocale;
  for (const [id, word] of [["corn", "樂牧"], ["ginger_tea", "草本"], ["dried_tangerine_peel", "佐使"], ["lychee_wine", "酒館"]]) assert(lines(id).zh_TW.some((l) => l.includes(word)), `${id} mentions ${word}`);
  assert(lines("lychee_wine").en_US.some((l) => l.includes("Tavern")), "English line");
  assert(lines("lychee_wine").zh_CN.some((l) => l.includes("酒馆")), "Simplified line");
  for (const e of entries) for (const locale of ["en_US", "zh_TW", "zh_CN"]) equal(e.mechanicsByLocale[locale].length, e.mechanics.length, `${e.id} ${locale} line count`);
});

test("languages: every zh_TW key is in en_US and zh_CN with text, in both packs", () => {
  for (const pack of ["packs/BP", "packs/RP"]) {
    const files = Object.fromEntries(["en_US", "zh_TW", "zh_CN"].map((l) => [l, readFileSync(`${pack}/texts/${l}.lang`, "utf8")]));
    equal(langProblems(files, pack).length, 0, `${pack} complete`);
  }
  const broken = langProblems({ zh_TW: "a=甲\nb=乙\nc=", en_US: "a=A\nc=C\nd=D", zh_CN: "a=甲\nb=\nc=丙" });
  for (const want of ["en_US.lang: b missing", "zh_CN.lang: b is empty", "zh_TW.lang: c is empty", "en_US.lang: d is not in zh_TW"]) assert(broken.some((p) => p.includes(want)), `reports "${want}"`);
});

test("balance: no food gives far more than its ingredients or less than one of them", () => {
  equal(hardOutliers().map((row) => row.id).join(), "", "hard outliers");
});

test("Tavern: the SDK waits for the required capabilities, then sends the payload and stops at the ack", () => {
  const client = tavernClient();
  const lines = warnings(() => {
    system.sendScriptEvent("kaleidoscope_tavern:api_ready", JSON.stringify({ api: 1, capabilities: ["barrel_recipes"] }));
    __advance(20);
  });
  equal(sent("kaleidoscope_tavern:extension_begin").length, 0, "nothing without pressing_recipes, guide_product_pages, chunk_transport, acknowledgements");
  assert(lines.some((l) => l.includes("lacks required capabilities")), "logged to the console");
  system.sentEvents = [];
  system.sendScriptEvent("kaleidoscope_tavern:api_ready", JSON.stringify({ api: 1, capabilities: ["barrel_recipes", "pressing_recipes", "guide_product_pages", "chunk_transport", "acknowledgements"] }));
  __advance(40);
  const ids = system.sentEvents.map((e) => e.id).filter((id) => id.startsWith("kaleidoscope_tavern:extension_"));
  equal(ids[0], "kaleidoscope_tavern:extension_begin", "begin first");
  equal(ids.at(-1), "kaleidoscope_tavern:extension_commit", "commit last");
  for (const e of system.sentEvents.filter((e) => e.id.startsWith("kaleidoscope_tavern:"))) assert(utf8Bytes(e.message) <= 1900, "packet size");
  const { revision, source } = JSON.parse(sent("kaleidoscope_tavern:extension_begin")[0].message);
  equal(source, NS, "source");
  const quiet = warnings(() => system.sendScriptEvent("kaleidoscope_tavern:extension_ack", JSON.stringify({ source: NS, revision, ok: true })));
  assert(client.registered, "registered after the ack");
  equal(quiet.length, 0, "success is not logged");
  system.sentEvents = [];
  __advance(300);
  equal(sent("kaleidoscope_tavern:extension_begin").length, 0, "no resend after the ack");
  equal(world.messages.length, 0, "no chat text");
});

// --- Sister packs: Fishing Voyage, and Harvest's own API ---------------------------------------------------

const { fishingMessages, __resetFishing } = await import("../../packs/BP/scripts/api/fishing.js");
const { EVENTS: HARVEST_EVENTS, CATALOGS, catalogReplies, handleHarvestEvent, ANNOUNCE_TICKS } = await import("../../packs/BP/scripts/api/harvestApi.js");
const { FISHING_BAITS, FISHING_POND_FEEDS } = await import("../../packs/BP/scripts/data/integrations.js");
const { VERSION } = await import("../../packs/BP/scripts/data/version.js");

test("startup pings Fishing and announces Harvest's own api_ready once, after the sister packs subscribe", () => {
  assert(STARTUP.includes("kaleidoscope_fishing:api_ping"), "Fishing pinged at startup");
  for (const id of ["kaleidoscope_fishing:register_bait", "kaleidoscope_fishing:register_pond_feed"]) assert(!STARTUP.includes(id), `${id} waits for api_ready`);
  assert(!STARTUP.includes(HARVEST_EVENTS.ready), "no api_ready on the first ticks");
  assert(ANNOUNCE_TICKS <= 22, "announced within the startup ticks the test waits for");
  const ready = ANNOUNCED;
  equal(ready.length, 1, "one api_ready by itself");
  equal(ready[0].api, 1, "api");
  equal(ready[0].source, NS, "source");
  equal(ready[0].version, VERSION, "version from data/version.js");
  assert(ready[0].capabilities.includes("catalog"), "catalog capability");
});

test("Fishing: bait needs `bait`, pond feed needs `pond_feed`, and every api_ready sends them again", () => {
  __resetFishing();
  system.sentEvents = [];
  fire("kaleidoscope_fishing:api_ready", { api: 2, capabilities: ["bait", "pond_feed"] });
  fire("kaleidoscope_fishing:api_ready", "{broken");
  equal(sent("kaleidoscope_fishing:register_bait").length + sent("kaleidoscope_fishing:register_pond_feed").length, 0, "nothing for api 2 or broken JSON");
  fire("kaleidoscope_fishing:api_ready", { api: 1, version: "1.4.0", capabilities: ["bait", "catch"] });
  equal(sent("kaleidoscope_fishing:register_bait").length, 1, "1.4.0: bait");
  equal(sent("kaleidoscope_fishing:register_pond_feed").length, 0, "1.4.0 has no pond feed");
  fire("kaleidoscope_fishing:api_ready", { api: 1, version: "1.5.0", capabilities: ["bait", "catch", "pond_feed"] });
  equal(sent("kaleidoscope_fishing:register_bait").length, 2, "bait sent again");
  const [feed] = sentJson("kaleidoscope_fishing:register_pond_feed");
  equal(feed.source, NS, "source");
  equal(feed.feeds.map((f) => f.id).join(), FISHING_POND_FEEDS.map((f) => r(f.id)).join(), "the pond feeds");
  const [bait] = sentJson("kaleidoscope_fishing:register_bait");
  equal(bait.api, 1, "api");
  equal(bait.baits.map((b) => b.id).join(), FISHING_BAITS.map((b) => r(b.id)).join(), "the baits");
  for (const b of bait.baits) assert(b.id.startsWith(`${NS}:`) && b.biteFactor >= 0.5 && b.biteFactor <= 1, `${b.id} own and in range`);
  for (const e of [...sent("kaleidoscope_fishing:register_bait"), ...sent("kaleidoscope_fishing:register_pond_feed")]) assert(e.message.length < SCRIPT_EVENT_LIMIT, "under 2048 characters");
  equal(fishingMessages(null).length, 0, "nothing before api_ready");
  equal(world.messages.length, 0, "no chat text");
});

test("Harvest API: api_ping is answered with api_ready", () => {
  system.sentEvents = [];
  fire(HARVEST_EVENTS.ping, "kaleidoscope_fishing");
  const [ready] = sentJson(HARVEST_EVENTS.ready);
  equal(ready?.source, NS, "answered");
  system.sentEvents = [];
  fire(HARVEST_EVENTS.ping, "x", "Entity");
  equal(sent(HARVEST_EVENTS.ready).length, 0, "a /scriptevent typed by a player is ignored");
});

test("Harvest API: catalog lists every crop and tree with full ids, split under 2048 characters", () => {
  for (const kind of ["crops", "trees"]) {
    const replies = handleHarvestEvent(HARVEST_EVENTS.catalogRequest, JSON.stringify({ api: 1, source: "my_pack", req: 7, kind }));
    assert(replies.length >= 1, `${kind}: answered`);
    for (const [index, reply] of replies.entries()) {
      equal(reply.to, "my_pack", "to");
      equal(reply.req, 7, "req echoed as a number");
      equal(reply.index, index, "index");
      equal(reply.parts, replies.length, "parts");
      assert(JSON.stringify(reply).length < SCRIPT_EVENT_LIMIT, `${kind} part ${index} under 2048`);
    }
    const items = replies.flatMap((reply) => reply.items);
    equal(items.length, CATALOGS[kind]().length, `${kind}: nothing lost between parts`);
    for (const row of items) assert(row.id.startsWith(`${NS}:`) && ITEMS.some((i) => r(i.id) === row.id), `${row.id} is a Harvest item`);
  }
  equal(handleHarvestEvent(HARVEST_EVENTS.catalogRequest, JSON.stringify({ api: 1, source: "my_pack", req: "x".repeat(40), kind: "crops" }))[0].req.length, 32, "a long req is cut to 32");
  const crops = catalogReplies("my_pack", undefined, "crops").flatMap((reply) => reply.items);
  equal(crops.length, CROPS.length, "one row per crop");
  assert(crops.every((c) => c.seed && c.form && c.climate), "seed, form and climate");
  const trees = catalogReplies("my_pack", undefined, "trees").flatMap((reply) => reply.items);
  equal(trees.length, TREES.length, "one row per tree");
  assert(trees.find((t) => t.id === r("cinnamon_bark"))?.bark, "cinnamon is bark");
});

test("Harvest API: bad catalog requests get no answer; an unknown kind lists the kinds", () => {
  for (const raw of ["{broken", JSON.stringify({ api: 2, source: "my_pack", kind: "crops" }), JSON.stringify({ api: 1, source: "Bad Pack", kind: "crops" }), JSON.stringify({ api: 1, source: NS, kind: "crops" }), JSON.stringify({ api: 1, kind: "crops" })])
    equal(handleHarvestEvent(HARVEST_EVENTS.catalogRequest, raw).length, 0, `no answer to ${raw}`);
  const [reply] = handleHarvestEvent(HARVEST_EVENTS.catalogRequest, JSON.stringify({ api: 1, source: "my_pack", kind: "dishes" }));
  equal(reply.ok, false, "not ok");
  equal(reply.code, "UNKNOWN_KIND", "code");
  equal(reply.kinds.join(), "crops,trees,foods", "kinds");
});

// --- 1.1 ------------------------------------------------------------------------------------------------------

/** Mud at y 63 and an aquatic crop at y 64, in water unless `dry`. */
function plantInWater(cropBlock, x = 0, { dry = false, bed = "minecraft:mud", states = {} } = {}) {
  __place(overworld, at(x, 63), bed);
  const block = __place(overworld, at(x), r(cropBlock), states);
  if (!dry) overworld.waterlogged.add(block.key);
  return block;
}

test("1.1 content: 14 new crops (3 aquatic), 4 new trees, fruitwood planks", () => {
  for (const id of ["lotus_root", "water_bamboo", "water_spinach", "bitter_melon", "luffa", "adzuki_bean", "mung_bean", "garlic_chives", "lemongrass", "sichuan_pepper"]) assert(CROPS.some((c) => c.id === id), `crop ${id}`);
  equal(CROPS.length, 34, "24 crops in 1.0 and 10 more (the other 4 of the 14 are trees)");
  equal(CROPS.filter((c) => c.form === "aquatic").length, 3, "three aquatic crops");
  equal(TREES.length, 15, "11 trees and 4 more");
  for (const id of ["longan", "loquat", "star_fruit", "papaya"]) assert(TREES.some((t) => t.id === id), `tree ${id}`);
});

test("aquatic: lotus grows in water over mud and drops its root and sometimes a pod", () => {
  const lotus = plantInWater("lotus_root_crop");
  const grown = tick(lotus, 40);
  equal(growth(grown), 7, "ripe");
  equal(grown.permutation.getState(S("off_climate")), false, "green");
  __setLootRandom(() => 0.99);
  __break(player(), grown);
  assert(overworld.dropped(r("lotus_root")) >= 1, "lotus root");
  equal(overworld.dropped(r("lotus_pod")), 1, "a lotus pod (0–1, the top roll)");
});

test("aquatic: out of water it stops and greys; on farmland or stone it does nothing", () => {
  const dry = plantInWater("lotus_root_crop", 0, { dry: true });
  const after = tick(dry, 40);
  equal(growth(after), 0, "no water, no growth");
  equal(after.permutation.getState(S("off_climate")), true, "grey without water");
  overworld.waterlogged.add(after.key);
  equal(tick(after, 1).permutation.getState(S("off_climate")), false, "green again in water");
  const onFarmland = plant("lotus_root_crop", 2);
  equal(growth(tick(onFarmland, 40)), 0, "vanilla farmland is not a paddy");
  const onStone = plantInWater("lotus_root_crop", 4, { bed: "minecraft:stone" });
  equal(growth(tick(onStone, 40)), 0, "stone is no water bed");
});

test("aquatic: water spinach and water bamboo are picked and grow back", () => {
  for (const [id, produce] of [["water_spinach_crop", "water_spinach"], ["water_bamboo_crop", "water_bamboo"]]) {
    __reset();
    const crop = plantInWater(id, 0, { states: { [S("growth")]: 7 } });
    __interact(player(), crop);
    assert(overworld.dropped(r(produce)) >= 1, `${produce} picked`);
    equal(growth(overworld.getBlock(at(0))), 4, `${id} back to harvestResetAge`);
  }
});

test("aquatic: blocks can stand in water, plant on a water bed or paddy, and grow wild in shallow water", () => {
  for (const crop of CROPS.filter((c) => c.form === "aquatic")) {
    const b = json(`packs/BP/blocks/${crop.id}_crop.json`)["minecraft:block"].components;
    equal(b["minecraft:liquid_detection"]?.detection_rules?.[0]?.can_contain_liquid, true, `${crop.id} holds water`);
    const filter = b["minecraft:placement_filter"].conditions[0].block_filter;
    assert(filter.includes("minecraft:mud") && filter.some((f) => f.tags?.includes("kaleidoscope_cookery:farmland")), `${crop.id} on mud or a paddy`);
    assert(!filter.includes("minecraft:farmland"), `${crop.id} not on dry farmland`);
    const seed = json(`packs/BP/items/${crop.seed}.json`)["minecraft:item"].components["minecraft:block_placer"];
    equal(seed.block, r(`${crop.id}_crop`), `${crop.seed} plants it`);
    const wild = json(`packs/BP/features/wild/wild_${crop.id}_feature.json`)["minecraft:single_block_feature"];
    equal(wild.may_replace.join(), "minecraft:water", `wild ${crop.id} goes into water`);
    assert(json(`packs/BP/blocks/wild_${crop.id}.json`)["minecraft:block"].components["minecraft:liquid_detection"], `wild ${crop.id} holds water`);
  }
});

test("new trellis, bean, spice and bush crops grow like their 1.0 kin", () => {
  const p = player(r("bitter_melon_seeds"));
  __place(overworld, at(0, 63), "minecraft:farmland");
  __interact(p, __place(overworld, at(0), r("bamboo_trellis")));
  equal(overworld.getBlock(at(0)).typeId, r("bitter_melon_crop"), "bitter melon on a trellis");
  const bean = tick(plant("adzuki_bean_crop", 2), 40);
  __break(player(), bean);
  assert(overworld.dropped(r("adzuki_bean")) >= 2, "adzuki beans, which also plant it");
  __place(overworld, at(4, 63), "minecraft:grass_block");
  const bush = __place(overworld, at(4), r("sichuan_pepper_crop"), { [S("growth")]: 7 });
  __interact(player(), bush);
  assert(overworld.dropped(r("sichuan_peppercorns")) >= 1, "peppercorns picked off the bush");
});

test("corn now also drops corn leaves sometimes", () => {
  __setLootRandom(() => 0.99);
  const corn = plant("corn_crop", 0, { [S("growth")]: 7 });
  __break(player(), corn);
  equal(overworld.dropped(r("corn_leaves")), 1, "corn leaves at the top roll");
});

test("juicer: a fruit and a milk bucket make the fruit's milk, and the bucket comes back", () => {
  const juicer = __place(overworld, at(0), r("juicer"));
  const papaya = player(r("papaya"));
  __interact(papaya, juicer);
  const milk = player("minecraft:milk_bucket");
  __interact(milk, overworld.getBlock(at(0)));
  equal(milk.hand?.typeId, "minecraft:bucket", "the empty bucket is handed back");
  equal(overworld.getBlock(at(0)).permutation.getState(S("juice")), "milk", "the jug is creamy");
  __interact(player("minecraft:milk_bucket"), overworld.getBlock(at(0)));
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 2, "full: no third thing");
  __interact(player("minecraft:glass_bottle"), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("papaya_milk")), 1, "papaya milk");
  // ## Two milks make nothing; an empty hand gives the milk back as a milk bucket.
  const again = overworld.getBlock(at(0));
  __interact(player("minecraft:milk_bucket"), again);
  __interact(player("minecraft:milk_bucket"), overworld.getBlock(at(0)));
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 1, "one milk at most");
  __interact(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped("minecraft:milk_bucket"), 1, "milk back");
  // ## Papaya has no juice of its own, so papaya and a mandarin make nothing.
  __interact(player(r("papaya")), overworld.getBlock(at(0)));
  __interact(player(r("mandarin")), overworld.getBlock(at(0)));
  __interact(player("minecraft:glass_bottle"), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("mixed_juice")), 0, "no mixed juice from a milk-only fruit");
  // ## Bananas and papayas only make milk drinks.
  equal(RECIPES.filter((row) => row.station === "juicer" && row.milk).map((row) => row.input).sort().join(), "banana,papaya", "milk drinks");
});

test("fruitwood planks: four from a log, tagged as planks for vanilla recipes", () => {
  const item = json("packs/BP/items/fruitwood_planks.json")["minecraft:item"].components;
  assert(item["minecraft:tags"].tags.includes("minecraft:planks"), "planks tag");
  equal(item["minecraft:block_placer"].block, r("fruitwood_planks"), "places the planks block");
  const recipe = json("packs/BP/recipes/fruitwood_planks.json")["minecraft:recipe_shapeless"];
  equal(recipe.ingredients[0].item, r("fruitwood_log"), "from the log");
  equal(recipe.result.count, 4, "four planks");
});

test("rice dishes use Cookery's rice; the garlic eggplant is put together before the steamer", () => {
  const by = (id) => RECIPES.find((row) => row.result === id);
  assert(by("sweet_potato_congee").slots.some((slot) => slot.includes("kaleidoscope_cookery:rice")), "congee from raw rice");
  for (const id of ["pineapple_fried_rice", "braised_pork_rice"]) assert(by(id).slots.some((slot) => slot.includes("kaleidoscope_cookery:cooked_rice")), `${id} from cooked rice`);
  equal(by("garlic_eggplant_raw").station, "crafting", "raw garlic eggplant at the table");
  equal(by("steamed_garlic_eggplant").input, "garlic_eggplant_raw", "then steamed");
  equal(recipePayload({ ...by("steamed_garlic_eggplant") }).recipe.input, r("garlic_eggplant_raw"), "the steamer payload");
});

test("Ranching: corn leaves are ruminant feed with feed_1_1, grass without it", () => {
  const leaves = (caps) => feedPayloads(caps).find((f) => f.item === r("corn_leaves"))?.kind;
  equal(leaves(["register_feed", "feed_1_1"]), "ruminant", "Ranching 1.1");
  equal(leaves(["register_feed"]), "grass", "Ranching 1.0");
  equal(feedPayloads(["register_feed"]).length, RANCHING_FEEDS.length, "every feed goes out either way");
});

test("Harvest API: catalog_foods lists every food with hunger, placeability and container", () => {
  assert(ANNOUNCED[0].capabilities.includes("catalog_foods"), "capability announced");
  equal(ANNOUNCED[0].version, VERSION, "version from data/version.js");
  const replies = handleHarvestEvent(HARVEST_EVENTS.catalogRequest, JSON.stringify({ api: 1, source: "my_pack", kind: "foods" }));
  for (const reply of replies) assert(JSON.stringify(reply).length < SCRIPT_EVENT_LIMIT, "each part under 2048");
  const foods = replies.flatMap((reply) => reply.items);
  equal(foods.length, ITEMS.filter((i) => i.food).length, "every food");
  const of = (id) => foods.find((f) => f.id === r(id));
  equal(of("mapo_tofu").placeable, true, "mapo tofu can be set down");
  equal(of("mapo_tofu").container, "minecraft:bowl", "in a bowl");
  equal(of("longan_tea").container, "kaleidoscope_cookery:empty_cup", "tea in a Cookery cup");
  equal(of("mango").container, undefined, "raw fruit has none");
  assert(of("papaya_milk").hunger === 6 && of("papaya_milk").saturation === 0.5, "hunger and saturation");
  assert(catalogReplies("my_pack", undefined, "crops").flatMap((reply) => reply.items).some((c) => c.form === "aquatic"), "aquatic crops in the crop catalog");
});

test("1.1 partners: longan wine goes to Tavern; new heat, feed and bait rows name real items", () => {
  assert(TAVERN_WINES.some((w) => w.id === "longan_wine"), "longan wine in the Tavern table");
  for (const id of ["mung_bean_soup", "longan_tea", "mapo_tofu"]) assert(HERBAL_HEAT.some((h) => h.id === id), `heat for ${id}`);
  for (const id of ["adzuki_bean", "mung_bean", "water_spinach", "corn_leaves"]) assert(RANCHING_FEEDS.some((f) => f.item === id), `feed ${id}`);
});

// --- Convenience update, phase 1: refusal cue, sneak-use, hoppers ---------------------------------------------
const { __setContainer } = mc;
const { REFUSE } = await import("../../packs/BP/scripts/data/feedback.js");
const { SNEAK_USE, AUTOMATION } = await import("../../packs/BP/scripts/data/stations.js");
const { trackedStations } = await import("../../packs/BP/scripts/stations/automation.js");
const refusals = () => overworld.sounds.filter((s) => s.id === REFUSE.sound).length;
const smoke = () => overworld.particles.filter((p) => p.id === REFUSE.particle).length;
/** Runs the clock on past one automation pass. */
const pass = (n = 1) => __advance(n * AUTOMATION.seconds * 20);
/** Lets sounds a sneak-use of an earlier test scheduled play out. */
const settle = () => {
  __advance(SNEAK_USE.gapTicks * SNEAK_USE.max);
  overworld.sounds = [];
};
/** Sneaks two mandarins into the juicer at `location`. */
function fillJuicer(location) {
  const f = player(r("mandarin"), 2);
  f.isSneaking = true;
  __interact(f, overworld.getBlock(location));
}

test("refusal: bone meal on a ripe or off-climate crop gives a low note and a grey puff, and is kept", () => {
  const crop = plant("napa_cabbage_crop", 0, { [S("growth")]: 7 });
  const p = player("minecraft:bone_meal", 3);
  __interact(p, crop);
  equal(refusals(), 1, "one low note");
  equal(smoke(), 1, "one grey puff");
  const cue = overworld.sounds.find((s) => s.id === REFUSE.sound);
  equal(cue.options.pitch, REFUSE.pitch, "low pitch");
  equal(p.hand.amount, 3, "bone meal kept on a ripe crop");
  overworld.biome = "minecraft:desert";
  const grey = tick(plant("napa_cabbage_crop", 3), 1);
  equal(grey.permutation.getState(S("off_climate")), true, "off-climate");
  __interact(p, grey);
  equal(refusals(), 2, "refused off-climate too");
  equal(growth(overworld.getBlock(at(3))), 0, "did not grow");
  equal(p.hand.amount, 3, "bone meal kept off-climate");
  equal(world.messages.length, 0, "no chat text");
});

test("refusal: an empty hand or a random item on an unripe crop stays silent", () => {
  const crop = plant("napa_cabbage_crop");
  __interact(player(), crop);
  __interact(player("minecraft:stick"), overworld.getBlock(at(0)));
  equal(refusals(), 0, "no cue");
  equal(smoke(), 0, "no puff");
});

test("refusal: one cue per block per gap while use is held down", () => {
  const crop = plant("napa_cabbage_crop", 0, { [S("growth")]: 7 });
  const p = player("minecraft:bone_meal", 3);
  for (let i = 0; i < 4; i++) __interact(p, overworld.getBlock(at(0)));
  equal(refusals(), 1, "held down: once");
  __advance(REFUSE.gapTicks);
  __interact(p, overworld.getBlock(at(0)));
  equal(refusals(), 2, "again after the gap");
  plant("napa_cabbage_crop", 2, { [S("growth")]: 7 });
  __interact(p, overworld.getBlock(at(2)));
  equal(refusals(), 3, "another block has its own gap");
  void crop;
});

test("refusal: bone meal on off-climate leaves, off-climate fruit and a sapling with no room", () => {
  grownMandarin();
  overworld.biome = "minecraft:snowy_plains";
  tick(overworld.getBlock(LEAF), 1);
  const p = player("minecraft:bone_meal", 5);
  __interact(p, overworld.getBlock(LEAF));
  equal(refusals(), 1, "off-climate leaf refused");
  equal(blossom(overworld.getBlock(LEAF)), false, "no blossom");
  const underRing = at(-1, 64 + MANDARIN_TRUNK - 2);
  __place(overworld, underRing, r("mandarin_fruit"));
  __interact(p, overworld.getBlock(underRing));
  equal(refusals(), 2, "off-climate fruit refused");
  equal(growth(overworld.getBlock(underRing)), 0, "fruit unchanged");
  equal(p.hand.amount, 5, "no bone meal used");
  __interact(player(), overworld.getBlock(underRing));
  equal(refusals(), 2, "an empty hand on an unripe fruit is silent");

  overworld.biome = "minecraft:swamp";
  plantSapling(10);
  overworld.getBlock(at(10)).setPermutation(BlockPermutation.resolve(r("mandarin_sapling"), { [S("growth")]: 3 }));
  overworld.featureFails = true;
  __interact(p, overworld.getBlock(at(10)));
  overworld.featureFails = false;
  equal(refusals(), 3, "no room for the tree: refused");
  equal(p.hand.amount, 5, "still no bone meal used");
});

test("refusal: another crop's seed on a trellis is refused; anything else is silent", () => {
  __place(overworld, at(0, 63), "minecraft:farmland");
  const trellis = __place(overworld, at(0), r("bamboo_trellis"));
  const p = player(r("napa_cabbage_seeds"), 2);
  __interact(p, trellis);
  equal(refusals(), 1, "refused");
  equal(p.hand.amount, 2, "seed kept");
  __place(overworld, at(2, 63), "minecraft:farmland");
  __interact(player("minecraft:stick"), __place(overworld, at(2), r("bamboo_trellis")));
  equal(refusals(), 1, "a stick is silent");
});

test("refusal: a full juicer, a second milk bucket and a bottle with nothing to pour", () => {
  const juicer = __place(overworld, at(0), r("juicer"));
  __interact(player("minecraft:glass_bottle"), juicer);
  equal(refusals(), 1, "bottle on an empty juicer");
  const p = player(r("mandarin"), 3);
  __interact(p, overworld.getBlock(at(0)));
  __interact(p, overworld.getBlock(at(0)));
  __advance(REFUSE.gapTicks);
  __interact(p, overworld.getBlock(at(0)));
  equal(refusals(), 2, "fruit on a full juicer");
  equal(p.hand.amount, 1, "the third mandarin kept");
  __interact(player(), overworld.getBlock(at(0)));
  __interact(player("minecraft:milk_bucket"), overworld.getBlock(at(0)));
  __advance(REFUSE.gapTicks);
  const milk = player("minecraft:milk_bucket");
  __interact(milk, overworld.getBlock(at(0)));
  equal(refusals(), 3, "a second milk bucket");
  equal(milk.hand.typeId, "minecraft:milk_bucket", "the milk is kept");
});

test("refusal: an ingredient on a sealed or full jar; other items stay silent", () => {
  __place(overworld, at(0), r("pickling_jar"));
  const p = player(r("napa_cabbage"), 8);
  __interact(p, overworld.getBlock(at(0)));
  __interact(p, overworld.getBlock(at(0)));
  __interact(player(), overworld.getBlock(at(0))); // sealed
  __interact(p, overworld.getBlock(at(0)));
  equal(refusals(), 1, "sealed jar refuses");
  equal(p.hand.amount, 6, "ingredient kept");
  __interact(player("minecraft:stick"), overworld.getBlock(at(0)));
  __interact(player(), overworld.getBlock(at(0))); // still fermenting: empty hand stays silent
  equal(refusals(), 1, "silent");
  __place(overworld, at(3), r("pickling_jar"));
  p.isSneaking = true;
  __interact(p, overworld.getBlock(at(3)));
  p.isSneaking = false;
  __interact(p, overworld.getBlock(at(3)));
  equal(refusals(), 2, "full jar refuses");
});

test("sneak-use: a stack of fruit fills the juicer; a stack of an ingredient fills the jar", () => {
  settle();
  __place(overworld, at(0), r("juicer"));
  const fruit = player(r("mandarin"), 5);
  fruit.isSneaking = true;
  __interact(fruit, overworld.getBlock(at(0)));
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 2, "two at once");
  equal(fruit.hand.amount, 3, "two used");
  equal(overworld.sounds.filter((s) => s.id === "block.composter.fill").length, 1, "first fill sound at once");
  __advance(SNEAK_USE.gapTicks);
  equal(overworld.sounds.filter((s) => s.id === "block.composter.fill").length, 2, "then the second");
  const one = player(r("mandarin"), 1);
  one.isSneaking = true;
  __place(overworld, at(2), r("juicer"));
  __interact(one, overworld.getBlock(at(2)));
  equal(overworld.getBlock(at(2)).permutation.getState(S("fruit")), 1, "only what the stack has");
  equal(one.hand, undefined, "hand empty");

  __place(overworld, at(4), r("pickling_jar"));
  const cabbage = player(r("napa_cabbage"), 6);
  cabbage.isSneaking = true;
  __interact(cabbage, overworld.getBlock(at(4)));
  equal(cabbage.hand.amount, 2, "four in at once");
  __interact(player(), overworld.getBlock(at(4)));
  equal(overworld.dropped(r("napa_cabbage")), 4, "four napa cabbage match nothing: all back");
});

test("sneak-use: bottles pour one after another, refilled with the same fruit from the inventory", () => {
  settle();
  __place(overworld, at(0), r("juicer"));
  fillJuicer(at(0));
  const p = player("minecraft:glass_bottle", 12);
  p.inventory.addItem(new ItemStack(r("mandarin"), 20));
  p.isSneaking = true;
  __interact(p, overworld.getBlock(at(0)));
  equal(overworld.dropped(r("mandarin_juice")), SNEAK_USE.max, "eight at most");
  equal(p.hand.amount, 12 - SNEAK_USE.max, "a bottle each");
  equal(p.inventory.count(r("mandarin")), 20 - 2 * (SNEAK_USE.max - 1), "two fruit per refill");
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 0, "juicer empty after");
  const pours = () => overworld.sounds.filter((s) => s.id === "bucket.fill.water").length;
  equal(pours(), 1, "first pour sound at once");
  __advance(SNEAK_USE.gapTicks * SNEAK_USE.max);
  equal(pours(), SNEAK_USE.max, "one sound per bottle, in sequence");

  // Fruit runs out: three mandarins in the inventory refill once.
  __place(overworld, at(3), r("juicer"));
  fillJuicer(at(3));
  const q = player("minecraft:glass_bottle", 10);
  q.inventory.addItem(new ItemStack(r("mandarin"), 3));
  q.isSneaking = true;
  __interact(q, overworld.getBlock(at(3)));
  equal(overworld.dropped(r("mandarin_juice")), SNEAK_USE.max + 2, "two more");
  equal(q.inventory.count(r("mandarin")), 1, "one mandarin left");
  equal(q.hand.amount, 8, "two bottles used");

  // Without sneaking a bottle pours once and the inventory is left alone.
  __place(overworld, at(6), r("juicer"));
  fillJuicer(at(6));
  const s = player("minecraft:glass_bottle", 5);
  s.inventory.addItem(new ItemStack(r("mandarin"), 4));
  __interact(s, overworld.getBlock(at(6)));
  equal(s.hand.amount, 4, "one bottle");
  equal(s.inventory.count(r("mandarin")), 4, "no refill");
});

test("hoppers: a juicer takes fruit and bottles from above and puts juice below", () => {
  const juicer = __placeByPlayer(overworld, at(0), r("juicer"));
  const above = __setContainer(overworld, at(0, 65));
  const below = __setContainer(overworld, at(0, 63), 27, "minecraft:chest");
  above.addItem(new ItemStack(r("mandarin"), 3));
  above.addItem(new ItemStack(r("grape"), 1));
  above.addItem(new ItemStack("minecraft:glass_bottle", 2));
  pass();
  equal(below.count(r("mandarin_juice")), 1, "mandarin juice below");
  equal(above.count(r("mandarin")), 1, "two mandarins taken");
  equal(above.count("minecraft:glass_bottle"), 1, "one bottle taken");
  pass();
  equal(below.count(r("mixed_juice")), 1, "the last mandarin and the grape: mixed juice");
  equal(above.count("minecraft:glass_bottle"), 0, "second bottle taken");
  pass();
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 0, "nothing left to load");
  void juicer;
});

test("hoppers: a juicer with no container below loads fruit but keeps the bottles above", () => {
  __placeByPlayer(overworld, at(0), r("juicer"));
  const above = __setContainer(overworld, at(0, 65));
  above.addItem(new ItemStack(r("mandarin"), 2));
  above.addItem(new ItemStack("minecraft:glass_bottle", 1));
  pass();
  equal(overworld.getBlock(at(0)).permutation.getState(S("fruit")), 2, "loaded");
  equal(above.count("minecraft:glass_bottle"), 1, "bottle stays: the juice would have nowhere to go");
  const below = __setContainer(overworld, at(0, 63));
  pass();
  equal(below.count(r("mandarin_juice")), 1, "a container below: poured");
});

test("hoppers: a pickling jar loads a whole recipe from above, seals, and unloads below when done", () => {
  __placeByPlayer(overworld, at(0), r("pickling_jar"));
  const above = __setContainer(overworld, at(0, 65));
  const below = __setContainer(overworld, at(0, 63));
  above.addItem(new ItemStack(r("napa_cabbage"), 1));
  pass();
  equal(contents(overworld.getBlock(at(0))), "empty", "one cabbage finishes nothing: nothing taken");
  equal(above.count(r("napa_cabbage")), 1, "still above");
  above.addItem(new ItemStack(r("napa_cabbage"), 1));
  pass();
  equal(contents(overworld.getBlock(at(0))), "fermenting", "sealed");
  equal(above.count(r("napa_cabbage")), 0, "both taken");
  __skipTime(24000);
  pass();
  equal(below.count(r("pickled_napa_cabbage")), 2, "result below");
  equal(contents(overworld.getBlock(at(0))), "empty", "open and empty again");
});

test("hoppers: a jar holding a hand-put ingredient only takes what completes it", () => {
  __placeByPlayer(overworld, at(0), r("pickling_jar"));
  __interact(player(r("daikon")), overworld.getBlock(at(0)));
  const above = __setContainer(overworld, at(0, 65));
  above.addItem(new ItemStack(r("napa_cabbage"), 2));
  pass();
  equal(above.count(r("napa_cabbage")), 2, "cabbage does not go with daikon");
  above.addItem(new ItemStack("minecraft:sugar", 1));
  pass();
  equal(contents(overworld.getBlock(at(0))), "fermenting", "daikon and sugar sealed");
  equal(above.count("minecraft:sugar"), 0, "sugar taken");
});

test("hoppers: stations are tracked by place, use and random tick, and dropped when gone", () => {
  __placeByPlayer(overworld, at(0), r("juicer"));
  __place(overworld, at(3), r("pickling_jar")); // a jar from an old world: no onPlace
  equal(trackedStations().length, 1, "placed juicer tracked");
  __randomTick(overworld.getBlock(at(3)));
  equal(trackedStations().length, 2, "old jar joins on its random tick");
  __randomTick(overworld.getBlock(at(3)));
  equal(trackedStations().length, 2, "no duplicates");
  __break(player(), overworld.getBlock(at(0)));
  equal(trackedStations().length, 1, "broken juicer untracked");
  overworld.getBlock(at(3)).setType("minecraft:air"); // blown up: no break event
  pass();
  equal(trackedStations().length, 0, "a pass drops a station that is gone");
});

// --- Phase 3: fruit-picking pole, harvest basket, produce crate (data/gear.js) ------------------------------------

const { PICKING_POLE, HARVEST_BASKET, PRODUCE_CRATE, crateLevel } = await import("../../packs/BP/scripts/data/gear.js");
const { SOUND } = await import("../../packs/BP/scripts/data/feedback.js");
const { basketHolders, resetBasket } = await import("../../packs/BP/scripts/growth/basket.js");
const { crateContents, CRATE_CAPACITY } = await import("../../packs/BP/scripts/stations/crate.js");

const POLE = r(PICKING_POLE.id);
const BASKET = r(HARVEST_BASKET.id);
const CRATE = r(PRODUCE_CRATE.id);
const MANDARIN = TREES.find((t) => t.id === "mandarin");
const CINNAMON = TREES.find((t) => t.id === "cinnamon");
const SCALLION = CROPS.find((c) => c.id === "scallion");
const FRUIT_Y = 64 + MANDARIN_TRUNK - 2;
const ripeFruit = (x, z) => __place(overworld, at(x, FRUIT_Y, z), r("mandarin_fruit"), { [S("growth")]: 2 });
const leafBits = () => overworld.particles.filter((p) => p.id === r(PICKING_POLE.particle)).length;
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

test("pole: every ripe fruit within 3 blocks comes down, unripe and far ones stay; one point of wear", () => {
  grownMandarin();
  ripeFruit(1, 0);
  ripeFruit(-1, -1);
  __place(overworld, at(1, FRUIT_Y, 1), r("mandarin_fruit"), { [S("growth")]: 1 });
  __place(overworld, at(6, FRUIT_Y + 1), r("mandarin_leaves"));
  __place(overworld, at(6, FRUIT_Y), r("mandarin_fruit"), { [S("growth")]: 2 }); // 5 blocks away
  const p = player(POLE);
  __interact(p, overworld.getBlock(LEAF));
  equal(overworld.dropped(r("mandarin")), 2 * MANDARIN.pick[0], "two ripe fruits, each as picked by hand");
  equal(overworld.getBlock(at(1, FRUIT_Y)).typeId, "minecraft:air", "picked fruit gone");
  equal(overworld.getBlock(at(-1, FRUIT_Y, -1)).typeId, "minecraft:air", "second fruit gone");
  equal(overworld.getBlock(at(1, FRUIT_Y, 1)).typeId, r("mandarin_fruit"), "unripe fruit stays");
  equal(overworld.getBlock(at(6, FRUIT_Y)).typeId, r("mandarin_fruit"), "fruit out of reach stays");
  equal(p.hand.getComponent("minecraft:durability").damage, 1, "one point of wear");
  assert(overworld.sounds.some((s) => s.id === SOUND.rustle), "rustle");
  assert(leafBits() >= 3, "leaf bits at the leaf and each fruit");
  equal(world.messages.length, 0, "no chat text");
  __interact(p, overworld.getBlock(LEAF));
  equal(refusals(), 1, "nothing ripe left: the refusal cue");
  equal(p.hand.getComponent("minecraft:durability").damage, 1, "not worn when nothing was picked");
});

test("pole: used on a hanging fruit too; creative does not wear it; the last point breaks it", () => {
  grownMandarin();
  ripeFruit(1, 0);
  ripeFruit(0, 1);
  const c = player(POLE);
  c.gameMode = GameMode.Creative;
  __interact(c, overworld.getBlock(at(1, FRUIT_Y)));
  equal(overworld.dropped(r("mandarin")), 2 * MANDARIN.pick[0], "both picked from a fruit");
  equal(c.hand.getComponent("minecraft:durability").damage, 0, "creative: no wear");
  ripeFruit(1, 0);
  const p = player(POLE);
  p.hand.durability.damage = PICKING_POLE.durability - 1;
  __interact(p, overworld.getBlock(LEAF));
  equal(p.hand, undefined, "worn out: the pole is gone");
  assert(overworld.sounds.some((s) => s.id === SOUND.toolBreak), "break sound");
});

test("pole: flushed cinnamon leaves round it give their bark; a hand still picks one fruit", () => {
  for (const x of [0, 2]) __place(overworld, at(x, 70), r("cinnamon_leaves"), { [S("blossom")]: true });
  __place(overworld, at(9, 70), r("cinnamon_leaves"), { [S("blossom")]: true });
  __interact(player(POLE), overworld.getBlock(at(0, 70)));
  equal(overworld.dropped(r("cinnamon_bark")), 2 * CINNAMON.pick[0], "two leaves stripped");
  equal(blossom(overworld.getBlock(at(2, 70))), false, "back to bare");
  equal(blossom(overworld.getBlock(at(9, 70))), true, "out of reach");
  grownMandarin();
  ripeFruit(1, 0);
  ripeFruit(-1, 0);
  __interact(player(), overworld.getBlock(at(1, FRUIT_Y)));
  equal(overworld.dropped(r("mandarin")), MANDARIN.pick[0], "a hand picks only the fruit it touches");
});

test("basket: walking past ripe scallions picks them into the inventory, from the off hand", () => {
  resetBasket();
  for (const x of [0, 1, 3]) plant("scallion_crop", x, { [S("growth")]: SCALLION.maxGrowth });
  plant("napa_cabbage_crop", -1, { [S("growth")]: 7 }); // broken, not picked
  const p = new Player(overworld, { x: 0.5, y: 63.9375, z: 0.5 });
  p.offhand = new ItemStack(BASKET);
  __advance(HARVEST_BASKET.rosterTicks);
  equal(basketHolders().length, 1, "the roster found the off-hand basket");
  __advance(HARVEST_BASKET.ticks);
  equal(p.inventory.count(r("scallion")), 2 * SCALLION.pick[0], "both scallions within a block");
  equal(growth(overworld.getBlock(at(0))), SCALLION.harvestResetAge, "picked crops drop back");
  equal(growth(overworld.getBlock(at(3))), SCALLION.maxGrowth, "two blocks away: not picked");
  equal(growth(overworld.getBlock(at(-1))), 7, "napa cabbage is broken by hand, not picked");
  equal(overworld.dropped(r("scallion")), 0, "nothing on the ground");
  // ## Standing still: no second look, even when something ripens beside the player.
  overworld.getBlock(at(1)).setPermutation(overworld.getBlock(at(1)).permutation.withState(S("growth"), SCALLION.maxGrowth));
  __advance(HARVEST_BASKET.ticks * 3);
  equal(growth(overworld.getBlock(at(1))), SCALLION.maxGrowth, "standing still picks nothing");
  p.location = { x: 2.5, y: 63.9375, z: 0.5 };
  __advance(HARVEST_BASKET.ticks);
  equal(growth(overworld.getBlock(at(3))), SCALLION.harvestResetAge, "walking on picks the next one");
  equal(growth(overworld.getBlock(at(1))), SCALLION.harvestResetAge, "and the one that ripened");
  equal(world.messages.length, 0, "no chat text");
});

test("basket: main hand works, events add a holder at once, putting it away stops the looks", () => {
  resetBasket();
  const STRAWBERRY = CROPS.find((c) => c.id === "strawberry");
  plant("strawberry_crop", 0, { [S("growth")]: STRAWBERRY.maxGrowth });
  const idle = new Player(overworld, { x: 0.5, y: 64, z: 0.5 });
  const p = new Player(overworld, { x: 0.5, y: 64, z: 0.5 });
  p.hand = new ItemStack(BASKET);
  world.afterEvents.playerHotbarSelectedSlotChange.fire({ player: p });
  world.afterEvents.playerHotbarSelectedSlotChange.fire({ player: idle });
  equal(basketHolders().length, 1, "only the player holding one");
  __advance(HARVEST_BASKET.ticks);
  assert(p.inventory.count(r("strawberry")) >= 1, "picked from the main hand");
  equal(idle.inventory.count(r("strawberry")), 0, "the other player got nothing");
  p.hand = undefined;
  __advance(HARVEST_BASKET.ticks);
  equal(basketHolders().length, 0, "put away: dropped from the holders");
  p.hand = new ItemStack(BASKET);
  for (let i = 0; i < 36; i++) p.inventory.setItem(i, new ItemStack("minecraft:dirt", 64)); // a full inventory
  world.afterEvents.playerInventoryItemChange.fire({ player: p });
  plant("strawberry_crop", 1, { [S("growth")]: STRAWBERRY.maxGrowth });
  p.location = { x: 1.5, y: 64, z: 0.5 };
  __advance(HARVEST_BASKET.ticks);
  assert(overworld.dropped(r("strawberry")) >= 1, "a full inventory: the produce drops");
});

test("crate: a stack goes in, another kind is refused, empty hand takes a stack, sneaking takes all", () => {
  const crate = __placeByPlayer(overworld, at(0), CRATE);
  equal(trackedStations().length, 1, "tracked for hoppers on place");
  const p = player(r("mandarin"), 40);
  __interact(p, crate);
  equal(p.hand, undefined, "the whole stack went in");
  equal(crateContents(overworld.getBlock(at(0))).count, 40, "40 inside");
  equal(overworld.getBlock(at(0)).permutation.getState(S("fill")), 1, "looks a third full");
  equal(overworld.sounds.at(-1).id, SOUND.crateIn, "sound");
  const g = player(r("grape"), 10);
  __interact(g, overworld.getBlock(at(0)));
  equal(refusals(), 1, "another kind: refusal cue");
  equal(g.hand.amount, 10, "grapes kept");
  __interact(player("minecraft:stick"), overworld.getBlock(at(0)));
  equal(refusals(), 1, "a non-produce item is silent");
  const e = player();
  __interact(e, overworld.getBlock(at(0)));
  equal(e.hand.typeId, r("mandarin"), "a stack into the empty hand");
  equal(e.hand.amount, 40, "all 40 (less than a stack)");
  equal(crateContents(overworld.getBlock(at(0))).count, 0, "empty");
  equal(overworld.getBlock(at(0)).permutation.getState(S("fill")), 0, "looks empty");
  for (let i = 0; i < 3; i++) __interact(player(r("pear"), 64), overworld.getBlock(at(0)));
  const s = player();
  s.isSneaking = true;
  __interact(s, overworld.getBlock(at(0)));
  equal(s.inventory.count(r("pear")), 192, "sneaking took everything");
  equal(crateContents(overworld.getBlock(at(0))).item, undefined, "empty again: any kind may go in");
  equal(world.messages.length, 0, "no chat text");
});

test("crate: nine stacks at most, the fill looks follow, breaking drops what it holds", () => {
  __placeByPlayer(overworld, at(0), CRATE);
  equal(CRATE_CAPACITY, 9 * 64, "nine stacks");
  const levels = [];
  for (let i = 0; i < 9; i++) {
    __interact(player(r("corn"), 64), overworld.getBlock(at(0)));
    levels.push(overworld.getBlock(at(0)).permutation.getState(S("fill")));
  }
  equal(levels.join(), "1,1,1,2,2,2,3,3,3", "three looks by thirds");
  const extra = player(r("corn"), 5);
  __interact(extra, overworld.getBlock(at(0)));
  equal(extra.hand.amount, 5, "full: kept");
  equal(refusals(), 1, "full: refusal cue");
  equal(crateLevel(1), 1, "one item shows a little pile");
  __break(player(), overworld.getBlock(at(0)));
  equal(overworld.dropped(r("corn")), CRATE_CAPACITY, "everything drops");
  assert(overworld.items.filter((i) => i.typeId === r("corn")).every((i) => i.amount <= 64), "in stacks");
  equal(overworld.dropped(CRATE), 1, "the crate drops itself");
  equal(trackedStations().length, 0, "untracked");
});

test("crate: a hopper above feeds it, a container below takes from it", () => {
  __placeByPlayer(overworld, at(0), CRATE);
  const above = __setContainer(overworld, at(0, 65));
  above.addItem(new ItemStack("minecraft:dirt", 3));
  above.addItem(new ItemStack(r("lemon"), 20));
  above.addItem(new ItemStack(r("peach"), 5));
  pass();
  equal(crateContents(overworld.getBlock(at(0))).item, r("lemon"), "the first produce above");
  equal(crateContents(overworld.getBlock(at(0))).count, PRODUCE_CRATE.perPass, "one pass worth");
  pass();
  equal(crateContents(overworld.getBlock(at(0))).count, 20, "the rest of the lemons");
  equal(above.count(r("peach")), 5, "another kind stays above");
  equal(above.count("minecraft:dirt"), 3, "non-produce stays above");
  const below = __setContainer(overworld, at(0, 63), 27, "minecraft:chest");
  pass();
  equal(below.count(r("lemon")), PRODUCE_CRATE.perPass, "out into the chest below");
  pass();
  equal(below.count(r("lemon")), 20, "all of it");
  equal(crateContents(overworld.getBlock(at(0))).count, 0, "the crate emptied");
  pass(2);
  equal(below.count(r("peach")), 5, "empty again: the peaches came through too");
});

test("phase 3 files: items, block, models, recipes, catalog and particle line up", () => {
  const pole = readJson("packs/BP/items/fruit_picking_pole.json")["minecraft:item"].components;
  equal(pole["minecraft:durability"].max_durability, PICKING_POLE.durability, "pole durability");
  equal(pole["minecraft:max_stack_size"], 1, "pole does not stack");
  equal(pole["minecraft:repairable"].repair_items[0].items[0], r("fruitwood_planks"), "mended with fruitwood planks");
  const basket = readJson("packs/BP/items/harvest_basket.json")["minecraft:item"].components;
  equal(basket["minecraft:allow_off_hand"], true, "basket goes in the off hand");
  const crate = readJson("packs/BP/blocks/produce_crate.json")["minecraft:block"];
  equal(JSON.stringify(crate.description.states[S("fill")]), JSON.stringify({ values: { min: 0, max: 3 } }), "fill 0–3");
  for (let n = 0; n <= 3; n++) {
    const geo = readJson(`packs/RP/models/blocks/produce_crate_${n}.geo.json`)["minecraft:geometry"][0];
    const cubes = geo.bones.reduce((sum, b) => sum + b.cubes.length, 0);
    assert(cubes >= 5 && cubes <= 8, `produce_crate_${n}: ${cubes} cubes, low-poly`);
  }
  equal(crate.components["minecraft:destructible_by_explosion"], false, "contents safe from explosions");
  const catalog = JSON.stringify(readJson("packs/BP/item_catalog/crafting_item_catalog.json"));
  for (const id of ["fruitwood_planks", PICKING_POLE.id, HARVEST_BASKET.id, PRODUCE_CRATE.id]) assert(catalog.includes(`"${r(id)}"`), `${id} in the creative catalog`);
  // ## No two Harvest shaped recipes share a grid (the series' grids were checked by hand, see tools/generate.mjs).
  const grids = new Map();
  for (const file of readdirSync("packs/BP/recipes")) {
    const shaped = readJson(`packs/BP/recipes/${file}`)["minecraft:recipe_shaped"];
    if (!shaped) continue;
    const key = shaped.pattern.map((row) => [...row].map((c) => (c === " " ? "." : JSON.stringify(shaped.key[c]))).join(",")).join("/");
    assert(!grids.has(key), `${file} has the same grid as ${grids.get(key)}`);
    grids.set(key, file);
  }
  for (const id of [PICKING_POLE.id, HARVEST_BASKET.id, PRODUCE_CRATE.id]) assert([...grids.values()].includes(`${id}.json`), `${id} has a recipe`);
  assert(readdirSync("packs/RP/particles").includes(`${PICKING_POLE.particle}.json`), "leaf particle written");
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
