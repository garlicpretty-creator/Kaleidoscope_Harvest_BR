// Kaleidoscope Harvest entry point.
// Keep this file small: bootstrap integrations and components only.

import { connectToCookery } from "./api/cookery.js";
import { startCookeryContent } from "./api/cookeryContent.js";
import { connectToFishing } from "./api/fishing.js";
import { startHarvestApi } from "./api/harvestApi.js";
import { connectToHerbal } from "./api/herbal.js";
import { connectToRanching } from "./api/ranching.js";
import { connectToTavern } from "./api/tavern.js";
import { registerComponents } from "./growth/components.js";

registerComponents();
connectToCookery();
startCookeryContent();
// ## Optional partners (企劃書「選用聯動」): each waits for its pack's api_ready and sends nothing without it.
connectToRanching();
connectToHerbal();
connectToTavern();
connectToFishing();
// ## Harvest's own API (docs/API.md): api_ready and the crop catalog for the sister packs.
startHarvestApi();
