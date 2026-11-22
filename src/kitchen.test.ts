import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import legacyPantry from "./data/legacy/pantry-v1.csv?raw";
import {
  convert,
  entry,
  getNutrientVisualStatus,
  goalsOn,
  keys,
  nextPortion,
  nutrients,
  scaled,
  totals,
  type Goal,
  type Profile,
} from "./model";
import {
  amount,
  exportCSV,
  pantryTSV,
  mapping,
  mergeFoods,
  parseCSV,
  preview,
  seedFoods,
  serving,
  pastedFoods,
  upsertFoods,
} from "./data/csv";
import { recommendations } from "./data/recommendations";
import { fresh, validateBackup } from "./storage";
import { PlateHistory, replaceDay } from "./history";
const milk = seedFoods().find((f) => f.name === "A2 Whole Milk")!,
  date = "2026-01-12",
  goal: Goal = {
    kind: "minimum",
    value: 10,
    reference: "Your setting",
    source: "",
  };
const p: Profile = {
  age: 35,
  sex: "female",
  height: 165,
  weight: 65,
  activity: 0,
  stage: "Standard",
  imperial: false,
  intent: "General wellness",
};
describe("plate and library", () => {
  it("files every starter food on its reviewed shelf", () => {
    const foods = seedFoods();
    const shelf = (name: string) =>
      foods
        .filter((f) => f.category === name)
        .map((f) => f.name)
        .sort();
    expect(foods).toHaveLength(136);
    // Keep the original 78 approved definitions pinned independently of later additions.
    const definitions = foods.slice(0, 78).map((f) => [
      f.name,
      f.brand,
      f.category,
      f.quantity,
      f.unit,
      ...Object.entries(f.nutrients)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, value]) => value),
    ]);
    expect(
      createHash("sha256").update(JSON.stringify(definitions)).digest("hex"),
    ).toBe("1aa6aa6845d99ef94f4939ac9701697336e1528623520e210bbb42738772f574");
    expect(foods.slice(78, 82).map((f) => [
      f.name, f.category, f.quantity, f.unit, f.nutrients.calories, f.nutrients.addedSugar,
    ])).toEqual([
      ["Brown rice (long-grain)", "Grains & Bread", 1, "cup", 248, null],
      ["Maath (amaranth leaves)", "Vegetables", 1, "cup", 28, null],
      ["Kuttu (buckwheat groats)", "Grains & Bread", 1, "cup", 155, null],
      ["Lima beans (large)", "Lentils & Legumes", 1, "cup", 216, null],
    ]);
    expect(foods.find((f) => f.name === "Maath (amaranth leaves)")?.nutrients)
      .toMatchObject({ fiber: null, totalSugar: null, vitaminK: null, calcium: 275.88 });
    expect(shelf("Dairy & Protein")).toEqual([
      "A2 Whole Milk",
      "Canned Tuna (in water)",
      "Chicken Breast",
      "Chicken Drumstick",
      "Eggs",
      "Golden Pompano",
      "Kirkland Yogurt",
      "Salmon Fillet",
    ]);
    expect(shelf("Dishes")).toEqual([
      "Aloo gobi",
      "Aloo paratha",
      "Aloo samosa",
      "Black bean burger",
      "Butter naan",
      "Chana Masala",
      "Chapati",
      "Chicken biryani",
      "Chicken burger (fried fillet)",
      "Chicken burger (shredded)",
      "Chicken curry",
      "Chicken curry with dosa",
      "Chicken taco",
      "Chicken wings",
      "Cranberry Walnut Chicken Salad (Panera)",
      "Cucumber raita",
      "Dahi bhaat (curd rice)",
      "Dal makhani",
      "Egg curry",
      "Fish taco",
      "Fried fish",
      "Fried prawns",
      "Idli",
      "Jola bhakri",
      "Khaman dhokla",
      "Masala dosa",
      "Massaman curry",
      "Matar paneer",
      "Methi thepla",
      "Misal pav",
      "Moong Dal Chilla",
      "Naan",
      "Palak paneer",
      "Pani puri",
      "Pav bhaji",
      "Pizza Melt (Potbelly)",
      "Plain dosa",
      "Plain khichdi",
      "Plain uttapam",
      "Qdoba Chicken Bowl",
      "Rava upma",
      "Rice kheer",
      "Sabudana khichdi",
      "Sambar",
      "Shev puri",
      "Smokehouse BBQ Chicken (Panera)",
      "Thai chicken fried rice",
      "Vada pav",
      "Veggie pizza",
      "Veggie poha",
      "Veggie pulav",
    ]);
    expect(shelf("Everyday Essentials")).toEqual([
      "Avocado Oil",
      "Coconut milk",
      "Fresh grated coconut",
      "Ghee",
      "Olive Oil",
      "White Sugar",
    ]);
    expect(shelf("Fruits & Berries")).toHaveLength(14);
  });
  it("uses the US a2 label per half cup, with declared zeros distinct from unreported fields", () => {
    expect(seedFoods().filter((f) => f.name === "Eggs")).toHaveLength(1);
    expect(milk.quantity).toBe(0.5);
    expect(milk.nutrients).toEqual({
      calories: 80,
      protein: 4,
      fiber: 0,
      fat: 4.5,
      carbohydrates: 6.5,
      totalSugar: 6,
      addedSugar: 0,
      calcium: 150,
      iron: 0,
      potassium: 200,
      magnesium: null,
      vitaminK: null,
    });
  });
  it("uses USDA guava vitamin K and does not count unsupported dish amounts as zeros", () => {
    const foods = seedFoods();
    const guava = foods.find((f) => f.name === "Guava")!;
    const chilla = foods.find((f) => f.name === "Moong Dal Chilla")!;
    const bowl = foods.find((f) => f.name === "Qdoba Chicken Bowl")!;
    expect(guava).toMatchObject({
      quantity: 1,
      unit: "cup",
      nutrients: { vitaminK: 4.29 },
    });
    expect(scaled(entry(guava, date, 0.5), "vitaminK")).toBe(2.145);
    expect(chilla.nutrients).toMatchObject({ potassium: null, vitaminK: null });
    expect(bowl.nutrients).toMatchObject({ magnesium: null, vitaminK: null });
    expect(
      foods.filter((f) => f.nutrients.addedSugar !== null).map((f) => f.name),
    ).toEqual([milk.name, "Black bean burger", "Jola bhakri", "Chapati"]);
  });
  it("logs independently removable IDs and scales serving snapshots", () => {
    const a = entry(milk, date),
      b = entry(milk, date, 1);
    expect(a.id).not.toBe(b.id);
    expect(totals([a, b], "calories").sum).toBe(240);
    expect(totals([b], "calcium").sum).toBe(300);
    expect(scaled({ ...a, quantity: 2 }, "protein")).toBe(16);
    const edited = { ...milk, nutrients: nutrients(() => 99) };
    expect(entry(edited, date).food.nutrients.calories).toBe(99);
    expect(a.food.nutrients.calories).toBe(80);
  });
  it("keeps partial data distinct from zero", () => {
    expect(totals([entry(milk, date)], "magnesium")).toEqual({
      sum: 0,
      missing: 1,
    });
    expect(totals([entry(milk, date)], "iron")).toEqual({ sum: 0, missing: 0 });
  });
  it.each([0, -1, NaN, Infinity])("rejects invalid serving %s", (q) =>
    expect(() => entry(milk, date, q)).toThrow(),
  );
  it("only converts compatible units", () => {
    expect(convert(1, "cup", "tbsp")).toBe(16);
    expect(convert(2, "cup", "g", { g: 244 })).toBe(488);
    expect(() => convert(1, "cup", "g")).toThrow();
  });
  it("isolates dated changes, undo and redo", () => {
    const a = entry(milk, date),
      b = entry(milk, "2026-01-13"),
      h = new PlateHistory();
    h.push({ date, before: [], after: [a] });
    expect(replaceDay([a, b], date, h.step(false)!.entries)).toEqual([b]);
    expect(h.step(true)!.entries).toEqual([a]);
    h.step(false);
    h.push({ date, before: [], after: [entry(milk, date)] });
    expect(h.step(true)).toBeUndefined();
  });
});
describe("goal semantics", () => {
  it("caps material not displayed percentage", () =>
    expect(getNutrientVisualStatus(16, goal)).toMatchObject({
      fill: 1,
      percent: 160,
      state: "success",
      color: "#8FA66B",
    }));
  it("does not manufacture a target or infer one for sugar", () => {
    expect(getNutrientVisualStatus(32)).toMatchObject({
      percent: null,
      state: "neutral",
    });
    expect(recommendations(p).totalSugar).toBeUndefined();
  });
  it("distinguishes range, upper limit, recommended maximum and estimates", () => {
    expect(
      getNutrientVisualStatus(15, { ...goal, kind: "range", max: 14 }).state,
    ).toBe("above");
    expect(
      getNutrientVisualStatus(14, { ...goal, kind: "range", max: 14 }).state,
    ).toBe("success");
    expect(getNutrientVisualStatus(10, { ...goal, kind: "ul" }).state).toBe(
      "neutral",
    );
    expect(
      getNutrientVisualStatus(11, { ...goal, kind: "maximum" }).state,
    ).toBe("above");
    expect(getNutrientVisualStatus(20, { ...goal, ul: 15 }, 1).state).toBe(
      "limit",
    );
    expect(getNutrientVisualStatus(20, { ...goal, kind: "energy" }).state).toBe(
      "progress",
    );
    expect(getNutrientVisualStatus(15, goal, 1).state).toBe("neutral");
  });
  it("uses adult DRI strata, food-applicable limits and effective dates", () => {
    const r = recommendations(p),
      active = recommendations({ ...p, activity: 3 });
    expect(r.iron?.value).toBe(18);
    expect(r.magnesium?.ul).toBeUndefined();
    expect(active.calories!.value).toBeGreaterThan(r.calories!.value);
    expect(active.iron).toEqual(r.iron);
    expect(recommendations({ ...p, stage: "Pregnant" }).iron?.value).toBe(27);
    expect(recommendations({ ...p, age: 17 })).toEqual({});
    const d = fresh();
    d.goals = [{ date, values: r }];
    expect(goalsOn(d, "2026-01-01")).toEqual({});
    expect(goalsOn(d, date)).toEqual(r);
  });
  it("starts with example recommendations without reseeding saved kitchens", () => {
    const d = fresh(date);
    expect(d.profileIsExample).toBe(true);
    expect(d.profile).not.toBeNull();
    expect(goalsOn(d, date)).toEqual(recommendations(d.profile));
    expect(goalsOn(d, date).calories?.kind).toBe("energy");
    expect(goalsOn(d, date).totalSugar).toBeUndefined();
    expect(goalsOn(d, "2026-01-11")).toEqual({});
    const optedOut = {
      ...d,
      profileIsExample: undefined,
      profile: null,
      goals: [],
    };
    expect(validateBackup(optedOut)).toEqual(optedOut);
  });
});
describe("data exchange", () => {
  it("copies rectangular spreadsheet values with units, fractions, blanks and declared zeros", () => {
    const cells = pantryTSV(
      [milk],
      ["quantity", "potassium", "magnesium", "addedSugar", "brand"],
      true,
    );
    expect(cells).toBe(
      "Serving\tPotassium (mg)\tMagnesium (mg)\tAdded sugar (g)\tBrand\n1/2 cup\t200\t\t0\t",
    );
    const custom = { ...milk, name: "=123", brand: 'Brand\t"A"\nB' };
    expect(pantryTSV([custom, milk], ["name", "brand"], false)).toBe(
      `'=123\t"Brand\t""A""\nB"\nA2 Whole Milk\t`,
    );
  });
  it("upgrades only matching legacy starter definitions once, never snapshots or custom servings", () => {
    const d = fresh(date);
    delete d.starterNutritionRevision;
    d.foods = seedFoods(legacyPantry);
    const byName = (name: string) => d.foods.find((f) => f.name === name)!;
    const old = byName(milk.name);
    Object.assign(old.nutrients, {
      calories: 75,
      fat: 4,
      carbohydrates: 6,
      addedSugar: null,
      magnesium: 12,
      potassium: 161,
      vitaminK: 0.1,
    });
    old.favorite = true;
    byName("Guava").nutrients.vitaminK = 2.2;
    Object.assign(byName("Moong Dal Chilla").nutrients, {
      potassium: 0,
      vitaminK: 0,
    });
    Object.assign(byName("Qdoba Chicken Bowl").nutrients, {
      magnesium: 0,
      vitaminK: 0,
    });
    const personal = [
      { ...old, id: "custom", type: "custom" as const },
      { ...old, id: "other-serving", quantity: 1 },
      { ...old, id: "edited", nutrients: { ...old.nutrients, fiber: 1 } },
    ];
    d.foods.push(...personal);
    d.entries.push(entry(old, date));
    const migrated = validateBackup(JSON.parse(JSON.stringify(d)));
    const corrected = migrated.foods.find((f) => f.id === old.id)!;
    expect(corrected).toEqual({ ...old, nutrients: milk.nutrients });
    for (const name of ["Guava", "Moong Dal Chilla", "Qdoba Chicken Bowl"]) {
      expect(
        migrated.foods.find((f) => f.id === byName(name).id)?.nutrients,
      ).toEqual(seedFoods().find((f) => f.name === name)?.nutrients);
    }
    expect(migrated.foods).toEqual(expect.arrayContaining(personal));
    expect(migrated.entries).toEqual(d.entries);
    // After the upgrade even a deliberate edit back to the old values must stick.
    corrected.nutrients = { ...old.nutrients };
    expect(validateBackup(migrated)).toEqual(migrated);
  });
  it("upgrades the stock 57-food pantry to the same ordered definitions as a fresh kitchen", () => {
    const d = fresh(date);
    d.starterNutritionRevision = 1;
    d.foods = seedFoods(legacyPantry);
    expect(d.foods).toHaveLength(57);
    const rice = d.foods.find((f) => f.name === "Basmati Rice (Cooked)")!;
    rice.favorite = true;
    d.entries.push(entry(rice, date));
    d.dishes.push({
      id: "bowl",
      name: "Bowl",
      ingredients: [{ foodId: rice.id, quantity: 0.5 }],
    });
    const upgraded = validateBackup(structuredClone(d));
    const definitions = (fs: typeof d.foods) =>
      fs.map(({ name, category, quantity, unit, nutrients, brand }) => ({
        name,
        category,
        quantity,
        unit,
        nutrients,
        brand,
      }));
    expect(definitions(upgraded.foods)).toEqual(definitions(seedFoods()));
    expect(upgraded.foods.find((f) => f.id === rice.id)).toMatchObject({
      name: "Basmati Rice",
      favorite: true,
    });
    expect(upgraded.entries).toEqual(d.entries);
    expect(upgraded.dishes).toEqual(d.dishes);
    upgraded.foods = upgraded.foods.filter((f) => f.name !== "Black beans");
    expect(validateBackup(upgraded)).toEqual(upgraded);
  });
  it("uses short portions for the nine whole dishes, retaining recipe values and blanks", () => {
    const additions = seedFoods().slice(82, 91);
    expect(additions.every((f) =>
      f.type === "dish" && f.quantity === 1 && f.nutrients.addedSugar === null,
    )).toBe(true);
    expect(additions.map((f) => [f.name, f.unit, f.nutrients.calories, f.nutrients.totalSugar])).toEqual([
      ["Vada pav", "sandwich", 296, 19],
      ["Pav bhaji", "plate", 561, null],
      ["Veggie pulav", "plate", 496, null],
      ["Chicken biryani", "plate", 753, 2],
      ["Chicken curry with dosa", "plate", 458, null],
      ["Chicken curry", "bowl", 320, null],
      ["Plain dosa", "dosa", 138, null],
      ["Masala dosa", "dosa", 345, null],
      ["Veggie poha", "bowl", 177, null],
    ]);
    expect(additions.find((f) => f.name === "Chicken biryani")?.nutrients)
      .toMatchObject({ magnesium: null, vitaminK: null, potassium: 550 });
  });
  it("keeps the ten new dish portions and distinguishes unreported sugars from zero", () => {
    const dishes = seedFoods().slice(91, 101);
    expect(dishes.every((f) => f.type === "dish" && f.quantity === 1 &&
      f.nutrients.totalSugar === null && f.nutrients.addedSugar === null)).toBe(true);
    expect(dishes.map((f) => [f.name, f.unit, f.nutrients.calories])).toEqual([
      ["Idli", "idli", 34], ["Sambar", "bowl", 249], ["Rava upma", "bowl", 157],
      ["Khaman dhokla", "piece", 65], ["Plain khichdi", "small bowl", 327],
      ["Sabudana khichdi", "bowl", 508], ["Palak paneer", "bowl", 230],
      ["Egg curry", "bowl", 178], ["Cucumber raita", "bowl", 90], ["Rice kheer", "bowl", 301],
    ]);
  });
  it("logs the street-food estimates by plate, samosa or piece without inventing missing nutrients", () => {
    const dishes = seedFoods().slice(101, 105);
    expect(dishes.every((f) => f.type === "dish" && f.nutrients.addedSugar === null)).toBe(true);
    expect(dishes.map((f) => [f.name, f.quantity, f.unit, f.nutrients.calories, f.nutrients.totalSugar])).toEqual([
      ["Misal pav", 1, "plate", 383, 5],
      ["Aloo samosa", 1, "samosa", 175, 1],
      ["Pani puri", 6, "filled puris", 306, 4.2],
      ["Shev puri", 6, "pieces", 496, 42],
    ]);
    const onePuri = { ...entry(dishes[2], date), quantity: 1 };
    expect(scaled(onePuri, "calories")).toBe(51);
    expect(scaled(onePuri, "calcium")).toBeNull();
    expect(scaled(onePuri, "potassium")).toBeNull();
  });
  it("keeps the new portions and distinct chicken preparations", () => {
    const dishes = seedFoods().slice(105, 116);
    expect(dishes.every((f) => f.type === "dish" && f.category === "Dishes")).toBe(true);
    expect(dishes.map((f) => [f.name, `${f.quantity} ${f.unit}`, f.nutrients.calories, f.nutrients.addedSugar])).toEqual([
      ["Thai chicken fried rice", "1 plate", 690, null], ["Massaman curry", "1 bowl", 402, null],
      ["Fish taco", "1 taco", 275, null], ["Chicken taco", "1 taco", 222, null],
      ["Fried prawns", "6 prawns", 262, null], ["Fried fish", "1 fillet", 304, null],
      ["Chicken wings", "1 wing", 178, null], ["Black bean burger", "1 burger", 277, 1],
      ["Chicken burger (fried fillet)", "1 burger", 377, null], ["Chicken burger (shredded)", "1 burger", 294, null],
      ["Veggie pizza", "1 slice", 235, null],
    ]);
  });
  it("retires the stock tea and shelf without losing logged meals, recipe references or personal drinks", () => {
    const d = fresh(date);
    expect(d.categories).not.toContain("Beverages");
    expect(d.foods.some((f) => f.name === "Thai iced tea")).toBe(false);
    d.starterNutritionRevision = 7;
    d.categories.push("Beverages");
    const tea = { ...milk, id: "stock-tea", name: "Thai iced tea", brand: "Taste Nirvana",
      category: "Beverages", quantity: 1, unit: "cup", nutrients: {
        calories: 160, protein: 1, fiber: 0, fat: 3, carbohydrates: 31, totalSugar: 30,
        calcium: 48, iron: 0.4, magnesium: 14, potassium: 130, vitaminK: null, addedSugar: 23,
      } };
    d.foods.push(tea);
    d.entries.push(entry(tea, date));
    const stock = validateBackup(d);
    expect(stock.foods).toEqual(d.foods.filter((f) => f.id !== tea.id));
    expect(stock.categories).toEqual(fresh(date).categories);
    expect(stock.entries).toEqual(d.entries);
    const personal = { ...tea, id: "my-drink", name: "My lemonade", type: "custom" as const };
    const edited = { ...tea, id: "edited-tea", quantity: 2 };
    d.foods.push(personal, edited);
    d.dishes.push({ id: "saved", name: "Saved dish", ingredients: [{ foodId: tea.id, quantity: 1 }] });
    const kept = validateBackup(d);
    expect(kept.categories).not.toContain("Beverages");
    expect(kept.categories).toContain("Needs category");
    expect(kept.foods.slice(-3)).toEqual([
      { ...tea, archived: true, category: "Needs category" },
      { ...personal, category: "Needs category" }, { ...edited, category: "Needs category" },
    ]);
    expect(kept.dishes).toEqual(d.dishes);
    expect(validateBackup(kept)).toEqual(kept);
  });
  it("logs four walnut halves or four shelled pistachios, scaling every nutrient with the count", () => {
    const foods = seedFoods();
    const expected = [
      ["Walnuts", "halves", [53,1.23,0.54,5.28,1.11,0.21,7.94,0.24,12.8,35.72,0.22,null]],
      ["Pistachios", "kernels", [13,0.47,0.25,1.05,0.63,0.18,2.43,0.09,2.8,23.72,null,null]],
    ] as const;
    for (const [name, unit, values] of expected) {
      const f = foods.find((food) => food.name === name)!;
      expect(f).toMatchObject({ quantity: 4, unit, type: "individual", category: "Nuts & Seeds" });
      const one = { ...entry(f, date), quantity: 1 };
      keys.forEach((key, i) => expect(scaled(one, key)).toBe(values[i] === null ? null : values[i]! / 4));
    }
  });
  it("uses quarter-cup reference servings for the five cooking staples", () => {
    const foods = seedFoods().slice(127).filter((f) => f.type === "individual");
    expect(foods.every((f) => f.type === "individual" && f.quantity === 0.25 && f.nutrients.addedSugar === null)).toBe(true);
    expect(foods.map((f) => [f.name, f.unit, f.category, f.nutrients.calories, f.nutrients.totalSugar])).toEqual([
      ["Atta (whole wheat flour)", "cup dry", "Grains & Bread", 102, 0.12],
      ["Rawa (semolina)", "cup dry", "Grains & Bread", 150, null],
      ["Maida (refined wheat flour)", "cup dry", "Grains & Bread", 114, 0.08],
      ["Fresh grated coconut", "cup", "Everyday Essentials", 71, 1.25],
      ["Coconut milk", "cup", "Everyday Essentials", 111, null],
    ]);
  });
  it("adds the four flatbreads once to a revision 10 kitchen without replacing history or restoring deletions", () => {
    const breads = ["Jola bhakri", "Chapati", "Naan", "Butter naan"];
    const d = fresh(date);
    d.starterNutritionRevision = 10;
    d.foods = d.foods.filter((f) => !breads.includes(f.name) && f.name !== "Eggs");
    d.entries = [entry(d.foods[0], date)];
    const upgraded = validateBackup(d);
    expect(upgraded.foods.slice(0, d.foods.length)).toEqual(d.foods);
    expect(upgraded.entries).toEqual(d.entries);
    expect(upgraded.foods.slice(d.foods.length).map((f) =>
      [f.name, f.type, f.category, f.nutrients.calories, f.nutrients.addedSugar],
    )).toEqual([
      ["Jola bhakri", "dish", "Dishes", 144, 0], ["Chapati", "dish", "Dishes", 102, 0],
      ["Naan", "dish", "Dishes", 262, null], ["Butter naan", "dish", "Dishes", 298, null],
    ]);
    expect(validateBackup(upgraded)).toEqual(upgraded);
  });
  it.each([[2, 78], [3, 82], [4, 91], [5, 101], [6, 105], [8, 116], [9, 127]] as const)("adds only newer starters to revision %i and respects personal changes on reload", (revision, count) => {
    const d = fresh(date);
    d.starterNutritionRevision = revision;
    const stock = d.foods.slice(0, count), additions = d.foods.slice(count);
    expect(validateBackup({ ...d, foods: stock }).foods.map((f) => f.name))
      .toEqual(d.foods.map((f) => f.name));
    const custom = { ...additions[0], type: "custom" as const, quantity: 0.5 };
    d.foods = [...stock.slice(1), custom];
    const upgraded = validateBackup(d);
    expect(upgraded.foods.slice(0, d.foods.length)).toEqual(d.foods);
    expect(upgraded.foods.slice(d.foods.length).map((f) => f.name))
      .toEqual(additions.slice(1).map((f) => f.name));
    upgraded.foods.pop();
    expect(validateBackup(upgraded)).toEqual(upgraded);
    for (const foods of [[], [custom]])
      expect(validateBackup({ ...d, foods }).foods).toEqual(foods);
  });
  it("does not overwrite custom rows, revive deleted old foods, or break a recipe during the catalog upgrade", () => {
    const d = fresh(date);
    d.starterNutritionRevision = 1;
    d.foods = seedFoods(legacyPantry).filter((f) => f.name !== "Eggs");
    const find = (name: string) => d.foods.find((f) => f.name === name)!;
    const mung = find("Green Moong (Whole)"),
      guava = find("Guava"),
      soya = find("Soya Chunks (Cooked)");
    mung.nutrients.protein = 99;
    const custom = {
      ...mung,
      name: "Black beans",
      id: "my-beans",
      type: "custom" as const,
    };
    d.foods.push(custom);
    d.dishes.push({
      id: "dish",
      name: "Existing recipe",
      ingredients: [
        { foodId: guava.id, quantity: 50 },
        { foodId: soya.id, quantity: 10 },
      ],
    });
    const migrated = validateBackup(d);
    for (const food of [mung, guava, soya, custom])
      expect(migrated.foods.find((f) => f.id === food.id)).toEqual(food);
    expect(migrated.foods.filter((f) => f.name === "Black beans")).toHaveLength(
      1,
    );
    expect(migrated.foods.some((f) => f.name === "Eggs")).toBe(false);
    expect(migrated.dishes).toEqual(d.dishes);
    expect(migrated.foods.some((f) => f.name === "Pearled barley")).toBe(true);
  });
  it("parses quoted names, fractions and custom header mappings", () => {
    const [h, ...rows] = parseCSV('Qty,Item,Energy\n1/3 cup,"Rice, cooked",20');
    const m = { ...mapping(h), quantity: 0, name: 1, calories: 2 },
      r = preview(rows, m);
    expect(r.errors).toEqual([]);
    expect(r.foods[0]).toMatchObject({
      name: "Rice, cooked",
      quantity: 1 / 3,
      nutrients: { calories: 20, protein: null },
    });
  });
  it("rejects malformed rows and unclosed quotes", () => {
    expect(() => serving("0/0 cup")).toThrow();
    expect(() => parseCSV('"oops')).toThrow();
    const [h, ...rows] = parseCSV(
      "Food Item,Quantity,Calories\nEggs,2 large,-1",
    );
    expect(preview(rows, mapping(h)).errors).toHaveLength(1);
  });
  it("supports skip, replace and variations while preserving snapshots", () => {
    const change = { ...milk, id: "another", nutrients: nutrients(() => 1) },
      original = entry(milk, date);
    expect(mergeFoods([milk], [change], "skip")).toEqual([milk]);
    expect(mergeFoods([milk], [change], "replace")[0]).toMatchObject({
      id: milk.id,
      nutrients: change.nutrients,
    });
    expect(mergeFoods([milk], [change], "variation")).toHaveLength(2);
    expect(original.food.nutrients.protein).toBe(4);
  });
  it("round-trips CSV and deeply checks JSON before restoration", () => {
    const [h, ...rows] = parseCSV(exportCSV([milk]));
    expect(preview(rows, mapping(h)).foods[0].nutrients).toEqual(
      milk.nutrients,
    );
    const d = fresh();
    d.entries.push(entry(milk, date));
    expect(validateBackup(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(() =>
      validateBackup({ ...d, entries: [{ quantity: -1 }] }),
    ).toThrow();
    expect(() => validateBackup({ ...d, version: 2 })).toThrow();
  });
  it("merges Dairy and Eggs & Protein in saved kitchens", () => {
    const d = fresh();
    d.categories = ["Vegetables", "Dairy", "Eggs & Protein", "Mine"];
    d.foods = [
      { ...milk, category: "Dairy" },
      { ...milk, id: "egg", category: "Eggs & Protein" },
    ];
    d.entries = [entry({ ...milk, category: "Dairy" }, date)];
    const m = validateBackup(JSON.parse(JSON.stringify(d)));
    expect(m.categories).toEqual(["Vegetables", "Dairy & Protein", "Mine"]);
    expect(m.foods.map((f) => f.category)).toEqual([
      "Dairy & Protein",
      "Dairy & Protein",
    ]);
    expect(m.entries[0].food.category).toBe("Dairy & Protein");
    expect(
      fresh().foods.some((f) => /^(Dairy|Eggs & Protein)$/.test(f.category)),
    ).toBe(false);
  });
  it("restores saved appearances and accepts backups from before theme selection", () => {
    const kitchen = fresh();
    expect(validateBackup(kitchen).settings.appearance).toBeUndefined();
    for (const appearance of ["wood", "periwinkle", "mono"]) {
      const settings = { ...kitchen.settings, appearance };
      expect(validateBackup({ ...kitchen, settings }).settings.appearance).toBe(
        appearance,
      );
    }
    expect(() =>
      validateBackup({
        ...kitchen,
        settings: { ...kitchen.settings, appearance: "unknown" },
      }),
    ).toThrow();
  });
  it("renames Grains & Rice to Grains & Bread in saved kitchens", () => {
    const d = fresh();
    d.categories = ["Grains & Rice", "Mine"];
    d.foods = [{ ...milk, category: "Grains & Rice" }];
    const m = validateBackup(JSON.parse(JSON.stringify(d)));
    expect(m.categories).toEqual(["Grains & Bread", "Mine"]);
    expect(m.foods[0].category).toBe("Grains & Bread");
  });
});

describe("portion stepping", () => {
  it("snaps to the next friendly serving size", () => {
    expect(nextPortion(1, 1)).toBe(1.25);
    expect(nextPortion(1, -1)).toBe(0.75);
    expect(nextPortion(0.25, -1)).toBe(0.25);
    expect(nextPortion(2.2, 1)).toBe(2.5);
    expect(nextPortion(2.2, -1)).toBe(2);
    expect(nextPortion(100, 1)).toBe(125);
    expect(nextPortion(1000, 1)).toBe(1250);
    expect(nextPortion(0, 1)).toBe(1);
  });
});

describe("pantry table paste", () => {
  const cats = fresh().categories;
  it("reads spreadsheet rows with headings, ranges and thousands", () => {
    const text = [
      "Food Item\tQuantity\tCalories\tProtein (g)\tFiber (g)",
      "IDEAL RANGE (auto-calculated)\t\t2,000 – 2,200\t50 – 165 g",
      "PROTIEN\t\t\t",
      "Tofu\t1/2 cup\t1,181\t10\t",
      "VEGGIES",
      "Kale\t1 cup\t33\t2.9\t2.6",
      "Broken\tabc\t1",
    ].join("\n");
    const p = pastedFoods(text, cats);
    expect(p.foods.map((f) => [f.name, f.category, f.quantity])).toEqual([
      ["Tofu", "Dairy & Protein", 0.5],
      ["Kale", "Vegetables", 1],
    ]);
    expect(p.foods[0].nutrients.calories).toBe(1181);
    expect(p.foods[0].nutrients.fiber).toBeNull();
    expect(p.errors).toHaveLength(1);
    expect(p.errors[0]).toMatch(/Broken/);
  });
  it("uses table column order when there is no header", () => {
    const p = pastedFoods("Pear\t1 medium\t100\t1", cats);
    expect(p.foods[0].category).toBe("Fruits & Berries");
    expect(p.foods[0].nutrients.calories).toBe(100);
    expect(p.foods[0].nutrients.protein).toBe(1);
  });
  it("classifies each unheaded row by the food rather than an ingredient or the first category", () => {
    const examples = [
      ["Baked salmon fillet", "Dairy & Protein"],
      ["Frozen broccoli", "Vegetables"],
      ["Avocado", "Fruits & Berries"],
      ["Avocado oil", "Everyday Essentials"],
      ["Apple juice", "Needs category"],
      ["Apple chips", "Snacks & Treats"],
      ["Oat milk", "Needs category"],
      ["Rolled oats", "Grains & Bread"],
      ["Green beans", "Vegetables"],
      ["Black beans", "Lentils & Legumes"],
      ["Peanut butter", "Nuts & Seeds"],
      ["Mystery bowl", "Needs category"],
      ["Chicken and rice", "Needs category"],
    ];
    expect(
      pastedFoods(
        examples.map(([name]) => `${name}\t1 serving`).join("\n"),
        cats,
      ).foods.map((f) => [f.name, f.category]),
    ).toEqual(examples);
  });
  it("prefers explicit categories, headings and saved assignments over name rules", () => {
    const existing = [
      { ...milk, name: "Apple", brand: "", category: "Lunchbox" },
    ];
    const p = pastedFoods(
      "Name\tServing\tCategory\nApple\t1 medium\t\nPear\t1 medium\tFruit gifts\nVEGGIES\nMango\t1 medium\t",
      [...cats, "Lunchbox"],
      existing,
    );
    expect(p.foods.map((f) => f.category)).toEqual([
      "Lunchbox",
      "Fruit gifts",
      "Vegetables",
    ]);
    expect(p.foods.every((f) => !f.autoCategory)).toBe(true);
    expect(pastedFoods("Pear\t1 medium", ["Lunchbox"]).foods[0].category).toBe(
      "Needs category",
    );
  });
  it("keeps all three food rows around a Markdown divider and aligns nutrients through vitamin K", () => {
    const p = pastedFoods(
      [
        "| Salmon Fillet | 1 small (4oz) | 184 | 23 | 0 | 9 | 0 | 0 | 12 | 0.9 | 30 | 412 | 0.5 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        "| Chicken Drumstick | 1 medium | 149 | 18 | 0 | 8 | 0 | 0 | 11 | 0.9 | 16 | 183 | 1.8 |",
        "| Golden Pompano | 1 small (4oz) | 228 | 21 | 0 | 14 | 0 | 0 | 25 | 0.7 | 31 | 380 | 0.1 |",
      ].join("\n"),
      cats,
    );
    expect(p.errors).toEqual([]);
    expect(p.foods.map((f) => [f.name, f.unit, f.nutrients.vitaminK])).toEqual([
      ["Salmon Fillet", "small (4oz)", 0.5],
      ["Chicken Drumstick", "medium", 1.8],
      ["Golden Pompano", "small (4oz)", 0.1],
    ]);
    expect(p.foods[0].nutrients).toEqual({
      calories: 184,
      protein: 23,
      fiber: 0,
      fat: 9,
      carbohydrates: 0,
      totalSugar: 0,
      calcium: 12,
      iron: 0.9,
      magnesium: 30,
      potassium: 412,
      vitaminK: 0.5,
      addedSugar: null,
    });
  });
  it("maps real Markdown headers and preserves empty cells and escaped pipes", () => {
    const p = pastedFoods(
      "Food item | Serving | Fiber (g) | Iron (mg)\n:--- | --- | ---: | :---:\nRice \\| beans | 1 cup | | 2.5",
      cats,
    );
    expect(p.errors).toEqual([]);
    expect(p.foods).toHaveLength(1);
    expect(p.foods[0]).toMatchObject({
      name: "Rice | beans",
      nutrients: { fiber: null, iron: 2.5 },
    });
  });
  it("updates same-named foods in place and keeps their identity", () => {
    const [eggs] = fresh().foods;
    const p = pastedFoods(`${eggs.name}\t3 large\t200`, cats);
    const r = upsertFoods([eggs], p.foods);
    expect([r.added, r.updated]).toEqual([0, 1]);
    expect(r.foods[0]).toMatchObject({
      id: eggs.id,
      type: eggs.type,
      quantity: 3,
    });
  });
  it("shows serving fractions the way a sheet does", () => {
    expect(amount(1 / 3)).toBe("1/3");
    expect(amount(0.5)).toBe("1/2");
    expect(amount(2)).toBe("2");
    expect(amount(0.2)).toBe("0.2");
  });
});
