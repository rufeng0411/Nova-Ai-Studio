#!/usr/bin/env node
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:5180/p/general";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}\n${e.stack || ""}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("requestfailed", (req) => {
    errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText || ""}`);
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3000);
    const rootHtml = await page.locator("#root").innerHTML().catch(() => "");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    console.log("URL", page.url());
    console.log("ROOT_LEN", rootHtml.length);
    console.log("BODY_TEXT_LEN", bodyText.length);
    console.log("BODY_PREVIEW", bodyText.slice(0, 300).replace(/\s+/g, " "));
    console.log("ERRORS_COUNT", errors.length);
    for (const err of errors.slice(0, 20)) {
      console.log("---");
      console.log(err);
    }
  } catch (e) {
    console.log("NAV_FAIL", e?.message || e);
    for (const err of errors) {
      console.log("---");
      console.log(err);
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
