// Fruit trees (企劃書「果樹生長」). A tree is not a vanilla tree: it is a
// sapling that grows through `saplingStages`, then turns into a trunk of Fruit
// Log blocks topped by this tree's fruit-leaf blocks. Each fruit leaf carries
// `fruit_stage`: 0 none → 1 blossom → 2 green fruit → 3 ripe. Picking a ripe
// leaf drops the fruit and puts it back to 0; the tree never dies. Chopping the
// trunk away leaves the fruit leaves without a log, and they fall.
// Plain data: no @minecraft imports.

export const FRUIT_STAGES = ["none", "blossom", "green", "ripe"];

/**
 * The tree's shape, relative to the sapling: trunk blocks, then leaves.
 * ## Fixed shape = a fixed number of fruit leaves per tree, which keeps big
 * ## orchards cheap (企劃書 risk: 限制單棵樹的果葉數). 3 trunk + 21 leaves.
 */
export const TREE_SHAPE = (() => {
  const trunk = [0, 1, 2].map((y) => [0, y, 0]);
  const leaves = [];
  for (const y of [2, 3]) {
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z || y === 3) leaves.push([x, y, z]);
  }
  // y=2 ring (8) + y=3 square (9) + a cross on top (4) = 21; the trunk top at y=2 sits inside.
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) leaves.push([x, 4, z]);
  return { trunk, leaves };
})();

/** How far a fruit leaf looks for a Fruit Log before it falls (blocks, along each axis). */
export const LEAF_LOG_RANGE = 2;

export const TREES = [
  {
    id: "mandarin", zh: "柑橘", en: "Mandarin",
    climate: "warm",
    saplingStages: 4, saplingChance: 0.3, minLightLevel: 9,
    fruitChance: 0.25, fruit: "mandarin", pick: [1, 2],
    look: { leaf: [64, 130, 56], blossom: [250, 250, 240], green: [120, 170, 60], ripe: [244, 150, 40] },
  },
];

export const TREE_BY_ID = new Map(TREES.map((tree) => [tree.id, tree]));

export const saplingBlockId = (tree) => `${tree.id}_sapling`;
export const fruitLeavesBlockId = (tree) => `${tree.id}_fruit_leaves`;
/** One trunk block for every fruit tree. */
export const FRUIT_LOG = { id: "fruit_log", zh: "果木原木", en: "Fruitwood Log" };
