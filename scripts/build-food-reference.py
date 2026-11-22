"""Build the two offline USDA reference files; see README for downloads."""
import argparse
import csv
import hashlib
import io
import json
import math
import re
import zipfile
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import xlrd
from reference_portions import customary


OUTPUT = Path(__file__).resolve().parents[1] / "public" / "food-reference"
NUTRIENTS = {
    "1008": ("calories", "KCAL"),
    "1003": ("protein", "G"),
    "1079": ("fiber", "G"),
    "1004": ("fat", "G"),
    "1005": ("carbohydrates", "G"),
    "2000": ("totalSugar", "G"),
    "1087": ("calcium", "MG"),
    "1089": ("iron", "MG"),
    "1090": ("magnesium", "MG"),
    "1092": ("potassium", "MG"),
    "1185": ("vitaminK", "UG"),
}


def verify(path, digest):
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError(f"{path}: file differs from the documented USDA release")


def sr_legacy(path):
    verify(path, "b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0")
    with zipfile.ZipFile(path) as z:
        def rows(table):
            name, = (n for n in z.namelist() if n.endswith("/" + table + ".csv"))
            with io.TextIOWrapper(z.open(name), encoding="utf-8", newline="") as f:
                yield from csv.DictReader(f)

        units = {r["id"]: r["unit_name"] for r in rows("nutrient")}
        for id_, (_, unit) in NUTRIENTS.items():
            if units[id_] != unit:
                raise ValueError(f"Unexpected unit for nutrient {id_}")
        records = list(rows("food"))
        foods = {int(r["fdc_id"]): {
            "id": int(r["fdc_id"]), "name": r["description"],
            "values": [None] * len(NUTRIENTS),
        } for r in records}
        indices = {id_: i for i, id_ in enumerate(NUTRIENTS)}
        for r in rows("food_nutrient"):
            i = indices.get(r["nutrient_id"])
            if i is None or not r["amount"].strip():
                continue
            values = foods[int(r["fdc_id"])]["values"]
            value = float(r["amount"])
            if values[i] is not None or not math.isfinite(value) or value < 0:
                raise ValueError(f"Unexpected USDA value: {r}")
            values[i] = int(value) if value.is_integer() else value
        weights = defaultdict(dict)
        for r in rows("food_portion"):
            food = foods[int(r["fdc_id"])]
            name = r["modifier"]
            grams = float(r["gram_weight"])
            if grams > 0 and r["amount"] == "1" and name in {"cup", "tbsp", "tsp"}:
                weights[food["id"]][name] = grams
            if grams > 0 and "portion" not in food and (
                (r["amount"] == "1" and re.match(r"^serving\b", name, flags=re.I))
                or re.search(r"\b1 (?:NLEA )?serving\b", name, flags=re.I)
            ):
                food["portion"] = {"grams": grams, "basis": "sr"}
            # Only unambiguous single measures with a published weight for this food.
            if ("measure" not in food and r["amount"] == "1"
                and r["measure_unit_id"] == "9999" and not r["portion_description"]
                and name in {"cup", "tbsp", "tsp", "slice", "piece", "patty"}
                and float(r["gram_weight"]) > 0):
                food["measure"] = {"name": name, "grams": float(r["gram_weight"])}
        for r in records:
            food = foods[int(r["fdc_id"])]
            if r["food_category_id"] == "3":
                food.pop("portion", None)
                continue
            if "portion" not in food:
                weights[food["id"]]["fiber"] = food["values"][indices["1079"]] or 0
                portion = customary(r["food_category_id"], food["name"], weights[food["id"]])
                if portion:
                    food["portion"] = portion
    return {"keys": [k for k, _ in NUTRIENTS.values()], "foods": list(foods.values())}


def survey_portions(path):
    verify(path, "f1392ee1706010da236cd5283b7dc2bdad9140dd7baf0bc6c360051fac606c17")
    with zipfile.ZipFile(path) as z:
        def rows(table):
            with io.TextIOWrapper(z.open(table + ".csv"), encoding="utf-8", newline="") as f:
                yield from csv.DictReader(f)
        codes = {r["fdc_id"]: int(r["food_code"]) for r in rows("survey_fndds_food")}
        return {codes[r["fdc_id"]]: float(r["gram_weight"]) for r in rows("food_portion")
                if r["modifier"] == "90000" and r["portion_description"] == "Quantity not specified"
                and float(r["gram_weight"]) > 0}


def fped(path, portions):
    verify(path, "fc4b0f65ff538a43cdf79cb8336e1b675d28599e4d3487edc83e4f1254aa9225")
    sheet = xlrd.open_workbook(path).sheet_by_name("FPED_1718")
    headers = sheet.row_values(0)
    code, name, sugar = map(headers.index, ["FOODCODE", "DESCRIPTION", "ADD_SUGARS (tsp. eq.)"])
    foods = []
    for row in range(1, sheet.nrows):
        tsp = sheet.cell_value(row, sugar)
        if not isinstance(tsp, (int, float)) or not math.isfinite(tsp) or tsp < 0:
            raise ValueError(f"Unexpected FPED added sugars in row {row + 1}")
        grams = float(Decimal(str(tsp)) * Decimal("4.2"))
        food = {"id": int(sheet.cell_value(row, code)), "name": sheet.cell_value(row, name), "values": [grams]}
        if food["id"] in portions:
            food["portion"] = {"grams": portions[food["id"]], "basis": "fndds"}
        foods.append(food)
    return {"keys": ["addedSugar"], "foods": foods}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sr_zip", type=Path)
    parser.add_argument("fped_xls", type=Path)
    parser.add_argument("fndds_zip", type=Path)
    args = parser.parse_args()
    files = {"sr-2018": sr_legacy(args.sr_zip), "fped-1718": fped(args.fped_xls, survey_portions(args.fndds_zip))}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        path = OUTPUT / (name + ".json")
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n",
                        encoding="utf-8")
        print(f"{path.name}: {len(data['foods'])} foods")
