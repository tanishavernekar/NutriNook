// Run after npm run build. Serve the real dist under a Pages-style repository path.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, preview } from "vite";
import { chromium } from "playwright-core";

const base = "/cozy-kitchen/";
const local = { host: "127.0.0.1", port: 0 };
const server = process.argv.includes("--dev")
  ? await (await createServer({ base, server: local })).listen()
  : await preview({ base, preview: local });
let browser;
try {
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}${base}`;
  browser = await chromium.launch({
    channel: process.env.CHROME_CHANNEL || "chrome",
  });
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  const layout = JSON.parse(
    await readFile(new URL("../src/theme-layout-v1.json", import.meta.url)),
  );
  await page.goto(url);
  assert.equal(await page.title(), "NutriNook");
  const icon = await page.locator('link[rel="icon"]').evaluate((link) => link.href);
  assert.equal(new URL(icon).pathname, `${base}nutrinook-icon.png`);
  assert.deepEqual(
    await (await page.request.get(icon)).body(),
    await readFile(new URL("../public/nutrinook-icon.png", import.meta.url)),
  );
  await page
    .getByRole("button", { name: "Kitchen settings", exact: true })
    .click();
  await page.getByText("Artwork themes", { exact: true }).click();
  const active = (name) =>
    page.getByText(`Active artwork: ${name}`, { exact: true }).waitFor();
  await active("Periwinkle");
  const fillings = page.locator(".jar-contents");
  const fillingSources = () =>
    fillings.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundImage.slice(5, -2)),
    );
  const builtIns = await fillingSources();
  assert.equal(new Set(builtIns).size, 11); // Added sugar is hidden without a goal.
  assert.ok(builtIns.every((url) => url.startsWith("http")));
  assert.ok(!requests.some((p) => p.endsWith("painted-jars.png")));
  async function fillingPixels() {
    return page.evaluate(
      async (urls) =>
        Promise.all(
          urls.map(async (url) => {
            const img = new Image();
            img.src = url;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            return Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  ctx.getImageData(0, 0, c.width, c.height).data,
                ),
              ),
            );
          }),
        ),
      await fillingSources(),
    );
  }
  const defaultPixels = await fillingPixels();
  const originalLayers = () =>
    page.evaluate(() => {
      const css = (q, p) => getComputedStyle(document.querySelector(q))[p];
      return [
        document.querySelector(".jar-front").src,
        document.querySelector(".jar-back").src,
        css(".shelfscene", "borderImageSource"),
        css(".kitchen-backdrop", "backgroundImage"),
        ...["ivy", "plant", "sprig"].map((s) =>
          css(".decor." + s, "backgroundImage"),
        ),
      ];
    });
  const defaultScenery = await originalLayers();
  assert.ok(
    defaultScenery.every(
      (url) => url.includes("http") && !url.includes("blob:"),
    ),
  );
  assert.ok(!requests.some((p) => p.endsWith("template-v1.png")));
  assert.equal(
    await page
      .getByRole("link", { name: "Download the paint-over PNG" })
      .count(),
    0,
  );

  // Change one real slot to a solid test color; leave everything else transparent.
  const data = await page.evaluate(({ width, height, slots }) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#456789";
    ctx.fillRect(...slots["shelf/cabinet.webp"]);
    return c.toDataURL().split(",")[1];
  }, layout);
  const picker = page.getByLabel("Preview a theme PNG");
  const input = {
    name: "midnight.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };
  await picker.setInputFiles(input);
  await active("midnight.png");
  assert.ok(
    await page
      .locator(".jar-back")
      .first()
      .evaluate((img) => img.src.startsWith("blob:")),
  );
  assert.ok(
    await page
      .locator(".cat-icon")
      .first()
      .evaluate((img) => img.src.startsWith("blob:")),
  );
  async function cabinetPixel() {
    return page.locator(".shelfscene").evaluate(async (el) => {
      const src = getComputedStyle(el).borderImageSource.match(
        /^url\("(blob:[^"]+)"\)$/,
      )?.[1];
      if (!src) return null;
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas"),
        ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    });
  }
  assert.deepEqual(await cabinetPixel(), [69, 103, 137, 255]);
  await picker.setInputFiles({ ...input, buffer: Buffer.from("not an atlas") });
  await page.getByText(/Artwork unchanged/).waitFor();
  assert.deepEqual(await cabinetPixel(), [69, 103, 137, 255]);
  const sceneName = "template-scene-v1.png";
  assert.equal(
    await page
      .getByRole("link", { name: "Download the shelf & scenery PNG" })
      .getAttribute("href"),
    url + "themes/" + sceneName,
  );
  await picker.setInputFiles(
    fileURLToPath(new URL("../public/themes/" + sceneName, import.meta.url)),
  );
  await active(sceneName);
  const scene = JSON.parse(
    await readFile(
      new URL("../src/theme-layout-scene-v1.json", import.meta.url),
    ),
  );
  const expected = Object.keys(layout.slots).filter(
    (key) =>
      key.startsWith("jars/contents/") ||
      /^(jars\/glass-(back|front)\.png|kitchen\/(ivy|plant|sprig|wall|wainscot)\.webp|shelf\/cabinet\.webp)$/.test(
        key,
      ),
  );
  assert.deepEqual(Object.keys(scene.slots).sort(), expected.sort());
  assert.equal(expected.length, 20);
  // Check the actual rendered layers, not just that the importer set variables.
  const sceneryBindings = [
    [".shelfscene", "borderImageSource", "shelf-cabinet"],
    [".decor.ivy", "backgroundImage", "kitchen-ivy"],
    [".decor.plant", "backgroundImage", "kitchen-plant"],
    [".decor.sprig", "backgroundImage", "kitchen-sprig"],
    [
      ".kitchen-backdrop",
      "backgroundImage",
      "kitchen-wainscot",
      "kitchen-wall",
    ],
  ];
  for (const [selector, property, ...slots] of sceneryBindings) {
    const rendered = await page.locator(selector).evaluate(
      (el, { property, slots }) => {
        const css = getComputedStyle(el);
        return {
          urls: css[property].match(/url\("[^"]+"\)/g),
          expected: slots.map((slot) =>
            css.getPropertyValue(`--paint-${slot}`).trim(),
          ),
        };
      },
      { property, slots },
    );
    assert.deepEqual(rendered.urls, rendered.expected, selector);
  }
  assert.deepEqual(
    await page.evaluate(() =>
      Array.from(document.documentElement.style)
        .filter((k) => k.startsWith("--paint-"))
        .sort(),
    ),
    expected
      .map((key) => "--paint-" + key.replace(/\.\w+$/, "").replaceAll("/", "-"))
      .sort(),
  );
  assert.ok(
    !(await page
      .locator(".cat-icon")
      .first()
      .evaluate((img) => img.src.startsWith("blob:"))),
  );
  assert.deepEqual(
    await page.locator(".shelfscene").evaluate(async (el) => {
      const img = new Image();
      img.src = getComputedStyle(el).borderImageSource.slice(5, -2);
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }),
    layout.slots["shelf/cabinet.webp"].slice(2),
  );
  await page.getByRole("button", { name: "Reset custom artwork" }).click();
  await active("Periwinkle");
  assert.equal(await cabinetPixel(), null);
  assert.deepEqual(await originalLayers(), defaultScenery);
  assert.deepEqual(await fillingSources(), builtIns);
  await page.goto(url + "?theme=painted-jars");
  await page.waitForFunction(() =>
    document
      .querySelector(".jar-contents")
      ?.style.backgroundImage.includes("blob:"),
  );
  assert.deepEqual(
    await fillingPixels(),
    defaultPixels,
    "The built-in fillings must match every pixel of the painted master.",
  );

  // The stock atlas itself must also import, without relying on the dev server.
  await page.goto(url + "?theme=template-v1");
  await page.waitForFunction(() =>
    document.querySelector(".jar-back")?.src.startsWith("blob:"),
  );
  assert.ok(requests.includes(base + "themes/template-v1.png"));
  await page.goto(url + "?theme=template-scene-v1");
  await page.waitForFunction(() =>
    document.querySelector(".jar-back")?.src.startsWith("blob:"),
  );
  assert.ok(requests.includes(base + "themes/" + sceneName));
  await page.route("**/themes/config.json", (route) =>
    route.fulfill({ json: { defaultTheme: "midnight" } }),
  );
  await page.route("**/themes/midnight.png", (route) =>
    route.fulfill({ contentType: "image/png", body: input.buffer }),
  );
  await page.goto(url);
  await page.waitForFunction(() =>
    document.documentElement.style.getPropertyValue("--paint-shelf-cabinet"),
  );
  assert.deepEqual(await cabinetPixel(), [69, 103, 137, 255]);
  await page.goto(url + "?theme=original");
  await page.locator(".shelfscene").waitFor();
  assert.equal(await cabinetPixel(), null);
  const openPicker = async () => {
    await page
      .getByRole("button", { name: "Kitchen settings", exact: true })
      .click();
    await page.getByText("Artwork themes", { exact: true }).click();
  };
  await openPicker();
  const shelfTints = () =>
    page
      .locator(".jar-glass")
      .evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).getPropertyValue("--tint")),
      );
  const tints = await shelfTints();
  const choose = async (name) => {
    const button = page.getByRole("button", { name, exact: true });
    await button.click();
    await active(name);
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.deepEqual(await fillingSources(), builtIns);
    assert.deepEqual(await shelfTints(), tints);
  };
  await choose("Cozy Wood");
  const wood = await originalLayers();
  assert.ok(wood.every((layer, i) => layer !== defaultScenery[i]));
  await page.setViewportSize({ width: 360, height: 800 });
  await choose("Ink & Paper");
  const mono = await originalLayers();
  assert.ok(
    mono.every((layer, i) => layer !== wood[i] && layer !== defaultScenery[i]),
  );
  assert.ok(
    await page
      .locator(".appearance-picker button")
      .evaluateAll((buttons) =>
        buttons.every(
          (b) =>
            b.getBoundingClientRect().height >= 44 &&
            b.scrollWidth <= b.clientWidth,
        ),
      ),
  );
  await page.goto(url); // local choice takes precedence over the hosted default
  await openPicker();
  await active("Ink & Paper");
  assert.deepEqual(await originalLayers(), mono);
  await picker.setInputFiles(input);
  await active("midnight.png");
  assert.deepEqual(await cabinetPixel(), [69, 103, 137, 255]);
  await page.getByRole("button", { name: "Reset custom artwork" }).click();
  await active("Ink & Paper");
  assert.deepEqual(await originalLayers(), mono);
  await choose("Periwinkle");
  assert.deepEqual(await originalLayers(), defaultScenery);
  console.log(
    "Paint-over import, pixel-exact CSS slot, jar/category artwork, rollback, reset, stock atlas and repository-path hosting passed.",
  );
} finally {
  await browser?.close();
  await server.close();
}
