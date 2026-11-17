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
import { JUICER, SPLASH_PARTICLE } from "../data/stations.js";
import { clearBlockData, getBlockData, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, getState, mainhand, playAt, setStates, tintedParticleAt } from "../utils/blocks.js";
import { removeVisual, syncVisual } from "./visuals.js";

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

/** Copies the block's fill and colour onto the display entity (the moving juice and reamer). */
export function syncJuicer(block) {
  const level = getState(block, "fruit");
  const juice = JUICER.colours.indexOf(getState(block, "juice"));
  syncVisual(block, JUICER.visual, { level, juice: Math.max(juice, 0) });
}

function show(block, fruits) {
  const colour = fruits.length ? JUICER.colourOf[bare(fruits[0])] ?? "orange" : "empty";
  setStates(block, { fruit: fruits.length, juice: colour });
  syncJuicer(block);
}

/** Juice-coloured drops over the jug. */
const splash = (block, colour) => tintedParticleAt(block, rid(SPLASH_PARTICLE), JUICER.splash[colour] ?? JUICER.splash.orange);

export function useJuicer(block, player) {
  const fruits = getBlockData(block, { fruits: [] }).fruits;
  const held = mainhand(player);

  if (held && JUICE_OF.has(held.typeId)) {
    if (fruits.length >= JUICER.capacity) return false;
    fruits.push(held.typeId);
    consumeMainhand(player);
    setBlockData(block, { fruits });
    show(block, fruits);
    splash(block, getState(block, "juice"));
    playAt(block, SOUND.juicerAdd);
    return true;
  }

  if (held?.typeId === JUICER.bottle) {
    const juice = juiceFor(fruits);
    if (!juice) return false;
    const colour = getState(block, "juice");
    consumeMainhand(player);
    dropAt(block, rid(juice), 1);
    clearBlockData(block);
    show(block, []);
    splash(block, colour);
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
  removeVisual(block, JUICER.visual);
}

export const juicerComponent = {
  onPlace({ block }) {
    syncJuicer(block);
  },
  onRandomTick({ block }) {
    syncJuicer(block);
  },
  onPlayerInteract({ block, player }) {
    if (!player) return;
    if (!useJuicer(block, player)) syncJuicer(block);
  },
  onPlayerBreak({ block }) {
    brokeJuicer(block);
  },
};
