// Kaleidoscope Harvest entry point.
// Keep this file small: bootstrap integrations and components only.

import { connectToCookery } from "./api/cookery.js";
import { startCookeryContent } from "./api/cookeryContent.js";
import { registerComponents } from "./growth/components.js";

registerComponents();
connectToCookery();
startCookeryContent();
