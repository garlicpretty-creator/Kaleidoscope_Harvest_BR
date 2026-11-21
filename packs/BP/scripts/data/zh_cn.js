// Simplified Chinese, made from the Traditional Chinese text so every string
// has one source. Same approach as Ranching's data/zh_cn.js.
// ## Add a character here when new text needs it: tools/validate.mjs fails when
// ## a generated zh_CN line still holds a character from HINTS.
// Plain data: no @minecraft imports.

export const TERMS = [];

export const CHARS = Object.fromEntries(
  [
    "漁渔 掛挂 釣钓 餌饵 較较 鉤钩 餵喂",
    "種种 蔥葱 黃黄 燉炖 樹树 葉叶 羅罗 語语 豐丰 廚厨 藤藤 實实 熟熟 開开 結结 採采 摘摘 據据 會会 長长 時时 後后 這这 裡里",
    "為为 與与 錘锤 鋤锄 頭头 塊块 個个 當当 從从 間间 處处 點点 進进 還还 齊齐 變变 顏颜 色色 溫温 寒寒 氣气 候候 帶带 層层",
    "鍋锅 湯汤 蒸蒸 籠笼 砧砧 板板 刀刀 炒炒 蛋蛋 肉肉 糖糖 水水 雞鸡 豬猪 碗碗 盤盘 罩罩 玻玻 璃璃 室室 屋屋 頂顶 牆墙 邊边",
    "動动 東东 戶户 見见 讓让 給给 對对 錯错 偏偏 灰灰 粒粒 聲声 響响 單单 雙双 兩两 樣样 條条 階阶 段段 幹干 斷断 掉掉 落落",
    "這这 個个 們们 來来 過过 關关 門门 問问 無无 麼么 應应 體体 現现 發发 機机 達达 題题 號号 學学 經经 業业 習习 務务 農农 藝艺",
    "滿满 歡欢 區区 遠远 論论 著着 幾几 繼继 續续 熱热 線线 圍围 擋挡 轉转 沒没 觀观 畫画 請请 擴扩",
    "藍蓝 鳳凤 檸柠 凍冻 莖茎 剝剥 蘋苹 乾干 爾尔 漿浆 涼凉 餃饺 莊庄 針针 紅红 燒烧 叢丛 濃浓 宮宫 爐炉 澤泽 絲丝 篩筛 陳陈 顆颗 裝装 綜综 鐵铁 錠锭 剛刚 壺壶 鈴铃 圓圆 飲饮",
    "電电 車车 風风 飛飞 馬马 鳥鸟 魚鱼 龍龙 麥麦 蘭兰 薑姜 蘿萝 蔔卜 醬酱 鹽盐 滷卤 餅饼 麵面 飯饭",
    "樂乐 館馆 釀酿 劑剂 飼饲 蓋盖 擺摆 檢检 藥药 圖图 鑑鉴 節节 級级 穀谷 鈣钙 芻刍 質质 緣缘",
    "選选 擇择 類类 錄录 記记 標标 籤签 說说 明明 種种 產产 殘残 舊旧 載载 讀读 寫写 誤误 夠够 機机 製制 醃腌 漬渍 缸缸 綠绿",
    "蓮莲 筍笋 楊杨 餡馅 餞饯 淺浅 樺桦 鋸锯",
    "籃篮 損损 腳脚 組组 別别 內内 設设 鐵铁 嫩嫩",
  ]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => [pair[0], pair[1]])
    .filter(([a, b]) => a !== b)
);

/**
 * Common Traditional-only characters, mapped or not. A converted line that still
 * holds one means CHARS is missing it (tools/validate.mjs).
 */
export const HINTS = new Set(
  "這個們來對時會說長還點進過開關門問間為與從無麼樣變應裡體種實現發動機頭類達題號學經業產習務邊農藝氣電車東風飛馬鳥魚龍麥葉樹蘭黃燉鍋湯雞豬蔥薑蘿蔔醬鹽滷餅麵飯讓給錯聲響兩條階斷選擇錄記標籤讀寫誤夠製醃漬綠鋤頭塊處齊顏溫帶層籠盤頂牆見戶單雙樣幹殘舊載採結豐廚羅語滿歡區遠論幾繼續熱線圍擋轉沒觀畫請擴藍鳳檸凍莖剝蘋乾漿爾涼餃莊針紅燒叢濃宮爐澤絲篩陳顆裝綜鐵錠剛壺鈴圓飲樂館釀劑飼蓋擺檢藥圖鑑節級穀鈣芻質緣漁掛釣餌較鉤餵蓮筍楊餡餞淺樺鋸"
);

export function toSimplified(text) {
  let out = text;
  for (const [from, to] of TERMS) out = out.split(from).join(to);
  return [...out].map((c) => CHARS[c] ?? c).join("");
}
