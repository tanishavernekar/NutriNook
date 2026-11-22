// Repaint the exported PNG, not the generated slot map. V1 coordinates are frozen.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const assets = new URL("../src/assets/", import.meta.url);
const scene = process.argv.includes("--scene");
const variant = scene ? "scene-v1" : "v1";
const layoutFile = new URL(
  `../src/theme-layout-${variant}.json`,
  import.meta.url,
);
const filename = `template-${variant}.png`;
const destination = new URL("../public/themes/", import.meta.url);
const svgSizes = {
  "jars/heap.svg": [100, 12],
  "plate/calendar-banner.svg": [248, 286],
  "plate/ceramic-rim.svg": [240, 100],
};
const old = await readFile(layoutFile, "utf8").catch((e) => {
  if (!scene && e.code === "ENOENT") return null;
  throw e;
});
const files = scene
  ? Object.keys(JSON.parse(old).slots)
  : (await readdir(assets, { recursive: true }))
      .filter((p) => /\.(png|webp)$/.test(p) || p in svgSizes)
      .sort();
const inputs = await Promise.all(
  files.map(async (path) => {
    const mime = path.endsWith(".svg") ? "svg+xml" : path.split(".").at(-1);
    return {
      path,
      size: svgSizes[path],
      url: `data:image/${mime};base64,${(await readFile(new URL(path, assets))).toString("base64")}`,
    };
  }),
);
const browser = await chromium.launch({
  channel: process.env.CHROME_CHANNEL || "chrome",
});
try {
  const page = await browser.newPage();
  const { layout, png } = await page.evaluate(
    async ({ inputs, existing, scene }) => {
      const sprites = await Promise.all(
        inputs.map(async (s) => {
          const img = new Image();
          img.src = s.url;
          await img.decode();
          return {
            path: s.path,
            img,
            w: s.size?.[0] ?? img.naturalWidth,
            h: s.size?.[1] ?? img.naturalHeight,
          };
        }),
      );
      const width = 3584,
        gap = 14;
      let rows = [],
        bottom = 104;
      const slots = {};
      for (const { path, w, h } of [...sprites].sort(
        (a, b) => b.h - a.h || b.w - a.w,
      )) {
        const labelWidth = Math.max(w, 208);
        let row = rows.find((r) => r.x + labelWidth + gap <= width);
        if (!row) {
          row = { x: gap, y: bottom + 22 };
          rows.push(row);
          bottom += h + 22 + gap;
        }
        slots[path] = [row.x, row.y, w, h];
        row.x += labelWidth + gap;
      }
      const layout = existing ?? {
        version: 1,
        width,
        height: bottom + gap,
        slots,
      };
      if (Object.keys(layout.slots).length !== sprites.length)
        throw Error("V1 asset set changed; create a new layout version.");
      const canvas = document.createElement("canvas");
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#eeeaf7";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#4a588b";
      ctx.fillRect(0, 0, canvas.width, 8);
      ctx.fillStyle = "#332e47";
      ctx.font = "bold 36px Georgia";
      ctx.fillText(
        scene
          ? "NutriNook   /   Shelf & scenery"
          : "NutriNook   /   Paint-over sheet",
        18,
        55,
      );
      ctx.font = "19px system-ui";
      ctx.fillText(
        scene
          ? `Compact v1   •   ${canvas.width} × ${canvas.height} px   •   20 slots   /   Paint inside the frames. Keep the canvas size and transparency.`
          : `Atlas v1   •   ${canvas.width} × ${canvas.height} px   •   ${sprites.length} slots   /   Paint inside the frames. Keep the canvas size, positions, and transparency. The printed gutters do not appear in the app.`,
        18,
        scene ? 81 : 88,
      );
      if (scene) {
        ctx.font = "bold 17px system-ui";
        ctx.fillStyle = "#4a588b";
        ctx.fillText("01  /  Jar contents", 16, 113);
        ctx.fillText("02  /  Glass & greenery", 1060, 113);
        ctx.fillText("03  /  Kitchen surfaces", 16, 877);
        ctx.imageSmoothingQuality = "high";
      }
      for (const { path, img, w, h } of sprites) {
        const box = layout.slots[path];
        const scale = scene ? 2 : 1;
        if (
          !box ||
          box[2] !== Math.ceil(w / scale) ||
          box[3] !== Math.ceil(h / scale)
        )
          throw Error(`V1 slot changed: ${path}`);
        const [x, y, sw, sh] = box;
        ctx.fillStyle = "#504464";
        ctx.fillRect(x - 1, y - 1, sw + 2, sh + 2);
        ctx.clearRect(x, y, sw, sh);
        ctx.drawImage(img, x, y, sw, sh);
        ctx.font = "14px monospace";
        ctx.fillStyle = "#332e47";
        const stem = path.replace(/\.\w+$/, "");
        const label = scene
          ? stem
              .split("/")
              .pop()
              .replace(/([A-Z])/g, " $1")
              .replaceAll("-", " ")
              .toLowerCase()
          : stem;
        ctx.fillText(label, x, y - 5, scene ? sw : Math.max(w, 208));
      }
      return { layout, png: canvas.toDataURL("image/png").split(",")[1] };
    },
    { inputs, existing: old && JSON.parse(old), scene },
  );
  if (old) assert.deepEqual(layout, JSON.parse(old));
  else await writeFile(layoutFile, JSON.stringify(layout, null, 2) + "\n");
  await mkdir(destination, { recursive: true });
  await writeFile(new URL(filename, destination), Buffer.from(png, "base64"));
  console.log(
    `${files.length} slots • ${layout.width} × ${layout.height} • public/themes/${filename}`,
  );
} finally {
  await browser.close();
}
