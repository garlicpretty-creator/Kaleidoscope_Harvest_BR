// Balance report (npm run balance): every food and drink in the packs with its hunger,
// saturation, ingredients and station, plus the outliers worth a second look.
// Prints a markdown table; `--write` also saves it to docs/M5_平衡表.md.
// `--check` exits 1 when a hard outlier remains (tools/validate.mjs runs the same check).
//
// How an ingredient is valued (「材料值」, in hunger), per item a recipe takes:
//   - a Harvest item you can eat: its hunger;
//   - a Harvest crop you cannot eat raw (onion, garlic, soybean…): 2, a vanilla carrot or beetroot's worth;
//   - a prepared Harvest ingredient (minced garlic, tofu…): the value of what went in, per item made;
//   - a vanilla item: VANILLA below, as the plain food a player would otherwise make of it. Raw meat
//     counts as cooked, potatoes as baked, wheat as a third of bread, an egg as Cookery's fried egg.
//
// Flags, per item made:
//   ✗ over   hunger above 1.5 × the ingredient value + 4 (cooking adds up to 4, as potato → baked potato)
//   ✗ worse  hunger below the best single edible ingredient (shared out over the items made):
//            cooking it threw food away
//   △ loses  hunger + saturation below that of the edible ingredients together. Shown, not an error:
//            drinks and preserves trade food for something that keeps, and meat dishes are measured
//            against the cooked meat (Cookery's own stews give 6 with meat in them).
// ✗ flags are hard: npm run validate fails on them (it runs balance --check). △ is a note.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs", "BP", "scripts", "data", name)).href);
const { ITEMS, ITEM_BY_ID } = await load("items.js");
const { RECIPES, recipeMaking } = await load("dishes.js");
const { NAMESPACE } = await load("ns.js");

/** Vanilla inputs: [hunger, saturation modifier] of what a player would otherwise eat them as; null = not food. */
export const VANILLA = {
  "minecraft:porkchop": [8, 0.8], "minecraft:beef": [8, 0.8], "minecraft:chicken": [6, 0.6], "minecraft:mutton": [6, 0.8],
  "minecraft:egg": [4, 0.5], "minecraft:potato": [5, 0.6], "minecraft:apple": [4, 0.3], "minecraft:wheat": [5 / 3, 0.6],
  "minecraft:honey_bottle": [6, 0.1], "minecraft:sugar": null, "minecraft:snowball": null, "minecraft:bowl": null,
  "minecraft:stick": null, "minecraft:glass_bottle": null, "minecraft:milk_bucket": null,
  // ## 1.1: Cookery's rice, counted as a bowl of its cooked rice either way; its chili as a crop.
  "kaleidoscope_cookery:rice": [4, 0.6], "kaleidoscope_cookery:cooked_rice": [4, 0.6], "kaleidoscope_cookery:red_chili": [2, 0.3],
};
/** 材料值 of a Harvest crop that cannot be eaten raw. */
const INEDIBLE_CROP = 2;

const STATION_ZH = {
  chopping_board: "砧板", millstone: "石磨", wok: "炒鍋", stockpot: "湯鍋", steamer: "蒸籠", teapot: "茶壺",
  bamboo_tray: "竹篩", juicer: "榨汁機", pickling_jar: "醃漬缸", crafting: "工作台", furnace: "熔爐",
};

const bare = (id) => (id.startsWith(`${NAMESPACE}:`) ? id.slice(NAMESPACE.length + 1) : id);

/** The items one craft takes (the juicer takes two of its fruit; "*" is two fruits of any kind). */
export function inputList(row) {
  if (row.station === "juicer") return row.input === "*" ? [] : row.milk ? [row.input, "minecraft:milk_bucket"] : [row.input, row.input];
  if (row.input) return [row.input];
  if (row.inputs) return [...row.inputs];
  return row.slots.map((slot) => slot[0]);
}
/** How many of `id` one craft gives. */
const madeCount = (row, id) => (row.outputs ? row.outputs.find(([out]) => out === id)?.[1] ?? 1 : row.count ?? 1);

const memo = new Map();
/** 材料值 of one item, in hunger (see the top of the file). */
export function valueOf(id) {
  if (id in VANILLA) return VANILLA[id]?.[0] ?? 0;
  if (id.includes(":") && !id.startsWith(`${NAMESPACE}:`)) return 0;
  const key = bare(id);
  if (memo.has(key)) return memo.get(key);
  memo.set(key, 0); // guards a loop
  const item = ITEM_BY_ID.get(key);
  let value = INEDIBLE_CROP;
  if (item?.food) value = item.food[0];
  else {
    const row = recipeMaking(key);
    if (row) value = inputList(row).reduce((sum, i) => sum + valueOf(i), 0) / madeCount(row, key);
  }
  memo.set(key, value);
  return value;
}

