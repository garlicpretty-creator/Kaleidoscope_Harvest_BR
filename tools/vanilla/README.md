# 原版資料快照

`tools/generate.mjs` 用這些原版檔案產生「原版內容＋豐收追加」的覆寫檔，不要直接改。

| 檔案 | 來源 |
| --- | --- |
| `loot_tables/chests/village/village_*_house.json` | Mojang/bedrock-samples v1.26.60.5，`behavior_pack/loot_tables/chests/village/` |

原版更新時，從新版 bedrock-samples 複製同名檔案覆蓋，再跑 `npm run generate`。
