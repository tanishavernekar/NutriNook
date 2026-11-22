import { build } from "vite";
import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const out = "dist-portable";
await build({
  base: "./",
  publicDir: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: out,
    lib: {
      entry: "src/main.tsx",
      formats: ["iife"],
      name: "NutriNook",
      fileName: () => "assets/kitchen.js",
      cssFileName: "kitchen",
    },
    rollupOptions: { output: { assetFileNames: "assets/[name][extname]" } },
  },
});

const files = {};
for (const dir of ["food-reference", "themes"]) {
  for (const name of await readdir(`public/${dir}`)) {
    const path = `${dir}/${name}`;
    if (name.startsWith("template-")) {
      await cp(`public/${path}`, join(out, path));
    } else {
      const bytes = await readFile(`public/${path}`);
      const mime = name.endsWith(".json") ? "application/json" : "image/png";
      files[path] = `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }
}
await writeFile(join(out, "assets/resources.js"), `window.cozyKitchenFiles=${JSON.stringify(files)};\n`);
await cp("public/licenses", join(out, "licenses"), { recursive: true });
await cp("public/nutrinook-icon.png", join(out, "nutrinook-icon.png"));
await writeFile(join(out, "index.html"), `<!doctype html>
<html lang="en">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#babddf">
  <title>NutriNook</title>
  <link rel="icon" type="image/png" sizes="64x64" href="./nutrinook-icon.png">
  <link rel="stylesheet" href="./assets/kitchen.css">
  <div id="root"><p>Opening NutriNook… If the kitchen does not appear, extract the entire ZIP before opening this page in Chrome.</p></div>
  <noscript>Enable JavaScript to open NutriNook.</noscript>
  <script src="./assets/resources.js"></script>
  <script src="./assets/kitchen.js"></script>
</html>
`);
