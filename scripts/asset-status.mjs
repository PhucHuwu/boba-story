// Ticks ASSETS.md against public/assets and prints what is still missing, grouped by section.
// Usage: node scripts/asset-status.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "ASSETS.md");
const has = (key) => fs.existsSync(path.join(ROOT, "public", "assets", `${key}.webp`));

let section = "";
const missing = new Map();
let done = 0;
let total = 0;
const out = fs
  .readFileSync(FILE, "utf8")
  .split("\n")
  .map((line) => {
    if (line.startsWith("## ")) section = line.slice(3);
    const m = line.match(/^- \[[ x]\] `([a-zA-Z0-9_]+)`(.*)$/);
    if (!m) return line;
    total++;
    if (has(m[1])) {
      done++;
      return `- [x] \`${m[1]}\`${m[2]}`;
    }
    if (!missing.has(section)) missing.set(section, []);
    missing.get(section).push(m[1]);
    return `- [ ] \`${m[1]}\`${m[2]}`;
  })
  .join("\n");
fs.writeFileSync(FILE, out);

console.log(`Đã có ${done}/${total} ảnh.`);
for (const [name, keys] of missing) console.log(`\n${name} (${keys.length}):\n  ${keys.join(" ")}`);
