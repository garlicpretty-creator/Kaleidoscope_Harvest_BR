// Harvest's recipes and guidebook chapter, sent to Cookery once it is ready.
//
//   kaleidoscope_cookery:register_recipe   chopping board, wok, stockpot, steamer (data/dishes.js)
//   kaleidoscope_cookery:guidebook_*       the「豐收」chapter (data/guidebook.js)
//
// ## Every registration is checked against Cookery's capability list first, so
// ## an older Cookery skips what it lacks (企劃書 risk: 廚房更新改動內部結構).
// ## Payload fields follow what Ranching 1.1 sends to Cookery 1.6.6.

import { system } from "@minecraft/server";
import { RECIPES } from "../data/dishes.js";
import { guidebookPayload } from "../data/guidebook.js";
import { NAMESPACE, rid } from "../data/ns.js";
import { cookeryHas, onCookeryReady, send } from "./cookery.js";

const SOURCE = NAMESPACE;
const KIND = { chopping_board: "chopping_board", wok: "wok", stockpot: "stockpot_exact", steamer: "steamer" };

/** The register_recipe payload for one row of data/dishes.js. */
export function recipePayload(row) {
  const kind = KIND[row.station];
  if (!kind) throw new Error(`unknown station ${row.station}`);
  const id = `${NAMESPACE}:${row.station}/${row.result}`;
  const result = rid(row.result);
  let recipe;
  switch (row.station) {
    case "chopping_board":
      recipe = { id, input: rid(row.input), result, count: row.count ?? 1, cuts: row.cuts ?? 1 };
      break;
    case "steamer":
      recipe = { id, input: rid(row.input), result, count: row.count ?? 1, time: row.time };
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

/** Sends every recipe Cookery can take; returns how many went out. */
export function registerRecipes() {
  let sent = 0;
  for (const row of RECIPES) {
    const payload = recipePayload(row);
    if (cookeryHas(payload.kind) && send("kaleidoscope_cookery:register_recipe", payload)) sent++;
  }
  return sent;
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
