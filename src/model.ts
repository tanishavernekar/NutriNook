export const labels = {
  calories: "Calories",
  protein: "Protein",
  fiber: "Fiber",
  fat: "Fat",
  carbohydrates: "Carbohydrates",
  totalSugar: "Total sugar",
  calcium: "Calcium",
  iron: "Iron",
  magnesium: "Magnesium",
  potassium: "Potassium",
  vitaminK: "Vitamin K",
  addedSugar: "Added sugar",
};
export type Key = keyof typeof labels;
export const keys = Object.keys(labels) as Key[];
export const unit = (k: Key) =>
  k === "calories"
    ? "kcal"
    : k === "vitaminK"
      ? "mcg"
      : ["calcium", "iron", "magnesium", "potassium"].includes(k)
        ? "mg"
        : "g";
export type Nutrients = Record<Key, number | null>;
export function nutrients(fn: (k: Key) => number | null): Nutrients {
  return Object.fromEntries(keys.map((k) => [k, fn(k)])) as Nutrients;
}
export type Food = {
  id: string;
  name: string;
  brand: string;
  category: string;
  autoCategory?: boolean;
  quantity: number;
  unit: string;
  nutrients: Nutrients;
  favorite: boolean;
  archived: boolean;
  type: "individual" | "custom" | "dish";
  createdAt: string;
  updatedAt: string;
};
export type Entry = {
  id: string;
  date: string;
  food: Food;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  dish?: string;
};
export type Dish = {
  id: string;
  name: string;
  ingredients: { foodId: string; quantity: number }[];
};
export type Goal = {
  kind: "minimum" | "range" | "maximum" | "ul" | "energy";
  value: number;
  max?: number;
  ul?: number;
  reference: string;
  source: string;
  custom?: boolean;
};
export type Goals = Partial<Record<Key, Goal>>;
export type Profile = {
  age: number;
  sex: "female" | "male";
  height: number;
  weight: number;
  activity: number;
  stage: string;
  imperial: boolean;
  heightUnit?: "cm" | "in";
  weightUnit?: "kg" | "lb";
  intent: string;
};
export const appearances = {
  wood: "Cozy Wood",
  periwinkle: "Periwinkle",
  mono: "Ink & Paper",
} as const;
export type Appearance = keyof typeof appearances;
export const isAppearance = (value: unknown): value is Appearance =>
  typeof value === "string" && Object.hasOwn(appearances, value);
export type Settings = {
  appearance?: Appearance;
  sound: boolean;
  volume: number;
  celebrate: boolean;
  reduced: boolean;
};
export type Kitchen = {
  version: 1;
  starterNutritionRevision?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  starterItemsSeen?: string[];
  foods: Food[];
  entries: Entry[];
  categories: string[];
  dishes: Dish[];
  profile: Profile | null;
  profileIsExample?: boolean;
  goals: { date: string; values: Goals }[];
  settings: Settings;
};
export const uid = () => crypto.randomUUID();
export const stamp = () => new Date().toISOString();
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s: string) => new Date(s + "T12:00:00");
export const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
export function positive(n: number) {
  if (!Number.isFinite(n) || n <= 0)
    throw Error("Enter a quantity greater than zero.");
  return n;
}
export function entry(
  food: Food,
  date: string,
  quantity = food.quantity,
  dish?: string,
): Entry {
  return {
    id: uid(),
    date,
    food: structuredClone(food),
    quantity: positive(quantity),
    dish,
    createdAt: stamp(),
    updatedAt: stamp(),
  };
}
export const scaled = (e: Entry, k: Key) =>
  e.food.nutrients[k] === null
    ? null
    : (e.food.nutrients[k]! * e.quantity) / e.food.quantity;
