// Fruit trees (企劃書「果樹生長」, as revised with art PR #4). A tree is not a vanilla
// tree: a sapling grows through `saplingStages`, then the script places the tree's
// `tree_feature` (packs/BP/features/trees/, written by tools/art/tree_shapes.py) where the
// sapling stands. The feature builds the trunk of `trunk` blocks and this tree's leaves.
//
// Leaves have two looks only: bare → blossom. A blossoming leaf with air below it sets a
// hanging fruit block there (like vanilla cocoa) and goes back to bare; the fruit grows
// small green → big green → ripe (`FRUIT_STAGES`), and picking it removes the block. The
// tree never dies; chopping the trunk away leaves the leaves without a trunk, and they fall.
// Plain data: no @minecraft imports.
//
// Cinnamon has no fruit block (`bark: true`): its blossom is a flush of red-brown new
// growth, and using it strips a piece of bark (企劃書：八角與肉桂歸在果樹，長成大樹後摘果或剝皮).
//
// wild: where the tree grows wild. Two kinds of world generation use it: whole trees from
//   packs/BP/feature_rules/trees/ (tools/art/tree_shapes.py; the names here follow those rules),
//   and a few wild saplings (tools/generate.mjs, like the wild crops), to dig up and take home.
// village: see data/village.js.

/** Hanging fruit stages (bones stage0 … stage2 of geometry.kaleidoscope_harvest.<tree>_fruit). */
export const FRUIT_STAGES = ["small_green", "big_green", "ripe"];

/** How far a leaf looks for its trunk before it falls (blocks, along each axis). */
export const LEAF_LOG_RANGE = 4;

/** Trunk blocks. Every tree uses the Fruitwood Log except the banana. */
export const FRUITWOOD_LOG = { id: "fruitwood_log", zh: "果木原木", en: "Fruitwood Log" };
export const BANANA_TRUNK = { id: "banana_trunk", zh: "香蕉假莖", en: "Banana Trunk" };
export const TRUNKS = [FRUITWOOD_LOG, BANANA_TRUNK];
/** 1.1: planks sawn from the Fruitwood Log, tagged as planks so vanilla wood recipes take them. */
export const FRUITWOOD_PLANKS = { id: "fruitwood_planks", zh: "果木木板", en: "Fruitwood Planks", from: FRUITWOOD_LOG.id, count: 4 };

const tree = (id, zh, en, climate, fruit, look, extra = {}) => ({
  id, zh, en, climate,
  saplingStages: 4, saplingChance: 0.3, minLightLevel: 9,
  // ## One chance for each step: bare → blossom, blossom → a fruit below, and each fruit stage.
  fruitChance: 0.25, fruit, pick: [1, 2],
  trunk: FRUITWOOD_LOG.id,
  look,
  ...extra,
});
const leaf = (ripe, blossom = [250, 250, 240]) => ({ leaf: [64, 130, 56], blossom, ripe });

export const TREES = [
  tree("mandarin", "柑橘", "Mandarin", "warm", "mandarin", leaf([244, 150, 40]), { village: ["plains", "savanna"] }),
  tree("sweet_orange", "柳橙", "Orange", "warm", "sweet_orange", leaf([250, 140, 30]), { wild: ["plains"] }),
  tree("lemon", "檸檬", "Lemon", "warm", "lemon", leaf([246, 226, 70]), { wild: ["savanna"] }),
  tree("peach", "桃", "Peach", "temperate", "peach", leaf([250, 170, 150], [250, 190, 210]), { wild: ["flower_forest"] }),
  tree("pear", "梨", "Pear", "temperate", "pear", leaf([220, 220, 130]), { wild: ["forest"] }),
  // ## 溫和偏涼, wild on the taiga's edge: temperate, so taiga (cold) grows it at half speed.
  tree("persimmon", "柿子", "Persimmon", "temperate", "persimmon", leaf([240, 120, 30]), { wild: ["taiga"] }),
  tree("lychee", "荔枝", "Lychee", "hot", "lychee", leaf([200, 50, 60]), { wild: ["jungle"] }),
  tree("mango", "芒果", "Mango", "hot", "mango", leaf([244, 184, 40]), { wild: ["jungle"] }),
  tree("banana", "香蕉", "Banana", "hot", "banana", leaf([246, 220, 80], [180, 60, 80]), { wild: ["jungle"], trunk: BANANA_TRUNK.id }),
  // ## 繁茂山丘: no such vanilla biome; the tree rule uses bamboo jungles (docs/art/TREE_SHAPES.md).
  tree("star_anise", "八角", "Star Anise", "warm", "star_anise", leaf([140, 70, 40]), { wild: ["bamboo"] }),
  tree("cinnamon", "肉桂", "Cinnamon", "warm", "cinnamon_bark", leaf([170, 70, 50], [200, 120, 90]), { wild: ["jungle_edge"], pick: [1, 1], bark: true }),
  // --- 1.1 -----------------------------------------------------------------------------------------
  tree("longan", "龍眼", "Longan", "hot", "longan", leaf([190, 150, 90], [240, 230, 180]), { wild: ["jungle"] }),
  tree("loquat", "枇杷", "Loquat", "warm", "loquat", leaf([246, 170, 50]), { wild: ["flower_forest"] }),
  tree("star_fruit", "楊桃", "Star Fruit", "hot", "star_fruit", leaf([240, 210, 70], [220, 150, 200]), { wild: ["jungle_edge"] }),
  // ## A tall single trunk with a tuft of leaves at the top; the fruit hangs under the tuft.
  tree("papaya", "木瓜", "Papaya", "hot", "papaya", leaf([246, 160, 60], [250, 250, 230]), { wild: ["savanna"] }),
];


export const saplingBlockId = (t) => `${t.id}_sapling`;
export const wildSaplingFeature = (t) => `wild_${t.id}_sapling`;
/** Biome tags for the wild-sapling rules: "jungle_edge" is jungle + edge in the tree rules, a plain tag here. */
export const saplingBiomes = (t) => [...new Set(t.wild.map((b) => (b === "jungle_edge" ? "jungle" : b)))];
export const leavesBlockId = (t) => `${t.id}_leaves`;
export const fruitBlockId = (t) => `${t.id}_fruit`;
/** The tree_feature a grown sapling places (packs/BP/features/trees/). */
export const treeFeatureId = (t) => `${t.id}_tree_feature`;
