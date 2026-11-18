// Harvest's recipes and guidebook chapter, sent to Cookery once it is ready.
//
//   kaleidoscope_cookery:register_recipe         chopping board, millstone, wok, stockpot, steamer,
//                                                teapot, bamboo tray (data/menu.js)
//   kaleidoscope_cookery:register_oil_container  sesame oil and peanut oil as wok oil
//   kaleidoscope_cookery:guidebook_*       the「豐收」chapter (data/guidebook.js)
//
// ## Every registration is checked against Cookery's capability list first, so
// ## an older Cookery skips what it lacks (企劃書 risk: 廚房更新改動內部結構).
// ## Payload fields follow what Ranching 1.1 and Herbal 1.2 send to Cookery 1.6.6.

import { ItemTypes, system } from "@minecraft/server";
import { COOKERY_STATIONS, RECIPES } from "../data/dishes.js";
import { TAVERN_GRAPE } from "../data/integrations.js";
import { ITEMS } from "../data/items.js";
import { guidebookPayload } from "../data/guidebook.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { cookeryHas, onCookeryReady, send } from "./cookery.js";

const SOURCE = NAMESPACE;
const KIND = {
  chopping_board: "chopping_board", millstone: "millstone", wok: "wok", stockpot: "stockpot_exact",
  steamer: "steamer", teapot: "teapot", bamboo_tray: "bamboo_tray",
};

/** The register_recipe payload for one Cookery recipe of data/dishes.js. */
export function recipePayload(row) {
  const kind = KIND[row.station];
  if (!kind) throw new Error(`unknown station ${row.station}`);
  const id = `${NAMESPACE}:${row.station}/${row.result}${row.idSuffix ?? ""}`;
  const result = rid(row.result);
  let recipe;
  switch (row.station) {
    case "chopping_board":
      recipe = { id, input: rid(row.input), result, count: row.count ?? 1, cuts: row.cuts ?? 1 };
      break;
    case "millstone":
      // ## Herbal's shape: every output is { id, count, chance } (chance 1 = always).
      recipe = { id, input: rid(row.input), outputs: row.outputs.map(([out, count, chance = 1]) => ({ id: rid(out), count, chance })) };
      break;
    case "steamer":
      recipe = { id, input: rid(row.input), result, count: row.count ?? 1, time: row.time };
      break;
    case "teapot":
      // ## Herbal's shape: one ingredient brewed in water, poured into Cookery cups.
      recipe = { id, ingredient: rid(row.input), base: "minecraft:water", result, count: row.count ?? 4, time: row.time };
      break;
    case "bamboo_tray":
      recipe = { id, input: rid(row.input), result, process: "dry", duration: row.time };
      break;
    default:
      recipe = {
        id,
        ingredients: row.slots,
        result,
        count: row.count ?? 1,
        carrier: row.carrier ?? "",
        time: row.time,
        ...(row.station === "stockpot" ? { base: "minecraft:water", finishedKind: "default" } : {}),
      };
  }
  return { api: 1, kind, source: SOURCE, recipe };
}

const itemExists = (id) => {
  try {
    return !!ItemTypes.get(id);
  } catch {
    return false;
  }
};

/**
 * 1.2: the same Cookery recipes for another pack's fruit that counts as Harvest's (Tavern's
 * grape dries into raisins too). Only sent when that pack is installed, so Cookery never
 * sees an unknown item.
 */
export function partnerRows() {
  if (!itemExists(TAVERN_GRAPE.tavern)) return [];
  return RECIPES.filter((row) => COOKERY_STATIONS.includes(row.station) && row.input === TAVERN_GRAPE.harvest).map((row) => ({
    ...row,
    input: TAVERN_GRAPE.tavern,
    idSuffix: "_from_tavern_grape",
  }));
}

/** Sends every recipe Cookery can take; returns how many went out. */
export function registerRecipes() {
  let sent = 0;
  for (const row of [...RECIPES.filter((r) => COOKERY_STATIONS.includes(r.station)), ...partnerRows()]) {
    const payload = recipePayload(row);
    if (cookeryHas(payload.kind) && send("kaleidoscope_cookery:register_recipe", payload)) sent++;
  }
  if (cookeryHas("oil_containers")) for (const payload of oilContainers()) send("kaleidoscope_cookery:register_oil_container", payload);
  return sent;
}

/** Plant oil capacity in Cookery wok uses (企劃書：容量預設 256). */
export const OIL_CAPACITY = 256;

/**
 * Sesame and peanut oil as Cookery wok oil, in the shape Ranching uses for lard. The
 * bottle holds OIL_CAPACITY uses, kept in an item dynamic property, so the oil items do
 * not stack (tools/generate.mjs); an empty glass bottle is left.
 */
export function oilContainers() {
  return ITEMS.filter((item) => item.oil).map((item) => ({
    api: 1,
    source: SOURCE,
    container: {
      id: rid(item.id),
      empty: "minecraft:glass_bottle",
      oil: rid(item.id),
      capacity: OIL_CAPACITY,
      defaultAmount: OIL_CAPACITY,
      amountProperty: `${NAMESPACE}:oil_amount`,
    },
  }));
}

// --- Guidebook chapter -----------------------------------------------------------------
//
// Cookery's guidebook extension takes a chapter in begin / chunk / end messages
// (the same transfer Ranching uses).

const GUIDEBOOK_ID = `${NAMESPACE}:guidebook`;
const CHUNK_SIZE = 1600;

/** A short hash, so Cookery takes a changed chapter as new. */
function revisionOf(json) {
  let a = 0x811c9dc5;
  let b = 0;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 31) + c) >>> 0;
  }
  return `g${a.toString(36)}${b.toString(36)}`;
}

export function guidebookMessages(payload = guidebookPayload()) {
  const json = JSON.stringify({ ...payload, id: GUIDEBOOK_ID });
  const revision = revisionOf(json);
  const parts = [];
  for (let at = 0; at < json.length; at += CHUNK_SIZE) parts.push(json.slice(at, at + CHUNK_SIZE));
  return [
    ["kaleidoscope_cookery:guidebook_begin", JSON.stringify({ api: 1, source: SOURCE, id: GUIDEBOOK_ID, revision, chunks: parts.length })],
    ...parts.map((data, index) => ["kaleidoscope_cookery:guidebook_chunk", [SOURCE, GUIDEBOOK_ID, revision, index, data].join("\n")]),
    ["kaleidoscope_cookery:guidebook_end", JSON.stringify({ api: 1, source: SOURCE, id: GUIDEBOOK_ID, revision })],
  ];
}

export function sendGuidebook() {
  let messages;
  try {
    messages = guidebookMessages();
  } catch (error) {
    console.warn(`[${NAMESPACE}] could not build the guidebook chapter: ${error}`);
    return false;
  }
  // ## A refused message spoils the transfer; stop and let the next guidebook_ready retry.
  for (const [id, message] of messages) if (!send(id, message)) return false;
  return true;
}

let guidebookSent = false;

export function startCookeryContent() {
  onCookeryReady(() => registerRecipes());
  // ## Cookery broadcasts guidebook_ready several times; a chapter that failed
  // ## to go out is tried again on the next one instead of being lost.
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "kaleidoscope_cookery:guidebook_ready" || guidebookSent) return;
    guidebookSent = sendGuidebook();
  });
  system.run(() => send("kaleidoscope_cookery:guidebook_ping", SOURCE));
}