export function totals(entries: Entry[], k: Key) {
  let sum = 0,
    missing = 0;
  for (const e of entries) {
    const v = scaled(e, k);
    if (v === null) missing++;
    else sum += v;
  }
  return { sum, missing };
}
export const goalsOn = (d: Kitchen, date: string) =>
  d.goals
    .filter((g) => g.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.values ?? {};
export function convert(
  q: number,
  from: string,
  to: string,
  specific: Record<string, number> = {},
) {
  positive(q);
  if (from === to) return q;
  if (specific[to]) return q * positive(specific[to]);
  for (const group of [
    { cup: 48, tbsp: 3, tsp: 1 },
    { kg: 1000, g: 1, mg: 0.001 },
    { l: 1000, ml: 1 },
  ] as Record<string, number>[]) {
    if (group[from] && group[to]) return (q * group[from]) / group[to];
  }
  throw Error("No compatible serving conversion.");
}
export function getNutrientVisualStatus(sum: number, g?: Goal, missing = 0) {
  const ratio = g ? sum / g.value : null,
    percent = ratio === null ? null : Math.round(ratio * 100);
  const exceeded =
    g &&
    ((g.ul !== undefined && sum > g.ul) || (g.kind === "ul" && sum > g.value));
  const state = exceeded
    ? "limit"
    : !g || missing
      ? "neutral"
      : g.kind === "ul"
        ? "neutral"
        : g.kind === "maximum"
          ? sum > g.value
            ? "above"
            : "neutral"
          : g.kind === "energy"
            ? "progress"
            : g.kind === "range" && sum > g.max!
              ? "above"
              : sum >= g.value
                ? "success"
                : sum > 0
                  ? "progress"
                  : "neutral";
  const text = exceeded
    ? "Upper limit exceeded"
    : missing
      ? "Incomplete data"
      : !g
        ? "No target"
        : g.kind === "energy"
          ? "Energy estimate"
          : g.kind === "ul"
            ? "Upper limit"
            : g.kind === "maximum" && sum <= g.value
              ? "Within maximum"
              : {
                  neutral: "Ready to fill",
                  progress: "In progress",
                  above:
                    "Above " + (g.kind === "maximum" ? "maximum" : "range"),
                  success: "Goal reached",
                  limit: "Upper limit exceeded",
                }[state];
  return {
    state,
    text,
    percent,
    fill: ratio === null ? 0 : Math.min(1, Math.max(0, ratio)),
    color: {
      neutral: "#D8BD83",
      progress: "#D9AE65",
      success: "#8FA66B",
      above: "#C87860",
      limit: "#956779",
    }[state],
  };
}
export const categoryNames = [
  "Fruits & Berries",
  "Vegetables",
  "Nuts & Seeds",
  "Lentils & Legumes",
  "Grains & Bread",
  "Dairy & Protein",
  "Everyday Essentials",
  "Snacks & Treats",
  "Dishes",
];
const mergedCategories: Record<string, string> = {
  Dairy: "Dairy & Protein",
  "Eggs & Protein": "Dairy & Protein",
  "Grains & Rice": "Grains & Bread",
};
/** Renames retired categories in saved kitchens (foods, entry snapshots, list). */
export function migrateCategories(d: Kitchen): Kitchen {
  const to = (c: string) => mergedCategories[c] ?? c;
  return {
    ...d,
    categories: [...new Set(d.categories.map(to))],
    foods: d.foods.map((f) => ({ ...f, category: to(f.category) })),
    entries: d.entries.map((e) => ({
      ...e,
      food: { ...e.food, category: to(e.food.category) },
    })),
  };
}

export const MIN_INGREDIENT_AMOUNT = 0.000001;

/** A recipe step is half the food's reference quantity, in its own unit. */
export function stepIngredient(q: number, reference: number, dir: 1 | -1) {
  const step = Math.max(reference / 2, MIN_INGREDIENT_AMOUNT);
  const next = Number((Math.max(0, q) + dir * step).toPrecision(15));
  return Number.isFinite(next) && next >= MIN_INGREDIENT_AMOUNT ? next : q;
}

/** Friendly serving sizes the portion pill snaps between. */
export const PORTION_LADDER = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30,
  40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500, 750, 1000,
];
/** The next ladder size above (dir 1) or below (dir -1) q; off-ladder values snap to their neighbour. */
export function nextPortion(q: number, dir: 1 | -1) {
  const eps = 1e-9;
  if (!Number.isFinite(q) || q <= 0) return 1;
  if (dir > 0)
    return PORTION_LADDER.find((x) => x > q + eps) ?? Math.ceil(q * 1.25);
  const below = [...PORTION_LADDER].reverse().find((x) => x < q - eps);
  return below ?? q;
}
