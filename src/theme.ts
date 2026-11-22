import { useSyncExternalStore } from "react";
import layout from "./theme-layout-v1.json";
import sceneLayout from "./theme-layout-scene-v1.json";
import contentsLayout from "./theme-layout-contents-v1.json";
import type { Appearance } from "./model";
import { publicAsset } from "./publicAsset";

type Sprites = Record<string, string>;
type Theme = { name: string; sprites: Sprites; busy: boolean; error: string };
const original: Theme = {
  name: "Original",
  sprites: {},
  busy: false,
  error: "",
};
const builtIns: Record<Appearance, Sprites> = {
  wood: {},
  mono: {},
  periwinkle: {},
};
const materials = import.meta.glob<string>(
  "./preset-art/{wood,mono}/**/*.{png,webp,svg}",
  {
    eager: true,
    query: "?no-inline",
    import: "default",
  },
);
for (const [path, url] of Object.entries(materials)) {
  const [, , preset, ...asset] = path.split("/");
  if (preset === "wood" || preset === "mono")
    builtIns[preset][asset.join("/")] = url;
}
let base: Appearance = "periwinkle";
let custom: Sprites = {};
let current = original,
  revision = 0;
const listeners = new Set<() => void>();
function publish(theme: Theme) {
  current = theme;
  for (const fn of listeners) fn();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const useArtworkTheme = () =>
  useSyncExternalStore(subscribe, () => current);
export const sheetSize = `${layout.width} × ${layout.height}`;
export const sceneSheetSize = `${sceneLayout.width} × ${sceneLayout.height}`;
const nativeSlots: Record<string, number[]> = layout.slots;
export const themeFile = (file: string) =>
  publicAsset(`themes/${file}`);
const variable = (path: string) =>
  "--paint-" + path.replace(/\.\w+$/, "").replaceAll("/", "-");
function renderLayers(state: Theme) {
  const sprites = { ...builtIns[base], ...custom };
  const style = document.documentElement.style;
  for (const key of Object.keys(current.sprites)) {
    if (!(key in sprites)) style.removeProperty(variable(key));
  }
  for (const [key, url] of Object.entries(sprites))
    style.setProperty(variable(key), `url("${url}")`);
  publish({ ...state, sprites });
}
export function setAppearance(next: Appearance) {
  document.documentElement.dataset.appearance = next;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      getComputedStyle(document.documentElement)
        .getPropertyValue("--periwinkle")
        .trim(),
    );
  if (base === next) return;
  base = next;
  renderLayers(current);
}
function apply(name: string, sprites: Sprites) {
  const previous = custom;
  custom = sprites;
  renderLayers({ ...original, name });
  Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
}
export function resetArtwork() {
  revision++;
  apply(original.name, {});
}
async function sliceSheet(file: Blob, id: number): Promise<Sprites> {
  const header = new DataView(await file.slice(0, 24).arrayBuffer());
  if (
    header.byteLength !== 24 ||
    header.getUint32(0) !== 0x89504e47 ||
    header.getUint32(4) !== 0x0d0a1a0a ||
    header.getUint32(12) !== 0x49484452
  )
    throw Error("Choose a PNG exported from a paint-over template.");
  const sheet = [layout, sceneLayout, contentsLayout].find(
    (s) =>
      header.getUint32(16) === s.width && header.getUint32(20) === s.height,
  );
  if (!sheet)
    throw Error(
      `Keep the original canvas size: ${contentsLayout.width} × ${contentsLayout.height} px (jar contents), ${sceneSheetSize} px (shelf & scenery), or ${sheetSize} px (full sheet).`,
    );
  const source = URL.createObjectURL(file),
    img = new Image(),
    canvas = document.createElement("canvas"),
    sprites: Sprites = {};
  try {
    img.src = source;
    await img.decode();
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Your browser could not open an image canvas.");
    for (const [key, [x, y, w, h]] of Object.entries(sheet.slots)) {
      if (revision !== id) throw Error("Preview cancelled.");
      // Normalize compact crops to the original image dimensions for CSS nine-slicing.
      const [, , width, height] = nativeSlots[key];
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, x, y, w, h, 0, 0, width, height);
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(Error(`Could not read ${key}.`))),
          "image/png",
        ),
      );
      sprites[key] = URL.createObjectURL(blob);
    }
    return sprites;
  } catch (error) {
    Object.values(sprites).forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    canvas.width = canvas.height = 1;
    URL.revokeObjectURL(source);
  }
}
async function changeTheme(
  getSheet: () => Promise<{ name: string; file: Blob } | null>,
) {
  const id = ++revision;
  publish({ ...current, busy: true, error: "" });
  try {
    const sheet = await getSheet();
    if (revision !== id) return;
    if (!sheet) {
      apply(original.name, {});
      return;
    }
    const sprites = await sliceSheet(sheet.file, id);
    if (revision === id) apply(sheet.name, sprites);
    else Object.values(sprites).forEach((url) => URL.revokeObjectURL(url));
  } catch (error) {
    if (revision === id)
      publish({
        ...current,
        busy: false,
        error: `Artwork unchanged. ${error instanceof Error ? error.message : String(error)}`,
      });
  }
}
export const previewArtwork = (file: File) =>
  changeTheme(async () => ({ name: file.name, file }));
export function loadSiteArtwork() {
  return changeTheme(async () => {
    let name: unknown = new URLSearchParams(location.search).get("theme");
    if (name === null) {
      const res = await fetch(themeFile("config.json"), { cache: "no-cache" });
      if (!res.ok)
        throw Error(`Could not read theme configuration (${res.status}).`);
      name = (await res.json()).defaultTheme;
    }
    if (name === "original") return null;
    if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name))
      throw Error(
        "Theme names must use 1–64 lowercase letters, numbers, or hyphens.",
      );
    const res = await fetch(themeFile(`${name}.png`));
    if (!res.ok) throw Error(`Could not load ${name}.png (${res.status}).`);
    return { name, file: await res.blob() };
  });
}
