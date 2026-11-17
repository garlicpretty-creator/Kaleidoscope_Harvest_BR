// Harvest's own stations (企劃書：榨汁機與醃漬缸). Their recipes are menu rows
// (data/menu.js, station "juicer" / "pickling_jar"); this file holds how the
// blocks look and behave. Plain data: no @minecraft imports.

/** Juicer: two fruits, then a glass bottle takes the juice. */
export const JUICER = {
  id: "juicer", zh: "榨汁機", en: "Juicer", look: ["bottle", [240, 150, 40]],
  capacity: 2,
  bottle: "minecraft:glass_bottle",
  // ## The jug shows the colour of what is in it; the art has three juice colours
  // ## (tools/art/station_models.py). Fruits not listed show orange.
  colours: ["empty", "orange", "grape", "mango"],
  colourOf: {
    mandarin: "orange", sweet_orange: "orange", lemon: "mango", peach: "orange", persimmon: "orange",
    grape: "grape", blueberry: "grape", lychee: "grape", passion_fruit: "mango",
    mango: "mango", pineapple: "mango", banana: "mango", strawberry: "grape", pear: "mango",
  },
  /** Made from two different fruits. */
  mixed: "mixed_juice",
  // ## Splash drops, RGB 0..1, the mid tone of each juice texture (tools/art/station_models.py).
  splash: { orange: [0.94, 0.57, 0.16], grape: [0.41, 0.14, 0.36], mango: [0.96, 0.72, 0.16] },
  /** The display entity holding the moving parts: the reamer and the juice (設計：station-animations). */
  visual: "juicer_visual",
};

/** Pickling jar: put in 1–4 items, seal it with an empty hand, open it when it is done. */
export const PICKLING_JAR = {
  id: "pickling_jar", zh: "醃漬缸", en: "Pickling Jar", look: ["bulb", [110, 70, 40]],
  capacity: 4,
  // ## The contents in the mouth change colour (tools/art/station_models.py).
  contents: ["empty", "fresh", "fermenting", "done"],
  /** The display entity holding the lid. */
  visual: "pickling_jar_visual",
};

/** Display-entity properties (client_sync), set by stations/visuals.js and read by the animations. */
export const VISUAL_PROPS = {
  level: "level", // juicer: fruits in it, 0..capacity
  juice: "juice", // juicer: index in JUICER.colours
  stage: "stage", // pickling jar: index in PICKLING_JAR.contents
};

/** Seconds between sweeps for display entities left with no station under them. */
export const VISUAL_SWEEP_SECONDS = 5;
export const SPLASH_PARTICLE = "splash";
export const BUBBLE_PARTICLE = "jar_bubble";
