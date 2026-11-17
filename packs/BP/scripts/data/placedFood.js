// Foods and drinks that can be put down as a block (設計：docs/superpowers/specs/
// 2026-11-17-placeable-food-design.md). The block has the item's id; the item gets
// minecraft:block_placer (tools/generate.mjs). The behaviour is Cookery's own:
// kaleidoscope_cookery:food_bite (a bite per use, the last stage is the empty
// container) or kaleidoscope_cookery:cup_stack (teas, up to four cups).
// The models are per shape, the textures per item (tools/art/food_models.py).
// Plain data: no @minecraft imports.

/** Bites a shared pot or dessert takes; a drink is drunk in one. */
export const SHARED_BITES = 4;
/** Cups a tea block holds (Cookery's cup_stack). */
export const MAX_CUPS = 4;

const pot = (item) => ({ item, shape: "pot", bites: SHARED_BITES });
const drink = (item, shape = "bottle") => ({ item, shape, bites: 1 });
const tea = (item) => ({ item, shape: "teacup", bites: 0 });

export const PLACED_FOODS = [
  pot("cabbage_pork_stew"), pot("daikon_beef_brisket"), pot("braised_pork"),
  pot("corn_chowder"), pot("taro_spare_ribs"), pot("tofu_vegetable_soup"),
  { item: "blueberry_pie", shape: "pie", bites: SHARED_BITES },
  { item: "pineapple_cake", shape: "cakes", bites: SHARED_BITES },
  { item: "fruit_platter", shape: "platter", bites: SHARED_BITES },
  drink("mandarin_juice"), drink("orange_juice"), drink("grape_juice"),
  drink("mango_juice"), drink("mixed_juice"), drink("passion_fruit_juice"),
  drink("lychee_wine", "wine"), drink("peach_wine", "wine"),
  tea("cinnamon_tea"), tea("ginger_tea"), tea("lemon_tea"), tea("passion_fruit_tea"),
  // --- 1.1 (1.1 企劃「可放置」) ----------------------------------------------------------------------
  pot("lotus_root_rib_soup"), pot("luffa_soup"), pot("red_bean_soup"), pot("mung_bean_soup"), pot("mapo_tofu"),
  { item: "red_bean_cake", shape: "cakes", bites: SHARED_BITES },
  { item: "mung_bean_cake", shape: "cakes", bites: SHARED_BITES },
  drink("loquat_juice"), drink("star_fruit_juice"), drink("papaya_milk"),
  drink("longan_wine", "wine"),
  tea("lemongrass_tea"), tea("longan_tea"),
];

const BY_ITEM = new Map(PLACED_FOODS.map((row) => [row.item, row]));
/** The placed-food row for an item id (no namespace), or undefined. */
export const placedFood = (item) => BY_ITEM.get(item);
