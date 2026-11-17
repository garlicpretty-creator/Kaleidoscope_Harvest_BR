# 果樹樹形

11 種果樹的樹形全部寫在 `tools/art/tree_shapes.py` 的 `TREES` 表裡（樹幹種類與高度範圍、樹冠種類與大小、傾斜與分枝）。重跑即覆寫，結果固定不變。

```bash
python tools/art/tree_shapes.py
```

產出：

| 檔案 | 內容 |
| --- | --- |
| `packs/BP/features/trees/<果樹>_tree_feature.json` | `minecraft:tree_feature`，id `kaleidoscope_harvest:<果樹>_tree_feature`，11 個 |
| `packs/BP/feature_rules/trees/<果樹>_tree_feature_rule.json` | 野生生成規則，11 個。柑橘只從村莊樹苗取得，它的規則指向一個沒有生物群系帶有的標籤，永遠不會生成；但沒有規則參照的地物，遊戲根本不會註冊，柑橘樹苗就長不大 |
| `art/previews/tree_shapes.png` | 等角體素預覽，無花果葉加上垂在葉下的果實，取各範圍中位數、固定種子 |

樹幹用 `kaleidoscope_harvest:fruitwood_log`（香蕉用 `kaleidoscope_harvest:banana_trunk`），樹葉用 `kaleidoscope_harvest:<果樹>_leaves`。

## 樹形一覽

| 果樹 | 樹幹（高度） | 樹冠 | 輪廓 | 預覽高 | 野生生物群系標籤 | 每區塊機率 |
| --- | --- | --- | --- | --- | --- | --- |
| 柑橘 mandarin | `trunk` 4–5 | `canopy` 偏移 −3..0，角落較常挖空（1/2） | 較矮的幹、稀疏小圓冠 | 5 | 無（村莊樹苗） | — |
| 柳橙 sweet_orange | `trunk` 5–6 | `canopy` 偏移 −3..0，角落較少挖空（1/3） | 5 寬濃密圓球冠 | 6 | `plains` | 1/4 |
| 檸檬 lemon | `acacia_trunk` 3–4，傾斜 1 格 | `acacia_canopy` 1 | 斜幹上偏一側的小平冠 | 5 | `savanna` | 1/4 |
| 桃 peach | `acacia_trunk` 4–5，傾斜 2–3 格，2/3 機率長分枝 | `acacia_canopy` 2（分枝也是 2） | 開心形，兩片平展傘冠 | 7 | `flower_forest` | 1/3 |
| 梨 pear | `fancy_trunk` 基 6、變化 2、比例 0.618 | `fancy_canopy` 高 3、半徑 2 | 大橡樹式分枝，多團不規則冠 | 7 | `forest`，排除 `taiga`、`roofed`、`mega`、`extreme_hills`、`cold` | 1/4 |
| 柿子 persimmon | `trunk` 5–7 | `canopy` 偏移 −3..0（原版橡樹式） | 較高幹、圓冠 | 7 | `taiga`，排除 `cold`、`mega` | 1/5 |
| 荔枝 lychee | `acacia_trunk` 4–5，不傾斜 | `roofed_canopy` 高 3、外 2、內 3 | 7 寬平頂濃密圓頂 | 6 | `jungle`，排除 `edge`、`bamboo` | 1/3 |
| 芒果 mango | `trunk` 5–6 | `mega_canopy` 高 3、基半徑 1 | 上窄下寬的傘形大冠 | 6 | `jungle`，排除 `edge`、`bamboo` | 1/3 |
| 香蕉 banana | `acacia_trunk` 3–4，不傾斜（香蕉莖） | `acacia_canopy` 1 | 頂端一片平展扇葉 | 5 | `jungle` | 1/3 |
| 八角 star_anise | `trunk` 7–8 | `spruce_canopy` 下 2–3、上 0–1、最大半徑 2 | 直立分層尖塔 | 8 | `bamboo`，或 `jungle`＋`hills` | 1/3 |
| 肉桂 cinnamon | `trunk` 6–7 | `pine_canopy` 高 5–6、基半徑 1 | 直立窄柱、尖頂 | 7 | `jungle`＋`edge` | 1/3 |

提案「第一份來源」對應的生物群系：平原 → `plains`；熱帶草原 → `savanna`；繁花森林 → `flower_forest`；森林 → `forest`；針葉林邊緣 → 非寒冷、非巨木的 `taiga`；叢林 → `jungle`；叢林邊緣 → `jungle`＋`edge`（稀疏叢林）。「繁茂山丘」原版沒有對應生物群系，取最接近的竹林（`bamboo`）與叢林丘陵（`jungle`＋`hills`）。叢林丘陵類生物群系在 1.18 之後的新地形裡已不生成，所以實際上八角只會出現在竹林。若要改成山地，可換成 `cherry_grove` 或 `meadow`。

野生規則都是每區塊一次嘗試（`iterations: 1`），由 `scatter_chance` 決定這個區塊要不要種，位置是區塊內隨機一格的地表高度，`placement_pass` 為 `surface_pass`（與原版樹木相同）。

