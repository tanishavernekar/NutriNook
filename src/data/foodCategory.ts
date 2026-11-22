import type { Food } from "../model";
import { starterRecipeDishes } from "./starterAdditions";

export const needsCategory = "Needs category";
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// The supplied sheet mixes foods from several groups under the same heading.
const starterShelves: Record<string, string[]> = {
  "Dairy & Protein": [
    "Eggs",
    "A2 Whole Milk",
    "Kirkland Yogurt",
    "Salmon Fillet",
    "Golden Pompano",
    "Chicken Drumstick",
    "Chicken Breast (Cooked)",
    "Chicken Breast",
    "Canned Tuna (in water)",
  ],
  "Fruits & Berries": [
    "Banana Cavendish",
    "Apple (H.C./Gala)",
    "Blueberries",
    "Avocado",
    "Paayri Mango",
    "Green Grapes",
    "Sweet Lemon (Mosambi)",
    "Sweet Cherries",
    "Strawberries",
    "Blackberries",
    "Raspberries",
    "Guava",
    "Papaya",
    "Pomegranate",
  ],
  Vegetables: [
    "Carrot",
    "Cucumber",
    "Red Onion",
    "White Onion",
    "Russet Potato",
    "Beetroot",
    "Spinach",
    "Broccoli",
    "Green Peas (Cooked)",
    "Green Peas",
    "Tomato",
    "Cauliflower",
    "Okra (bhindi)",
    "Red bell pepper",
    "Sweet potato",
    "Green beans",
    "Cabbage",
    "Eggplant",
    "White mushrooms",
    "Dudhi (bottle gourd)",
    "Shevga (drumstick pods)",
    "Bhopla (pumpkin)",
    "Sweet corn",
    "Maath (amaranth leaves)",
  ],
  "Grains & Bread": [
    "Atta (whole wheat flour)",
    "Rawa (semolina)",
    "Maida (refined wheat flour)",
    "Oatnut Bread",
    "Mirch Masala Roti",
    "Basmati Rice (Cooked)",
    "Basmati Rice",
    "Rolled oats",
    "Quinoa",
    "Pearled barley",
    "Brown rice (long-grain)",
    "Kuttu (buckwheat groats)",
    "Ragi Powder",
  ],
  "Nuts & Seeds": [
    "Walnuts",
    "Pistachios",
    "Pecan Halves",
    "Cashews",
    "Sunflower Seeds",
    "Peanuts",
    "Almonds",
    "Almonds (Normal)",
    "Almonds (Soaked/Peeled)",
  ],
  "Lentils & Legumes": [
    "Toor Dal (Cooked)",
    "Toor Dal",
    "Chole",
    "Lobia",
    "Rajma",
    "Green Moong (Whole)",
    "Soya Chunks (Cooked)",
    "Edamame (Cooked)",
    "Edamame",
    "Akha moong (whole green mung)",
    "Lentils",
    "Masoor dal (red lentils)",
    "Mod alele moog (long mung sprouts)",
    "Matki (moth beans)",
    "Whole urad (black gram)",
    "Black beans",
    "Lima beans (large)",
  ],
  "Everyday Essentials": ["Avocado Oil", "Ghee", "Olive Oil", "White Sugar", "Fresh grated coconut", "Coconut milk"],
  Dishes: [
    ...starterRecipeDishes,
    "Cranberry Walnut Chicken Salad (Panera)",
    "Smokehouse BBQ Chicken (Panera)",
    "Pizza Melt (Potbelly)",
    "Moong Dal Chilla",
    "Chana Masala",
    "Qdoba Chicken Bowl",
  ],
};
const starterByName = new Map(
  Object.entries(starterShelves).flatMap(([category, names]) =>
    names.map((name) => [normalize(name), category] as const),
  ),
);
export const starterCategory = (name: string) =>
  starterByName.get(normalize(name));

