# Placeable Food Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 21 Harvest foods and drinks can be put down as blocks and eaten (or, for teas, stacked as cups) the way Cookery's own dishes are.

**Architecture:** One data table (`packs/BP/scripts/data/placedFood.js`) lists item → shape → bites. `tools/art/food_models.py` writes one block model per shape and one 32×32 texture per item. `tools/generate.mjs` turns each row into a block (same id as the item) that uses Cookery's `food_bite` or `cup_stack` component, gives the item `block_placer` and Cookery's `placeable_food` tag, and writes per-stage loot. No new Harvest script.

**Tech Stack:** Bedrock block JSON (format 1.21.100), Python + Pillow (art), Node (generator, tests).

**Spec:** `docs/superpowers/specs/2026-11-17-placeable-food-design.md`

## Global Constraints

- Block id = item id; item gets `minecraft:block_placer` `{ block, replace_block_item: true }` and tag `kaleidoscope_cookery:placeable_food`.
- `food_bite` params: `state` `kaleidoscope_cookery:food_stage`, `max_stage` = bites, `nutrition` = ceil(item nutrition ÷ bites), `saturation_modifier` = the item's, `always_eat` true, `return_items` = the item's container (omitted when none).
- Bites: pots and desserts 4, drinks 1.
- `cup_stack` params: `filled` true, `item` = the tea, `empty_item` `kaleidoscope_cookery:empty_cup`, `max_count` 4; states `kaleidoscope_cookery:cup_count` 1–4, `kaleidoscope_cookery:tea_count` 1–4; bones `cup_1..4`, `tea_1..4`.
- Every block: `minecraft:cardinal_direction` placement trait with `y_rotation_offset` 180, `kaleidoscope_cookery:placeable_food_placement_guard`, immovable, light_dampening 0.
- Breaking: stage 0 drops the item; later stages drop the container (nothing when none). Teas: `cup_stack` drops, block loot empty.

## Review Focus

- A drink placed and drunk shows an empty bottle, and one more use gives the bottle back — `return_items` must be set for drinks.
- Breaking a half-eaten pot gives only the bowl, not the stew back — per-stage loot.
- A tea placed and then the same tea used on it stacks (not a second block) — `cup_stack` `item` equals the block id.
- Item used in the air still eats/drinks — `minecraft:food` is kept alongside `block_placer`.
- Every placed food has a model, texture and name — no missing geometry in game.

---

### Task 1: Data table

**Files:** Create `packs/BP/scripts/data/placedFood.js`.

**Produces:** `PLACED_FOODS: { item, shape, bites }[]` (shape ∈ `pot`, `pie`, `cakes`, `platter`, `bottle`, `wine`, `teacup`; `bites` 0 for teacups), `placedFood(itemId)`.

- [ ] Rows exactly as the spec's four groups.

### Task 2: Art

**Files:** Create `tools/art/food_models.py`; writes `packs/RP/models/blocks/food_<shape>.geo.json` and `packs/RP/textures/kaleidoscope_harvest/blocks/food/<item>.png` (+ `_normal`, `_mer`).

- [ ] Each shape's bones: pot `pot`, `soup_1..4`, `bits_1..4`; pie/cakes/platter `plate`, `piece_1..4`; bottle/wine `bottle`, `liquid`, glass faces on material instance `glass`; teacup `cup_1..4`, `tea_1..4`.
- [ ] Texture slots (16×16 each): container, main, accent, accent 2.

### Task 3: Generator

**Files:** Modify `tools/generate.mjs`.

- [ ] Block per row with bone_visibility: pot `soup_k`/`bits_k` when stage == 4 − k; pieces `piece_i` when stage ≤ 4 − i; `liquid` when stage == 0; cups as Herbal's teas.
- [ ] Item: `block_placer`, tag; tile name = item name; terrain `kh_food_<item>`.
- [ ] Loot tables `placed_<item>_full`, `placed_<container>`.

### Task 4: Tests

**Files:** Modify `tools/test/run.mjs`.

- [ ] Test "placed food: every row's block uses Cookery's component with the spec's params": for each row assert component name, `max_stage`, `nutrition` = ceil, `return_items`, item `block_placer.block` = block id, tag present, geometry file exists with the bones the visibility names, texture file exists, stage 0 loot gives the item and stage 1 the container.
- [ ] `npm run build` passes.

### Task 5: In game, then PR and merge

- [ ] Place a pot, bite four times, take the bowl; drink a juice, take the bottle; stack two teas and take one back; break a fresh and a started dish.
- [ ] Commit, push, PR, merge (the user asked for it).
