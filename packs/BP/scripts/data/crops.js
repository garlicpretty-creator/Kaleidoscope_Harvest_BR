// Every crop Harvest grows, one row each. Blocks, seed items, loot tables,
// textures, language lines and the growth components all come from this table
// (tools/generate.mjs writes the JSON, growth/*.js reads the rules).
// Plain data: no @minecraft imports.
//
// form (企劃書「種植與生長系統」的六種型態):
//   once         8 stages; breaking a ripe crop drops the produce and seeds, the block is gone.
//   underground  like once, but the produce is under the soil: only the leaves show and
//                turn yellow when ripe; dug with a hoe it gives `hoeBonus` more.
//   repeatable   use the ripe crop to pick it; it drops back to `harvestResetAge`.
//   tall         two blocks high (corn): the lower block holds the stage, the upper block
//                appears from `tallFrom`; breaking either one breaks both.
//   trellis      planted on a Bamboo Trellis; picked like `repeatable`; breaking it gives
//                the trellis back.
//   tree         see data/trees.js.
//
// Rule fields copy the names of Cookery's `crop_growth` (企劃書): growthChance (per random
// tick, before climate), minLightLevel, maxGrowth (last stage), harvestResetAge.
//
// climate: cold | temperate | warm | hot (data/climate.js).
// drops: what a ripe crop gives when broken; [min, max] counts.
// pick: what a ripe repeatable / trellis crop gives when used.
// look: placeholder art (tools/art.mjs) until the real textures are drawn:
//   leaf / ripe colours as [r, g, b].

export const CROPS = [
  {
    id: "napa_cabbage", zh: "大白菜", en: "Napa Cabbage",
    form: "once", climate: "temperate",
    growthChance: 0.45, minLightLevel: 9, maxGrowth: 7,
    seed: "napa_cabbage_seeds", produce: "napa_cabbage",
    drops: { produce: [1, 1], seed: [1, 2] },
    look: { leaf: [150, 196, 98], ripe: [226, 236, 196] },
  },
  {
    id: "scallion", zh: "蔥", en: "Scallion",
    form: "repeatable", climate: "temperate",
    growthChance: 0.45, minLightLevel: 9, maxGrowth: 7, harvestResetAge: 4,
    // ## Scallions are replanted from the scallion itself, like vanilla carrots.
    seed: "scallion", produce: "scallion",
    drops: { produce: [1, 2], seed: [0, 0] },
    pick: [1, 2],
    look: { leaf: [92, 168, 70], ripe: [70, 150, 60] },
  },
  {
    id: "corn", zh: "玉米", en: "Corn",
    form: "tall", climate: "warm",
    growthChance: 0.4, minLightLevel: 9, maxGrowth: 7, tallFrom: 4,
    seed: "corn_seeds", produce: "corn",
    drops: { produce: [1, 2], seed: [1, 2] },
    look: { leaf: [118, 170, 70], ripe: [240, 200, 70] },
  },
  {
    id: "cucumber", zh: "小黃瓜", en: "Cucumber",
    form: "trellis", climate: "warm",
    growthChance: 0.4, minLightLevel: 9, maxGrowth: 7, harvestResetAge: 5,
    seed: "cucumber_seeds", produce: "cucumber",
    drops: { produce: [1, 2], seed: [1, 1] },
    pick: [1, 3],
    look: { leaf: [84, 150, 64], ripe: [60, 120, 50] },
  },
];

export const CROP_BY_ID = new Map(CROPS.map((crop) => [crop.id, crop]));

/** The block id of a crop (the lower block for tall crops). */
export const cropBlockId = (crop) => `${crop.id}_crop`;

/** The Bamboo Trellis every trellis crop is planted on. */
export const TRELLIS = { id: "bamboo_trellis", zh: "竹藤架", en: "Bamboo Trellis" };
