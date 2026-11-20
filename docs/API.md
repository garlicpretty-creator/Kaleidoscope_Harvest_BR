# 森羅物語：豐收 — 對外 API（API 1）

其他附加包透過 **Script Event** 和豐收溝通，命名空間一律是 `kaleidoscope_harvest`。做法和森羅廚房、草本、樂牧、漁歌相同：`api_ping` → `api_ready`，再依 `capabilities` 決定要用哪些功能。**不要 import 豐收行為包裡的腳本。**

豐收不收任何註冊；這套 API 讓姊妹包知道豐收有沒有裝、是哪一版、種了什麼，不必再去猜它的物品在不在。

Other add-ons talk to Harvest through script events in the `kaleidoscope_harvest` namespace, the same ping / ready pattern Cookery, Herbal, Ranching and Fishing Voyage use. Harvest takes no registrations: the API tells the sister packs that Harvest is there, which version, and what it grows.

## 通用規則

| 項目 | 規定 |
| --- | --- |
| 傳輸 | `system.sendScriptEvent(id, message)`，`message` 是一行 JSON，長度不超過 2048 字元 |
| 來源 | 只接受腳本送出的事件（`sourceType === 'Server'`）；玩家輸入的 `/scriptevent` 與指令方塊一律忽略 |
| 請求必填 | `api: 1`、`source`：你的命名空間（`[a-z0-9_.-]`，1–64 字，不可以是 `kaleidoscope_harvest`） |
| 回覆定址 | 回覆是廣播，帶 `to: <你的 source>`；請只處理 `to` 等於自己的訊息 |
| 對應請求 | 請求可以帶 `req`（字串或數字），回覆原樣帶回；字串超過 32 字只帶回前 32 字 |
| 不合格的請求 | JSON 壞掉、`api` 不是 1、`source` 不合規：不回覆 |
| 沒裝豐收 | 不會有任何回覆；你的附加包應該照常運作 |
| 相容性 | 新功能只會**增加** capability 或事件；有破壞性變更才會升 `api` |

## 握手

| 方向 | 事件 | 內容 |
| --- | --- | --- |
| → 豐收 | `kaleidoscope_harvest:api_ping` | 任意字串（建議放你的 `source`） |
| ← 豐收 | `kaleidoscope_harvest:api_ready` | `{"api":1,"source":"kaleidoscope_harvest","version":"1.3.1","capabilities":["catalog","catalog_foods"]}` |

豐收在世界載入後 20 tick 會主動廣播一次 `api_ready`；比較晚載入的附加包自己送 `api_ping` 會得到同樣的回覆。

### capabilities

| 名稱 | 意義 |
| --- | --- |
| `catalog` | 可以查詢作物與果樹的清單：`catalog_request` |
| `catalog_foods` | 1.1：`catalog_request` 多一種 `kind: "foods"`，列出所有可吃喝的東西 |

## 清單 — `catalog`

請求 `kaleidoscope_harvest:catalog_request`：`{"api":1,"source":"my_pack","req":"1","kind":"crops"}`

回覆 `kaleidoscope_harvest:catalog`，可能分成多封；收齊 `parts` 封後依 `index` 合併 `items`：

```json
{"api":1,"to":"my_pack","req":"1","kind":"crops","ok":true,"index":0,"parts":2,"items":[...]}
```

| `kind` | `items` 每筆 |
| --- | --- |
| `crops` | `{id, seed, form, climate}`：`id` 是收成的物品，`seed` 是種下去的物品；`form` 是 `once`、`underground`、`repeatable`、`tall`、`trellis`、`bush`，1.1 多了 `aquatic`（水生）；`climate` 是 `cold`、`temperate`、`warm`、`hot`。之後可能再多新的 `form`：看不懂的請當成 `once` |
| `trees` | `{id, sapling, climate, bark?}`：`id` 是摘下的果實（肉桂是樹皮，帶 `bark: true`），`sapling` 是樹苗方塊 |

| `foods`（需要 `catalog_foods`） | `{id, hunger, saturation, placeable, container?}`：`hunger` 是恢復的飢餓值，`saturation` 是飽和係數；`placeable` 為 `true` 表示能放在桌上吃；`container` 是吃完還回的容器（碗、玻璃瓶、廚房空杯） |

所有 ID 都是完整的 `kaleidoscope_harvest:` ID（`container` 是原版或廚房的 ID）。未知的 `kind` 回 `{"ok":false,"code":"UNKNOWN_KIND","kinds":["crops","trees","foods"]}`。

## 豐收會主動找的附加包

豐收載入後會送出下面的 `api_ping`。有回覆才會動作；沒裝的話什麼都不會發生。資料表都在 `packs/BP/scripts/data/integrations.js`，每列附一句理由。

| 附加包 | 豐收送出 | 效果 |
| --- | --- | --- |
| 森羅物語：樂牧 `kaleidoscope_ranching` | `register_feed`（需要 `register_feed`；玉米葉在有 `feed_1_1` 時是 `ruminant`，否則 `grass`） | 玉米、大豆、紅豆、綠豆、豆渣、大白菜、空心菜、白蘿蔔、地瓜、玉米葉等 13 種進飼槽 |
| 森羅物語：草本 `kaleidoscope_herbal` | `heat_register`（`external_heat`）、`adjuvant_register`（`external_adjuvants`） | 32 樣食物有寒熱值；陳皮、肉桂皮可當砂鍋佐使 |
| 森羅物語：漁歌 `kaleidoscope_fishing` | `register_bait`（`bait`）、`register_pond_feed`（`pond_feed`，1.5.0） | 玉米種子（0.7）、綠豆（0.7）、大豆（0.8）當魚餌；豆渣（2 餐）、玉米種子與紅豆餡（1 餐）當魚池飼料 |
| 森羅物語：酒館 `kaleidoscope_tavern` | 酒館 SDK（`barrel_recipes`、`pressing_recipes`） | 荔枝酒、桃子酒、龍眼酒可以用酒桶釀；豐收的葡萄可放進壓榨桶，壓出酒館的葡萄汁（每顆 125 mB），再釀酒館的葡萄酒 |

反過來，酒館的葡萄 `kaleidoscope_tavern:grape` 在豐收的榨汁機算作葡萄（取回時還是酒館的葡萄），裝了酒館時也會多登記一道廚房竹篩配方，把它曬成葡萄乾。漁歌裝了豐收時多 7 道用豐收作物的料理，樂牧裝了豐收時可以把玉米放進青貯桶做青貯料。

## 最小範例

```js
import { system } from "@minecraft/server";

const ME = "my_pack";
let harvest;                                   // 豐收的 api_ready；沒裝就一直是 undefined
const crops = [];

system.afterEvents.scriptEventReceive.subscribe(ev => {
  let m;
  try { m = JSON.parse(ev.message); } catch { return; }
  if (ev.id === "kaleidoscope_harvest:api_ready" && m.api === 1) {
    harvest = m;
    if (m.capabilities.includes("catalog"))
      system.sendScriptEvent("kaleidoscope_harvest:catalog_request", JSON.stringify({ api: 1, source: ME, req: "c", kind: "crops" }));
  } else if (ev.id === "kaleidoscope_harvest:catalog" && m.to === ME && m.ok) {
    crops[m.index] = m.items;                   // 收齊 m.parts 封後 crops.flat()
  }
}, { namespaces: ["kaleidoscope_harvest"] });

system.runTimeout(() => system.sendScriptEvent("kaleidoscope_harvest:api_ping", ME), 20);
```
