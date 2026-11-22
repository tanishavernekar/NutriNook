import type { Key } from "../model";

type Guide = {
  role: string;
  foods: string[];
  low: string;
  high: string;
  source: { name: string; url: string };
};

const ods = (name: string) => ({
  name: "NIH Office of Dietary Supplements",
  url: `https://ods.od.nih.gov/factsheets/${name}-Consumer/`,
});
const medline = (article: string) => ({
  name: "MedlinePlus",
  url: `https://medlineplus.gov/ency/article/${article}.htm`,
});
const sugars = {
  name: "FDA · Understanding sugars",
  url: "https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label",
};

export const nutrientGuides: Record<Key, Guide> = {
  calories: {
    foods: ["Olive oil", "Peanut butter", "Walnuts", "Tahini"],
    role: "Calories measure energy. Even at rest, your body uses energy to breathe, circulate blood and stay warm.",
    low: "Consistently eating less energy than your body uses can lead to fatigue and unintended weight loss.",
    high: "Consistently taking in more energy than you use can lead to weight gain. A daily energy estimate is not a ceiling.",
    source: {
      name: "NHS · Understanding calories",
      url: "https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/understanding-calories/",
    },
  },
  protein: {
    foods: ["Lentils", "Tempeh", "Greek yogurt", "Chicken", "Fish"],
    role: "Protein supplies amino acids that your body uses to repair muscle, build new tissue and make enzymes.",
    low: "Too little protein over time can contribute to muscle loss and make it harder to repair tissue.",
    high: "Eating more than the minimum is not itself harmful. A diet heavily focused on protein can leave less room for fiber-rich foods.",
    source: medline("002467"),
  },
  fiber: {
    foods: [
      "Black beans",
      "Lentils",
      "Raspberries",
      "Wheat bran",
      "Chia seeds",
    ],
    role: "Insoluble fiber adds bulk to stool. Some soluble fibers, like those in oats and beans, help lower LDL cholesterol.",
    low: "With little fiber, stools can be harder to pass and constipation is more likely.",
    high: "A sudden increase can cause gas, bloating or cramps. Gradually adding fiber and drinking enough water can help.",
    source: medline("002470"),
  },
  fat: {
    foods: ["Olive oil", "Avocado", "Almonds", "Sesame paste", "Butter"],
    role: "Fat supplies essential fatty acids and helps you absorb fat-soluble vitamins.",
    low: "A very low-fat diet can make it harder to get essential fatty acids and absorb vitamins such as A, D and E.",
    high: "The type matters: diets high in saturated fat can raise LDL cholesterol. All fats are concentrated sources of energy.",
    source: {
      name: "NHS · Fat in your diet",
      url: "https://www.nhs.uk/live-well/eat-well/food-types/different-fats-nutrition/",
    },
  },
  carbohydrates: {
    foods: ["Brown rice", "Oats", "Potatoes", "Whole-grain bread", "Chickpeas"],
    role: "Your body breaks down starches and sugars into glucose for energy. Fiber is a carbohydrate too, but it works differently in digestion.",
    low: "Cutting back on beans, whole grains and fruit without replacing their fiber can contribute to constipation.",
    high: "The source matters. Relying heavily on sweets and refined grains can crowd out fiber and other nutrients.",
    source: medline("002469"),
  },
  totalSugar: {
    foods: ["Dates", "Raisins", "Fruit juice", "Sweetened soft drinks"],
    role: "Sugars supply energy. Total sugar counts both naturally occurring sugars, such as those in fruit and milk, and added sugars.",
    low: "There is no minimum intake for total sugar. Starches can also supply glucose.",
    high: "The total alone does not tell you whether you ate too much added sugar. Frequently sipping sugary drinks raises the risk of tooth decay; sugars in whole fruit are not the same concern.",
    source: {
      name: "NHS · Sugar in your diet",
      url: "https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/",
    },
  },
  addedSugar: {
    foods: ["Regular soda", "Candy", "Frosted cakes", "Honey and syrups"],
    role: "Added sugars provide sweetness and energy. They are not an essential nutrient.",
    low: "There is no dietary need for added sugar. Eating little or none does not cause a deficiency.",
    high: "Foods and drinks rich in added sugars can make it harder to meet nutrient needs within your energy needs.",
    source: sugars,
  },
  calcium: {
    foods: [
      "Yogurt",
      "Calcium-set tofu",
      "Sardines with edible bones",
      "Calcium-fortified soy milk",
    ],
    role: "Calcium builds bones and teeth and helps muscles contract and nerves send signals.",
    low: "If intake stays low, your body can draw calcium from bone. Over time this can weaken bones.",
    high: "Excessive calcium intake, especially from supplements, may increase kidney stone risk in some people.",
    source: ods("Calcium"),
  },
  iron: {
    foods: ["Clams", "Beef", "Lentils", "Iron-fortified breakfast cereal"],
    role: "Iron is part of hemoglobin, the protein that carries oxygen in red blood cells.",
    low: "Once iron stores are depleted, iron-deficiency anemia can develop and cause tiredness or weakness.",
    high: "High-dose iron supplements can cause nausea or constipation. People with iron overload can accumulate enough iron to damage organs.",
    source: ods("Iron"),
  },
  magnesium: {
    foods: ["Pumpkin seeds", "Almonds", "Spinach", "Black beans"],
    role: "Magnesium helps muscles and nerves work and helps the body make protein and bone.",
    low: "Long-lasting deficiency can cause weakness and, when more severe, muscle cramps or abnormal heart rhythms.",
    high: "Healthy kidneys usually remove excess magnesium from food. High doses from supplements or laxatives can cause diarrhea; their upper limit is not a food limit.",
    source: ods("Magnesium"),
  },
  potassium: {
    foods: ["Baked potatoes", "White beans", "Dried apricots", "Lentils"],
    role: "Potassium helps nerves transmit signals and muscles, including the heart, contract.",
    low: "Low blood potassium can cause weakness or abnormal heart rhythms. Fluid losses and some medicines can cause it; a food log cannot diagnose it.",
    high: "When kidneys cannot clear potassium well, or with certain medicines, potassium can build up and disrupt heart rhythm. Supplements and potassium-based salt substitutes can add substantial amounts.",
    source: ods("Potassium"),
  },
  vitaminK: {
    foods: ["Kale", "Spinach", "Collard greens", "Broccoli"],
    role: "Vitamin K helps make proteins needed for normal blood clotting and bone health.",
    low: "Severe deficiency is uncommon in adults but can cause easy bruising or bleeding.",
    high: "No upper limit has been established. If you take warfarin, sudden changes in vitamin K intake can change how it works; consistency matters more than avoiding greens.",
    source: ods("VitaminK"),
  },
};
