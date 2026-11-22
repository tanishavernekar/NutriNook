import {
  categoryNames,
  isAppearance,
  keys,
  localDate,
  migrateCategories,
  type Kitchen,
} from "./model";
import { seedFoods } from "./data/csv";
import { latestStarterRevision } from "./data/starterAdditions";
import { migrateStarterNutrition } from "./data/starterNutrition";
import { exampleProfile, recommendations } from "./data/recommendations";
export const fresh = (date = localDate()): Kitchen => ({
  version: 1,
  starterNutritionRevision: latestStarterRevision,
  foods: seedFoods(),
  entries: [],
  categories: [...categoryNames],
  dishes: [],
  goals: [{ date, values: recommendations(exampleProfile) }],
  profile: { ...exampleProfile },
  profileIsExample: true,
  settings: { sound: true, volume: 0.25, celebrate: true, reduced: false },
});
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, min = 0): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min;
const pos = (v: unknown) => num(v) && v > 0;
const str = (v: unknown) => typeof v === "string" && Boolean(v.trim());
const day = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\d$/.test(v) &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const list = (v: unknown, check: (x: unknown) => boolean) =>
  Array.isArray(v) && v.every(check);
const food = (x: unknown) =>
  record(x) &&
  str(x.id) &&
  str(x.name) &&
  typeof x.brand === "string" &&
  str(x.category) &&
  (x.autoCategory === undefined || typeof x.autoCategory === "boolean") &&
  pos(x.quantity) &&
  str(x.unit) &&
  ["individual", "custom", "dish"].includes(String(x.type)) &&
  typeof x.favorite === "boolean" &&
  typeof x.archived === "boolean" &&
  str(x.createdAt) &&
  str(x.updatedAt) &&
  record(x.nutrients) &&
  keys.every((k) => {
    const v = (x.nutrients as Record<string, unknown>)[k];
    return v === null || num(v);
  });
export function validateBackup(x: unknown): Kitchen {
  const s = record(x) ? x.settings : null;
  if (
    !record(x) ||
    x.version !== 1 ||
    (x.starterNutritionRevision !== undefined &&
      x.starterNutritionRevision !== 1 &&
      x.starterNutritionRevision !== 2 &&
      x.starterNutritionRevision !== 3 &&
      x.starterNutritionRevision !== 4 &&
      x.starterNutritionRevision !== 5 &&
      x.starterNutritionRevision !== 6 &&
      x.starterNutritionRevision !== 7 &&
      x.starterNutritionRevision !== 8 &&
      x.starterNutritionRevision !== 9 &&
      x.starterNutritionRevision !== 10 &&
      x.starterNutritionRevision !== latestStarterRevision) ||
    (x.profileIsExample !== undefined &&
      typeof x.profileIsExample !== "boolean") ||
    !list(x.foods, food) ||
    !list(x.categories, str) ||
    !record(s) ||
    (s.appearance !== undefined && !isAppearance(s.appearance)) ||
    !num(s.volume) ||
    s.volume > 1 ||
    !["sound", "celebrate", "reduced"].every(
      (k) => typeof s[k] === "boolean",
    ) ||
    !list(
      x.entries,
      (e) =>
        record(e) &&
        str(e.id) &&
        day(e.date) &&
        food(e.food) &&
        pos(e.quantity) &&
        str(e.createdAt) &&
        str(e.updatedAt) &&
        (e.dish === undefined || typeof e.dish === "string"),
    ) ||
    !list(
      x.dishes,
      (d) =>
        record(d) &&
        str(d.id) &&
        str(d.name) &&
        Array.isArray(d.ingredients) &&
        d.ingredients.length > 0 &&
        list(
          d.ingredients,
          (i) => record(i) && str(i.foodId) && pos(i.quantity),
        ),
    ) ||
    !list(
      x.goals,
      (g) =>
        record(g) &&
        day(g.date) &&
        record(g.values) &&
        Object.entries(g.values).every(
          ([k, v]) =>
            keys.some((key) => key === k) &&
            record(v) &&
            ["minimum", "range", "maximum", "ul", "energy"].includes(
              String(v.kind),
            ) &&
            pos(v.value) &&
            (v.kind !== "range" || (num(v.max) && v.max >= Number(v.value))) &&
            (v.ul === undefined || pos(v.ul)) &&
            str(v.reference) &&
            typeof v.source === "string" &&
            (v.source === "" || /^https:\/\//.test(v.source)),
        ),
    ) ||
    !(
      x.profile === null ||
      (record(x.profile) &&
        pos(x.profile.age) &&
        ["male", "female"].includes(String(x.profile.sex)) &&
        num(x.profile.height) &&
        num(x.profile.weight) &&
        [0, 1, 2, 3].includes(Number(x.profile.activity)) &&
        typeof x.profile.activity === "number" &&
        ["Standard", "Pregnant", "Breastfeeding"].includes(
          String(x.profile.stage),
        ) &&
        typeof x.profile.imperial === "boolean" &&
        (x.profile.heightUnit === undefined ||
          x.profile.heightUnit === "cm" ||
          x.profile.heightUnit === "in") &&
        (x.profile.weightUnit === undefined ||
          x.profile.weightUnit === "kg" ||
          x.profile.weightUnit === "lb") &&
        str(x.profile.intent))
    )
  )
    throw Error("Not a valid version 1 NutriNook backup. No changes made.");
  const d = x as Kitchen;
  for (const rows of [d.foods, d.entries, d.dishes])
    if (new Set(rows.map((v) => v.id)).size !== rows.length)
      throw Error("Duplicate IDs in backup.");
  if (
    d.dishes.some((r) =>
      r.ingredients.some((i) => !d.foods.some((f) => f.id === i.foodId)),
    )
  )
    throw Error("Dish ingredient missing from library.");
  return migrateStarterNutrition(migrateCategories(d));
}
let dbPromise: Promise<IDBDatabase> | undefined,
  connection: IDBDatabase | undefined;
function database() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    // Keep the original database name so the rebrand opens existing journals.
    const req = indexedDB.open("cozy-kitchen", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("journal");
    req.onsuccess = () => {
      connection = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(Error("Close other NutriNook tabs to upgrade storage."));
  }));
}
export async function load() {
  const db = await database();
  return new Promise<{ kitchen: Kitchen; firstRun: boolean }>(
    (resolve, reject) => {
      const r = db.transaction("journal").objectStore("journal").get("kitchen");
      r.onsuccess = () => {
        try {
          const firstRun = r.result === undefined;
          resolve({
            kitchen: firstRun ? fresh() : validateBackup(r.result),
            firstRun,
          });
        } catch (e) {
          reject(e);
        }
      };
      r.onerror = () => reject(r.error);
    },
  );
}
export function save(d: Kitchen) {
  return new Promise<void>((resolve, reject) => {
    if (!connection) throw Error("Journal is not open");
    const tx = connection.transaction("journal", "readwrite", {
      durability: "strict",
    });
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? Error("Write aborted"));
    tx.objectStore("journal").put(d, "kitchen");
    tx.commit?.();
  });
}
