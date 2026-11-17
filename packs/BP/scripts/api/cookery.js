// Handshake with the Kaleidoscope Cookery host (森羅物語：廚房 v1.6.6).
//
// ## Cookery exposes a Script Event bus, not importable modules (企劃書：只走
// ## 公開介面). We ping it after startup, wait for `api_ready`, then read its
// ## capability list. Cookery keeps registrations for the current world session
// ## only, so the handshake runs again on every world load.

import { system } from "@minecraft/server";
import { NAMESPACE } from "../data/ns.js";

export const API_PING = "kaleidoscope_cookery:api_ping";
export const API_READY = "kaleidoscope_cookery:api_ready";

/** How long to wait for Cookery before logging that it is missing. */
const READY_TIMEOUT_TICKS = 200;

let capabilities = null;
const readyListeners = [];

/** Runs `listener(capabilities)` once Cookery is ready (at once if it already is). */
export function onCookeryReady(listener) {
  if (capabilities) listener(capabilities);
  else readyListeners.push(listener);
}

/** True when Cookery listed the capability during the handshake. */
export function cookeryHas(capability) {
  return capabilities?.includes(capability) ?? false;
}

/** Sends one script event; false if the game refused it. */
export function send(event, payload) {
  try {
    system.sendScriptEvent(event, typeof payload === "string" ? payload : JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn(`[${NAMESPACE}] could not send ${event}: ${error}`);
    return false;
  }
}

export function connectToCookery() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== API_READY || capabilities) return;
    let payload;
    try {
      payload = JSON.parse(String(event.message ?? "{}"));
    } catch {
      return;
    }
    // ## Older v1 Cookery builds answer with only {api:1}: an empty capability
    // ## list, so every registration is skipped rather than sent blind.
    capabilities = Array.isArray(payload.capabilities) ? payload.capabilities : [];
    for (const listener of readyListeners.splice(0)) listener(capabilities);
  });

  system.run(() => send(API_PING, ""));

  // ## No chat message: Harvest shows no text (企劃書「沉浸式」). The manifest
  // ## dependency already stops the pack loading without Cookery; this only
  // ## helps whoever reads the content log.
  system.runTimeout(() => {
    if (!capabilities) console.warn(`[${NAMESPACE}] Cookery did not answer api_ping; recipes and the guidebook chapter were not registered.`);
  }, READY_TIMEOUT_TICKS);
}

/** Test hook: forget the handshake. */
export function __resetCookery() {
  capabilities = null;
  readyListeners.length = 0;
}
