// The Pickling Jar (醃漬缸). Use an ingredient on it to put it in (four at most).
// When what is inside is exactly one recipe's set, use it with an empty hand to seal
// it; it ferments for the recipe's time (in game ticks, counted on the world clock,
// so it keeps going while nobody is near). Use it again with an empty hand when it
// is done to take the result. An unsealed jar whose contents match nothing gives
// them back to an empty hand. Breaking it drops the ingredients (a sealed batch is lost
// with the ingredients returned, nothing gained).
//
// State kaleidoscope_harvest:contents  empty | fresh | fermenting | done — the colour in its mouth.

import { RECIPES } from "../data/dishes.js";
import { SOUND } from "../data/feedback.js";
import { rid } from "../data/ns.js";
import { PICKLING_JAR } from "../data/stations.js";
import { clearBlockData, getBlockData, now, setBlockData } from "../utils/blockStore.js";
import { consumeMainhand, dropAt, getState, mainhand, playAt, setStates } from "../utils/blocks.js";

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
      setStates(block, { contents: "done" });
      playAt(block, SOUND.jarDone);
    }
  }
  return jar;
}

export function useJar(block, player) {
  const jar = refreshJar(block);
  const held = mainhand(player);
  const sealed = jar.sealedAt !== null;

  if (held) {
    if (sealed || !ACCEPTED.has(held.typeId) || jar.items.length >= PICKLING_JAR.capacity) return false;
    jar.items.push(held.typeId);
    consumeMainhand(player);
    setBlockData(block, jar);
    setStates(block, { contents: "fresh" });
    playAt(block, SOUND.jarAdd);
    return true;
  }

  if (sealed) {
    if (getState(block, "contents") !== "done") return false;
    const recipe = JAR_RECIPES.find((r) => r.result === jar.recipe);
    if (recipe) dropAt(block, rid(recipe.result), recipe.count ?? 1);
    clearBlockData(block);
    setStates(block, { contents: "empty" });
    playAt(block, SOUND.jarOpen);
    return true;
  }

  if (!jar.items.length) return false;
  const recipe = jarRecipeFor(jar.items);
  if (recipe) {
    setBlockData(block, { ...jar, sealedAt: now(), recipe: recipe.result });
    setStates(block, { contents: "fermenting" });
    playAt(block, SOUND.jarSeal);
  } else {
    for (const item of jar.items) dropAt(block, item, 1);
    clearBlockData(block);
    setStates(block, { contents: "empty" });
  }
  return true;
}

export function brokeJar(block) {
  for (const item of getBlockData(block, emptyJar()).items) dropAt(block, item, 1);
  clearBlockData(block);
}

export const picklingJarComponent = {
  onRandomTick({ block }) {
    refreshJar(block);
  },
  onPlayerInteract({ block, player }) {
    if (player) useJar(block, player);
  },
  onPlayerBreak({ block }) {
    brokeJar(block);
  },
};
