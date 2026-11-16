// Registers Harvest's block custom components at startup. The block JSON
// (tools/generate.mjs) names the same ids.

import { system } from "@minecraft/server";
import { NAMESPACE } from "../data/ns.js";
import { cropComponent } from "./crops.js";
import { trellisComponent } from "./trellis.js";
import { fruitLeavesComponent, saplingComponent } from "./trees.js";

export const COMPONENTS = {
  [`${NAMESPACE}:crop`]: cropComponent,
  [`${NAMESPACE}:trellis`]: trellisComponent,
  [`${NAMESPACE}:sapling`]: saplingComponent,
  [`${NAMESPACE}:fruit_leaves`]: fruitLeavesComponent,
};

export function registerComponents() {
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    for (const [id, component] of Object.entries(COMPONENTS)) blockComponentRegistry.registerCustomComponent(id, component);
  });
}
