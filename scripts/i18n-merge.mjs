// Deep-merge a patch file { th: {...}, en: {...} } into messages/*.json.
// Usage: node scripts/i18n-merge.mjs <patch.json>
import fs from "node:fs";

const patch = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    a[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] && typeof a[k] === "object" ? a[k] : {}, v) : v;
  }
  return a;
};
for (const locale of Object.keys(patch)) {
  const file = `messages/${locale}.json`;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify(merge(data, patch[locale]), null, 2) + "\n");
  console.log(`merged into ${file}`);
}
