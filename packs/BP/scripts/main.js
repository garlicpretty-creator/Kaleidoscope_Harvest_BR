// Kaleidoscope Harvest entry point.
// Keep this file small: bootstrap integrations and components only.

import { connectToCookery } from "./api/cookery.js";
import { startCookeryContent } from "./api/cookeryContent.js";
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
