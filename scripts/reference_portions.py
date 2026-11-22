"""Customary portions for unambiguous SR preparations without a labeled serving.

FDA: 21 CFR 101.12(b), table 2. USDA meat/poultry: 9 CFR 317.312 / 381.412.
An arbitrary household measure in SR is a conversion, not a serving.
"""
import re


def customary(cat, name, weights):
    name = name.lower()
    head = name.split(",")[0]
    grams = None
    basis = "fda"

    def volume(unit, count):
        weight = weights.get(unit)
        return weight * count if weight else None

    if name.startswith("spices,"):
        grams = volume("tsp", 0.25)
    elif cat == "16" and "mature seeds, cooked, boiled" in name:
        grams = 90
    elif head in {"tofu", "tempeh"} and not re.search("dried|dessert|fried|yogurt|spread|salted and fermented", name):
        grams = 85
    elif cat == "12" and head in {"nuts", "seeds"}:
        if "butter" in name or "tahini" in name:
            grams = volume("tbsp", 2)
        elif "flour" in name:
            grams = 15
        elif not re.search("milk|water|cream|paste|oil,|liquid|juice|meal|defatted", name):
            grams = 30
    elif head == "peanut butter":
        grams = volume("tbsp", 2)
    elif head == "peanuts" and not re.search("flour|oil,|spread", name):
        grams = 30
    elif head == "yogurt" and not re.search("frozen|coated|drink", name):
        grams = 170
    elif head == "cheese" and not re.search("powder|dry cottage|sauce|grated|substitute", name):
        grams = 110 if "cottage" in name else 55 if "ricotta" in name else 30
    elif head == "egg" and "whole, cooked" in name:
        grams = 110 if re.search("scrambled|omelet", name) else 50
    elif head in {"oil", "butter", "margarine"} and "spray" not in name:
        grams = volume("tbsp", 1)
    elif head == "milk" and "fluid" in name and "cream" not in name:
        grams = volume("cup", 1)
    elif head in {"pasta", "rice", "quinoa", "barley", "spaghetti", "macaroni"} and ", cooked" in name and not re.search("mix|sauce|soup|stuffed", name):
        grams = 140
    elif cat == "8" and "wheat germ" in name and "toasted, plain" in name:
        grams = 15
    elif cat == "8" and head == "cereals ready-to-eat" and weights.get("cup"):
        cup = weights["cup"]
        # High-fiber cereals have a separate rule regardless of cup weight.
        grams = 40 if weights.get("fiber", 0) >= 28 else 15 if cup < 20 else 40 if cup < 43 else 60
    elif cat == "9" and re.search(r", raw\b", name) and not re.search("peel|zest|juice|garnish|ground|tamarind|rose.hip", name):
        grams = 50 if head in {"avocados", "cranberries", "lemons", "limes"} else 280 if head == "watermelon" else 140
    elif head in {"raisins", "dates"} or (cat == "9" and ", dried" in name and not re.search("powder|stewed|juice|dehydrated", name)):
        grams = 40
    elif cat == "11" and head in {
        "spinach", "kale", "carrots", "broccoli", "cauliflower", "lettuce", "mushrooms", "cabbage",
        "asparagus", "eggplant", "squash", "collards", "chard", "peas", "beets", "turnip greens",
        "green beans", "cucumber", "onions", "tomatoes", "okra", "artichokes", "brussels sprouts",
    } and not re.search("sauce|canned|dried|powder|sprout|dehydrated|pickled|babyfood|green onion|spring|scallion", name) and re.search(r", (raw|cooked, boiled)\b", name):
        grams = 85
    elif head in {"potatoes", "sweet potato"} and re.search(r", (baked|boiled)\b", name) and not re.search("skin only|skin,|sauce|cream|mashed|stuffed|peel only", name.replace("flesh and skin,", "")):
        grams = 110
    elif head == "fish" and re.search(r", cooked, (dry|moist) heat", name):
        grams = 85
    elif cat in {"5", "10", "13", "17"} and ", cooked," in name and (
        "separable lean" in name or "meat only" in name or "meat and skin" in name or "ground," in name
    ) and not re.search("bacon|sausage|sauce|breaded|luncheon|patties, breakfast", name):
        grams, basis = 85, "poultry" if cat == "5" else "meat"
    elif head == "soup" and re.search("ready.to.serve|prepared with", name):
        grams = 245
    elif head in {"cookies", "bagels", "tortillas", "waffles"} and not re.search("mix|dough|crumb|chip|filling", name):
        grams = {"cookies": 30, "bagels": 110, "tortillas": 55, "waffles": 85}[head]
    return {"grams": grams, "basis": basis} if grams else None
