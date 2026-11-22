// Painted jar and shelf layers. To swap in new artwork, replace the files in
// art/source (fillings: public/themes/painted-jars.png) and run
// `python3 scripts/build-assets.py`, or overwrite the
// exported files directly at the same pixel sizes (see art/spritesheet.png).
import type { Key } from "./model";
import geometry from "./assets/jars/geometry.json";
import glassBack from "./assets/jars/glass-back.png";
import glassFront from "./assets/jars/glass-front.png";
import interiorMask from "./assets/jars/interior-mask.png";
import label from "./assets/jars/label.png";
import badge from "./assets/jars/badge.png";
import cabinet from "./assets/shelf/cabinet.webp";

const contentFiles = import.meta.glob<string>("./assets/jars/contents/*.webp", {
  eager: true,
  import: "default",
});
export const contents = Object.fromEntries(
  Object.entries(contentFiles).map(([path, url]) => [
    path.split("/").pop()!.replace(".webp", ""),
    url,
  ]),
) as Record<Key, string>;
export const jarArt = { glassBack, glassFront, interiorMask, label, badge };
export const shelfArt = { cabinet };
export { geometry };
