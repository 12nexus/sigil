/** Render the window shell + background once, as a 1920x1080 PNG. */
import { chromium } from "@playwright/test";

const VID = { w: 1472, h: 920, x: 224, y: 80 };
const BAR = 42;

const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1920px;height:1080px;overflow:hidden;
       background:linear-gradient(135deg,#2b2119 0%,#15121a 45%,#0a0a0e 100%);
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .glow{position:absolute;inset:0;
        background:radial-gradient(900px 500px at 22% 8%,rgba(221,184,118,.10),transparent 68%),
                   radial-gradient(800px 460px at 85% 92%,rgba(139,123,247,.08),transparent 70%)}
  .win{position:absolute;left:${VID.x}px;top:${VID.y - BAR}px;
       width:${VID.w}px;height:${VID.h + BAR}px;border-radius:14px;
       box-shadow:0 40px 90px -20px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.07);
       overflow:hidden;background:#0e0e13}
  .bar{height:${BAR}px;background:#1b1b22;display:flex;align-items:center;
       padding:0 16px;gap:8px;border-bottom:1px solid rgba(255,255,255,.06)}
  .dot{width:12px;height:12px;border-radius:50%}
  .url{flex:1;text-align:center;font-size:12.5px;color:#8e8b84;letter-spacing:.2px;
       margin-right:56px}
  .mark{position:absolute;left:${VID.x}px;top:${VID.y + VID.h + 22}px;
        width:${VID.w}px;display:flex;align-items:center;justify-content:center;gap:11px;
        opacity:.55}
  .glyph{width:17px;height:19px}
  .word{font-size:13px;font-weight:600;letter-spacing:.34em;color:#f2efe9}
</style>
<div class="glow"></div>
<div class="win">
  <div class="bar">
    <span class="dot" style="background:#ff5f57"></span>
    <span class="dot" style="background:#febc2e"></span>
    <span class="dot" style="background:#28c840"></span>
    <span class="url">sigil.12nexusbpo.com</span>
  </div>
</div>
<div class="mark">
  <svg class="glyph" viewBox="17 15 30 34"><path fill="#ddb876"
    d="M18 22 L24 16 L46 16 L46 23 L25 23 L25 28.5 L46 28.5 L46 42 L40 48 L18 48 L18 41 L39 41 L39 35.5 L18 35.5 Z"/></svg>
  <span class="word">SIGIL</span>
</div>`;

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await p.setContent(html);
await p.waitForTimeout(400);
await p.screenshot({ path: "testreel-output/chrome.png" });
await b.close();
console.log("chrome.png written");
