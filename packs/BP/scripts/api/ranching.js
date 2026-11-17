// Optional link with 森羅物語：樂牧 (Kaleidoscope Ranching 1.1): Harvest's crops as trough feed.
//
//   → kaleidoscope_ranching:api_ping       at startup
//   ← kaleidoscope_ranching:api_ready      { api, version, capabilities }
//   → kaleidoscope_ranching:register_feed  { item, kind, units }, one per message (data/integrations.js)
//   ← kaleidoscope_ranching:api_result     { event, id, ok, error? } for every add-on: ours only
//
// ## Same pattern as api/cookery.js: Script Events only, never Ranching's files (企劃書：只走公開
// ## 介面). Ranching keeps registrations for the current world session, announces api_ready once
// ## after loading and again in answer to a ping; registering twice is safe, so every api_ready
// ## sends the feeds again. Without Ranching nothing answers and nothing is sent.

import { system } from "@minecraft/server";
import { RANCHING_FEEDS } from "../data/integrations.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { send } from "./cookery.js";

const R = "kaleidoscope_ranching";
export const RANCHING_PING = `${R}:api_ping`;
export const RANCHING_READY = `${R}:api_ready`;
export const RANCHING_RESULT = `${R}:api_result`;

/** Feed kinds and the capability each needs (ruminant and calcium are Ranching 1.1). */
const KIND_NEEDS = { grass: "register_feed", grain: "register_feed", veg: "register_feed", mixed: "register_feed", concentrate: "register_feed", ruminant: "feed_1_1", calcium: "feed_1_1" };

let capabilities = null;
const reported = new Set();

/** The register_feed payloads Ranching can take with these capabilities. */
export function feedPayloads(caps = capabilities ?? []) {
  return RANCHING_FEEDS.filter((feed) => caps.includes("register_feed") && caps.includes(KIND_NEEDS[feed.kind])).map((feed) => ({ item: rid(feed.item), kind: feed.kind, units: feed.units }));
}

/** Sends every feed Ranching can take; returns how many went out. */
export function registerFeeds() {
  let sent = 0;
  for (const payload of feedPayloads()) if (send(`${R}:register_feed`, payload)) sent++;
  return sent;
}

/** Ranching listed the capability in its last api_ready. */
export const ranchingHas = (capability) => capabilities?.includes(capability) ?? false;

/** A refusal for one of Harvest's own ids, worth a line in the content log (never on screen). */
export function ownFailure(result) {
  return Boolean(result && result.ok === false && typeof result.id === "string" && result.id.startsWith(`${NAMESPACE}:`));
}

export function connectToRanching() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === RANCHING_READY) {
      let payload;
      try {
        payload = JSON.parse(String(event.message ?? "{}"));
      } catch {
        return;
      }
      if (payload?.api !== 1) return;
      capabilities = Array.isArray(payload.capabilities) ? payload.capabilities : [];
      registerFeeds();
      return;
    }
    if (event.id !== RANCHING_RESULT) return;
    let result;
    try {
      result = JSON.parse(String(event.message ?? "{}"));
    } catch {
      return;
    }
    // ## api_result goes to every add-on: other packs' results are none of Harvest's business.
    if (!ownFailure(result)) return;
    const line = `${result.event} ${result.id}: ${result.error}`;
    if (reported.has(line)) return; // the second api_ready repeats it
    reported.add(line);
    console.warn(`[${NAMESPACE}] Ranching refused ${line}`);
  });
  system.run(() => send(RANCHING_PING, NAMESPACE));
}

/** Test hook: forget the handshake. */
export function __resetRanching() {
  capabilities = null;
  reported.clear();
}
