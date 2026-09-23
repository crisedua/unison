// Fails if messages/es.json and messages/en.json don't have exactly the same keys.
// Usage: npm run check:i18n
import { readFile } from "node:fs/promises";

const load = async (locale) => JSON.parse(await readFile(`messages/${locale}.json`, "utf8"));

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const en = new Set(keys(await load("en")));
const es = new Set(keys(await load("es")));
const missing = [...en].filter((k) => !es.has(k));
const extra = [...es].filter((k) => !en.has(k));

if (missing.length || extra.length) {
  if (missing.length) console.error(`Missing in es.json:\n  ${missing.join("\n  ")}`);
  if (extra.length) console.error(`Not in en.json:\n  ${extra.join("\n  ")}`);
  process.exit(1);
}
console.log(`Translations match (${en.size} keys).`);
