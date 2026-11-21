// The Juicer (榨汁機). Use a fruit on it to put the fruit in (two at most); use a
// glass bottle on it when it holds two to take a bottle of juice. Two of the same
// fruit give that fruit's juice, two different fruits give mixed juice. 1.1: a fruit
// and a milk bucket give that fruit's milk (papaya, banana); the bucket comes back
// empty at once. An empty hand takes the contents back out (the milk as a milk
// bucket); breaking it drops what is inside. 1.2: with 酒館 Tavern, Tavern's grape
// counts as a grape (data/integrations.js TAVERN_GRAPE).
//
// Convenience update (phase 1): sneaking with a stack of fruit puts in as many as fit;
// sneaking with glass bottles pours one after another, refilling the juicer with the same
// fruit from the player's inventory, while fruit and bottles last (SNEAK_USE.max at most).
// A container above feeds it fruit and bottles, and the juice goes into a container below
// (stations/automation.js). A use that can do nothing gives the refusal cue.
//
// State kaleidoscope_harvest:fruit 0–2 (how full), kaleidoscope_harvest:juice (jug colour).
// The fruits themselves are kept in utils/blockStore.js.

import { RECIPES } from "../data/dishes.js";
import { SOUND } from "../data/feedback.js";
import { TAVERN_GRAPE } from "../data/integrations.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { JUICER, SNEAK_USE, SPLASH_PARTICLE } from "../data/stations.js";
import { clearBlockData, getBlockData, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, getState, isCreative, mainhand, playAt, playSequence, refuse, replaceMainhand, setStates, tintedParticleAt } from "../utils/blocks.js";
import { containerOf, countIn, putInto, roomFor, takeAll, takeFrom } from "../utils/containers.js";
import { registerAutomated, track, untrack } from "./automation.js";
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

/** Empties the juicer after a pour: the jug goes clear with a splash of its colour. */
function emptyJug(block) {
  const colour = getState(block, "juice");
  clearBlockData(block);
  show(block, []);
  splash(block, colour);
}

/**
 * Sneaking with bottles: pour, put the same fruit back in from the inventory, pour again, while
 * bottles and fruit last (SNEAK_USE.max bottles at most). The pours sound one after another.
 */
function pourAll(block, player) {
  const fruits = getBlockData(block, { fruits: [] }).fruits;
  const inventory = containerOf(player);
  const creative = isCreative(player);
  let poured = 0;
  for (;;) {
    const juice = juiceFor(fruits);
    if (!juice || mainhand(player)?.typeId !== JUICER.bottle) break;
    consumeMainhand(player);
    dropAt(block, rid(juice), 1);
    poured++;
    if (poured >= SNEAK_USE.max || mainhand(player)?.typeId !== JUICER.bottle) break;
    // ## A milk bucket is not refilled from the inventory: its empty bucket would have to come back too.
    if (fruits.includes(JUICER.milk) || !inventory) break;
    const refilled = creative ? countIn(inventory, fruits) >= fruits.length : takeAll(inventory, fruits);
    if (!refilled) break;
    splash(block, getState(block, "juice"));
  }
  emptyJug(block);
  playSequence(block, SOUND.juicerPour, poured, SNEAK_USE.gapTicks);
  return true;
}

export function useJuicer(block, player) {
  track(block);
  const fruits = getBlockData(block, { fruits: [] }).fruits;
  const held = mainhand(player);

  const milk = held?.typeId === JUICER.milk && MILK_OF.size > 0;
  if (held && (TAKES.has(held.typeId) || milk)) {
    const free = JUICER.capacity - fruits.length;
    if (free <= 0) return refuse(block);
    // ## One milk at most: two buckets make nothing.
    if (milk && fruits.includes(JUICER.milk)) return refuse(block);
    // ## Sneaking puts in as many as fit (a milk bucket is always one).
    const n = milk || !player.isSneaking ? 1 : Math.min(free, isCreative(player) ? free : held.amount);
    for (let i = 0; i < n; i++) fruits.push(held.typeId);
    if (milk) replaceMainhand(player, JUICER.bucket);
    else consumeMainhand(player, n);
    setBlockData(block, { fruits });
    show(block, fruits);
    splash(block, getState(block, "juice"));
    playSequence(block, SOUND.juicerAdd, n, SNEAK_USE.gapTicks);
    return true;
  }

  if (held?.typeId === JUICER.bottle) {
    const juice = juiceFor(fruits);
    if (!juice) return refuse(block);
    if (player.isSneaking) return pourAll(block, player);
    consumeMainhand(player);
    dropAt(block, rid(juice), 1);
    emptyJug(block);
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
  untrack(block);
}

/** Fruits a container above may feed in: those that make juice by themselves (not milk-only ones). */
const FEEDS = new Set([...JUICE_OF.keys(), ...SAME_AS.keys()]);

/**
 * The fruit to take from `container` next, in slot order: the first one when the juicer is empty,
 * else the same as the one in, else one that makes juice with it.
 */
function nextFruit(container, fruits) {
  const present = [];
  for (let i = 0; i < container.size; i++) {
    const id = container.getItem(i)?.typeId;
    if (id && FEEDS.has(id) && !present.includes(id)) present.push(id);
  }
  if (!fruits.length) return present[0];
  const [first] = fruits;
  return present.find((id) => own(id) === own(first)) ?? present.find((id) => juiceFor([first, id]));
}

/**
 * One automation pass (stations/automation.js): fruit and glass bottles come from the container
 * above, the juice goes into the container below. Nothing is taken that has nowhere to go.
 */
export function automateJuicer(block, above, below) {
  const fruits = getBlockData(block, { fruits: [] }).fruits;
  let added = 0;
  while (above && fruits.length < JUICER.capacity) {
    const id = nextFruit(above, fruits);
    if (!id) break;
    takeFrom(above, [id], 1);
    fruits.push(id);
    added++;
  }
  if (added) {
    setBlockData(block, { fruits });
    show(block, fruits);
    splash(block, getState(block, "juice"));
    playAt(block, SOUND.juicerAdd);
  }
  const juice = juiceFor(fruits);
  if (!juice || !above || !below || !countIn(above, [JUICER.bottle]) || !roomFor(below, rid(juice))) return;
  takeFrom(above, [JUICER.bottle], 1);
  putInto(below, rid(juice), 1);
  emptyJug(block);
  playAt(block, SOUND.juicerPour);
}
registerAutomated(rid(JUICER.id), automateJuicer);

export const juicerComponent = {
  onPlace({ block }) {
    track(block);
    syncJuicer(block);
  },
  onRandomTick({ block }) {
    track(block);
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
