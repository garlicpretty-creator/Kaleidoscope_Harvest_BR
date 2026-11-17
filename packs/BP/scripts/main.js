// Kaleidoscope Harvest entry point.
// Keep this file small: bootstrap integrations and components only.

import { system } from "@minecraft/server";
import { startBurntTea } from "./api/burntTea.js";
import { connectToCookery } from "./api/cookery.js";
import { startCookeryContent } from "./api/cookeryContent.js";
import { connectToFishing } from "./api/fishing.js";
import { startHarvestApi } from "./api/harvestApi.js";
import { connectToHerbal } from "./api/herbal.js";
import { connectToRanching } from "./api/ranching.js";
import { connectToTavern } from "./api/tavern.js";
import { registerComponents } from "./growth/components.js";
import { OTC_FOODS, SMOKER_RECIPES } from "./data/burntTeaCatalog.js";
import { NAMESPACE } from "./data/ns.js";

registerComponents();
connectToCookery();
startCookeryContent();
// ## Optional partners (企劃書「選用聯動」): each waits for its pack's api_ready and sends nothing without it.
connectToRanching();
connectToHerbal();
connectToTavern();
connectToFishing();
// ## Harvest's own api_ping / api_ready (next release): the sister packs can find it without guessing from its items.
startHarvestApi();
// ## burnt-tea-dev's packs (下單了 menu and stove, 煙火 skewers) take registrations without a ping of their own.
startBurntTea(system, { source: NAMESPACE, foods: OTC_FOODS, smoking: SMOKER_RECIPES });
