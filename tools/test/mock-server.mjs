// A small in-memory stand-in for @minecraft/server, enough to run Harvest's
// scripts in Node (same idea as Ranching's tools/test/mock-server.mjs, cut down
// to blocks). Harvest blocks read their states, custom components, permutations
// and loot tables from the real generated block JSON, so the tests also check
// the generated files.
//
// Not a Minecraft emulator: no physics, no rendering, no placement rules.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BP = join(root, "packs", "BP");

const BLOCK_DEFS = new Map();
for (const file of readdirSync(join(BP, "blocks"))) {
  const def = JSON.parse(readFileSync(join(BP, "blocks", file), "utf8"))["minecraft:block"];
  BLOCK_DEFS.set(def.description.identifier, def);
}
const ITEM_TAGS = new Map([
  ["minecraft:iron_hoe", ["minecraft:is_hoe"]],
  ["minecraft:iron_axe", ["minecraft:is_axe"]],
]);
for (const file of readdirSync(join(BP, "items"))) {
  const item = JSON.parse(readFileSync(join(BP, "items", file), "utf8"))["minecraft:item"];
  const tags = item.components?.["minecraft:tags"]?.tags;
  if (tags) ITEM_TAGS.set(item.description.identifier, tags);
}

// --- Events ----------------------------------------------------------------------------

class Signal {
  constructor() {
    this.listeners = [];
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return listener;
  }
  unsubscribe(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  fire(event) {
    for (const listener of [...this.listeners]) listener(event);
    return event;
  }
}

export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand" };
export const GameMode = { Survival: "Survival", Creative: "Creative" };

// --- Items ------------------------------------------------------------------------------

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId.includes(":") ? typeId : `minecraft:${typeId}`;
    this.amount = amount;
  }
  hasTag(tag) {
    return (ITEM_TAGS.get(this.typeId) ?? []).includes(tag);
  }
  getTags() {
    return ITEM_TAGS.get(this.typeId) ?? [];
  }
  clone() {
    return new ItemStack(this.typeId, this.amount);
  }
}

// --- Blocks ------------------------------------------------------------------------------

function defaultStates(typeId) {
  const states = BLOCK_DEFS.get(typeId)?.description.states ?? {};
  return Object.fromEntries(Object.entries(states).map(([name, values]) => [name, Array.isArray(values) ? values[0] : values.values.min]));
}

function validState(typeId, name, value) {
  const spec = BLOCK_DEFS.get(typeId)?.description.states?.[name];
  if (!spec) return false;
  return Array.isArray(spec) ? spec.includes(value) : Number.isInteger(value) && value >= spec.values.min && value <= spec.values.max;
}

export class BlockPermutation {
  constructor(typeId, states) {
    this.type = { id: typeId };
    this.states = { ...defaultStates(typeId), ...states };
  }
  static resolve(typeId, states = {}) {
    for (const [name, value] of Object.entries(states)) if (BLOCK_DEFS.has(typeId) && !validState(typeId, name, value)) throw new Error(`invalid state ${name}=${value} for ${typeId}`);
    return new BlockPermutation(typeId, states);
  }
  getState(name) {
    return this.states[name];
  }
  withState(name, value) {
    // ## Like the game: an unknown state or an out-of-range value throws.
    if (BLOCK_DEFS.has(this.type.id) && !validState(this.type.id, name, value)) throw new Error(`invalid state ${name}=${value} for ${this.type.id}`);
    return new BlockPermutation(this.type.id, { ...this.states, [name]: value });
  }
  matches(typeId) {
    return this.type.id === typeId;
  }
}

/** Evaluates a permutation condition such as "q.block_state('ns:growth') == 3 && q.block_state('ns:x') == false". */
function conditionHolds(condition, permutation) {
  return condition.split("&&").every((part) => {
    const m = part.trim().match(/^q\.block_state\('([^']+)'\)\s*==\s*(\S+)$/);
    if (!m) throw new Error(`mock: cannot read condition "${part}"`);
    const raw = m[2];
    const want = raw === "true" ? true : raw === "false" ? false : /^'.*'$/.test(raw) ? raw.slice(1, -1) : Number(raw);
    return permutation.getState(m[1]) === want;
  });
}

