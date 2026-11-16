// Sounds and particles: Harvest's only way of telling the player something
// happened, since it shows no text on screen (企劃書「沉浸式回饋」).
// Vanilla ids for now; the custom pick / ripe sounds of the asset list replace
// them here when they are recorded. Plain data: no @minecraft imports.

export const SOUND = {
  pick: "block.sweet_berry_bush.pick",
  plant: "use.grass",
  boneMeal: "item.bone_meal.use",
  treeGrown: "block.azalea.place",
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
};

/** Chance, per random tick, that a ripe crop or fruit leaf gives off a particle. */
export const RIPE_PARTICLE_CHANCE = 0.35;
