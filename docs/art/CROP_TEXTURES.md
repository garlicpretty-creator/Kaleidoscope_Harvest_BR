# 作物、樹苗與果樹貼圖

全部由 `tools/art/crop_textures.py` 以程式逐像素繪製（16×16、無反鋸齒、每種材質 3–5 階色），不使用 AI 生成或外部素材。重跑即覆寫，結果固定不變。

```bash
python tools/art/crop_textures.py
```

預覽總表：`art/previews/crop_textures.png`（放大 4 倍，每列一種作物或果樹）。

## 檔案

路徑皆在 `packs/RP/textures/kaleidoscope_harvest/blocks/` 之下。每張顏色圖都另有 `<名稱>_normal.png` 與 `<名稱>_mer.png`。

| 類別 | 檔名 | 數量 |
| --- | --- | --- |
| 作物 | `crops/<作物>_stage_<0-3>.png` | 24 種 × 4 |
| 玉米上半格 | `crops/corn_upper_stage_2.png`、`crops/corn_upper_stage_3.png` | 2 |
| 樹苗 | `saplings/<果樹>_sapling.png` | 11 |
| 果葉 | `trees/<果樹>_leaves_<bare/blossom>.png` | 11 × 2 |
| 木材 | `trees/fruitwood_log.png`（側面）、`trees/fruitwood_log_top.png`（年輪）、`trees/banana_trunk.png` | 3 |

作物：napa_cabbage、bok_choy、spinach、coriander、cumin、sesame、soybean、onion、scallion、garlic、peanut、sweet_potato、ginger、daikon、taro、eggplant、strawberry、blueberry、pineapple、corn、cucumber、black_pepper、grape、passion_fruit。

果樹：mandarin、sweet_orange、lemon、peach、pear、persimmon、lychee、mango、banana、star_anise、cinnamon。

## 階段意義

| 視覺階段 | 意義 |
| --- | --- |
| 0 | 發芽 |
| 1 | 幼苗 |
| 2 | 生長中／開花 |
| 3 | 成熟可採收（果實上色；地下作物葉片轉黃） |

方塊狀態 `0..7` 對應視覺階段 `floor(state / 2)`：0–1 → 0、2–3 → 1、4–5 → 2、6–7 → 3。

玉米是兩格高：下半格用 `corn_stage_0..3`，上半格只在階段 2、3 出現，用 `corn_upper_stage_2/3`（雄穗由青轉褐）。

藤架作物（小黃瓜、黑胡椒、葡萄、百香果）只畫藤蔓，背景透明；竹藤架是另外的模型。

果葉只有兩個階段：`bare` 無花 → `blossom` 開花。果實不畫在葉子裡，而是另一個垂掛在葉子下方的方塊（見 `tools/art/fruit_models.py` 與 PLANT_MODELS.md）。果葉貼圖可無縫平鋪，有少量透明孔，材質用 `alpha_test`。

## PBR

- 法線：依材質高度加亮度推出輕微斜面；平鋪貼圖（果葉、木材）邊緣環繞取樣。
- MER：金屬度 0、自發光 0；粗糙度依材質：葉 185、莖 200、花 200、果實 150、根／球莖 190、乾燥物 215、木材 225、樹皮 235；透明像素為 255。
- 未使用次表面散射。
