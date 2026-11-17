# 森羅物語：豐收 — 對外 API（API 1）

其他附加包透過 **Script Event** 和豐收打招呼，命名空間是 `kaleidoscope_harvest`。做法和森羅廚房、草本、樂牧、漁歌相同：`api_ping` → `api_ready`，再依 `capabilities` 決定要用哪些功能。**不要 import 豐收行為包裡的腳本。**

豐收不收任何註冊，只告訴別人「我在」、「我種了什麼」。1.0.0 沒有這套 API，漁歌當時是看豐收的物品在不在；下一版起可以直接握手。

## 通用規則

| 項目 | 規定 |
| --- | --- |
| 傳輸 | `system.sendScriptEvent(id, message)`，`message` 是一行 JSON，長度不超過 2048 字元 |
| 來源 | 只接受腳本送出的事件（`sourceType === "Server"`）；玩家輸入的 `/scriptevent` 一律忽略 |
| 請求必填 | `api: 1`、`source`：你的命名空間（`[a-z0-9_.-]`，1–64 字，不可為 `kaleidoscope_harvest`） |
| 回覆定址 | 回覆是廣播，帶 `to: <你的 source>`；請只處理 `to` 等於自己的訊息 |
| 對應請求 | 可以帶 `req`（字串或數字），回覆原樣帶回；字串超過 32 字只帶回前 32 字 |
| 不合格的請求 | JSON 壞掉、`api` 不是 1、`source` 不合規：不回覆 |
| 沒裝豐收 | 不會有任何回覆 |

## 握手

| 方向 | 事件 | 內容 |
| --- | --- | --- |
| → 豐收 | `kaleidoscope_harvest:api_ping` | 任意字串（建議放你的 `source`） |
| ← 豐收 | `kaleidoscope_harvest:api_ready` | `{"api":1,"source":"kaleidoscope_harvest","version":"…","capabilities":["catalog"],"limits":{"kinds":["crops","trees","partners"]}}` |

豐收在世界載入 20 tick 後會主動廣播一次 `api_ready`。

## 清單查詢 `catalog`

請求 `kaleidoscope_harvest:catalog_request`：`{"api":1,"source":"my_pack","req":"1","kind":"crops"}`

回覆 `kaleidoscope_harvest:catalog`，可能分成多封；收齊 `parts` 封後依 `index` 合併 `items`：

| `kind` | `items` 每筆 |
| --- | --- |
| `crops` | `{id, seed, produce, form, climate}`，ID 都是完整物品 ID；`form` 與 `climate` 見 `data/crops.js` |
| `trees` | `{id, sapling, produce, climate}` |
| `partners` | `{id}`：豐收會主動握手的附加包命名空間 |

未知的 `kind` 回 `{"ok":false,"code":"UNKNOWN_KIND","kinds":[...]}`。

## 豐收會主動找的附加包

載入後送出 `api_ping`，有回覆才動作。完整資料表在 `packs/BP/scripts/data/integrations.js`。

| 附加包 | 豐收送出 | 效果 |
| --- | --- | --- |
| 森羅廚房 `kaleidoscope_cookery` | 配方、手冊 | 料理在廚房的器具上做 |
| 樂牧 `kaleidoscope_ranching` | `register_feed` | 玉米、大豆、豆渣、葉菜與根莖類進飼槽 |
| 草本 `kaleidoscope_herbal` | `heat_register`、`adjuvant_register` | 20 樣食物有寒熱值；陳皮、肉桂皮是佐使 |
| 酒館 `kaleidoscope_tavern` | 酒館 SDK | 荔枝酒、桃子酒可以用酒桶釀 |
| 漁歌 `kaleidoscope_fishing` | `register_bait`（要 `bait`）、`register_pond_feed`（要 `pond_feed`） | 玉米種子、豆渣可以當魚餌；豆渣、大豆、玉米種子可以餵魚池 |
## 和 burnt-tea-dev 的包握手（下單了、煙火）

這兩個包沒有自己的 `api_ping`，但收註冊。我們載入 20 tick 後主動送，沒裝就沒人聽、什麼都不發生。程式在 `api/burntTea.js`，要送的清單 `data/burntTeaCatalog.js` 由 `tools/gen_burnt_tea.mjs` 從本包的物品、燻爐配方與 zh_TW 語言檔產生（不要手改；測試會檢查它是否過期）。

| 對方 | 送出 | 效果 |
| --- | --- | --- |
| 下單了 Order To Cook | `ordertocook:food_catalog_v1`（收到 `food_catalog_request_v1` 時重送） | 料理用中文名上餐廳菜單；杯裝、瓶裝的算飲品。生食材、漁獲、食材分類、飢餓值不到 3 的不上菜單 |
| 同上 | `ordertocook:smoking_recipes_v1`（回應 `request_smoking_recipes_v1`） | 本包的燻爐配方可以在下單了的爐子上做；目錄名用 `main`，會取代下單了發行時替我們內建的那份 |
| 煙火 Grilling | `kaleidoscope_grilling:register_smoking`，一組一則 | 神秘烤串上的生肉、生魚烤好後變成熟的那一樣，和 Java 版煙火查燻製配方一樣 |

當兩個倉庫放在本倉庫旁邊時，測試會直接用下單了與煙火自己的程式碼驗證我們的訊息都被接受。
