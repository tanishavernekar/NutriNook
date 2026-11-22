import type { Goal, Key } from "../model";
import { publicAsset } from "../publicAsset";

export type ReferenceFood = {
  id: number;
  name: string;
  values: (number | null)[];
  measure?: { name: string; grams: number };
  portion?: {
    grams: number;
    basis: "sr" | "fndds" | "fda" | "meat" | "poultry";
  };
};
export type ReferenceBook = { keys: Key[]; foods: ReferenceFood[] };
export const fpedPage =
  "https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/food-surveys-research-group/docs/fped-databases/";
export const bookFor = (key: Key) =>
  key === "addedSugar" ? "fped-1718" : "sr-2018";
const cache = new Map<string, Promise<ReferenceBook>>();
export function loadBook(
  book: ReturnType<typeof bookFor>,
): Promise<ReferenceBook> {
  const cached = cache.get(book);
  if (cached) return cached;
  const loading = fetch(
    publicAsset(`food-reference/${book}.json`),
  )
    .then(async (r): Promise<ReferenceBook> => {
      if (!r.ok) throw new Error(`Food reference: HTTP ${r.status}`);
      return r.json();
    })
    .catch((error) => {
      cache.delete(book);
      throw error;
    });
  cache.set(book, loading);
  return loading;
}

function referenceProblem(goal?: Goal) {
  if (!goal)
    return "No goal is saved for this date. Set a reference in My goals to see foods that contribute at least 10%.";
  const end = goal.kind === "range" ? goal.max : goal.value;
  if (
    !Number.isFinite(goal.value) ||
    goal.value <= 0 ||
    end === undefined ||
    !Number.isFinite(end) ||
    end < goal.value
  )
    return "Check this nutrient’s saved goal in My goals before comparing portions.";
  if (goal.ul !== undefined && end > goal.ul)
    return "This saved reference exceeds the applicable upper limit. Review it in My goals before comparing portions.";
}

export function rankedSources(book: ReferenceBook, key: Key, goal?: Goal) {
  const i = book.keys.indexOf(key);
  const note = referenceProblem(goal);
  const foods = book.foods
    .flatMap((food) => {
      const per100 = food.values[i];
      const portion = food.portion;
      if (
        !goal ||
        note ||
        !portion ||
        !Number.isFinite(portion.grams) ||
        portion.grams <= 0 ||
        per100 == null ||
        !Number.isFinite(per100) ||
        per100 <= 0
      )
        return [];
      const amount = (per100 * portion.grams) / 100;
      const percent = (amount / goal.value) * 100;
      return Number.isFinite(percent) && amount >= goal.value / 10
        ? [{ food, per100, portion, amount, percent }]
        : [];
    })
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        a.food.name.localeCompare(b.food.name) ||
        a.food.id - b.food.id,
    );
  return { foods, note };
}

type Portion =
  | { note: string }
  | { low: number; high?: number; label: string; limit: boolean };
export function portionFor(per100: number | null, goal?: Goal): Portion {
  const note = referenceProblem(goal);
  if (!goal || note) return { note: note! };
  if (per100 === null || !Number.isFinite(per100) || per100 <= 0)
    return {
      note: "No positive nutrient amount is available for this food.",
    } as const;
  const end = goal.kind === "range" ? goal.max! : goal.value;
  const grams = (value: number) => 100 * (value / per100);
  if (!Number.isFinite(grams(end)))
    return { note: "This amount is too large to calculate." } as const;
  return {
    low: grams(goal.value),
    high: goal.kind === "range" ? grams(end) : undefined,
    label: {
      minimum: "For your daily minimum",
      range: "For your daily range",
      maximum: "Equivalent to your daily maximum",
      ul: "Equivalent to your upper limit",
      energy: "For your estimated daily energy",
    }[goal.kind],
    limit: goal.kind === "maximum" || goal.kind === "ul",
  } as const;
}
