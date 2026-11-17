// Optional link with 森羅物語：漁歌 (Kaleidoscope Fishing Voyage 1.5, API 1): Harvest's corn and okara as
// fishing bait and as pond feed.
//
//   → kaleidoscope_fishing:api_ping             at startup (message: our source)
//   ← kaleidoscope_fishing:api_ready            { api, source, version, capabilities }
//   → kaleidoscope_fishing:register_bait        { api, source, baits: [{ id, biteFactor }] }   needs bait
//   → kaleidoscope_fishing:register_pond_feed   { api, source, feeds: [{ id, meals }] }        needs pond_feed
//
// ## Fishing sends no reply to registrations; it logs refusals itself ("[Fishing Voyage] Rejected …").
// ## It keeps registrations for the world session and re-sending is an update, so every api_ready sends
// ## them again. Fishing already cooks seven of its dishes with Harvest crops (it looks for our items);
// ## this is the other half of that handshake.

import { system } from "@minecraft/server";
import { FISHING_BAITS, FISHING_POND_FEEDS } from "../data/integrations.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { send } from "./cookery.js";

const F = "kaleidoscope_fishing";
export const FISHING_PING = `${F}:api_ping`;
export const FISHING_READY = `${F}:api_ready`;

let ready = null;

/** The messages Fishing can take, given its api_ready payload. */
export function fishingMessages(info = ready) {
  if (!info) return [];
  const caps = Array.isArray(info.capabilities) ? info.capabilities : [];
  const out = [];
  if (caps.includes("bait")) out.push([`${F}:register_bait`, JSON.stringify({ api: 1, source: NAMESPACE, baits: FISHING_BAITS.map((b) => ({ id: rid(b.id), biteFactor: b.biteFactor })) })]);
  if (caps.includes("pond_feed")) out.push([`${F}:register_pond_feed`, JSON.stringify({ api: 1, source: NAMESPACE, feeds: FISHING_POND_FEEDS.map((f) => ({ id: rid(f.id), meals: f.meals })) })]);
  return out;
}

export function registerWithFishing() {
  let sent = 0;
  for (const [event, message] of fishingMessages()) if (send(event, message)) sent++;
  return sent;
}

export function connectToFishing() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== FISHING_READY) return;
    if (event.sourceType !== undefined && event.sourceType !== "Server") return;
    let message;
    try {
      message = JSON.parse(String(event.message ?? "{}"));
    } catch {
      return;
    }
    if (Number(message?.api) !== 1) return;
    ready = message;
    registerWithFishing();
  });
  system.run(() => send(FISHING_PING, NAMESPACE));
}

/** Fishing answered with API 1. */
export const fishingReady = () => ready !== null;

/** Test hook: forget the handshake. */
export function __resetFishing() {
  ready = null;
}
