// Optional link with 森羅物語：酒館 (Kaleidoscope Tavern): Harvest's lychee and peach wines as
// Tavern barrel recipes, with guide pages in three languages.
//
// ## Tavern has no written API; its public extension SDK (api/tavernSdk, copied from Herbal 1.1)
// ## is the contract. The SDK pings Tavern, waits for api_ready with the capabilities in
// ## `requires`, sends the payload as begin / chunk / commit packets (each under 1900 bytes) and
// ## waits for extension_ack. The payload copies the shape of Herbal's data/tavernRecipes.js.
// ## Without Tavern nothing answers and the wines stay pickling-jar drinks.

import { system } from "@minecraft/server";
import { NAMESPACE } from "../data/ns.js";
import { tavernPayload } from "../data/tavern.js";
import { registerTavernExtension } from "./tavernSdk/tavern-extension-client.js";

/** SDK log lines that are failures; its "Registered" line is not one (Harvest logs failures only). */
export const tavernLog = (text) => {
  if (!String(text).includes("Registered")) console.warn(`[${NAMESPACE}] ${text}`);
};

let client = null;
export function connectToTavern() {
  client = registerTavernExtension(system, tavernPayload(), { log: tavernLog });
  return client;
}
/** The SDK handle (registered, attempts), for tests. */
export const tavernClient = () => client;