// Match the food at the end of a description, not an ingredient anywhere in it:
// "apple juice", "apple chips" and "apple" belong on different shelves.
const groups: [string, RegExp][] = [
  [
    needsCategory,
    /\b(juice|smoothies?|coffee(?: beans?)?|tea|water|sodas?|lemonade|drinks?|shakes?|(?:almond|oat|soy|soya|cashew|coconut|rice) milk)$/,
  ],
  [
    "Snacks & Treats",
    /\b(ice cream|cookies?|biscuits?|cakes?|brownies?|muffins?|candy|candies|chocolates?|chips|crisps|popcorn|pretzels?|crackers?|(?:energy|granola|protein) bars?)$/,
  ],
  [
    "Nuts & Seeds",
    /\b((?:peanut|almond|cashew|sunflower seed) butter|tahini|almonds?|walnuts?|pecans?|cashews?|pistachios?|peanuts?|hazelnuts?|macadamias?|seeds?|flaxseed|chia)$/,
  ],
  [
    "Everyday Essentials",
    /\b(oils?|ghee|butter|salt|(?:black|white|ground|cayenne) pepper|peppercorns?|sugar|honey|vinegar|syrup|spices?|cumin|paprika|turmeric|cinnamon|seasoning)$/,
  ],
  ["Vegetables", /\b(cauliflower rice|spaghetti squash)$/],
  [
    "Grains & Bread",
    /\b(rice|quinoa|oats?|oatmeal|barley|millet|bulgur|couscous|pasta|spaghetti|noodles?|bread|bagels?|tortillas?|pita|naan|roti|chapati|flour|ragi|granola|cereal)$/,
  ],
  [
    "Vegetables",
    /\b(green beans?|green peas|snap peas|snow peas|carrots?|kale|spinach|broccoli|cauliflower|lettuce|cabbage|celery|chard|arugula|potato(?:es)?|tomato(?:es)?|peppers?|onions?|cucumbers?|zucchini|squash|eggplants?|beets?|beetroots?|mushrooms?|asparagus|artichokes?|pumpkin|bok choy|okra|garlic|leeks?|radishes|turnips?|corn)$/,
  ],
  [
    "Lentils & Legumes",
    /\b(lentils?|beans?|chickpeas?|garbanzos?|split peas|dal|daal|dhal|chana|chole|rajma|lobia|moong|edamame|tempeh|tofu|soya chunks|hummus)$/,
  ],
  [
    "Dairy & Protein",
    /\b(eggs?|milk|yogh?urt|kefir|cheese|paneer|cheddar|mozzarella|ricotta|fish|salmon|pompano|tuna|cod|haddock|trout|sardines?|tilapia|halibut|shrimp|prawns?|beef|steak|pork|lamb|turkey|chicken)(?: (?:fillets?|filets?|breasts?|thighs?|drumsticks?|wings?))?$/,
  ],
  [
    "Fruits & Berries",
    /\b(apples?|pears?|bananas?|avocados?|mango(?:es|s)?|oranges?|mandarins?|lemons?|limes?|grapes?|grapefruits?|peach(?:es)?|plums?|apricots?|cherr(?:y|ies)|(?:blue|black|rasp|straw|cran|mul)?berr(?:y|ies)|kiwis?|melons?|watermelons?|papayas?|pineapples?|guavas?|figs?|dates?|raisins?|pomegranates?)$/,
  ],
];

export function inferFoodCategory(
  name: string,
  categories: string[],
  foods: Food[],
  omitId?: string,
) {
  const key = normalize(name);
  const matches = new Set(
    foods
      .filter(
        (f) =>
          f.id !== omitId &&
          f.category !== needsCategory &&
          categories.includes(f.category) &&
          normalize(f.name) === key,
      )
      .map((f) => f.category),
  );
  if (matches.size === 1) return [...matches][0];
  const reviewed = starterByName.get(key);
  if (!matches.size && reviewed && categories.includes(reviewed))
    return reviewed;
  if (matches.size || /\b(with|and|blend|mix)\b|[&+]/i.test(name))
    return needsCategory;
  const food = key
    .replace(
      /\b(fresh|frozen|raw|cooked|roasted|grilled|baked|boiled|steamed|canned|drained|unsalted|boneless|skinless|chopped|sliced|diced|peeled|organic|halves)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const group = groups.find(([, pattern]) => pattern.test(food))?.[0];
  return (
    categories.find((c) => c.toLowerCase() === group?.toLowerCase()) ??
    needsCategory
  );
}
