// The Juicer (榨汁機). Use a fruit on it to put the fruit in (two at most); use a
// glass bottle on it when it holds two to take a bottle of juice. Two of the same
// fruit give that fruit's juice, two different fruits give mixed juice. An empty
// hand takes the fruit back out; breaking it drops what is inside.
//
// State kaleidoscope_harvest:fruit 0–2 (how full), kaleidoscope_harvest:juice (jug colour).
// The fruits themselves are kept in utils/blockStore.js.

import { RECIPES } from "../data/dishes.js";
import { SOUND } from "../data/feedback.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { JUICER } from "../data/stations.js";
import { clearBlockData, getBlockData, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, mainhand, playAt, setStates } from "../utils/blocks.js";

/** fruit id → juice id, for every juice that can be made right now. */
const JUICE_OF = new Map(RECIPES.filter((r) => r.station === "juicer" && r.input !== "*").map((r) => [rid(r.input), r.result]));
const MIXED = RECIPES.some((r) => r.station === "juicer" && r.input === "*") ? JUICER.mixed : null;
const bare = (id) => id.slice(NAMESPACE.length + 1);

export const juicerFruits = () => [...JUICE_OF.keys()];

/** The juice two fruits make, or null. */
export function juiceFor([a, b]) {
  if (!a || !b) return null;
  if (a === b) return JUICE_OF.get(a) ?? null;
  return MIXED;
}

function show(block, fruits) {
  const colour = fruits.length ? JUICER.colourOf[bare(fruits[0])] ?? "orange" : "empty";
  setStates(block, { fruit: fruits.length, juice: colour });
}

export function useJuicer(block, player) {
  const fruits = getBlockData(block, { fruits: [] }).fruits;
  const held = mainhand(player);

  if (held && JUICE_OF.has(held.typeId)) {
    if (fruits.length >= JUICER.capacity) return false;
    fruits.push(held.typeId);
    consumeMainhand(player);
    setBlockData(block, { fruits });
    show(block, fruits);
    playAt(block, SOUND.juicerAdd);
    return true;
  }

  if (held?.typeId === JUICER.bottle) {
    const juice = juiceFor(fruits);
    if (!juice) return false;
    consumeMainhand(player);
    dropAt(block, rid(juice), 1);
    clearBlockData(block);
    show(block, []);
    playAt(block, SOUND.juicerPour);
    return true;
  }

  if (!held && fruits.length) {
    for (const fruit of fruits) dropAt(block, fruit, 1);
    clearBlockData(block);
    show(block, []);
    return true;
  }
  return false;
}

/** Breaking a juicer gives its fruit back. */
export function brokeJuicer(block) {
  for (const fruit of getBlockData(block, { fruits: [] }).fruits) dropAt(block, fruit, 1);
  clearBlockData(block);
}

export const juicerComponent = {
  onPlayerInteract({ block, player }) {
    if (player) useJuicer(block, player);
  },
  onPlayerBreak({ block }) {
    brokeJuicer(block);
  },
};
