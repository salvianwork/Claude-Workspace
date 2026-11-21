// Tiny Playwright step runner for the dashboard browser tests.
// Usage: node browser_driver.mjs '<json steps>'   (or a path to a .json file)
// Prints one JSON object: {"ok": bool, "results": [...], "errors": [...], "error"?: str}
import { createRequire } from "node:module";
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  // fall back to the global install
  const { execSync } = await import("node:child_process");
  const root = execSync("npm root -g").toString().trim();
  playwright = require(root + "/playwright");
}

const arg = process.argv[2] || "[]";
const steps = JSON.parse(existsSync(arg) ? readFileSync(arg, "utf8") : arg);
const out = { ok: true, results: [], errors: [] };
const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
const page = await context.newPage();
page.on("pageerror", (e) => out.errors.push(String(e)));
page.on("dialog", (d) => { out.errors.push("dialog: " + d.message()); d.dismiss().catch(() => {}); });
page.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text()); });

const T = 8000;
let i = 0;
try {
  for (const s of steps) {
    let r = null;
    switch (s.op) {
      case "viewport": await page.setViewportSize({ width: s.w, height: s.h }); break;
      case "goto": await page.goto(s.url); break;
      case "wait_text": await page.getByText(s.text, { exact: !!s.exact }).first().waitFor({ timeout: s.timeout || T }); break;
      case "wait_selector": await page.locator(s.selector).first().waitFor({ timeout: s.timeout || T, state: s.state || "visible" }); break;
      case "click": await page.getByRole("button", { name: s.name, exact: true }).click({ timeout: s.timeout || T }); break;
      case "click_selector": await page.locator(s.selector).first().click({ timeout: s.timeout || T }); break;
      case "fill": await page.locator(s.selector).fill(s.value); break;
      case "count": r = await page.locator(s.selector).count(); break;
      case "buttons": r = await page.locator(s.selector || "#board button:visible").allInnerTexts(); break;
      case "text": r = await page.locator(s.selector).first().innerText(); break;
      case "eval": r = await page.evaluate(s.js); break;
      case "reload": await page.reload(); break;
      case "hang_once": {
        // the first matching request never gets an answer (a hung server)
        let hung = false;
        await page.route(s.pattern, (route) => {
          if (!hung) { hung = true; return; }
          return route.continue();
        });
        break;
      }
      case "sleep": await page.waitForTimeout(s.ms); break;
      case "write_file": writeFileSync(s.path, s.text, "utf8"); break; // change a run mid-test
      case "mock_answer":
        await page.route("**/api/answer", (route) =>
          route.fulfill({ status: s.status, contentType: "application/json", body: JSON.stringify(s.body) }));
        break;
      case "screenshot": await page.screenshot({ path: s.path, fullPage: !!s.full, ...(s.clip ? { clip: s.clip } : {}) }); break;
      default: throw new Error("unknown op " + s.op);
    }
    out.results.push(r);
    i++;
  }
} catch (e) {
  out.ok = false;
  out.error = `step ${i} (${JSON.stringify(steps[i])}): ${e.message.split("\n")[0]}`;
  try { out.board = await page.locator("body").innerText(); } catch {}
}
await browser.close();
process.stdout.write(JSON.stringify(out));
