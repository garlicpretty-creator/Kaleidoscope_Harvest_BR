// A small in-memory stand-in for @minecraft/server, enough to run Harvest's
// scripts in Node (same idea as Ranching's tools/test/mock-server.mjs, cut down
// to blocks). Harvest blocks read their states, custom components, permutations
// and loot tables from the real generated block JSON, so the tests also check
// the generated files.
//
// Not a Minecraft emulator: no physics, no rendering, no placement rules.

import { existsSync, readFileSync, readdirSync } from "node:fs";
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
/** Items with minecraft:durability: id → max durability (the pole). */
const ITEM_DURABILITY = new Map();
for (const file of readdirSync(join(BP, "items"))) {
  const item = JSON.parse(readFileSync(join(BP, "items", file), "utf8"))["minecraft:item"];
  const tags = item.components?.["minecraft:tags"]?.tags;
  if (tags) ITEM_TAGS.set(item.description.identifier, tags);
  const durability = item.components?.["minecraft:durability"]?.max_durability;
  if (durability) ITEM_DURABILITY.set(item.description.identifier, durability);
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
export class MolangVariableMap {
  constructor() {
    this.values = {};
  }
  setColorRGBA(name, color) {
    this.values[name] = { ...color };
  }
  setVector3(name, vector) {
    this.values[name] = { ...vector };
  }
}
/** Items the world knows: vanilla, Harvest's, and any a test adds with __addItemType (another pack's). */
const extraItemTypes = new Set();
export const ItemTypes = {
  get: (id) => (id.startsWith("minecraft:") || id.startsWith("kaleidoscope_harvest:") || extraItemTypes.has(id) ? { id } : undefined),
};
export function __addItemType(id) {
  extraItemTypes.add(id);
}
export const GameMode = { Survival: "Survival", Creative: "Creative" };

// --- Items ------------------------------------------------------------------------------

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId.includes(":") ? typeId : `minecraft:${typeId}`;
    this.amount = amount;
    const max = ITEM_DURABILITY.get(this.typeId);
    /** Like the game's ItemDurabilityComponent: damage counts up to maxDurability. */
    this.durability = max ? { damage: 0, maxDurability: max } : undefined;
  }
  getComponent(id) {
    return id === "minecraft:durability" ? this.durability : undefined;
  }
  hasTag(tag) {
    return (ITEM_TAGS.get(this.typeId) ?? []).includes(tag);
  }
  getTags() {
    return ITEM_TAGS.get(this.typeId) ?? [];
  }
  clone() {
    const copy = new ItemStack(this.typeId, this.amount);
    if (this.durability) copy.durability = { ...this.durability };
    return copy;
  }
  get maxAmount() {
    return this.durability ? 1 : 64;
  }
}

/** A block's or a player's inventory (hoppers, chests, the player's 36 slots). */
export class Container {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  getItem(i) {
    return this.slots[i]?.clone();
  }
  setItem(i, stack) {
    this.slots[i] = stack ? stack.clone() : undefined;
  }
  /** Like the game: tops up stacks of the same item, then empty slots; returns what did not fit. */
  addItem(stack) {
    let left = stack.amount;
    for (let i = 0; i < this.size && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.typeId === stack.typeId && s.amount < s.maxAmount) {
        const n = Math.min(left, s.maxAmount - s.amount);
        s.amount += n;
        left -= n;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(left, stack.maxAmount);
        this.slots[i] = new ItemStack(stack.typeId, n);
        left -= n;
      }
    }
    return left > 0 ? new ItemStack(stack.typeId, left) : undefined;
  }
  get emptySlotsCount() {
    return this.slots.filter((s) => !s).length;
  }
  /** Test helper: how many of an item it holds. */
  count(typeId) {
    return this.slots.filter((s) => s?.typeId === typeId).reduce((sum, s) => sum + s.amount, 0);
  }
}

