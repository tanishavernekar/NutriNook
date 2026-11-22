import { keys, type Food, type Kitchen, type Nutrients } from "../model";
import { seedFoods } from "./csv";
import { introducedIn, latestStarterRevision } from "./starterAdditions";
import { needsCategory } from "./foodCategory";
import legacyCSV from "./legacy/pantry-v1.csv?raw";

// Pre-audit values, solely to recognize untouched starter nutrition in old journals.
// Compare against the original serving, even if a later release changes its unit.
const previous = new Map<string, Partial<Nutrients>>([
  [
    "A2 Whole Milk",
    {
      calories: 75,
      fat: 4,
      carbohydrates: 6,
      magnesium: 12,
      potassium: 161,
      vitaminK: 0.1,
      addedSugar: null,
    },
  ],
  ["Guava", { vitaminK: 2.2 }],
  ["Moong Dal Chilla", { potassium: 0, vitaminK: 0 }],
  ["Qdoba Chicken Bowl", { magnesium: 0, vitaminK: 0 }],
]);

function applyAudit(kitchen: Kitchen, starters: Map<string, Food>): Kitchen {
  const foods = kitchen.foods.map((food) => {
    const changed = previous.get(food.name);
    const starter = starters.get(food.name);
    if (
      !changed ||
      !starter ||
      food.type !== starter.type ||
      food.brand !== starter.brand ||
      food.unit !== starter.unit ||
      food.quantity !== starter.quantity
    )
      return food;
    const before = { ...starter.nutrients, ...changed };
    if (!keys.every((k) => food.nutrients[k] === before[k])) return food;
    return { ...food, nutrients: { ...starter.nutrients } };
  });
  return { ...kitchen, foods, starterNutritionRevision: 1 };
}

const renamed = new Map([
  ["Basmati Rice (Cooked)", "Basmati Rice"],
  ["Toor Dal (Cooked)", "Toor Dal"],
  ["Green Moong (Whole)", "Akha moong (whole green mung)"],
  ["Edamame (Cooked)", "Edamame"],
  ["Green Peas (Cooked)", "Green Peas"],
  ["Chicken Breast (Cooked)", "Chicken Breast"],
]);

type StarterDefinition = Pick<Food, "type" | "brand" | "category" | "quantity" | "unit" | "nutrients">;
function matchesStarter(food: Food, old: StarterDefinition | undefined) {
  return (
    old &&
    food.type === old.type &&
    food.brand === old.brand &&
    food.category === old.category &&
    food.quantity === old.quantity &&
    food.unit === old.unit &&
    keys.every((k) => food.nutrients[k] === old.nutrients[k])
  );
}

const identity = (name: string, brand: string) =>
  JSON.stringify([name.trim().toLowerCase(), brand.trim().toLowerCase()]);

const retiredTea: StarterDefinition = {
  brand: "Taste Nirvana", category: "Beverages", type: "individual", quantity: 1, unit: "cup",
  nutrients: {
    calories: 160, protein: 1, fiber: 0, fat: 3, carbohydrates: 31, totalSugar: 30,
    calcium: 48, iron: 0.4, magnesium: 14, potassium: 130, vitaminK: null, addedSugar: 23,
  },
};

function retireBeverages(kitchen: Kitchen): Kitchen {
  const categories = new Set(kitchen.categories);
  categories.delete("Beverages");
  const foods = kitchen.foods.flatMap((f) => {
    if (f.category !== "Beverages") return [f];
    const stockTea = f.name === "Thai iced tea" && matchesStarter(f, retiredTea);
    if (stockTea && !kitchen.dishes.some((d) => d.ingredients.some((i) => i.foodId === f.id)))
      return [];
    categories.add(needsCategory);
    return [{ ...f, category: needsCategory, archived: stockTea || f.archived }];
  });
  return { ...kitchen, foods, categories: [...categories] };
}

export function migrateStarterNutrition(kitchen: Kitchen): Kitchen {
  const revision = kitchen.starterNutritionRevision;
  if (revision === latestStarterRevision) return kitchen;
  if ((revision ?? 0) < 8) kitchen = retireBeverages(kitchen);
  const current = new Map(seedFoods().map((f) => [f.name, f]));
  if (revision !== undefined && revision >= 2) {
    const hasStarter = kitchen.foods.some(
      (f) => introducedIn(f.name) <= revision && matchesStarter(f, current.get(f.name)),
    );
    const occupied = new Set(kitchen.foods.map((f) => identity(f.name, f.brand)));
    const additions = hasStarter ? [...current.values()].filter(
      (f) => introducedIn(f.name) > revision && !occupied.has(identity(f.name, f.brand)),
    ) : [];
    return { ...kitchen, foods: [...kitchen.foods, ...additions], starterNutritionRevision: latestStarterRevision };
  }
  const old = new Map(seedFoods(legacyCSV).map((f) => [f.name, f]));
  const d =
    kitchen.starterNutritionRevision === 1 ? kitchen : applyAudit(kitchen, old);
  // Don't seed an intentionally empty or fully custom library on restore.
  if (!d.foods.some((f) => matchesStarter(f, old.get(f.name)))) {
    return { ...d, starterNutritionRevision: latestStarterRevision };
  }

  const oldNames = new Set([...old.keys()].map((n) => renamed.get(n) ?? n));
  const inDish = new Set(
    d.dishes.flatMap((dish) => dish.ingredients.map((i) => i.foodId)),
  );
  const occupied = new Set(d.foods.map((f) => identity(f.name, f.brand)));
  const foods = d.foods.flatMap((f) => {
    if (!matchesStarter(f, old.get(f.name))) return [f];
    const name = renamed.get(f.name) ?? f.name;
    const next = current.get(name);
    if (!next) {
      // Retain a retired food when the user kept it or a recipe still needs it.
      return f.favorite || f.archived || inDish.has(f.id) ? [f] : [];
    }
    if (name !== f.name && occupied.has(identity(name, f.brand))) return [f];
    // Dish ingredient amounts are in the food's unit, not in multiples of its serving.
    if (f.unit !== next.unit && inDish.has(f.id)) return [f];
    occupied.add(identity(name, f.brand));
    return [
      {
        ...f,
        name,
        quantity: next.quantity,
        unit: next.unit,
        nutrients: next.nutrients,
      },
    ];
  });
  for (const f of current.values()) {
    if (!oldNames.has(f.name) && !occupied.has(identity(f.name, f.brand)))
      foods.push(f);
  }
  return { ...d, foods, starterNutritionRevision: latestStarterRevision };
}
