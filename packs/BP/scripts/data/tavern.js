// The payload Harvest sends 森羅物語：酒館 (api/tavern.js): the lychee, peach and (1.1) longan wines as barrel
// recipes, (1.2) Harvest's grape as a pressing-tub input, with guide pages in three languages. Same fields as Herbal 1.1's data/tavernRecipes.js.
// Plain data: no @minecraft imports.

import { ITEM_BY_ID } from "./items.js";
import { MENU } from "./menu.js";
import { NAMESPACE, rid } from "./ns.js";
import { TAVERN_BATCH, TAVERN_GRAPE, TAVERN_WINES } from "./integrations.js";
import { VERSION } from "./version.js";
import { toSimplified } from "./zh_cn.js";

export const LOCALES = ["zh_TW", "zh_CN", "en_US"];
const NAMES = {
  "minecraft:sugar": { zh_TW: "糖", en_US: "Sugar" },
  "minecraft:wheat": { zh_TW: "小麥", en_US: "Wheat" },
};

/** Localized name of an ingredient: Harvest's items from data/items.js, vanilla from NAMES. */
function nameOf(id, locale) {
  const item = ITEM_BY_ID.get(id);
  const zh = item ? item.zh : NAMES[id].zh_TW;
  if (locale === "en_US") return item ? item.en : NAMES[id].en_US;
  return locale === "zh_CN" ? toSimplified(zh) : zh;
}

/** How long the pickling jar takes for this wine, in days (data/menu.js). */
const jarDays = (id) => MENU.find((row) => row.item.id === id).make.time / 24000;

function wineBody(wine, locale) {
  const items = wine.ingredients.map((id) => `${nameOf(id, locale)} ×1`);
  const fruit = nameOf(wine.fruit, locale);
  const days = jarDays(wine.id);
  if (locale === "en_US")
    return [
      `Barrel batch per bottle: ${TAVERN_BATCH.waterBuckets} water buckets (${TAVERN_BATCH.fluidAmount} mB); ${items.join(", ")}. Fill the barrel before adding ingredients. Equal amounts of all three make 1–${TAVERN_BATCH.maxBatch} bottles; excess ingredients are not returned.`,
      "Close the lid and wait for the next barrel check. Place an empty glass bottle below the tap, then open the tap to bottle the wine.",
      `Also made without Tavern: two ${fruit} and one sugar sealed in Harvest's pickling jar for ${days} days give two bottles. Drinking it returns the glass bottle.`,
    ].join("\n\n");
  const zh = [
    `酒桶單瓶配方：水桶 ×${TAVERN_BATCH.waterBuckets}（${TAVERN_BATCH.fluidAmount} mB）；${items.join("、")}。先加滿水，再投材料。三種材料各 n 份可釀 n 瓶（1～${TAVERN_BATCH.maxBatch}），多投入的材料不會返還。`,
    "關上桶蓋，待酒桶下一次檢查完成釀製。在酒嘴下擺空玻璃瓶，再開酒嘴裝瓶。",
    `沒有酒館也能做：在豐收的醃漬缸放兩顆${fruit}和一份糖，封缸 ${days} 天得兩瓶。喝完還玻璃瓶。`,
  ].join("\n\n");
  // ## Names are already converted; converting the whole text again is harmless.
  return locale === "zh_CN" ? toSimplified(zh) : zh;
}

function fruitBody(wine, locale) {
  const wineName = nameOf(wine.id, locale);
  if (locale === "en_US") return `A Harvest fruit, from its fruit tree. In Tavern's barrel it makes ${wineName}; see the Harvest chapter of the Cookery guide for growing it.`;
  const zh = `豐收的水果，從果樹摘下。在酒館的酒桶裡可釀${wineName}；種植方法請見廚房圖鑑的「豐收」章節。`;
  return locale === "zh_CN" ? toSimplified(zh) : zh;
}

function grapeBody(locale) {
  if (locale === "en_US")
    return "Harvest's grape, grown on a bamboo trellis. It presses just like Tavern's grape: put it in the pressing tub for grape juice, then brew Tavern's grape wine. Tavern's grape also works in Harvest's juicer and on Cookery's bamboo tray for raisins.";
  const zh = "豐收的葡萄，種在竹藤架上。和酒館的葡萄一樣能放進壓榨桶壓成葡萄汁，再釀酒館的葡萄酒；酒館的葡萄也能放進豐收的榨汁機，或放在廚房的竹篩上曬成葡萄乾。";
  return locale === "zh_CN" ? toSimplified(zh) : zh;
}

const localized = (fn) => Object.fromEntries(LOCALES.map((locale) => [locale, fn(locale)]));
const icon = (id) => `textures/${NAMESPACE}/items/${id}`;

/** What Harvest sends Tavern: the same fields as Herbal's TAVERN_PAYLOAD. */
export function tavernPayload() {
  return {
    api: 1,
    source: NAMESPACE,
    version: VERSION,
    title: { zh_TW: "森羅物語：豐收", zh_CN: toSimplified("森羅物語：豐收"), en_US: "Kaleidoscope Harvest" },
    requires: ["barrel_recipes", "pressing_recipes", "guide_product_pages", "chunk_transport", "acknowledgements"],
    recipes: [
      ...TAVERN_WINES.map((wine) => ({
      id: rid(`barrel/${wine.id}`),
      kind: "barrel",
      title: wine.title,
      fluid: "minecraft:water",
      ingredients: wine.ingredients.map((id) => [rid(id)]),
      carrier: TAVERN_BATCH.carrier,
      unitTime: TAVERN_BATCH.unitTime,
      output: { item: rid(wine.id) },
      })),
      // ## 1.2: Harvest's grape in Tavern's pressing tub gives Tavern's own grape juice.
      {
        id: rid("pressing/grape"),
        kind: "pressing",
        title: TAVERN_GRAPE.title,
        input: [rid(TAVERN_GRAPE.harvest)],
        fluid: TAVERN_GRAPE.juice,
        amount: TAVERN_GRAPE.amount,
      },
    ],
    pages: [
      ...TAVERN_WINES.map((wine) => ({
        id: rid(`guide/${wine.id}`),
        item: rid(wine.id),
        category: "barrel",
        title: wine.title,
        icon: icon(wine.id),
        recipeIds: [rid(`barrel/${wine.id}`)],
        body: localized((locale) => wineBody(wine, locale)),
      })),
      // ## Like Herbal's ingredient pages: Tavern learns the localized names of Harvest's fruit.
      ...TAVERN_WINES.map((wine) => ({
        id: rid(`guide/ingredient_${wine.fruit}`),
        item: rid(wine.fruit),
        category: "ingredients",
        title: localized((locale) => nameOf(wine.fruit, locale)),
        icon: icon(wine.fruit),
        body: localized((locale) => fruitBody(wine, locale)),
      })),
      {
        id: rid("guide/ingredient_grape"),
        item: rid(TAVERN_GRAPE.harvest),
        category: "ingredients",
        title: TAVERN_GRAPE.title,
        icon: icon(TAVERN_GRAPE.harvest),
        recipeIds: [rid("pressing/grape")],
        body: localized(grapeBody),
      },
    ],
  };
}
