// Harvest's own Script Event API (API 1, next release after 1.0.0): the family packs can now say hello to Harvest too.
//
//   in   kaleidoscope_harvest:api_ping          anyone; message is the sender's namespace (or anything)
//   out  kaleidoscope_harvest:api_ready         { api: 1, source, version, capabilities, limits }
//                                               also broadcast once by itself 20 ticks after load
//   in   kaleidoscope_harvest:catalog_request   { api: 1, source, req?, kind: "crops" | "trees" | "partners" }
//   out  kaleidoscope_harvest:catalog           { api: 1, to, req?, kind, ok, index, parts, items }
//
// ## Same envelope as Herbal and Fishing (their docs/API.md): one-line JSON under 2048 characters, only
// ## script-sent events count (sourceType "Server"; players typing /scriptevent are ignored), replies are
// ## broadcast with `to`, a bad request gets no reply. Harvest takes no registrations: it only says who it
// ## is and what it grows, so Fishing, Herbal and Ranching no longer have to guess from its items.

import { system } from "@minecraft/server";
import { CROPS } from "../data/crops.js";
import { TREES } from "../data/trees.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { VERSION } from "../data/version.js";
import { send } from "./cookery.js";

export const PING = `${NAMESPACE}:api_ping`;
export const READY = `${NAMESPACE}:api_ready`;
export const CATALOG_REQUEST = `${NAMESPACE}:catalog_request`;
export const CATALOG = `${NAMESPACE}:catalog`;
export const CAPABILITIES = ["catalog"];
export const KINDS = ["crops", "trees", "partners"];
/** Keep each reply well inside the 2048-character script event limit. */
const MAX_MESSAGE = 1800;
const SOURCE_RE = /^[a-z0-9_.-]{1,64}$/;

/** The partner packs Harvest registers with when they answer (api/*.js). */
const PARTNERS = ["kaleidoscope_cookery", "kaleidoscope_ranching", "kaleidoscope_herbal", "kaleidoscope_tavern", "kaleidoscope_fishing"];

export function readyPayload() {
  return { api: 1, source: NAMESPACE, version: VERSION, capabilities: CAPABILITIES, limits: { kinds: KINDS } };
}

/** One row per crop / tree, full item ids. */
export function catalogItems(kind) {
  if (kind === "crops") return CROPS.map((c) => ({ id: rid(c.id), seed: rid(c.seed), produce: rid(c.produce), form: c.form, climate: c.climate }));
  if (kind === "trees") return TREES.map((t) => ({ id: rid(t.id), sapling: rid(`${t.id}_sapling`), produce: rid(t.fruit), climate: t.climate }));
  if (kind === "partners") return PARTNERS.map((id) => ({ id }));
  return null;
}

/** Splits a catalog into replies of at most MAX_MESSAGE characters. */
export function catalogReplies(request) {
  const head = { api: 1, to: request.source, ...(request.req !== undefined ? { req: request.req } : {}), kind: request.kind };
  const items = catalogItems(request.kind);
  if (!items) return [JSON.stringify({ ...head, ok: false, code: "UNKNOWN_KIND", kinds: KINDS })];
  const pages = [[]];
  for (const item of items) {
    const page = pages.at(-1);
    if (page.length && JSON.stringify({ ...head, ok: true, index: 99, parts: 99, items: [...page, item] }).length > MAX_MESSAGE) pages.push([item]);
    else page.push(item);
  }
  return pages.map((page, index) => JSON.stringify({ ...head, ok: true, index, parts: pages.length, items: page }));
}

/** Parses a request; undefined when it does not deserve a reply. */
export function parseRequest(message) {
  let m;
  try {
    m = JSON.parse(String(message ?? ""));
  } catch {
    return undefined;
  }
  if (!m || typeof m !== "object" || m.api !== 1) return undefined;
  if (typeof m.source !== "string" || !SOURCE_RE.test(m.source) || m.source === NAMESPACE) return undefined;
  if (m.req !== undefined) {
    if (typeof m.req === "string") m.req = m.req.slice(0, 32);
    else if (typeof m.req !== "number" || !Number.isFinite(m.req)) delete m.req;
  }
  return m;
}

export const announce = () => send(READY, readyPayload());

export function startHarvestApi() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.sourceType !== undefined && event.sourceType !== "Server") return;
      if (event.id === PING) announce();
      else if (event.id === CATALOG_REQUEST) {
        const request = parseRequest(event.message);
        if (request) for (const reply of catalogReplies(request)) send(CATALOG, reply);
      }
    },
    { namespaces: [NAMESPACE] }
  );
  system.runTimeout(announce, 20);
}
