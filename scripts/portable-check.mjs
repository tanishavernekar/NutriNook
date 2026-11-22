import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const file = pathToFileURL(resolve(process.argv[2] ?? "dist-portable/index.html"));
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || "chrome" });
try {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("requestfailed", (r) => failures.push(r.url().slice(0, 150)));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) failures.push(`Unexpected network request: ${r.url()}`);
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.goto(file.href);
  assert.equal(await page.title(), "NutriNook");
  assert.equal(await page.locator('link[rel="icon"]').evaluate(async (link) => {
    const icon = new Image();
    icon.src = link.href;
    await icon.decode();
    return icon.naturalWidth;
  }), 64);
  await button("Pantry table").click();
  assert.equal(await page.locator(".selection-summary").innerText(), "136 food items");
  await button("Close dialog").click();
  await page.getByLabel("Search recipe book").fill("A2 Whole Milk");
  await button("Add A2 Whole Milk").click();
  await button("View nutrition for A2 Whole Milk").click();
  assert.match(await page.getByRole("dialog").innerText(), /80 kcal/);
  await page.reload();
  await button("View nutrition for A2 Whole Milk").waitFor();
  await page.locator(".jar").nth(2).click();
  await button("Guide").click();
  await button("Dive deeper").click();
  await page.getByRole("searchbox", { name: "Search food sources" }).fill("lentils without salt boiled");
  await page.getByRole("button", { name: /^Lentils, mature seeds, cooked, boiled, without salt/ }).waitFor();
  await button("Close dialog").click();
  await button("Kitchen settings").click();
  await page.getByText("Artwork themes", { exact: true }).click();
  await page.getByText("Active artwork: Periwinkle", { exact: true }).waitFor();
  await page.locator('[data-preset="wood"]').click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
  assert.deepEqual(failures, []);
  console.log("Offline file:// launch, starter pantry, logging, reload, food sources and artwork passed.");
} finally {
  await browser.close();
}
