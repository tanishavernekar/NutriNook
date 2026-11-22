import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bookFor,
  portionFor,
  rankedSources,
  type ReferenceBook,
} from "./data/foodReference";
import { recommendations, exampleProfile } from "./data/recommendations";
import { fresh } from "./storage";
import { goalsOn, type Goal } from "./model";

const read = (name: string): ReferenceBook =>
  JSON.parse(
    readFileSync(
      new URL(`../public/food-reference/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const sr = read("sr-2018"),
  fped = read("fped-1718");
const goal: Goal = { kind: "minimum", value: 25, reference: "AI", source: "" };
describe("food source reference", () => {
  it("retains the specific USDA cooked lentil record, its units and matching cup", () => {
    expect(sr.foods.length).toBe(7793);
    const f = sr.foods.find((food) => food.id === 172421)!;
    expect(f.name).toBe("Lentils, mature seeds, cooked, boiled, without salt");
    expect(f.measure).toEqual({ name: "cup", grams: 198 });
    expect(f.values[sr.keys.indexOf("protein")]).toBe(9.02);
    expect(f.values[sr.keys.indexOf("iron")]).toBe(3.33);
    expect(f.values[sr.keys.indexOf("vitaminK")]).toBe(1.7);
    const fiber = f.values[sr.keys.indexOf("fiber")];
    expect(fiber).toBe(7.9);
    expect(portionFor(fiber, goal)).toMatchObject({
      low: expect.closeTo(316.4557, 3),
      limit: false,
    });
  });
  it("ranks by a documented portion and keeps paprika off the fiber list", () => {
    const i = sr.keys.indexOf("fiber");
    expect(sr.foods.some((f) => f.values[i] === null)).toBe(true);
    expect(sr.foods.some((f) => f.values[i] === 0)).toBe(true);
    const ranked = rankedSources(sr, "fiber", goal).foods;
    expect(sr.foods.find((f) => f.id === 171329)?.portion?.grams).toBeCloseTo(
      0.575,
    );
    expect(ranked.some((r) => r.food.id === 171329)).toBe(false);
    expect(ranked.find((r) => r.food.id === 172421)).toMatchObject({
      amount: expect.closeTo(7.11),
      percent: expect.closeTo(28.44),
      portion: { grams: 90 },
    });
    expect(ranked.every((r) => r.amount >= 2.5)).toBe(true);
    expect(ranked.map((r) => r.amount)).toEqual(
      ranked.map((r) => r.amount).sort((a, b) => b - a),
    );
  });
  it("includes the exact 10% boundary, rejects rounding up, and never defaults to 100 g", () => {
    const sample: ReferenceBook = {
      keys: ["fiber"],
      foods: [
        {
          id: 1,
          name: "Pass",
          values: [5],
          portion: { grams: 50, basis: "sr" },
        },
        {
          id: 2,
          name: "Just below",
          values: [4.9999],
          portion: { grams: 50, basis: "sr" },
        },
        {
          id: 3,
          name: "Cup weight only",
          values: [50],
          measure: { name: "cup", grams: 700 },
        },
        {
          id: 4,
          name: "No nutrient value",
          values: [null],
          portion: { grams: 50, basis: "sr" },
        },
      ],
    };
    for (const kind of [
      "minimum",
      "maximum",
      "range",
      "energy",
      "ul",
    ] as const) {
      expect(
        rankedSources(sample, "fiber", { ...goal, kind, max: 40 }).foods.map(
          (r) => r.food.id,
        ),
      ).toEqual([1]);
    }
    expect(
      rankedSources(sample, "fiber", { ...goal, value: 30 }).foods,
    ).toHaveLength(0);
    expect(
      rankedSources(sample, "fiber", { ...goal, ul: 10 }).foods,
    ).toHaveLength(0);
    expect(rankedSources(sample, "fiber").note).toContain("No goal");
    expect(rankedSources(sample, "fiber").foods).toHaveLength(0);
  });
  it("does not infer added sugars from total sugars; uses the USDA survey code and teaspoon equivalent", () => {
    expect(bookFor("addedSugar")).not.toBe(bookFor("totalSugar"));
    expect(sr.keys).not.toContain("addedSugar");
    expect(fped.keys).toEqual(["addedSugar"]);
    expect(fped.foods.find((f) => f.id === 91101010)?.values[0]).toBeCloseTo(
      23.76 * 4.2,
      8,
    );
    expect(fped.foods.find((f) => f.id === 11111000)?.values[0]).toBe(0);
    const sugar = rankedSources(fped, "addedSugar", {
      ...goal,
      kind: "maximum",
      value: 20,
    }).foods.find((r) => r.food.id === 91101010);
    expect(sugar).toMatchObject({
      portion: { grams: 8, basis: "fndds" },
      amount: expect.closeTo(7.98336),
    });
  });
  it("uses dated goals with age-specific references and overrides, never substitutes a Daily Value", () => {
    const data = fresh();
    data.goals = [
      {
        date: "2026-01-01",
        values: recommendations({ ...exampleProfile, age: 55 }),
      },
      {
        date: "2026-02-01",
        values: { fiber: { ...goal, value: 30, custom: true } },
      },
    ];
    const at = (date: string) => portionFor(10, goalsOn(data, date).fiber);
    expect(at("2025-12-31")).toMatchObject({
      note: expect.stringContaining("No goal"),
    });
    expect(at("2026-01-15")).toMatchObject({ low: 210 });
    expect(at("2026-02-01")).toMatchObject({ low: 300 });
  });
  it("uses both range endpoints and distinguishes an energy estimate from a maximum or UL", () => {
    expect(portionFor(10, { ...goal, kind: "range", max: 40 })).toMatchObject({
      low: 250,
      high: 400,
      limit: false,
    });
    expect(portionFor(100, { ...goal, kind: "energy" })).toMatchObject({
      low: 25,
      label: expect.stringContaining("estimated"),
    });
    for (const kind of ["ul", "maximum"] as const)
      expect(portionFor(10, { ...goal, kind })).toMatchObject({
        low: 250,
        limit: true,
      });
  });
  it("withholds misleading portions for zero, missing or conflicting references", () => {
    for (const n of [null, 0, NaN, -1])
      expect(portionFor(n, goal)).toHaveProperty("note");
    expect(portionFor(5, { ...goal, kind: "range", max: 20 })).toHaveProperty(
      "note",
    );
    expect(
      portionFor(5, { ...goal, kind: "range", max: 40, ul: 35 }),
    ).toMatchObject({ note: expect.stringContaining("upper limit") });
    expect(portionFor(5, { ...goal, ul: 10 })).not.toHaveProperty("low");
  });
});
