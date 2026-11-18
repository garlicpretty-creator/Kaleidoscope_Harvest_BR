// Optional link with 森羅物語：草本 (Kaleidoscope Herbal 1.1, API 1): 寒熱 for Harvest foods and
// two clay-pot adjuvants.
//
//   → kaleidoscope_herbal:api_ping           at startup (message: our source)
//   ← kaleidoscope_herbal:api_ready          { api, source, version, capabilities, limits }
//   → kaleidoscope_herbal:heat_register      { api, source, items: [{ id, heat }] }       needs external_heat
//   → kaleidoscope_herbal:adjuvant_register  { api, source, items: [{ id, servings }] }   needs external_adjuvants
//   ← kaleidoscope_herbal:heat_ack / adjuvant_ack   { to, ok, accepted, rejected, code?, more? }
//
// ## Written directly in api/cookery.js's style rather than copying Herbal's sdk/herbal-client.js:
// ## Harvest only registers, it never asks Herbal anything. Herbal keeps no outside registrations,
// ## so every api_ready (its own announcement and the answer to our ping) sends them again; that is
// ## harmless (Herbal docs/API.md). Replies are broadcast: only those addressed `to` us count.

import { system } from "@minecraft/server";
import { HERBAL_ADJUVANTS, HERBAL_HEAT } from "../data/integrations.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { send } from "./cookery.js";

const H = "kaleidoscope_herbal";
export const HERBAL_PING = `${H}:api_ping`;
export const HERBAL_READY = `${H}:api_ready`;
const ACKS = new Set([`${H}:heat_ack`, `${H}:adjuvant_ack`]);
/** Script events carry at most 2048 characters; stay well inside it. */
export const MAX_MESSAGE = 1800;

let ready = null;
const reported = new Set();

/** Splits rows into messages of at most `perMessage` rows and MAX_MESSAGE characters. */
export function batches(event, rows, perMessage) {
  const out = [];
  let batch = [];
  const message = (items) => JSON.stringify({ api: 1, source: NAMESPACE, items });
  for (const row of rows) {
    if (batch.length && (batch.length >= perMessage || message([...batch, row]).length > MAX_MESSAGE)) {
      out.push([event, message(batch)]);
      batch = [];
    }
    batch.push(row);
  }
  if (batch.length) out.push([event, message(batch)]);
  return out;
}

/** The messages Herbal can take, given its api_ready payload. */
export function herbalMessages(info = ready) {
  if (!info) return [];
  const caps = Array.isArray(info.capabilities) ? info.capabilities : [];
  const perMessage = Math.min(32, Number(info.limits?.itemsPerMessage) || 32);
  const out = [];
  if (caps.includes("external_heat")) out.push(...batches(`${H}:heat_register`, HERBAL_HEAT.map((row) => ({ id: rid(row.id), heat: row.heat })), perMessage));
  if (caps.includes("external_adjuvants")) {
    const servings = Math.min(1, Number(info.limits?.adjuvantServingsMax) || 1);
    out.push(...batches(`${H}:adjuvant_register`, HERBAL_ADJUVANTS.map((row) => ({ id: rid(row.id), servings })), perMessage));
  }
  return out;
}

export function registerWithHerbal() {
  let sent = 0;
  for (const [event, message] of herbalMessages()) if (send(event, message)) sent++;
  return sent;
}

export function connectToHerbal() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== HERBAL_READY && !ACKS.has(event.id)) return;
    // ## Herbal ignores /scriptevent typed by players; Harvest does the same with its replies.
    if (event.sourceType !== undefined && event.sourceType !== "Server") return;
    let message;
    try {
      message = JSON.parse(String(event.message ?? "{}"));
    } catch {
      return;
    }
    if (message?.api !== 1) return;
    if (event.id === HERBAL_READY) {
      ready = message;
      registerWithHerbal();
      return;
    }
    if (message.to !== NAMESPACE) return;
    const problems = [...(message.code ? [message.code] : []), ...(message.rejected ?? []).map((row) => `${row.id} ${row.code}`), ...(message.more ? [`${message.more} more`] : [])];
    for (const problem of problems) {
      const line = `${event.id.slice(H.length + 1)}: ${problem}`;
      if (reported.has(line)) continue;
      reported.add(line);
      console.warn(`[${NAMESPACE}] Herbal refused ${line}`);
    }
  });
  system.run(() => send(HERBAL_PING, NAMESPACE));
}

/** Test hook: forget the handshake. */
export function __resetHerbal() {
  ready = null;
  reported.clear();
}
