// The Pickling Jar (醃漬缸). Use an ingredient on it to put it in (four at most).
// When what is inside is exactly one recipe's set, use it with an empty hand to seal
// it; it ferments for the recipe's time (in game ticks, counted on the world clock,
// so it keeps going while nobody is near). Use it again with an empty hand when it
// is done to take the result. An unsealed jar whose contents match nothing gives
// them back to an empty hand. Breaking it drops the ingredients (a sealed batch is lost
// with the ingredients returned, nothing gained).
//
// Convenience update (phase 1): sneaking with a stack of an ingredient puts in as many as
// fit. A container above loads a whole recipe and seals it; a finished batch goes into a
// container below (stations/automation.js). An ingredient on a full or sealed jar gives the
// refusal cue.
//
// State kaleidoscope_harvest:contents  empty | fresh | fermenting | done — the colour in its mouth.

import { RECIPES } from "../data/dishes.js";
import { SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { PICKLING_JAR, SNEAK_USE } from "../data/stations.js";
import { clearBlockData, getBlockData, now, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, getState, isCreative, mainhand, playAt, playSequence, refuse, setStates } from "../utils/blocks.js";
import { countIn, putInto, roomFor, takeFrom } from "../utils/containers.js";
import { registerAutomated, track, untrack } from "./automation.js";
import { removeVisual, syncVisual } from "./visuals.js";

/** Copies the contents stage onto the display entity (the lid: open, sealed and rattling, hopping when done). */
export function syncJar(block) {
  syncVisual(block, PICKLING_JAR.visual, { stage: Math.max(PICKLING_JAR.contents.indexOf(getState(block, "contents")), 0) });
}

function setContents(block, contents) {
  setStates(block, { contents });
  syncJar(block);
}

const JAR_RECIPES = RECIPES.filter((r) => r.station === "pickling_jar").map((r) => ({ ...r, set: r.inputs.map(rid).sort() }));
const ACCEPTED = new Set(JAR_RECIPES.flatMap((r) => r.set));

/** The recipe whose inputs are exactly these items, in any order. */
export function jarRecipeFor(items) {
  const key = [...items].sort().join("|");
  return JAR_RECIPES.find((r) => r.set.join("|") === key) ?? null;
}

/** A fresh empty jar: a new object each time, since callers fill it in. */
const emptyJar = () => ({ items: [], sealedAt: null, recipe: null });

/** Moves a sealed jar to "done" once its time is up. Returns the jar's data. */
export function refreshJar(block) {
  const jar = getBlockData(block, emptyJar());
  if (jar.sealedAt !== null && getState(block, "contents") === "fermenting") {
    const recipe = JAR_RECIPES.find((r) => r.result === jar.recipe);
    if (recipe && now() - jar.sealedAt >= recipe.time) {
      setContents(block, "done");
      playAt(block, SOUND.jarDone);
    }
  }
  return jar;
}

export function useJar(block, player) {
  track(block);
  const jar = refreshJar(block);
  const held = mainhand(player);
  const sealed = jar.sealedAt !== null;

  if (held) {
    if (!ACCEPTED.has(held.typeId)) return false;
    const free = PICKLING_JAR.capacity - jar.items.length;
    if (sealed || free <= 0) return refuse(block);
    // ## Sneaking puts in as many as fit.
    const n = !player.isSneaking ? 1 : Math.min(free, isCreative(player) ? free : held.amount);
    for (let i = 0; i < n; i++) jar.items.push(held.typeId);
    consumeMainhand(player, n);
    setBlockData(block, jar);
    setContents(block, "fresh");
    playSequence(block, SOUND.jarAdd, n, SNEAK_USE.gapTicks);
    return true;
  }

  if (sealed) {
    if (getState(block, "contents") !== "done") return false;
    const recipe = JAR_RECIPES.find((r) => r.result === jar.recipe);
    if (recipe) dropAt(block, rid(recipe.result), recipe.count ?? 1);
    clearBlockData(block);
    setContents(block, "empty");
    playAt(block, SOUND.jarOpen);
    return true;
  }

  if (!jar.items.length) return false;
  const recipe = jarRecipeFor(jar.items);
  if (recipe) {
    setBlockData(block, { ...jar, sealedAt: now(), recipe: recipe.result });
    setContents(block, "fermenting");
    playAt(block, SOUND.jarSeal);
  } else {
    for (const item of jar.items) dropAt(block, item, 1);
    clearBlockData(block);
    setContents(block, "empty");
  }
  return true;
}

export function brokeJar(block) {
  for (const item of getBlockData(block, emptyJar()).items) dropAt(block, item, 1);
  clearBlockData(block);
  removeVisual(block, PICKLING_JAR.visual);
  untrack(block);
}

/** What `set` still needs on top of `items` (both lists of ids), or null when `items` holds something else. */
function stillNeeded(set, items) {
  const rest = [...set];
  for (const item of items) {
    const i = rest.indexOf(item);
    if (i < 0) return null;
    rest.splice(i, 1);
  }
  return rest;
}

/** Larger recipes first, so kimchi is not sealed as pickled napa cabbage halfway through. */
const BY_SIZE = [...JAR_RECIPES].sort((a, b) => b.set.length - a.set.length);

/**
 * One automation pass (stations/automation.js). A finished batch goes into the container below
 * (when it fits). An open jar takes from the container above the rest of the first recipe it can
 * complete with what is already in it, and seals itself; it takes nothing it cannot finish.
 */
export function automateJar(block, above, below) {
  const jar = refreshJar(block);
  if (jar.sealedAt !== null) {
    if (!below || getState(block, "contents") !== "done") return;
    const recipe = JAR_RECIPES.find((r) => r.result === jar.recipe);
    if (recipe && !roomFor(below, rid(recipe.result), recipe.count ?? 1)) return;
    if (recipe) putInto(below, rid(recipe.result), recipe.count ?? 1);
    clearBlockData(block);
    setContents(block, "empty");
    playAt(block, SOUND.jarOpen);
    return;
  }
  if (!above) return;
  for (const recipe of BY_SIZE) {
    const rest = stillNeeded(recipe.set, jar.items);
    if (!rest) continue;
    const need = new Map();
    for (const id of rest) need.set(id, (need.get(id) ?? 0) + 1);
    if ([...need].some(([id, n]) => countIn(above, [id]) < n)) continue;
    for (const [id, n] of need) takeFrom(above, [id], n);
    setBlockData(block, { items: [...recipe.set], sealedAt: now(), recipe: recipe.result });
    setContents(block, "fermenting");
    if (rest.length) playAt(block, SOUND.jarAdd);
    playAt(block, SOUND.jarSeal);
    return;
  }
}
registerAutomated(rid(PICKLING_JAR.id), automateJar);

export const picklingJarComponent = {
  onPlace({ block }) {
    track(block);
    syncJar(block);
  },
  onRandomTick({ block }) {
    track(block);
    refreshJar(block);
    syncJar(block);
  },
  onPlayerInteract({ block, player }) {
    if (!player) return;
    if (!useJar(block, player)) syncJar(block);
  },
  onPlayerBreak({ block }) {
    brokeJar(block);
  },
};
