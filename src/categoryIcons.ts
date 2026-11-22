const icons = import.meta.glob<string>("./assets/categories/*.webp", {
  eager: true,
  import: "default",
});
const icon = (key: string) => icons[`./assets/categories/${key}.webp`];
const byCategory: Record<string, string> = {
  "Fruits & Berries": "fruits",
  Vegetables: "vegetables",
  "Nuts & Seeds": "nuts",
  "Lentils & Legumes": "legumes",
  "Grains & Bread": "grains",
  "Grains & Rice": "grains",
  "Dairy & Protein": "dairy-protein",
  Dairy: "dairy",
  "Eggs & Protein": "protein",
  "Everyday Essentials": "essentials",
  "Snacks & Treats": "snacks",
  Dishes: "dishes",
};
/** Painted icon for a food category; custom categories get the herb bowl. */
export const categoryIcon = (name: string, sprites: Record<string, string>) => {
  const key = byCategory[name] ?? "other";
  return sprites[`categories/${key}.webp`] ?? icon(key);
};
