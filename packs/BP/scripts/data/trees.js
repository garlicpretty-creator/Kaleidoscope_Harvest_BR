// Fruit trees (企劃書「果樹生長」). A tree is not a vanilla tree: it is a
// sapling that grows through `saplingStages`, then turns into a trunk of
// `trunk` blocks topped by this tree's fruit-leaf blocks. Each fruit leaf carries
// `fruit_stage`: 0 none → 1 blossom → 2 green fruit → 3 ripe. Picking a ripe
// leaf drops the fruit and puts it back to 0; the tree never dies. Chopping the
// trunk away leaves the fruit leaves without a trunk, and they fall.
// Plain data: no @minecraft imports.
//
// Cinnamon has no fruit: its "ripe" leaves are red-brown new growth, and picking
// them strips a piece of bark (企劃書：八角與肉桂歸在果樹，長成大樹後摘果或剝皮).
//
// wild: biome tags where a wild sapling grows (planted by world generation like the
//   wild crops, so it grows into a tree once the chunk is loaded long enough).
// village: see data/village.js.

export const FRUIT_STAGES = ["none", "blossom", "green", "ripe"];

/**
 * Tree shapes, relative to the sapling: trunk blocks, then leaves.
 * ## A fixed shape is a fixed number of fruit leaves per tree, which keeps big
 * ## orchards cheap (企劃書 risk: 限制單棵樹的果葉數).
 */
export const TREE_SHAPES = {
  /** 3 trunk + 21 leaves: a ring at y2, a square at y3, a cross on top. */
  round: (() => {
    const trunk = [0, 1, 2].map((y) => [0, y, 0]);
    const leaves = [];
    for (const y of [2, 3]) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z || y === 3) leaves.push([x, y, z]);
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) leaves.push([x, 4, z]);
    return { trunk, leaves };
  })(),
  /** 4 trunk + 9 leaves: a crown on top with fronds hanging one block lower. */
  palm: (() => {
    const trunk = [0, 1, 2, 3].map((y) => [0, y, 0]);
    const leaves = [[0, 4, 0], [1, 4, 0], [-1, 4, 0], [0, 4, 1], [0, 4, -1], [2, 3, 0], [-2, 3, 0], [0, 3, 2], [0, 3, -2]];
    return { trunk, leaves };
  })(),
};
/** The shape most trees use (kept under its old name for the growth code). */
export const TREE_SHAPE = TREE_SHAPES.round;

/** How far a fruit leaf looks for its trunk before it falls (blocks, along each axis). */
export const LEAF_LOG_RANGE = 2;

/** Trunk blocks. Every tree uses the Fruitwood Log except the banana. */
export const FRUIT_LOG = { id: "fruit_log", zh: "果木原木", en: "Fruitwood Log" };
export const BANANA_TRUNK = { id: "banana_trunk", zh: "香蕉假莖", en: "Banana Trunk" };
export const TRUNKS = [FRUIT_LOG, BANANA_TRUNK];

const tree = (id, zh, en, climate, fruit, look, extra = {}) => ({
  id, zh, en, climate,
  saplingStages: 4, saplingChance: 0.3, minLightLevel: 9,
  fruitChance: 0.25, fruit, pick: [1, 2],
  shape: "round", trunk: FRUIT_LOG.id,
  look,
  ...extra,
});
const leaf = (ripe, blossom = [250, 250, 240]) => ({ leaf: [64, 130, 56], blossom, green: [120, 170, 60], ripe });

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
  tree("banana", "香蕉", "Banana", "hot", "banana", leaf([246, 220, 80], [180, 60, 80]), { wild: ["jungle"], shape: "palm", trunk: BANANA_TRUNK.id }),
  // ## 繁茂山丘: the dark (roofed) forest, a warm biome in data/climate.js.
  tree("star_anise", "八角", "Star Anise", "warm", "star_anise", leaf([140, 70, 40]), { wild: ["roofed"] }),
  tree("cinnamon", "肉桂", "Cinnamon", "warm", "cinnamon_bark", leaf([170, 70, 50], [200, 120, 90]), { wild: ["jungle"], pick: [1, 1] }),
];

export const TREE_BY_ID = new Map(TREES.map((t) => [t.id, t]));

export const saplingBlockId = (t) => `${t.id}_sapling`;
export const fruitLeavesBlockId = (t) => `${t.id}_fruit_leaves`;
export const wildSaplingFeature = (t) => `wild_${t.id}_sapling`;
