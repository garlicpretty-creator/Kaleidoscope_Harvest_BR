# 作物、藤架與樹苗模型

由 `tools/art/plant_models.py` 產生（先跑 `tools/art/crop_textures.py`）。1.1 的 10 種作物列在腳本的 `NEW_CROPS`，貼圖還沒畫也照樣產生模型（預覽格標「no texture」）。做法比照原版與《廚房》的作物：根莖、球莖、穀物類用原版的「#」字四面（小麥、胡蘿蔔那種），葉菜與結果的植物用《廚房》的 crossedcrop 交叉兩面（20.4 寬），都往耕地下沉 1 像素；不另外做立體果實。樹苗和原版一樣是一個交叉兩面。

## 檔案（`packs/RP/models/blocks/`）

| 檔案 | geometry | 骨骼 | 材質實例 |
| --- | --- | --- | --- |
| `<作物>_crop.geo.json`（28 種，含 1.1 的 8 種） | `geometry.kaleidoscope_harvest.<作物>_crop` | `stage0`～`stage3` | `stage0`～`stage3` |
| `corn_upper.geo.json` | `geometry.kaleidoscope_harvest.corn_upper` | `stage2`、`stage3` | 同左 |
| `bamboo_trellis_<藤蔓>.geo.json`（小黃瓜、黑胡椒、葡萄、百香果；1.1 苦瓜、絲瓜） | `geometry.kaleidoscope_harvest.bamboo_trellis_<藤蔓>` | `trellis`、`stage0`～`stage3` | `trellis`、`stage0`～`stage3` |
| `sapling.geo.json`（11 種樹苗共用） | `geometry.kaleidoscope_harvest.sapling` | `sapling` | `sapling` |

## 方塊端怎麼接

- 每個 permutation 用 `minecraft:geometry` 的 `bone_visibility` 只顯示目前階段的骨骼；方塊狀態 0..7 對應 floor(狀態/2)。
- `material_instances` 把 `stageN` 指到 `<作物>_stage_N`（`render_method: alpha_test`），藤架的 `trellis` 指到 `bamboo_trellis`。
- 藤架模型的 UV 空間是 64×64（竹架圖集），階段貼圖的 UV 已乘 4，直接指到 16×16 的階段貼圖即可。
- 「#」字形：洋蔥、大蒜、蔥、白蘿蔔、花生、地瓜、薑、大豆、芝麻、孜然、玉米；1.1 紅豆、綠豆、韭菜、香茅。交叉形：大白菜、青江菜、菠菜、香菜、茄子、草莓、藍莓、鳳梨、芋頭；1.1 花椒（灌木，同藍莓）。
- 水生（1.1）：蓮藕、茭白筍、空心菜也是交叉形。方塊站在水裡、底下是水田或泥巴，和其他作物一樣往下沉 1 像素（沉進水田／泥巴，莖底本來就在水裡看不到），不另做水面以下的模型。

## 垂掛果實（`tools/art/fruit_models.py`）

果實不畫在果葉裡，而是掛在果葉下方的獨立方塊，像原版的可可豆、螢光漿果。

| 檔案 | geometry | 骨骼 |
| --- | --- | --- |
| `<果樹>_fruit.geo.json`（肉桂以外 14 種，含 1.1 的 4 種） | `geometry.kaleidoscope_harvest.<果樹>_fruit` | `stage0` 小青果、`stage1` 大青果、`stage2` 熟果 |

- 貼圖 `blocks/fruit/<果樹>_fruit.png`（附 normal、MER）分四格：青果皮、熟果皮、果梗、果蒂（香蕉是紫色花苞）。
- 果實從方塊頂端沿果梗往下垂，每種有自己的造型：
    - 柑橘（3 顆扁圓）、柳橙（2 顆圓）：圓形用三個交錯方塊削掉稜角，頂上有綠色果蒂。
    - 檸檬：直立橢圓加尖端；桃：圓果加一片下垂的葉子；梨：圓身加較小的頸部。
    - 柿子：扁圓加十字形的四瓣萼片；芒果：長果梗上微斜的橢圓。
    - 荔枝：一串 6 顆凹凸紋路的小紅果；八角：3 個八角星形果莢（8 片分開的果瓣）。
    - 香蕉：果軸上三層蕉手，每層 8 根往上外翹的蕉指，最下面是紫色花苞。
    - 龍眼（1.1）：一串 9 顆光滑的淺褐色小圓果，外圈 4 顆掛在小果梗上。
    - 枇杷（1.1）：短果梗四周 4 顆高低不一的直立小橢圓橘果，底部有深色的花萼殘痕。
    - 楊桃（1.1）：一顆縱向垂掛的果，中心加 5 道相隔 72 度的稜，稜的外緣上下較短所以兩端收尖；從下往上看是五角星。
    - 木瓜（1.1）：兩顆長果用很短的果梗緊貼葉叢下方，上窄下寬；熟果皮是橘色，靠果梗處有綠色條紋。
- Blockbench 預覽：`art_src/blockbench/fruit_preview.bbmodel`（熟果排成一列，貼圖用 `art/previews/fruit_preview.png` 圖集）。腳本只重寫 `art/previews/fruit_preview.geo.json` 與圖集（現在 14 種）；`.bbmodel` 是從 geo 匯入 Blockbench 存的，要看 1.1 的果實請重新匯入 geo。
- 方塊只能放在果葉下方；上方果葉消失時果實掉落。