/** A block's components for one permutation: the base components, then every matching permutation in order. */
export function __componentsOf(permutation) {
  const def = BLOCK_DEFS.get(permutation.type.id);
  if (!def) return {};
  const out = { ...def.components };
  for (const p of def.permutations ?? []) if (conditionHolds(p.condition, permutation)) Object.assign(out, p.components);
  return out;
}

let lootRandom = () => 0;
/** Test hook for loot rolls (default 0: the first entry, the lowest count). */
export function __setLootRandom(fn) {
  lootRandom = fn;
}

function rollLoot(path) {
  const table = JSON.parse(readFileSync(join(BP, path), "utf8"));
  const drops = [];
  for (const pool of table.pools) {
    for (let r = 0; r < (pool.rolls ?? 1); r++) {
      const total = pool.entries.reduce((sum, e) => sum + (e.weight ?? 1), 0);
      let pick = lootRandom() * total;
      const entry = pool.entries.find((e) => (pick -= e.weight ?? 1) < 0) ?? pool.entries[0];
      if (entry.type !== "item") continue;
      const count = entry.functions?.find((f) => f.function === "set_count")?.count;
      const n = count ? count.min + Math.floor(lootRandom() * (count.max - count.min + 1)) : 1;
      if (n > 0) drops.push({ typeId: entry.name, amount: n });
    }
  }
  return drops;
}

/** What breaking a block with this permutation drops. */
function lootOf(permutation) {
  if (permutation.type.id === "minecraft:air") return [];
  const components = __componentsOf(permutation);
  if (!BLOCK_DEFS.has(permutation.type.id)) return [];
  if (!components["minecraft:loot"]) return [{ typeId: permutation.type.id, amount: 1 }];
  return rollLoot(components["minecraft:loot"]);
}

export class Block {
  constructor(dimension, location) {
    this.dimension = dimension;
    this.location = { ...location };
    this.x = location.x;
    this.y = location.y;
    this.z = location.z;
  }
  get key() {
    return `${this.x},${this.y},${this.z}`;
  }
  get permutation() {
    return this.dimension.blocks.get(this.key) ?? new BlockPermutation("minecraft:air");
  }
  get typeId() {
    return this.permutation.type.id;
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  setPermutation(permutation) {
    if (permutation.type.id === "minecraft:air") this.dimension.blocks.delete(this.key);
    else this.dimension.blocks.set(this.key, permutation);
  }
  setType(typeId) {
    this.setPermutation(new BlockPermutation(typeId));
  }
  hasTag(tag) {
    return Object.hasOwn(__componentsOf(this.permutation), `tag:${tag}`);
  }
  offset(dx, dy, dz) {
    return this.dimension.getBlock({ x: this.x + dx, y: this.y + dy, z: this.z + dz });
  }
  above() {
    return this.offset(0, 1, 0);
  }
  below() {
    return this.offset(0, -1, 0);
  }
}

class Dimension {
  constructor(id) {
    this.id = id;
    this.blocks = new Map();
    this.items = [];
    this.sounds = [];
    this.particles = [];
    this.biome = "minecraft:plains";
  }
  getBlock(location) {
    return new Block(this, { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) });
  }
  getBiome() {
    return { id: this.biome };
  }
  spawnItem(stack, location) {
    this.items.push({ typeId: stack.typeId, amount: stack.amount, location: { ...location } });
  }
  playSound(id, location) {
    this.sounds.push({ id, location });
  }
  spawnParticle(id, location) {
    this.particles.push({ id, location });
  }
  runCommand(command) {
    const m = command.match(/^setblock (-?\d+) (-?\d+) (-?\d+) air destroy$/);
    if (!m) throw new Error(`mock: unsupported command ${command}`);
    const block = this.getBlock({ x: +m[1], y: +m[2], z: +m[3] });
    for (const drop of lootOf(block.permutation)) this.items.push({ ...drop, location: block.location });
    block.setPermutation(new BlockPermutation("minecraft:air"));
    return { successCount: 1 };
  }
  /** Test helper: total of one item lying on the ground. */
  dropped(typeId) {
    return this.items.filter((i) => i.typeId === typeId).reduce((sum, i) => sum + i.amount, 0);
  }
}

const DIMENSIONS = { overworld: new Dimension("minecraft:overworld") };

let absoluteTime = 0;
const dynamicProperties = new Map();
/** Moves the world clock on (stations compare it with world.getAbsoluteTime). */
export function __skipTime(ticks) {
  absoluteTime += ticks;
}

