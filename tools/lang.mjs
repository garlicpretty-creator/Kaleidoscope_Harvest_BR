// Language-file completeness (企劃書：zh_TW、zh_CN、en_US), shared by tools/validate.mjs and the tests.
// zh_TW is the source language: every key it has must be in en_US and zh_CN with some text,
// and neither may carry a key zh_TW lacks.

export const LANG_LOCALES = ["en_US", "zh_TW", "zh_CN"];

/** key → text of a .lang file; a trailing "## comment" is not text. Duplicate keys are reported. */
export function parseLang(text, problems = [], where = "") {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes("=") || line.startsWith("#")) continue;
    const key = line.slice(0, line.indexOf("="));
    if (values.has(key)) problems.push(`${where}: ${key} appears twice`);
    values.set(key, line.slice(line.indexOf("=") + 1).replace(/\s*##.*$/, "").trim());
  }
  return values;
}

/** Problems in one pack's three files: { en_US, zh_TW, zh_CN } as file text. */
export function langProblems(files, where = "texts") {
  const problems = [];
  const lang = Object.fromEntries(LANG_LOCALES.map((locale) => [locale, parseLang(files[locale] ?? "", problems, `${where} ${locale}.lang`)]));
  for (const [key, value] of lang.zh_TW) {
    if (!value) problems.push(`${where} zh_TW.lang: ${key} is empty`);
    for (const locale of ["en_US", "zh_CN"]) {
      if (!lang[locale].has(key)) problems.push(`${where} ${locale}.lang: ${key} missing (zh_TW has it)`);
      else if (!lang[locale].get(key)) problems.push(`${where} ${locale}.lang: ${key} is empty`);
    }
  }
  for (const locale of ["en_US", "zh_CN"]) for (const key of lang[locale].keys()) if (!lang.zh_TW.has(key)) problems.push(`${where} ${locale}.lang: ${key} is not in zh_TW.lang`);
  return problems;
}
