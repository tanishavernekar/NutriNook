import { expect, it } from "vitest";
import raw from "./data/pantry.csv?raw";
import { seedFoods, mapping, parseCSV, columns } from "./data/csv";
import { migrateStarterNutrition } from "./data/starterNutrition";
import { fresh } from "./storage";
import frozen from "./data/legacy/pantry-v11.csv?raw";
import { entry } from "./model";

const header = raw.split(/\r?\n/)[0];
const standard = seedFoods(frozen);
const extra = "Example flatbread,1 piece,41,1,2,0,9,0,,,,,,0,,Dishes";
const example = () => seedFoods(`${header}\n${extra}`)[0];

it("validates every row in the published CSV, without pinning its size or order", () => {
  const [head, ...rows] = parseCSV(raw);
  const map = mapping(head);
  expect(columns.every(c => map[c] >= 0)).toBe(true);
  expect(seedFoods()).toHaveLength(rows.length);
  expect(rows.length).toBeGreaterThan(0);
});

it("uses explicit dish categories, infers familiar items and permits uncategorized additions", () => {
  const foods = seedFoods(`${header}\n${extra}\nFresh macadamias,1 cup,100,,,,,,,,,,,,\nUnfamiliar item,1 piece,100,,,,,,,,,,,,`);
  expect(foods.map(f => [f.type, f.category])).toEqual([
    ["dish", "Dishes"], ["individual", "Nuts & Seeds"], ["individual", "Needs category"],
  ]);
  expect(foods[0].nutrients).toMatchObject({ calories: 41, fat: 0, potassium: null });
});

it("identifies invalid rows and duplicate name/brand pairs before publishing", () => {
  for (const row of [extra + ",oops", extra.replace("1 piece", ""), extra.replace("41", "-1"), extra.replace("Dishes", "Dihses")]) {
    expect(() => seedFoods(`${header}\n${row}`)).toThrow(/Row 2/);
  }
  expect(() => seedFoods(`${header}\n${extra}\n${extra}`)).toThrow(/Row 3: Duplicate/);
});

it("offers unseen CSV identities once, even across historical upgrades and restores", () => {
  const today = "2026-11-22";
  const d = fresh(today, structuredClone(standard));
  delete d.starterItemsSeen;
  d.foods.shift(); // Previously deleted.
  d.foods[1].quantity = 12;
  d.entries.push(entry(d.foods[1], today));
  const f = example(), stock = [...standard, f];
  const next = migrateStarterNutrition(d, stock);
  expect(next.foods).toEqual([...d.foods, f]);
  expect(next.entries).toEqual(d.entries);
  next.foods.pop(); // Deliberately delete the new item.
  expect(migrateStarterNutrition(next, stock)).toEqual(next);
  const custom = { ...f, type: "custom" as const };
  for (const foods of [[], [custom], [...d.foods, custom]]) {
    expect(migrateStarterNutrition({ ...d, foods }, stock).foods).toEqual(foods);
  }
});
