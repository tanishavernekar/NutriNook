import type { Goal, Goals, Profile } from "../model";
export const exampleProfile: Readonly<Profile> = {
  age: 30,
  sex: "female",
  height: 165,
  weight: 65,
  activity: 0,
  stage: "Standard",
  imperial: false,
  intent: "General wellness",
};
const energySource =
  "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html";
const ods = (n: string) =>
  `https://ods.od.nih.gov/factsheets/${n}-HealthProfessional/`;
const dri =
  "https://www.nal.usda.gov/human-nutrition-and-food-safety/dri-calculator";
const minimum = (
  value: number,
  reference: string,
  source: string,
  ul?: number,
): Goal => ({ kind: "minimum", value, reference, source, ul });
export function recommendations(p: Profile | null): Goals {
  if (!p || p.age < 19) return {};
  const male = p.sex === "male",
    preg = p.stage === "Pregnant",
    lac = p.stage === "Breastfeeding",
    older = p.age > 50;
  if ((preg || lac) && (male || older)) return {};
  const g: Goals = {
    calcium: minimum(
      p.age > 70 || (!male && older) ? 1200 : 1000,
      "RDA · 2011",
      ods("Calcium"),
      older ? 2000 : 2500,
    ),
    iron: minimum(
      preg ? 27 : lac ? 9 : male || older ? 8 : 18,
      "RDA · 2001",
      ods("Iron"),
      45,
    ),
    magnesium: minimum(
      male
        ? p.age > 30
          ? 420
          : 400
        : (p.age > 30 ? 320 : 310) + (preg ? 40 : 0),
      "RDA · 1997",
      ods("Magnesium"),
    ),
    potassium: minimum(
      preg ? 2900 : lac ? 2800 : male ? 3400 : 2600,
      "AI · 2019",
      ods("Potassium"),
    ),
    vitaminK: minimum(male ? 120 : 90, "AI · 2001", ods("VitaminK")),
    fiber: minimum(
      preg ? 28 : lac ? 29 : male ? (older ? 30 : 38) : older ? 21 : 25,
      "AI · 2005",
      dri,
    ),
    protein: minimum(
      preg || lac ? 71 : male ? 56 : 46,
      "RDA · 2005 (reference adult)",
      dri,
    ),
    carbohydrates: minimum(preg ? 175 : lac ? 210 : 130, "RDA · 2005", dri),
  };
  if (!preg && !lac && p.height > 0 && p.weight > 0) {
    const table = male
      ? [
          [753.07, 6.5, 14.1],
          [581.47, 8.3, 14.94],
          [1004.82, 6.52, 15.91],
          [-517.88, 15.61, 19.11],
        ]
      : [
          [584.9, 5.72, 11.71],
          [575.77, 6.6, 12.14],
          [710.25, 6.54, 12.34],
          [511.83, 9.07, 12.56],
        ];
    const [b, h, w] = table[p.activity];
    const kcal = Math.round(
      b - (male ? 10.83 : 7.01) * p.age + h * p.height + w * p.weight,
    );
    if (kcal > 0) {
      g.calories = {
        kind: "energy",
        value: kcal,
        reference: "EER · 2023",
        source: energySource,
      };
      g.fat = {
        kind: "range",
        value: (kcal * 0.2) / 9,
        max: (kcal * 0.35) / 9,
        reference: "AMDR · 2005 (20–35% of estimated energy)",
        source: dri,
      };
    }
  }
  return g;
}
