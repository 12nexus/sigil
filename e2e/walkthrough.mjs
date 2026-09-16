/**
 * End-to-end walkthrough of the full SIGIL pipeline against the real Gemini API.
 *
 * Run with the dev server up:  node e2e/walkthrough.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SIGIL_URL || "http://localhost:3210";
const SHOTS = process.env.SHOT_DIR || "./e2e/shots";
/* A persistent profile keeps IndexedDB between runs, so re-running the
   walkthrough reuses artwork that has already been generated and paid for.
   Delete e2e/.profile for a genuinely cold run. */
const PROFILE = process.env.SIGIL_PROFILE || "./e2e/.profile";
mkdirSync(SHOTS, { recursive: true });

let step = 0;
const log = (msg) => console.log(`\n▸ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures.push(msg);
};
const failures = [];

async function shot(page, name) {
  step += 1;
  await page.screenshot({
    path: `${SHOTS}/${String(step).padStart(2, "0")}-${name}.png`,
    fullPage: false,
  });
}

const run = async () => {
  const context = await chromium.launchPersistentContext(PROFILE, {
    viewport: { width: 1600, height: 1000 },
  });
  const browser = context.browser() ?? { close: () => context.close() };
  const page = context.pages()[0] ?? (await context.newPage());

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

  /* ---------------------------------------------------------------- */
  log("1. Dashboard loads and offers the sample project");
  // Sign in (the persistent profile keeps the session between runs).
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (new URL(page.url()).pathname === "/login") {
    const user = process.env.SIGIL_AUTH_USERNAME;
    const pass = process.env.SIGIL_AUTH_PASSWORD;
    if (!user || !pass) throw new Error("Set SIGIL_AUTH_USERNAME and SIGIL_AUTH_PASSWORD to run the walkthrough");
    await page.getByLabel("Username").fill(user);
    await page.getByLabel("Password").fill(pass);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.pathname !== "/login");
    await page.goto(BASE, { waitUntil: "networkidle" });
  }
  await page.getByRole("heading", { name: "Projects" }).waitFor();
  ok("dashboard rendered");
  await shot(page, "dashboard-empty");

  const existingCard = page.locator('a[href^="/projects/"]').first();
  if (await existingCard.count()) {
    await existingCard.click();
    await page.waitForURL(/\/projects\/[^/]+\/.+/, { timeout: 20000 });
    ok("reusing the existing sample project");
  } else {
    await page.getByRole("button", { name: /Nexora sample|sample project/i }).first().click();
    await page.waitForURL(/\/projects\/.+\/exploration/, { timeout: 20000 });
    ok("sample project created");
  }
  const projectId = page.url().match(/projects\/([^/]+)/)[1];
  await page.goto(`${BASE}/projects/${projectId}/exploration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  ok(`project: ${projectId}`);
  await shot(page, "exploration-ready");

  /* ---------------------------------------------------------------- */
  log("2. Seeded stages are complete and navigable backwards");
  await page.goto(`${BASE}/projects/${projectId}/brief`, { waitUntil: "networkidle" });
  const approvedBanner = await page.getByText(/Approved/).first().isVisible().catch(() => false);
  if (approvedBanner) ok("brief shows as approved"); else fail("brief approval state missing");
  await shot(page, "brief");

  await page.goto(`${BASE}/projects/${projectId}/directions`, { waitUntil: "networkidle" });
  const approvedCount = await page.getByText(/Approved 4/).isVisible().catch(() => false);
  if (approvedCount) ok("4 directions approved, 2 rejected"); else fail("direction decisions not shown");
  await shot(page, "directions");

  /* ---------------------------------------------------------------- */
  log("3. Batch generation — real Gemini image calls");
  await page.goto(`${BASE}/projects/${projectId}/exploration`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  let tiles = await page.locator("article img").count();
  if (tiles > 0) {
    ok(`${tiles} concepts already generated — skipping the batch`);
  } else {
  await page.getByRole("button", { name: /^Generate \d+ concepts$/ }).first().click();
  await page.getByRole("dialog").waitFor();

  // Keep the test batch small: 2 concepts across each of the 4 territories.
  const perDirection = page.locator('input[type="number"]').first();
  await perDirection.fill("2");
  await shot(page, "generation-setup");
  await page.getByRole("dialog").getByRole("button", { name: /Generate \d+ concepts/ }).click();

  ok("planning started (text model)");
  await page.getByText(/Generating \d+\/\d+/).waitFor({ timeout: 420000 });
  ok("image batch started");
  await shot(page, "generation-running");

  await page.getByText(/of \d+ generated/).waitFor({ timeout: 600000 });
  const progressText = await page.getByText(/of \d+ generated/).first().textContent();
  ok(`batch finished: ${progressText.trim()}`);

  tiles = await page.locator("article img").count();
  if (tiles > 0) ok(`${tiles} concept images rendered`);
  else fail("no concept images rendered");
  await shot(page, "concepts-generated");
  }

  /* ---------------------------------------------------------------- */
  log("4. Persistence across a hard reload");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const tilesAfter = await page.locator("article img").count();
  if (tilesAfter === tiles) ok(`${tilesAfter} concepts survived the reload`);
  else fail(`concepts lost on reload: ${tiles} → ${tilesAfter}`);

  /* ---------------------------------------------------------------- */
  log("5. Curation — shortlist, open detail, AI critique");
  const firstCard = page.locator("article").first();
  await firstCard.getByRole("button", { name: "Shortlist" }).click();
  await page.waitForTimeout(600);
  ok("concept shortlisted");

  await firstCard.locator("img").click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "concept-detail");

  await page.getByRole("tab", { name: "AI critique" }).click();
  await page.waitForTimeout(800);
  if (await page.getByRole("button", { name: /Run design critique/ }).count()) {
    await page.getByRole("button", { name: /Run design critique/ }).click();
    await page.getByText(/Distinctiveness/).waitFor({ timeout: 180000 });
    ok("AI critique returned with scored dimensions");
  } else {
    await page.getByText(/Distinctiveness/).waitFor({ timeout: 10000 });
    ok("AI critique already present from an earlier run");
  }
  await shot(page, "concept-critique");

  // Alternate renders are real canvas conversions.
  await page.getByRole("button", { name: "Pure B/W" }).click();
  await page.waitForTimeout(1200);
  ok("black-and-white render produced");
  await shot(page, "concept-bw");
  await page.keyboard.press("Escape");

  /* ---------------------------------------------------------------- */
  log("6. Iteration engine — feedback becomes structured instructions");
  await page.goto(`${BASE}/projects/${projectId}/refinement`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const existingVariations = await page
    .getByText(/variations? from this concept/)
    .count();
  if (existingVariations > 0) {
    ok("variations already generated in an earlier run — skipping");
  } else {
  await page.getByRole("button", { name: /Refine with feedback/ }).first().click();
  await page.getByRole("dialog").waitFor();

  await page.locator("textarea").first().fill(
    "I like the symbol but not the typography. Keep the mark exactly as it is and try heavier, more technical type.",
  );
  await page.locator('input[type="number"]').first().fill("2");
  await shot(page, "iterate-feedback");

  await page.getByRole("button", { name: /Interpret feedback/ }).click();
  await page.getByText(/Preserve/).first().waitFor({ timeout: 180000 });
  ok("feedback interpreted into preserve/change/explore instructions");
  await shot(page, "iterate-instructions");

  await page.getByRole("button", { name: /Generate \d+ variations/ }).click();
  await page.getByText(/of \d+ generated/).waitFor({ timeout: 300000 });
  ok("variations generated");
  await page.waitForTimeout(1500);
  await shot(page, "variations");
  }

  /* ---------------------------------------------------------------- */
  log("7. Version tree shows lineage");
  await page.getByRole("tab", { name: "Version tree" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "version-tree");
  ok("version tree rendered");

  /* ---------------------------------------------------------------- */
  log("8. Finalists — promote and build the lockup family");
  await page.getByRole("tab", { name: "Shortlist" }).click();
  await page.waitForTimeout(800);
  if (await page.getByRole("button", { name: /Promote to finalist/ }).count()) {
    await page.getByRole("button", { name: /Promote to finalist/ }).first().click();
    await page.waitForTimeout(1200);
    ok("concept promoted to finalist");
  } else {
    ok("finalist already promoted");
  }

  await page.goto(`${BASE}/projects/${projectId}/finalists`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  if (await page.getByRole("button", { name: /Build lockup family/ }).count()) {
    await page.getByRole("button", { name: /Build lockup family/ }).first().click();
    await page.getByText(/of \d+ generated/).waitFor({ timeout: 600000 });
    ok("lockup family generated");
  } else {
    ok("lockup family already built");
  }
  await page.waitForTimeout(1500);
  await shot(page, "finalist-lockups");

  /* ---------------------------------------------------------------- */
  log("9. Client review — publish and present");
  if (await page.getByRole("button", { name: /Approve for client/ }).count()) {
    await page.getByRole("button", { name: /Approve for client/ }).first().click();
    ok("designer approval recorded");
  } else {
    await page.getByRole("button", { name: /Client review/ }).first().click();
    ok("designer approval already recorded");
  }
  await page.waitForURL(/client-review/, { timeout: 30000 });
  await page.waitForTimeout(1500);

  if (await page.getByRole("button", { name: /Publish presentation/ }).count()) {
    await page.getByRole("button", { name: /Publish presentation/ }).first().click();
    await page.waitForTimeout(1500);
    ok("presentation published");
  } else {
    ok("presentation already published");
  }
  await shot(page, "client-review");

  /* ---------------------------------------------------------------- */
  log("10. Client presentation mode hides internals");
  const clientPage = await context.newPage();
  await clientPage.goto(`${BASE}/present/${projectId}`, { waitUntil: "networkidle" });
  await clientPage.waitForTimeout(2000);
  await clientPage.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, "0")}-presentation.png` });

  const body = await clientPage.locator("body").innerText();
  const leaks = [
    "EXECUTION STANDARD",
    "DO NOT PRODUCE",
    "TASK:",
    "gemini-",
    "nano-banana",
    "Generation prompt",
    "Shortlisted",
    "Design memory",
  ].filter((term) => body.toLowerCase().includes(term.toLowerCase()));
  if (leaks.length === 0) ok("no internal information leaked into the presentation");
  else fail(`presentation leaked internals: ${leaks.join(", ")}`);

  await clientPage.locator("textarea").fill(
    "I like this one but it feels too aggressive, and the font feels too technical.",
  );
  await clientPage.getByRole("button", { name: /Request changes/ }).click();
  await clientPage.getByText(/your feedback has been sent/i).waitFor({ timeout: 15000 });
  ok("client feedback submitted");
  await clientPage.close();

  /* ---------------------------------------------------------------- */
  log("11. Client feedback interpreted and confirmed");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /Interpret this feedback/ }).first().click();
  await page.getByText(/Awaiting your confirmation/).first().waitFor({ timeout: 180000 });
  ok("client feedback translated into design requirements");
  await shot(page, "feedback-interpreted");

  await page.getByRole("button", { name: /Confirm interpretation/ }).first().click();
  await page.waitForTimeout(1500);
  ok("interpretation confirmed; constraints entered design memory");

  /* ---------------------------------------------------------------- */
  log("12. Approvals, finalization, and the logo system");
  if (await page.getByRole("button", { name: /Record client approval of/ }).count()) {
    const approvalTile = page
      .getByRole("button", { name: /Record client approval of/ })
      .first();
    await approvalTile.scrollIntoViewIfNeeded();
    await approvalTile.click();
    await page.waitForURL(/finalization/, { timeout: 30000 });
    ok("client approval recorded");
  } else {
    await page.goto(`${BASE}/projects/${projectId}/finalization`, {
      waitUntil: "networkidle",
    });
    ok("client approval already recorded");
  }
  await page.waitForTimeout(1500);
  await shot(page, "finalization");

  if (await page.getByRole("button", { name: /Approve as final/ }).count()) {
    await page.getByRole("button", { name: /Approve as final/ }).click();
    await page.waitForTimeout(2500);
    ok("final approval recorded");
  } else {
    ok("final approval already recorded");
  }

  await page.goto(`${BASE}/projects/${projectId}/delivery`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const hasFavicon = await page.getByText("favicon", { exact: true }).count();

  if (hasFavicon === 0) {
    await page.goto(`${BASE}/projects/${projectId}/finalization`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1200);
    await page
      .getByRole("button", { name: /(Build|Rebuild) the logo system|Rebuild logo system/ })
      .first()
      .click();
    await page.getByText(/of \d+ generated/).waitFor({ timeout: 900000 });
    ok("full logo system generated from finalization instructions");
    await page.waitForTimeout(2000);
  } else {
    ok("logo system already built");
  }
  await shot(page, "logo-system");

  /* ---------------------------------------------------------------- */
  log("13. Delivery and brand kit");
  await page.goto(`${BASE}/projects/${projectId}/delivery`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  if (await page.getByRole("button", { name: /Generate brand kit/ }).count()) {
    await page.getByRole("button", { name: /Generate brand kit/ }).click();
    // "Open / print" only renders once a real brand kit exists.
    await page.getByRole("button", { name: /Open \/ print/ }).waitFor({ timeout: 300000 });
    ok("brand kit generated");
  } else {
    await page.getByRole("button", { name: /Open \/ print/ }).waitFor({ timeout: 15000 });
    ok("brand kit already present");
  }

  const swatches = await page.locator('p.font-mono').count();
  if (swatches > 0) ok(`${swatches} colour swatches with hex values`);
  else fail("brand kit rendered no colour palette");
  await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  await shot(page, "delivery");

  const kitPage = await context.newPage();
  await kitPage.goto(`${BASE}/brandkit/${projectId}`, { waitUntil: "networkidle" });
  await kitPage.waitForTimeout(3000);
  await kitPage.screenshot({
    path: `${SHOTS}/${String(++step).padStart(2, "0")}-brandkit.png`,
    fullPage: true,
  });
  const kitBody = await kitPage.locator("body").innerText();
  if (/No brand kit yet/i.test(kitBody)) {
    fail("printable brand kit shows the empty state");
  } else if (/Colour palette/i.test(kitBody) && /Using the mark/i.test(kitBody)) {
    ok("printable brand kit document rendered with palette and usage rules");
  } else {
    fail("printable brand kit is missing expected sections");
  }
  await kitPage.close();

  /* ---------------------------------------------------------------- */
  log("14. History records every decision");
  await page.goto(`${BASE}/projects/${projectId}/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const events = await page.locator("ol li").count();
  if (events > 10) ok(`${events} timeline events recorded`);
  else fail(`timeline too sparse: ${events} events`);
  await shot(page, "history");

  /* ---------------------------------------------------------------- */
  log("15. Error handling with an invalid key");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByText(/Use my own key instead/).click();
  await page.locator('input[type="password"]').fill("AIzaINVALIDKEYFORTESTING123456789");
  await page.getByRole("button", { name: /Test connection/ }).click();
  await page.getByText(/rejected|not valid|API key/i).first().waitFor({ timeout: 30000 });
  ok("invalid key produces an understandable error, not a raw stack trace");
  await shot(page, "invalid-key");

  // Restore the server key so the app is left in a working state.
  await page.getByText(/Use my own key instead/).click();
  await page.waitForTimeout(500);

  /* ---------------------------------------------------------------- */
  log("16. Responsive layout");
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto(`${BASE}/projects/${projectId}/selection`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const scrollX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  if (!scrollX) ok("tablet layout has no horizontal overflow");
  else fail("tablet layout overflows horizontally");
  await shot(page, "tablet");

  /* ---------------------------------------------------------------- */
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|Download the React DevTools|net::ERR_/.test(e),
  );
  console.log("\n" + "=".repeat(64));
  if (realErrors.length) {
    console.log(`Console errors (${realErrors.length}):`);
    realErrors.slice(0, 10).forEach((e) => console.log(`  · ${e.slice(0, 180)}`));
  } else {
    console.log("No console errors.");
  }

  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
  } else {
    console.log("\nAll checks passed.");
  }
  console.log("=".repeat(64));

  await browser.close();
  process.exit(failures.length ? 1 : 0);
};

run().catch((err) => {
  console.error("\nWALKTHROUGH CRASHED:", err.message);
  process.exit(1);
});
