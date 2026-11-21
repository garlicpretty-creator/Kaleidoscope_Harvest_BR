// Sounds and particles: Harvest's only way of telling the player something
// happened, since it shows no text on screen (企劃書「沉浸式回饋」).
// Vanilla ids for now; the custom pick / ripe sounds of the asset list replace
// them here when they are recorded. Plain data: no @minecraft imports.

export const SOUND = {
  pick: "block.sweet_berry_bush.pick",
  plant: "use.grass",
  boneMeal: "item.bone_meal.use",
  treeGrown: "block.azalea.place",
  strip: "use.wood",
  trellisPlant: "use.bamboo",
  juicerAdd: "block.composter.fill",
  juicerPour: "bucket.fill.water",
  jarAdd: "block.composter.fill",
  jarSeal: "block.barrel.close",
  jarOpen: "block.barrel.open",
  jarDone: "block.composter.ready",
};

export const PARTICLE = {
  boneMeal: "minecraft:crop_growth_emitter",
  ripe: "minecraft:wax_particle",
  pick: "minecraft:villager_happy",
};

// ## Vanilla particles that read Molang variables log an error on every frame without them
// ## (wax_particle wants variable.color and variable.direction; found in game, 1.0.0).
// ## color: RGBA 0..1, a warm ripe glint; direction: a slow drift upward.
export const PARTICLE_VARIABLES = {
  "minecraft:wax_particle": { color: { variable: "variable.color", rgba: [1, 0.82, 0.35, 1] }, vector: { variable: "variable.direction", xyz: [0, 0.6, 0] } },
};

/** Chance, per random tick, that a ripe crop or hanging fruit gives off a particle. */
export const RIPE_PARTICLE_CHANCE = 0.35;

// ## Refusal (owner, 2026-11-21: 便利更新): bone meal on a ripe or off-climate plant, a full
// ## juicer or jar, a bottle with nothing to pour… answer with a low note and a grey puff on
// ## the block, never text (same "missing" cue as Fishing's util/hint.js). Only when the
// ## player held the thing for the job; an empty hand stays silent. The held item is kept.
export const REFUSE = {
  sound: "note.bass",
  pitch: 0.7,
  volume: 0.6,
  particle: "minecraft:basic_smoke_particle",
  /** Holding use repeats the interaction: one cue per block per this many ticks. */
  gapTicks: 10,
};
