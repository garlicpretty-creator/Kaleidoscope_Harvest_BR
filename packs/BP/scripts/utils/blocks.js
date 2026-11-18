// Small helpers with no lifecycle of their own: block states, the player's
// hand, dropping items, sounds and particles.

import { EquipmentSlot, GameMode, ItemStack, MolangVariableMap } from "@minecraft/server";
import { PARTICLE_VARIABLES } from "../data/feedback.js";
import { state } from "../data/ns.js";

// --- Randomness (tests replace it) ---------------------------------------------------

let random = Math.random;
/** Test hook: makes every roll come from `fn` (restore with Math.random). */
export function setRandom(fn) {
  random = fn;
}
export const roll = () => random();
/** A whole number in [min, max]. */
export const rollRange = ([min, max]) => min + Math.floor(random() * (max - min + 1));

// --- Block states ----------------------------------------------------------------------

export function getState(block, name) {
  return block.permutation.getState(state(name));
}
export function setStates(block, states) {
  let p = block.permutation;
  for (const [name, value] of Object.entries(states)) p = p.withState(state(name), value);
  block.setPermutation(p);
}

/** Breaks a block as if mined, so its loot table drops (and nothing if it is gone already). */
export function destroyBlock(block) {
  const { x, y, z } = block.location;
  try {
    block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
  } catch {
    block.setType("minecraft:air");
  }
}

// --- The player's hand ------------------------------------------------------------------

export function isCreative(player) {
  try {
    return player.getGameMode() === GameMode.Creative;
  } catch {
    return false;
  }
}
export function mainhand(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
}
/** Uses up `n` of the held stack (never in creative). */
export function consumeMainhand(player, n = 1) {
  if (isCreative(player)) return;
  const equippable = player.getComponent("minecraft:equippable");
  const stack = equippable?.getEquipment(EquipmentSlot.Mainhand);
  if (!stack) return;
  if (stack.amount > n) {
    stack.amount -= n;
    equippable.setEquipment(EquipmentSlot.Mainhand, stack);
  } else {
    equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
  }
}

/** Uses up one of the held stack and gives `typeId` in its place (a milk bucket → an empty bucket). */
export function replaceMainhand(player, typeId) {
  if (isCreative(player)) return;
  const equippable = player.getComponent("minecraft:equippable");
  const stack = equippable?.getEquipment(EquipmentSlot.Mainhand);
  if (!stack) return;
  if (stack.amount > 1) {
    stack.amount -= 1;
    equippable.setEquipment(EquipmentSlot.Mainhand, stack);
    const left = player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(typeId, 1));
    if (left) player.dimension.spawnItem(left, player.location);
  } else {
    equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack(typeId, 1));
  }
}

// --- Drops and feedback --------------------------------------------------------------------

const centre = ({ x, y, z }) => ({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });

/** Drops `count` of an item on the block. */
export function dropAt(block, typeId, count) {
  if (count <= 0) return;
  block.dimension.spawnItem(new ItemStack(typeId, count), centre(block.location));
}

export function playAt(block, sound) {
  try {
    block.dimension.playSound(sound, centre(block.location));
  } catch {
    // ## A missing sound id must never break a harvest.
  }
}

/** A tinted particle just above the block (variable.color = rgb, alpha 1); used for juice splashes. */
export function tintedParticleAt(block, particle, [red, green, blue], dy = 0.85) {
  try {
    const vars = new MolangVariableMap();
    vars.setColorRGBA("variable.color", { red, green, blue, alpha: 1 });
    const { x, y, z } = block.location;
    block.dimension.spawnParticle(particle, { x: x + 0.5, y: y + dy, z: z + 0.5 }, vars);
  } catch {
    // ## Feedback only: never worth an error.
  }
}

export function particleAt(block, particle) {
  try {
    const wants = PARTICLE_VARIABLES[particle];
    if (!wants) {
      block.dimension.spawnParticle(particle, centre(block.location));
      return;
    }
    const vars = new MolangVariableMap();
    const [red, green, blue, alpha] = wants.color.rgba;
    vars.setColorRGBA(wants.color.variable, { red, green, blue, alpha });
    const [x, y, z] = wants.vector.xyz;
    vars.setVector3(wants.vector.variable, { x, y, z });
    block.dimension.spawnParticle(particle, centre(block.location), vars);
  } catch {
    // ## Same for particles: an unloaded chunk or a bad id is not worth an error.
  }
}
