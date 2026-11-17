// Registers Harvest's block custom components at startup. The block JSON
// (tools/generate.mjs) names the same ids.

import { system } from "@minecraft/server";
import { NAMESPACE } from "../data/ns.js";
import { cropComponent } from "./crops.js";
import { trellisComponent } from "./trellis.js";
import { hangingFruitComponent, leavesComponent, saplingComponent } from "./trees.js";
import { juicerComponent } from "../stations/juicer.js";
import { picklingJarComponent } from "../stations/picklingJar.js";
import { startVisualSweep } from "../stations/visuals.js";
import { JUICER, PICKLING_JAR } from "../data/stations.js";

export const COMPONENTS = {
  [`${NAMESPACE}:crop`]: cropComponent,
  [`${NAMESPACE}:trellis`]: trellisComponent,
  [`${NAMESPACE}:sapling`]: saplingComponent,
  [`${NAMESPACE}:tree_leaves`]: leavesComponent,
  [`${NAMESPACE}:hanging_fruit`]: hangingFruitComponent,
  [`${NAMESPACE}:juicer`]: juicerComponent,
  [`${NAMESPACE}:pickling_jar`]: picklingJarComponent,
};

export function registerComponents() {
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    for (const [id, component] of Object.entries(COMPONENTS)) blockComponentRegistry.registerCustomComponent(id, component);
  });
  startVisualSweep([JUICER, PICKLING_JAR]);
}
