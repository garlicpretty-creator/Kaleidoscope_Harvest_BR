// Harvest's own Script Event API (API 1, docs/API.md): so the sister packs can tell Harvest is
// installed, which version it is, and what it grows, without looking for its items.
//
//   ← kaleidoscope_harvest:api_ping          anything (best: the sender's namespace)
//   → kaleidoscope_harvest:api_ready         { api, source, version, capabilities }
//   ← kaleidoscope_harvest:catalog_request   { api, source, req?, kind }
//   → kaleidoscope_harvest:catalog           { api, to, req?, kind, ok, index, parts, items }
//
// ## Same shape as Fishing's and Herbal's APIs: replies are broadcast with `to`, a bad request
// ## gets no answer, and api_ready goes out once by itself shortly after load (the sister packs
// ## subscribe on their first tick). Harvest takes no registrations: nothing to keep or resend.

import { system } from "@minecraft/server";
import { CROPS } from "../data/crops.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { TREES, saplingBlockId } from "../data/trees.js";
import { VERSION } from "../data/version.js";
import { send } from "./cookery.js";

export const EVENTS = Object.freeze({
  ping: `${NAMESPACE}:api_ping`,
  ready: `${NAMESPACE}:api_ready`,
  catalogRequest: `${NAMESPACE}:catalog_request`,
  catalog: `${NAMESPACE}:catalog`,
});
export const CAPABILITIES = Object.freeze(["catalog"]);
/** Ticks after load before the first api_ready; Fishing answers its own at 10, Ranching at 20. */
export const ANNOUNCE_TICKS = 20;
/** Script events carry at most 2048 characters; stay well inside it. */
const MAX_MESSAGE = 1800;
const SOURCE_RE = /^[a-z0-9_.-]{1,64}$/;

export const readyPayload = () => ({ api: 1, source: NAMESPACE, version: VERSION, capabilities: [...CAPABILITIES] });

/** Catalog rows by kind. Every id is a full item or block id. */
export const CATALOGS = Object.freeze({
  crops: () => CROPS.map((c) => ({ id: rid(c.produce), seed: rid(c.seed), form: c.form, climate: c.climate })),
  trees: () => TREES.map((t) => ({ id: rid(t.fruit), sapling: rid(saplingBlockId(t)), climate: t.climate, ...(t.bark ? { bark: true } : {}) })),
});

/** The catalog replies for one request, split so that each stays under MAX_MESSAGE. */
export function catalogReplies(to, req, kind) {
  const head = { api: 1, to, ...(req !== undefined ? { req } : {}), kind };
  if (!CATALOGS[kind]) return [{ ...head, ok: false, code: "UNKNOWN_KIND", kinds: Object.keys(CATALOGS) }];
  const parts = [];
  let items = [];
  const size = (rows) => JSON.stringify({ ...head, ok: true, index: 99, parts: 99, items: rows }).length;
  for (const row of CATALOGS[kind]()) {
    if (items.length && size([...items, row]) > MAX_MESSAGE) {
      parts.push(items);
      items = [];
    }
    items.push(row);
  }
  parts.push(items);
  return parts.map((rows, index) => ({ ...head, ok: true, index, parts: parts.length, items: rows }));
}

/** `req` as the other APIs echo it: a number stays a number, a string keeps 32 characters. */
function echoReq(req) {
  if (typeof req === "number" && Number.isFinite(req)) return req;
  if (typeof req === "string") return req.slice(0, 32);
  return undefined;
}

/** Handles one script event; returns the replies it sent (exported for tests). */
export function handleHarvestEvent(id, raw) {
  if (id === EVENTS.ping) {
    const reply = readyPayload();
    send(EVENTS.ready, reply);
    return [reply];
  }
  if (id !== EVENTS.catalogRequest) return [];
  let m;
  try {
    m = JSON.parse(String(raw ?? ""));
  } catch {
    return [];
  }
  if (!m || m.api !== 1 || typeof m.source !== "string" || !SOURCE_RE.test(m.source) || m.source === NAMESPACE) return [];
  const replies = catalogReplies(m.source, echoReq(m.req), String(m.kind ?? ""));
  for (const reply of replies) send(EVENTS.catalog, reply);
  return replies;
}

export function startHarvestApi() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      // ## Like Herbal: /scriptevent typed by a player or a command block is not another pack.
      if (event.sourceType !== undefined && event.sourceType !== "Server") return;
      handleHarvestEvent(event.id, event.message);
    },
    { namespaces: [NAMESPACE] }
  );
  system.runTimeout(() => send(EVENTS.ready, readyPayload()), ANNOUNCE_TICKS);
}
