// Climate preference (企劃書「氣候偏好」). Bedrock has no seasons, so every
// biome is sorted into one of four climates and every crop names the climate
// it likes. Plain data: no @minecraft imports.
//
//   same climate        ×1
//   one step away       ×0.5
//   two or more steps   does not grow
//   inside a greenhouse ×1 whatever the biome (growth/environment.js)

export const CLIMATES = ["cold", "temperate", "warm", "hot"];

/** Growth multiplier for a crop that likes `preferred` growing in `actual`. */
export function climateMultiplier(preferred, actual) {
  const a = CLIMATES.indexOf(preferred);
  const b = CLIMATES.indexOf(actual);
  if (a < 0 || b < 0) return 1;
  const steps = Math.abs(a - b);
  return steps === 0 ? 1 : steps === 1 ? 0.5 : 0;
}

// ## Hand-sorted from the vanilla biome temperatures (desert 2.0, savanna 1.2,
// ## jungle 0.95, plains 0.8, forest 0.7, taiga 0.25, snowy 0.0), then nudged
// ## so each crop's wild biome in the proposal is inside its own climate.
// ## Matched by substring on the biome id, first match wins, so the more
// ## specific names come first. Tune here; nothing else hard-codes a biome.
const BIOME_RULES = [
  ["frozen", "cold"],
  ["snowy", "cold"],
  ["ice", "cold"],
  ["cold", "cold"],

  ["desert", "hot"],
  ["savanna", "hot"],
  ["mesa", "hot"],
  ["badlands", "hot"],
  ["jungle", "hot"],
  ["mangrove", "hot"],
  ["warm_ocean", "hot"],

  ["grove", "cold"], // snowy slopes / grove (cherry_grove is in EXACT)
  ["peaks", "cold"],
  ["taiga", "cold"],
  ["deep_dark", "cold"],
  ["windswept", "cold"],
  ["extreme_hills", "cold"],
  ["stone_beach", "cold"],

  ["swamp", "warm"],
  ["beach", "warm"],
  ["mushroom", "warm"],
  ["lukewarm", "warm"],
  ["roofed_forest", "warm"],
  ["dark_forest", "warm"],

  ["plains", "temperate"],
  ["sunflower", "temperate"],
  ["forest", "temperate"],
  ["birch", "temperate"],
  ["meadow", "temperate"],
  ["river", "temperate"],
  ["ocean", "temperate"],
];

// "cherry_grove" contains "grove" but is a mild biome.
const EXACT = {
  "minecraft:cherry_grove": "temperate",
  "minecraft:flower_forest": "temperate",
  "minecraft:pale_garden": "temperate",
};

/** Climate of a biome id; unknown biomes (other add-ons, the Nether…) count as temperate. */
export function climateOfBiome(biomeId) {
  if (!biomeId) return "temperate";
  if (EXACT[biomeId]) return EXACT[biomeId];
  const name = biomeId.replace(/^minecraft:/, "");
  for (const [needle, climate] of BIOME_RULES) if (name.includes(needle)) return climate;
  return "temperate";
}
