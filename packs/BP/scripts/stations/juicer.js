// The Juicer (榨汁機). Use a fruit on it to put the fruit in (two at most); use a
// glass bottle on it when it holds two to take a bottle of juice. Two of the same
// fruit give that fruit's juice, two different fruits give mixed juice. 1.1: a fruit
// and a milk bucket give that fruit's milk (papaya, banana); the bucket comes back
// empty at once. An empty hand takes the contents back out (the milk as a milk
// bucket); breaking it drops what is inside. 1.2: with 酒館 Tavern, Tavern's grape
// counts as a grape (data/integrations.js TAVERN_GRAPE).
//
// State kaleidoscope_harvest:fruit 0–2 (how full), kaleidoscope_harvest:juice (jug colour).
// The fruits themselves are kept in utils/blockStore.js.

import { RECIPES } from "../data/dishes.js";
import { SOUND } from "../data/feedback.js";
import { TAVERN_GRAPE } from "../data/integrations.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { JUICER, SPLASH_PARTICLE } from "../data/stations.js";
import { clearBlockData, getBlockData, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, getState, mainhand, playAt, replaceMainhand, setStates, tintedParticleAt } from "../utils/blocks.js";
import { removeVisual, syncVisual } from "./visuals.js";

/** fruit id → juice id, for every juice that can be made right now. */
const JUICE_OF = new Map(RECIPES.filter((r) => r.station === "juicer" && r.input !== "*" && !r.milk).map((r) => [rid(r.input), r.result]));
/** fruit id → milk drink id (1.1). */
const MILK_OF = new Map(RECIPES.filter((r) => r.station === "juicer" && r.milk).map((r) => [rid(r.input), r.result]));
/** Other packs' fruit that counts as a Harvest fruit (the id stays as it is, so it comes back out the same). */
const SAME_AS = new Map([[TAVERN_GRAPE.tavern, rid(TAVERN_GRAPE.harvest)]]);
const own = (id) => SAME_AS.get(id) ?? id;
/** Fruits the juicer takes: those with a juice, and those with only a milk drink. */
const TAKES = new Set([...JUICE_OF.keys(), ...MILK_OF.keys(), ...SAME_AS.keys()]);
const MIXED = RECIPES.some((r) => r.station === "juicer" && r.input === "*") ? JUICER.mixed : null;
const bare = (id) => id.slice(NAMESPACE.length + 1);

/** The juice two fruits (or a fruit and milk) make, or null. */
export function juiceFor(fruits) {
  const [a, b] = fruits.map(own);
  if (!a || !b) return null;
  if (a === JUICER.milk || b === JUICER.milk) {
    const fruit = a === JUICER.milk ? b : a;
    return fruit === JUICER.milk ? null : MILK_OF.get(fruit) ?? null;
  }
  if (a === b) return JUICE_OF.get(a) ?? null;
  // ## Mixed juice is two juicing fruits; a fruit kept only for milk makes nothing with another fruit.
  return JUICE_OF.has(a) && JUICE_OF.has(b) ? MIXED : null;
}

/** Copies the block's fill and colour onto the display entity (the moving juice and reamer). */
export function syncJuicer(block) {
  const level = getState(block, "fruit");
  const juice = JUICER.colours.indexOf(getState(block, "juice"));
  syncVisual(block, JUICER.visual, { level, juice: Math.max(juice, 0) });
}

function show(block, fruits) {
  const fruit = own(fruits.find((id) => id !== JUICER.milk) ?? "");
  const colour = !fruits.length ? "empty" : fruits.includes(JUICER.milk) ? JUICER.milkColour : JUICER.colourOf[bare(fruit)] ?? "orange";
  setStates(block, { fruit: fruits.length, juice: colour });
  syncJuicer(block);
}

/** Juice-coloured drops over the jug. */
const splash = (block, colour) => tintedParticleAt(block, rid(SPLASH_PARTICLE), JUICER.splash[colour] ?? JUICER.splash.orange);

export function useJuicer(block, player) {
  const fruits = getBlockData(block, { fruits: [] }).fruits;
  const held = mainhand(player);

  const milk = held?.typeId === JUICER.milk && MILK_OF.size > 0;
  if (held && (TAKES.has(held.typeId) || milk)) {
    if (fruits.length >= JUICER.capacity) return false;
    // ## One milk at most: two buckets make nothing.
    if (milk && fruits.includes(JUICER.milk)) return false;
    fruits.push(held.typeId);
    if (milk) replaceMainhand(player, JUICER.bucket);
    else consumeMainhand(player);
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