/** [hunger, saturation] of an input eaten as it is (vanilla: as its plain food), or null. */
function edibleAs(id) {
  if (id in VANILLA) return VANILLA[id] && [VANILLA[id][0], VANILLA[id][0] * VANILLA[id][1] * 2];
  const food = ITEM_BY_ID.get(bare(id))?.food;
  return food ? [food[0], food[0] * food[1] * 2] : null;
}

/** Average 材料值 of two of the juicer's fruits, for the mixed juice. */
function mixedJuiceValue() {
  const fruits = RECIPES.filter((r) => r.station === "juicer" && r.input !== "*").map((r) => valueOf(r.input));
  return (2 * fruits.reduce((a, b) => a + b, 0)) / fruits.length;
}

const round = (n) => Math.round(n * 10) / 10;
function timeOf(row) {
  if (row.station === "pickling_jar") return `${round(row.time / 24000)} 天`;
  if (row.station === "bamboo_tray") return `${round(row.time / 24000)} 天`;
  if (row.time) return `${round(row.time / 20)} 秒`;
  return "—";
}

export function balanceRows() {
  const rows = [];
  for (const item of ITEMS.filter((i) => i.food)) {
    const [hunger, modifier] = item.food;
    const row = recipeMaking(item.id);
    const out = {
      id: item.id, zh: item.zh, kind: item.kind, hunger, modifier,
      saturation: round(hunger * modifier * 2),
      station: row ? STATION_ZH[row.station] : "採收", time: row ? timeOf(row) : "—",
      count: 0, value: null, flags: [],
    };
    if (row) {
      const inputs = inputList(row);
      const per = madeCount(row, item.id);
      out.count = row.input === "*" ? 2 : inputs.length;
      out.value = round((row.input === "*" ? mixedJuiceValue() : inputs.reduce((sum, i) => sum + valueOf(i), 0)) / per);
      const edible = inputs.map(edibleAs).filter(Boolean);
      // ## Per item made: a jar of two peaches that gives two bottles spends one peach on each.
      const best = Math.max(0, ...edible.map(([h]) => h)) / per;
      const total = edible.reduce((sum, [h, s]) => sum + h + s, 0) / per;
      if (hunger > 1.5 * out.value + 4) out.flags.push("✗ over");
      if (hunger < best - 0.01) out.flags.push("✗ worse");
      else if (hunger + out.saturation < total - 0.01) out.flags.push("△ loses");
    }
    rows.push(out);
  }
  const order = { produce: 0, ingredient: 1, drink: 2, dish: 3 };
  return rows.sort((a, b) => order[a.kind] - order[b.kind] || a.hunger - b.hunger || a.id.localeCompare(b.id));
}

export const hardOutliers = (rows = balanceRows()) => rows.filter((r) => r.flags.some((f) => f.startsWith("✗")));

export function report(rows = balanceRows()) {
  const kindZh = { produce: "產物", ingredient: "食材", drink: "飲品", dish: "料理" };
  const lines = [
    "# M5 平衡表",
    "",
    "由 `npm run balance -- --write` 產生，不要手改。數值來自 `packs/BP/scripts/data/`。",
    "",
    "- **飢餓**：恢復的飢餓值（半格雞腿為 1）。**飽和**：`飢餓 × 飽和係數 × 2`，基岩版的算法。",
    "- **材料數**：做一次放進去幾樣東西。**材料值**：做出一份所用材料的價值（算法見 `tools/balance.mjs` 開頭：生肉以熟肉計、雞蛋以廚房的煎蛋計，生吃不了的作物算 2）。",
    "- **✗ over**：飢餓超過「材料值 ×1.5＋4」（烹調最多多給 4 點，比照馬鈴薯烤成烤馬鈴薯）。**✗ worse**：比單一可吃的材料（一次做多份時按份分攤）還少，煮了反而虧。**△ loses**：飢餓加飽和比可吃材料的合計少；果汁、酒、醃漬品以保存換食物，肉類料理則是跟熟肉比（廚房自己的燉湯放了肉也只給 6），所以只列出、不算錯。",
    "- 帶 ✗ 的列會讓 `npm run validate` 失敗。",
    "",
    "| 物品 | 類別 | 飢餓 | 飽和係數 | 飽和 | 材料數 | 材料值 | 器具 | 時間 | 標記 |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ];
  for (const r of rows)
    lines.push(`| ${r.zh}（\`${r.id}\`） | ${kindZh[r.kind]} | ${r.hunger} | ${r.modifier} | ${r.saturation} | ${r.count || "—"} | ${r.value ?? "—"} | ${r.station} | ${r.time} | ${r.flags.join("、") || ""} |`);
  const hard = hardOutliers(rows);
  const soft = rows.filter((r) => r.flags.some((f) => f.startsWith("△")));
  lines.push("", `共 ${rows.length} 項可食用物品；✗ ${hard.length} 項，△ ${soft.length} 項。`, "");
  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = balanceRows();
  const text = report(rows);
  console.log(text);
  if (process.argv.includes("--write")) writeFileSync(join(root, "docs", "M5_平衡表.md"), text);
  if (process.argv.includes("--check") && hardOutliers(rows).length) process.exit(1);
}