/** Test hook: gives the block at `location` a container (a hopper, a chest) of `size` slots. */
export function __setContainer(dimension, location, size = 5, typeId = "minecraft:hopper") {
  const block = dimension.getBlock(location);
  block.setPermutation(new BlockPermutation(typeId));
  const container = new Container(size);
  dimension.containers.set(block.key, container);
  return container;
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
  /** Water in the block's space (tests set dimension.waterlogged). */
  get isWaterlogged() {
    return this.dimension.waterlogged?.has(this.key) ?? false;
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
  getComponent(id) {
    if (id !== "minecraft:inventory") return undefined;
    const container = this.isAir ? undefined : this.dimension.containers.get(this.key);
    return container ? { container } : undefined;
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

// --- Entities (only what the stations' display entities use) --------------------------------

export class Entity {
  constructor(dimension, typeId, location) {
    this.dimension = dimension;
    this.typeId = typeId;
    this.location = { ...location };
    this.properties = {};
    this.isValid = true;
  }
  setProperty(name, value) {
    if (!this.isValid) throw new Error("mock: entity removed");
    this.properties[name] = value;
  }
  getProperty(name) {
    return this.properties[name];
  }
  remove() {
    this.isValid = false;
    this.dimension.entities = this.dimension.entities.filter((e) => e !== this);
  }
}

class Dimension {
  constructor(id) {
    this.id = id;
    this.entities = [];
    this.blocks = new Map();
    this.items = [];
    this.sounds = [];
    this.particles = [];
    this.placedFeatures = [];
    this.containers = new Map();
    this.biome = "minecraft:plains";
    /** Test hook: placeFeature fails (as when the game finds no room) while this is true. */
    this.featureFails = false;
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
  playSound(id, location, options) {
    this.sounds.push({ id, location, ...(options ? { options: { ...options } } : {}) });
  }
  spawnEntity(typeId, location) {
    const entity = new Entity(this, typeId, location);
    this.entities.push(entity);
    return entity;
  }
  getEntities({ type, location, maxDistance } = {}) {
    return this.entities.filter((e) => (!type || e.typeId === type) && (!location || Math.hypot(e.location.x - location.x, e.location.y - location.y, e.location.z - location.z) <= maxDistance));
  }
  spawnParticle(id, location, variables) {
    this.particles.push({ id, location, variables: variables?.values });
  }
  runCommand(command) {
    const m = command.match(/^setblock (-?\d+) (-?\d+) (-?\d+) air destroy$/);
    if (!m) throw new Error(`mock: unsupported command ${command}`);
    const block = this.getBlock({ x: +m[1], y: +m[2], z: +m[3] });
    for (const drop of lootOf(block.permutation)) this.items.push({ ...drop, location: block.location });
    block.setPermutation(new BlockPermutation("minecraft:air"));
    return { successCount: 1 };
  }
  /**
   * A stand-in for placing a tree_feature (packs/BP/features/trees): not the engine's canopy
   * algorithms, just the trunk at its shortest height with a 3×3 ring of leaves round the top log
   * and a 3×3 layer above it. Like the game it checks may_grow_on under the base and
   * may_replace for every block it would set, and returns false (or throws) when it cannot place.
   */
  placeFeature(name, location, shouldThrow = false) {
    const failed = (why) => {
      if (shouldThrow) throw new Error(`mock: placeFeature ${name}: ${why}`);
      return false;
    };
    if (this.featureFails) return failed("no room");
    const file = join(BP, "features", "trees", `${name.split(":")[1]}.json`);
    if (!existsSync(file)) throw new Error(`mock: unknown feature ${name}`);
    this.placedFeatures.push({ name, location: { ...location } });
    const tree = JSON.parse(readFileSync(file, "utf8"))["minecraft:tree_feature"];
    const trunk = tree[Object.keys(tree).find((k) => k.endsWith("trunk"))];
    const canopy = tree[Object.keys(tree).find((k) => k.endsWith("canopy"))];
    const height = trunk.trunk_height.range_min ?? trunk.trunk_height.base;
    const leaf = canopy.leaf_block ?? canopy.leaf_blocks[0][0];
    const base = this.getBlock(location);
    if (!tree.may_grow_on.includes(base.below().typeId)) return failed("ground");
    const spots = [];
    for (let y = 0; y < height; y++) spots.push([0, y, 0, trunk.trunk_block]);
    for (const y of [height - 1, height]) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z || y === height) spots.push([x, y, z, leaf]);
    const replace = new Set(["minecraft:air", ...tree.may_replace]);
    const targets = spots.map(([x, y, z, id]) => [base.offset(x, y, z), id]);
    if (targets.some(([b]) => !replace.has(b.typeId))) return failed("in the way");
    for (const [b, id] of targets) b.setPermutation(BlockPermutation.resolve(id));
    return true;
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

/** Every Player made since the last __reset (world.getAllPlayers). */
let players = [];

export const world = {
  getDimension: (id) => DIMENSIONS[id.replace("minecraft:", "")],
  getAllPlayers: () => players.filter((p) => p.isValid),
  afterEvents: { playerHotbarSelectedSlotChange: new Signal(), playerInventoryItemChange: new Signal(), playerLeave: new Signal() },
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

let lastPlayerId = 0;
export class Player {
  constructor(dimension, location = { x: 0.5, y: 64, z: 0.5 }) {
    this.dimension = dimension;
    this.id = String(++lastPlayerId);
    this.isValid = true;
    this.location = { ...location };
    this.gameMode = GameMode.Survival;
    this.hand = undefined;
    /** The off hand (EquipmentSlot.Offhand). */
    this.offhand = undefined;
    this.isSneaking = false;
    /** The rest of the inventory (the held stack is `hand`). */
    this.inventory = new Container(36);
    const player = this;
    this.equippable = {
      getEquipment: (slot) => (slot === EquipmentSlot.Mainhand ? player.hand?.clone() : slot === EquipmentSlot.Offhand ? player.offhand?.clone() : undefined),
      setEquipment: (slot, stack) => {
        if (slot === EquipmentSlot.Mainhand) player.hand = stack ? stack.clone() : undefined;
        if (slot === EquipmentSlot.Offhand) player.offhand = stack ? stack.clone() : undefined;
      },
    };
    players.push(this);
  }
  getGameMode() {
    return this.gameMode;
  }
  getComponent(id) {
    if (id === "minecraft:inventory") return { container: this.inventory };
    return id === "minecraft:equippable" ? this.equippable : undefined;
  }
}

// --- System ---------------------------------------------------------------------------------

let currentTick = 0;
let lastHandle = 0;
const scheduled = [];

export const system = {
  get currentTick() {
    return currentTick;
  },
  beforeEvents: { startup: new Signal() },
  afterEvents: { scriptEventReceive: new Signal() },
  run(fn) {
    return system.runTimeout(fn, 1);
  },
  runTimeout(fn, ticks = 1) {
    const handle = ++lastHandle;
    scheduled.push({ at: currentTick + ticks, fn, handle });
    return handle;
  },
  runInterval(fn, ticks = 1) {
    const handle = ++lastHandle;
    const again = () => {
      fn();
      scheduled.push({ at: currentTick + ticks, fn: again, handle });
    };
    scheduled.push({ at: currentTick + ticks, fn: again, handle });
    return handle;
  },
  clearRun(handle) {
    const i = scheduled.findIndex((t) => t.handle === handle);
    if (i >= 0) scheduled.splice(i, 1);
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
      const i = scheduled.indexOf(task);
      if (i < 0) continue; // cleared by an earlier task this tick
      scheduled.splice(i, 1);
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

/** A player places a block: like __place, then onPlace runs. */
export function __placeByPlayer(dimension, location, typeId, states = {}) {
  const block = __place(dimension, location, typeId, states);
  for (const component of customComponentsOf(block)) component.onPlace?.({ block, dimension });
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
    dimension.entities = [];
    dimension.items = [];
    dimension.sounds = [];
    dimension.particles = [];
    dimension.biome = "minecraft:plains";
    dimension.featureFails = false;
    dimension.placedFeatures = [];
    dimension.waterlogged = new Set();
    dimension.containers = new Map();
  }
  world.messages = [];
  players = [];
  system.sentEvents = [];
  dynamicProperties.clear();
  extraItemTypes.clear();
}
