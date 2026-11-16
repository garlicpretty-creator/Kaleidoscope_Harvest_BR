# Kaleidoscope_Harvest_BR
《森羅物語：豐收》為《森羅物語：廚房》新增 35 種作物，包括蔬菜、香料、水果和果樹。從田間種植、果園採收，到砧板、石磨、炒鍋上的料理，讓餐桌更加豐盛。

## 文件

- [企劃書](docs/PROPOSAL.zh-TW.md)
- [M1 說明：基礎與生長系統](docs/M1_說明.md)
- [M2 說明：蔬菜與香料](docs/M2_說明.md)
- [M4 說明：料理與新器具](docs/M4_說明.md)

## 開發

需要 Node 22，不需安裝套件。

```
npm run generate   # 由 packs/BP/scripts/data/ 產生方塊、物品、語言檔與貼圖清單
npm run validate   # 檢查資料與產生的檔案
npm test           # 行為測試
npm run build      # 打包成 dist/*.mcaddon
```
