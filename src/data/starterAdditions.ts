const revision3 = [
  "Brown rice (long-grain)",
  "Maath (amaranth leaves)",
  "Kuttu (buckwheat groats)",
  "Lima beans (large)",
];

const revision4 = [
  "Vada pav",
  "Pav bhaji",
  "Veggie pulav",
  "Chicken biryani",
  "Chicken curry with dosa",
  "Chicken curry",
  "Plain dosa",
  "Masala dosa",
  "Veggie poha",
];

const revision5 = [
  "Idli",
  "Sambar",
  "Rava upma",
  "Khaman dhokla",
  "Plain khichdi",
  "Sabudana khichdi",
  "Palak paneer",
  "Egg curry",
  "Cucumber raita",
  "Rice kheer",
];

const revision6 = ["Misal pav", "Aloo samosa", "Pani puri", "Shev puri"];

const revision7Dishes = [
  "Thai chicken fried rice",
  "Massaman curry",
  "Fish taco",
  "Chicken taco",
  "Fried prawns",
  "Fried fish",
  "Chicken wings",
  "Black bean burger",
  "Chicken burger (fried fillet)",
  "Chicken burger (shredded)",
  "Veggie pizza",
];
const revision9Dishes = [
  "Aloo paratha", "Methi thepla", "Plain uttapam", "Aloo gobi",
  "Matar paneer", "Dal makhani", "Dahi bhaat (curd rice)",
];
const revision9 = [...revision9Dishes, "Papaya", "Pomegranate", "Walnuts", "Pistachios"];
const revision10 = [
  "Atta (whole wheat flour)", "Rawa (semolina)", "Maida (refined wheat flour)",
  "Fresh grated coconut", "Coconut milk",
];
const revision11Dishes = ["Jola bhakri", "Chapati", "Naan", "Butter naan"];
export const latestStarterRevision = 11;
export const starterRecipeDishes = [...revision4, ...revision5, ...revision6, ...revision7Dishes, ...revision9Dishes, ...revision11Dishes];

// Used only for additive upgrades from the original 78-food catalog onward.
export function introducedIn(name: string) {
  if (revision11Dishes.includes(name)) return 11;
  if (revision10.includes(name)) return 10;
  if (revision9.includes(name)) return 9;
  if (revision7Dishes.includes(name)) return 7;
  if (revision6.includes(name)) return 6;
  if (revision5.includes(name)) return 5;
  if (revision4.includes(name)) return 4;
  if (revision3.includes(name)) return 3;
  return 2;
}
