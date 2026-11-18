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
| 作物 | `crops/<作物>_stage_<0-3>.png` | 34 種 × 4 |
| 玉米上半格 | `crops/corn_upper_stage_2.png`、`crops/corn_upper_stage_3.png` | 2 |
| 樹苗 | `saplings/<果樹>_sapling.png` | 15 |
| 果葉 | `trees/<果樹>_leaves_<bare/blossom>.png` | 15 × 2 |
| 木材 | `trees/fruitwood_log.png`（側面）、`trees/fruitwood_log_top.png`（年輪）、`trees/banana_trunk.png`、`trees/fruitwood_planks.png`（1.1，木板，上下與側面同一張） | 4 |

作物：napa_cabbage、bok_choy、spinach、coriander、cumin、sesame、soybean、onion、scallion、garlic、peanut、sweet_potato、ginger、daikon、taro、eggplant、strawberry、blueberry、pineapple、corn、cucumber、black_pepper、grape、passion_fruit。

1.1 作物：lotus_root、water_bamboo、water_spinach（水生）、bitter_melon、luffa（藤架）、adzuki_bean、mung_bean（豆類）、garlic_chives、lemongrass、sichuan_pepper（香料）。

果樹：mandarin、sweet_orange、lemon、peach、pear、persimmon、lychee、mango、banana、star_anise、cinnamon；1.1：longan、loquat、star_fruit、papaya。

樹苗方塊若 `art/icons/<果樹>_sapling.png` 已選定 16×16 的 icon，就直接用那張 icon（方塊和物品同一張圖）；沒有 icon 時才用程式畫的樹苗。

## 階段意義

| 視覺階段 | 意義 |
| --- | --- |
| 0 | 發芽 |
| 1 | 幼苗 |
| 2 | 生長中／開花 |
| 3 | 成熟可採收（果實上色；地下作物葉片轉黃） |

方塊狀態 `0..7` 對應視覺階段 `floor(state / 2)`：0–1 → 0、2–3 → 1、4–5 → 2、6–7 → 3。

玉米是兩格高：下半格用 `corn_stage_0..3`，上半格只在階段 2、3 出現，用 `corn_upper_stage_2/3`（雄穗由青轉褐）。

藤架作物（小黃瓜、黑胡椒、葡萄、百香果、苦瓜、絲瓜）只畫藤蔓，背景透明；竹藤架是另外的模型。苦瓜成熟時是淺綠帶疣的果實，絲瓜是細長光滑的深綠果實並仍開黃花。

水生作物（蓮藕、茭白筍、空心菜）站在一格水裡，貼圖只畫植株本身，水面以下的部分由模型處理：

- 蓮藕：圓形荷葉由長葉柄撐起；階段 2 冒出花苞，成熟時荷葉上方開粉紅荷花。
- 茭白筍：細長禾草狀葉叢；成熟時莖基部膨大成白色筍身，外包綠色葉鞘。
- 空心菜：淺綠中空莖，葉片箭頭形；成熟時葉片轉深綠。

紅豆、綠豆是像大豆的豆叢，開黃色小花，成熟時葉尖轉黃、垂掛細長豆莢（紅豆暗紅、綠豆深綠）。韭菜是扁平葉叢，成熟時抽出白色星狀花球；香茅是淺綠高禾叢，基部是粗白莖；花椒是像藍莓的帶刺小灌木，成熟時結一簇簇紅色花椒粒。

木瓜果葉是大片掌狀裂葉；楊桃果葉是細小的小葉。

果葉只有兩個階段：`bare` 無花 → `blossom` 開花。果實不畫在葉子裡，而是另一個垂掛在葉子下方的方塊（見 `tools/art/fruit_models.py` 與 PLANT_MODELS.md）。果葉貼圖可無縫平鋪，有少量透明孔，材質用 `alpha_test`。

## 物品 icon

- `tools/art/block_icons.py`：果葉與木材方塊的等角小方塊 icon（含 1.1 的 longan_leaves、loquat_leaves、star_fruit_leaves、papaya_leaves，以及 fruitwood_planks，上面與側面用同一張木板貼圖），寫到 `art/icons/` 與 `items/`；`items/` 下的法線、MER 與 texture set 由 `tools/art/pbr_maps.py` 產生。
- `tools/art/seed_icons.py`：種子 icon（含 1.1 的 water_spinach_seeds、bitter_melon_seeds、luffa_seeds、garlic_chive_seeds，以及種子狀的 adzuki_bean、mung_bean、sichuan_peppercorns、lotus_seeds），寫到 `art/icons/`。

兩支都在 `art/icons/picks.json` 記為 `"code"`。三支腳本都只在像素有變時才重寫 PNG，重跑不會改動已提交的檔案。

## PBR

- 法線：依材質高度加亮度推出輕微斜面；平鋪貼圖（果葉、木材）邊緣環繞取樣。
- MER：金屬度 0、自發光 0；粗糙度依材質：葉 185、莖 200、花 200、果實 150、根／球莖 190、乾燥物 215、木材 225、樹皮 235；透明像素為 255。
- 未使用次表面散射。
