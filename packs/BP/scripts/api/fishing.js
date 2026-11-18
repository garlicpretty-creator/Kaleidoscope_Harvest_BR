// Optional link with 森羅物語：漁歌 (Kaleidoscope Fishing Voyage 1.5, API 1): Harvest's corn and
// soybeans as bait, okara and corn as fish-pond feed.
//
//   → kaleidoscope_fishing:api_ping            at startup (message: our source)
//   ← kaleidoscope_fishing:api_ready           { api, source, version, capabilities }
//   → kaleidoscope_fishing:register_bait       { api, source, baits: [{ id, biteFactor }] }   needs bait
//   → kaleidoscope_fishing:register_pond_feed  { api, source, feeds: [{ id, meals }] }        needs pond_feed (1.5.0)
//
// ## Same pattern as api/ranching.js and api/herbal.js: Script Events only, never Fishing's files.
// ## Fishing keeps no outside registrations, so every api_ready sends them again (harmless, Fishing
// ## docs/API.md). Fishing sends no reply to a registration; a refusal is a line in its own content
// ## log. Without Fishing nothing answers and nothing is sent.

import { system } from "@minecraft/server";
import { FISHING_BAITS, FISHING_POND_FEEDS } from "../data/integrations.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { send } from "./cookery.js";

const F = "kaleidoscope_fishing";
export const FISHING_PING = `${F}:api_ping`;
export const FISHING_READY = `${F}:api_ready`;

let ready = null;

/** The messages Fishing can take, given its api_ready payload. Both lists fit one message each. */
export function fishingMessages(info = ready) {
  if (!info) return [];
  const caps = Array.isArray(info.capabilities) ? info.capabilities : [];
  const out = [];
  if (caps.includes("bait")) out.push([`${F}:register_bait`, { api: 1, source: NAMESPACE, baits: FISHING_BAITS.map((b) => ({ id: rid(b.id), biteFactor: b.biteFactor })) }]);
  if (caps.includes("pond_feed")) out.push([`${F}:register_pond_feed`, { api: 1, source: NAMESPACE, feeds: FISHING_POND_FEEDS.map((f) => ({ id: rid(f.id), meals: f.meals })) }]);
  return out;
}

export function registerWithFishing() {
  let sent = 0;
  for (const [event, payload] of fishingMessages()) if (send(event, payload)) sent++;
  return sent;
}

export function connectToFishing() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== FISHING_READY) return;
    let message;
    try {
      message = JSON.parse(String(event.message ?? "{}"));
    } catch {
      return;
    }
    if (message?.api !== 1) return;
    ready = message;
    registerWithFishing();
  });
  system.run(() => send(FISHING_PING, NAMESPACE));
}

/** Test hook: forget the handshake. */
export function __resetFishing() {
  ready = null;
}