共用設定：

- `may_grow_on`：`grass_block`、`dirt`、`coarse_dirt`、`podzol`、`dirt_with_roots`、`moss_block`，不含耕地。
- `may_replace`：空氣、11 種果葉、11 種樹苗、原版各種樹葉、草、蕨、花、藤蔓、雪層。
- `may_grow_through`：草、蕨、雪層。

## 樹苗長成

樹苗方塊由腳本長成：在樹苗的位置呼叫 `dimension.placeFeature('kaleidoscope_harvest:<果樹>_tree_feature', location)`。樹苗本身列在 `may_replace` 裡，所以不用先清掉，樹幹最底一格會取代樹苗。空間不夠時放置會失敗（回傳 `false`，或在 `shouldThrow` 為 `true` 時拋錯），這時腳本要保留樹苗，晚點再試。

`leaf_block` 只寫方塊 id，生出來的果葉會是方塊的預設狀態。果葉方塊的預設狀態必須是「無花」。果實是另外垂掛在葉下的方塊，由腳本在葉子下方是空氣時生出，不在樹形裡。

## 預覽與遊戲可能不同的地方

預覽是我們對各種樹冠生成方式的解讀，依據原版 data-driven 樹木的舊版生成器推論，畫的是一個代表樣本。遊戲內每棵樹都會隨機變化，以下幾點未經遊戲內驗證：

1. **`canopy`**：沒寫 `canopy_slope` 與 `min_width`，沿用原版橡樹的預設值，所以樹冠由上到下半徑是 1、1、2、2。`rise`／`run` 哪一個是每層增量官方文件沒寫清楚，因此刻意不用。`variation_chance` 依原版橡樹抄 1/2、1/2、1/2、1/1。官方說明寫的是「數字越大越密」，但原版的數值更像是「角落被挖掉的機率」，抄原版的組合在兩種解讀下都還好看。
2. **範圍上限**：`range_max` 是否包含在內，文件沒寫。
3. **不用 `random_spread_canopy`**（實機測試 1.0.0）：接在一般 `trunk` 上時完全不放樹葉；改接 `acacia_trunk` 後，用腳本放樹（樹苗長大）會有葉子，但世界生成時仍然只剩光禿的樹幹。柑橘、柳橙改用原版橡樹式的 `canopy`，檸檬、香蕉改用 `acacia_canopy`；`canopy`、`acacia_canopy`、`fancy_canopy`、`mega_canopy` 都在野外確認長得出完整的樹。`canopy` 只在偏移 −3..0 加 4 個 `variation_chance`（與原版橡樹、柿子相同）的寫法下實機確認過，所以先固定這樣用；而且樹冠會從樹幹頂往下 3 格，樹幹太矮時樹會貼地像灌木，所以至少 4 格。`tools/art/tree_shapes.py` 與 `npm run validate` 都會擋這些情況。
4. **`roofed_canopy`**：文件說 `canopy_height` 是「中間層數」，預覽把它當成總層數，另外畫了偶爾才出現的頂蓋。若照中間層解讀，荔枝會再高 2 層。
5. **`mega_canopy`**：預覽把最上層放在樹幹頂上一格，往下每層半徑加 1。
6. **`spruce_canopy`／`pine_canopy`**：預覽依原版雲杉、松樹的參數範圍推論。`trunk_height` 視為整棵樹的高度，`lower_offset` 視為底部光禿的樹幹長度，`upper_offset` 視為樹葉高出樹幹的格數。
7. **`acacia_trunk` 分枝**：遊戲內分枝方向隨機，預覽固定畫在傾斜的反方向。`branch_position` 當成從樹頂往下算。
8. **`fancy_trunk`**：預覽用大橡樹演算法的簡化版，節點數與分枝角度只是近似。
9. **方塊名稱**：用的是攤平後的新名稱（`grass_block`、`coarse_dirt`、`short_grass`、`oak_leaves` 等），需要 1.21 系列的新版本。舊版本可能回報未知方塊。
10. **叢林**：地表高度圖常落在原版大樹的樹冠上，那裡不在 `may_grow_on` 裡，所以叢林果樹的實際成功率會比 1/3 低。

## 參考資料

- tree_feature 結構：<https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecrafttree_feature>
- 特徵與特徵規則（`placement_pass`、`scatter_chance`、`distribution`、過濾群組）：<https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/featuresintroduction>
- 生物群系標籤與各群系的標籤表：<https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/definitions/nestedtables/biome_filter>
- 官方範例（`trunk_height` 用 `range_min`／`range_max` 的寫法、樹木規則寫法）：<https://github.com/microsoft/minecraft-samples>（`custom_features/example_feature_set`、`creator_camp`）
- 原版樹木參數（oak、fancy_oak、savanna、roofed、spruce、pine、mega_jungle、jungle_bush）：bridge-core 收錄的原版行為包 <https://github.com/bridge-core/bridge./tree/master/static/vanilla/BP/features>
- 宿主寫法參考：廚房 v1.6.6 的 `feature_rules/wild_crops`、`features/wild_crops`
