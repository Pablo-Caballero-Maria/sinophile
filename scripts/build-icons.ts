/**
 * Generates the app icons from the stroke data of 汉 (no fonts needed).
 * Run once: node scripts/build-icons.ts  (requires rsvg-convert for the PNGs)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const { strokes } = JSON.parse(readFileSync(root("node_modules/hanzi-writer-data/汉.json"), "utf8")) as { strokes: string[] };
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" rx="230" fill="#d93a3f"/>
<g transform="translate(152 152) scale(0.703) scale(1 -1) translate(0 -900)" fill="#ffffff">${strokes.map((d) => `<path d="${d}"/>`).join("")}</g>
</svg>
`;
writeFileSync(root("public/icon.svg"), svg);
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-icon.png", 180]] as const) {
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), root("public/icon.svg"), "-o", root(`public/${name}`)]);
}
console.log("icons written to public/");