export const world = {
  getDimension: (id) => DIMENSIONS[id.replace("minecraft:", "")],
  getAbsoluteTime: () => absoluteTime,
  getDynamicProperty: (key) => dynamicProperties.get(key),
  setDynamicProperty(key, value) {
    if (value === undefined) dynamicProperties.delete(key);
    else dynamicProperties.set(key, value);
  },
  getDynamicPropertyIds: () => [...dynamicProperties.keys()],
  sendMessage(message) {
    world.messages.push(message);
  },
  messages: [],
};

// --- Players ------------------------------------------------------------------------------

export class Player {
  constructor(dimension) {
    this.dimension = dimension;
    this.gameMode = GameMode.Survival;
    this.hand = undefined;
    const player = this;
    this.equippable = {
      getEquipment: (slot) => (slot === EquipmentSlot.Mainhand ? player.hand?.clone() : undefined),
      setEquipment: (slot, stack) => {
        if (slot === EquipmentSlot.Mainhand) player.hand = stack ? stack.clone() : undefined;
      },
    };
  }
  getGameMode() {
    return this.gameMode;
  }
  getComponent(id) {
    return id === "minecraft:equippable" ? this.equippable : undefined;
  }
}

// --- System ---------------------------------------------------------------------------------

let currentTick = 0;
const scheduled = [];

export const system = {
  get currentTick() {
    return currentTick;
  },
  beforeEvents: { startup: new Signal() },
  afterEvents: { scriptEventReceive: new Signal() },
  run(fn) {
    scheduled.push({ at: currentTick + 1, fn });
  },
  runTimeout(fn, ticks = 1) {
    scheduled.push({ at: currentTick + ticks, fn });
  },
  /** Every script event sent, oldest first (tests read it). */
  sentEvents: [],
  sendScriptEvent(id, message) {
    system.sentEvents.push({ id, message });
    system.afterEvents.scriptEventReceive.fire({ id, message, sourceType: "Server" });
  },
};

/** Runs the scheduler forward. */
export function __advance(ticks) {
  for (let i = 0; i < ticks; i++) {
    currentTick++;
    for (const task of scheduled.filter((t) => t.at <= currentTick)) {
      scheduled.splice(scheduled.indexOf(task), 1);
      task.fn();
    }
  }
}

// --- Driving blocks the way the game would ------------------------------------------------------

const COMPONENTS = {};
export function __registerComponents() {
  system.beforeEvents.startup.fire({
    blockComponentRegistry: { registerCustomComponent: (id, component) => (COMPONENTS[id] = component) },
    itemComponentRegistry: { registerCustomComponent: () => {} },
  });
  return COMPONENTS;
}

function customComponentsOf(block) {
  return Object.keys(__componentsOf(block.permutation))
    .filter((key) => COMPONENTS[key])
    .map((key) => COMPONENTS[key]);
}

export function __place(dimension, location, typeId, states = {}) {
  dimension.getBlock(location).setPermutation(BlockPermutation.resolve(typeId, states));
  return dimension.getBlock(location);
}

export function __randomTick(block) {
  for (const component of customComponentsOf(block)) component.onRandomTick?.({ block, dimension: block.dimension });
}

export function __interact(player, block) {
  for (const component of customComponentsOf(block)) component.onPlayerInteract?.({ block, player, dimension: block.dimension });
}

/** A player breaks a block: loot drops (not in creative), the block goes, onPlayerBreak runs. */
export function __break(player, block) {
  const broken = block.permutation;
  const components = customComponentsOf(block);
  if (player.gameMode !== GameMode.Creative) for (const drop of lootOf(broken)) block.dimension.items.push({ ...drop, location: block.location });
  block.setPermutation(new BlockPermutation("minecraft:air"));
  for (const component of components) component.onPlayerBreak?.({ block, brokenBlockPermutation: broken, player, dimension: block.dimension });
}

export function __reset() {
  for (const dimension of Object.values(DIMENSIONS)) {
    dimension.blocks = new Map();
    dimension.items = [];
    dimension.sounds = [];
    dimension.particles = [];
    dimension.biome = "minecraft:plains";
  }
  world.messages = [];
  system.sentEvents = [];
  dynamicProperties.clear();
}
