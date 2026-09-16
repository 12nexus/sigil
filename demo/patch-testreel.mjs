#!/usr/bin/env node
/**
 * Patch testreel so it scrolls a target into view before measuring it.
 *
 * testreel resolves a locator, measures its bounding box, and fires
 * `mouse.click(x, y)` — with no scrollIntoView. Any element outside the
 * viewport therefore gets clicked at coordinates that are off-screen, and the
 * click silently lands on nothing. Playwright still reports the element as
 * "visible", so the step is logged as a success and the real failure only
 * surfaces several steps later as a missing element.
 *
 * This inserts `scrollIntoViewIfNeeded()` into the one helper that every
 * click, type, fill and hover goes through.
 *
 * Idempotent — safe to run after every `npm install`.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "node_modules/testreel/dist/index.js",
  "node_modules/testreel/dist/fixture.js",
  "node_modules/testreel/dist/index.cjs",
  "node_modules/testreel/dist/fixture.cjs",
  "node_modules/testreel/dist/cli.cjs",
];
const MARKER = "/*sigil-scroll-patch*/";

/* The helper is minified differently in each bundle, so match it structurally:
   `async function X(a,b){let c=await Y(a,b).boundingBox();`  */
const HELPER =
  /async function (\w+)\((\w+),(\w+)\)\{let (\w+)=await (\w+)\(\2,\3\)\.boundingBox\(\);/;

let patched = 0, already = 0, missing = 0;
for (const file of FILES) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { missing++; continue; }
  if (src.includes(MARKER)) { already++; continue; }
  const m = HELPER.exec(src);
  if (!m) { missing++; continue; }
  const [whole, fn, page, sel, box, resolve] = m;
  const replacement =
    `async function ${fn}(${page},${sel}){${MARKER}` +
    `let _l=${resolve}(${page},${sel});` +
    `try{await _l.scrollIntoViewIfNeeded({timeout:3000})}catch{}` +
    `await ${page}.waitForTimeout(260);` +
    `let ${box}=await _l.boundingBox();`;
  writeFileSync(file, src.replace(whole, replacement));
  patched++;
}
console.log(`patched ${patched}, already patched ${already}, not applicable ${missing}`);
if (patched === 0 && already === 0) process.exit(1);
