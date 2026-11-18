// What a growing plant reads from the world around it: the biome's climate,
// whether it stands in a greenhouse, its light and its soil.

import { climateMultiplier, climateOfBiome } from "../data/climate.js";
import { NAMESPACE } from "../data/ns.js";

/** Climate at a block; temperate when the biome cannot be read. */
export function climateAt(block) {
  try {
    return climateOfBiome(block.dimension.getBiome(block.location)?.id);
  } catch {
    return "temperate";
  }
}

// --- Greenhouse (企劃書：玻璃完整罩住的空間內忽略氣候偏好) --------------------------
//
// ## A full flood fill on every random tick would be too costly, so the check is
// ## what a player can see from the crop: glass somewhere straight above (with
// ## only air and plants in between), and a wall in each of the four directions
// ## at the crop's own height. Any solid block counts as wall, so glass houses
// ## with wooden frames and doors work; only the roof has to be glass.

export const GREENHOUSE_REACH = { up: 8, side: 8 };

const isGlass = (typeId) => typeId.endsWith("glass") || typeId.endsWith("glass_pane") || typeId === "minecraft:tinted_glass";

/** Blocks that do not close a greenhouse: air, water and whatever grows inside one. */
const PLANT = /(_crop|short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|wheat|carrots|potatoes|beetroot|sapling)$/;
function isOpen(block) {
  if (!block) return true;
  const id = block.typeId;
  if (isGlass(id)) return false;
  if (id === "minecraft:air" || id === "minecraft:water" || id === "minecraft:light_block") return true;
  // ## Harvest's own crops, trellises, saplings, leaves and fruit; its trunks are walls.
  if (id.startsWith(`${NAMESPACE}:`)) return !id.endsWith(":fruitwood_log") && !id.endsWith(":banana_trunk");
  return PLANT.test(id);
}

export function inGreenhouse(block) {
  const { dimension } = block;
  const { x, y, z } = block.location;
  let roof = false;
  for (let dy = 1; dy <= GREENHOUSE_REACH.up; dy++) {
    const above = dimension.getBlock({ x, y: y + dy, z });
    if (!above) break;
    if (isGlass(above.typeId)) {
      roof = true;
      break;
    }
    if (!isOpen(above)) return false;
  }
  if (!roof) return false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let wall = false;
    for (let d = 1; d <= GREENHOUSE_REACH.side; d++) {
      const side = dimension.getBlock({ x: x + dx * d, y, z: z + dz * d });
      if (!side) break;
      if (!isOpen(side)) {
        wall = true;
        break;
      }
    }
    if (!wall) return false;
  }
  return true;
}

/**
 * The growth multiplier of a plant that likes `preferred`, standing at `block`:
 * 1 in a greenhouse, otherwise the climate rule.
 */
export function growthMultiplier(block, preferred) {
  const multiplier = climateMultiplier(preferred, climateAt(block));
  if (multiplier >= 1) return 1;
  return inGreenhouse(block) ? 1 : multiplier;
}

/** True when the block is bright enough; true as well when this game version cannot tell. */
export function bright(block, minLightLevel) {
  if (!minLightLevel) return true;
  try {
    if (typeof block.getLightLevel !== "function") return true;
    return block.getLightLevel() >= minLightLevel;
  } catch {
    return true;
  }
}

/** Ground a bush or sapling grows in (data/crops.js WILD_SOIL plus farmland). */
const SOIL = new Set(["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:dirt_with_roots", "minecraft:moss_block", "minecraft:mud", "minecraft:farmland"]);
export const isSoil = (block) => Boolean(block && SOIL.has(block.typeId));

/** Farmland, or any block tagged as Cookery farmland (its paddy field). */
export function isFarmland(block) {
  if (!block) return false;
  if (block.typeId === "minecraft:farmland") return true;
  try {
    return block.hasTag("kaleidoscope_cookery:farmland");
  } catch {
    return false;
  }
}

// --- Water (1.1: aquatic crops) ----------------------------------------------------------------
//
// ## An aquatic crop grows on Cookery's paddy field (a block with Cookery's farmland tag that is not
// ## vanilla farmland), or waterlogged in plain water over mud, clay, dirt, grass or sand.

const WATER_SOIL = new Set(["minecraft:mud", "minecraft:clay", "minecraft:dirt", "minecraft:grass_block", "minecraft:sand"]);

/** Cookery's paddy field: tagged as Cookery farmland, but not vanilla farmland. */
export function isPaddy(block) {
  if (!block || block.typeId === "minecraft:farmland") return false;
  try {
    return block.hasTag("kaleidoscope_cookery:farmland");
  } catch {
    return false;
  }
}

/** Ground an aquatic crop may stand on: a paddy field or the bed of shallow water. */
export const isWaterBed = (block) => Boolean(block && (isPaddy(block) || WATER_SOIL.has(block.typeId)));

function waterlogged(block) {
  try {
    return block.isWaterlogged === true;
  } catch {
    return false;
  }
}

/** True when an aquatic crop at `block` has its water: a paddy below, or water around it. */
export function hasWater(block) {
  const below = block.below();
  if (isPaddy(below)) return true;
  return Boolean(below && WATER_SOIL.has(below.typeId) && waterlogged(block));
}
