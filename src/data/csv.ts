import {
  categoryNames,
  keys,
  labels,
  nutrients,
  positive,
  stamp,
  uid,
  unit,
  type Food,
} from "../model";
import raw from "./pantry.csv?raw";
import { inferFoodCategory, starterCategory } from "./foodCategory";
import { starterRecipeDishes } from "./starterAdditions";
export function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Unclosed quote in CSV.");
  row.push(field.trim());
  rows.push(row);
  return rows.filter((r) => r.some(Boolean));
}
const aliases: Record<string, string[]> = {
  name: ["food item", "food", "name"],
  quantity: ["quantity", "serving"],
  carbohydrates: ["carbs", "carbohydrates"],
  totalSugar: ["sugar", "total sugar"],
};
export const columns = ["name", "quantity", "category", "brand", ...keys];
export function mapping(headers: string[]) {
  return Object.fromEntries(
    columns.map((c) => [
      c,
      headers.findIndex((h) =>
        (aliases[c] ?? [labels[c as keyof typeof labels] ?? c]).some(
          (a) =>
            a.toLowerCase() ===
            h
              .replace(/\s*\([^)]*\)/g, "")
              .trim()
              .toLowerCase(),
        ),
      ),
    ]),
  );
}
export function serving(s: string) {
  const m = /^(\d+(?:\.\d+)?(?:\/\d+)?)\s+(.+)$/.exec(s);
  if (!m) throw Error("Expected a serving such as “0.5 cup”.");
  const [a, b] = m[1].split("/").map(Number);
  return { quantity: positive(a / (b ?? 1)), unit: m[2].trim() };
}
export const sections: Record<string, string> = {
  "EVERYDAY ITEMS": "Everyday Essentials",
  PROTIEN: "Dairy & Protein",
  VEGGIES: "Vegetables",
  NUTS: "Nuts & Seeds",
  FRUITS: "Fruits & Berries",
  ESSENTIALS: "Everyday Essentials",
  LENTILS: "Lentils & Legumes",
  DISHES: "Dishes",
};
export function preview(
  rows: string[][],
  map: Record<string, number>,
  {
    seed = false,
    categories = categoryNames,
    existing = [],
  }: { seed?: boolean; categories?: string[]; existing?: Food[] } = {},
) {
  if (map.name < 0 || map.quantity < 0)
    throw Error("Map both food name and quantity.");
  const foods: Food[] = [],
    errors: string[] = [];
  let group: string | undefined;
  rows.forEach((row, i) => {
    const get = (k: string) => row[map[k]]?.trim() ?? "",
      name = get("name");
    if (!get("quantity") && headingCategory(name, categories)) {
      group = headingCategory(name, categories);
      return;
    }
    try {
      if (!name) throw Error("Missing name.");
      const portion = serving(get("quantity"));
      const brand = get("brand");
      const explicit = get("category") || group;
      const match =
        !explicit &&
        existing.find(
          (f) =>
            f.name.toLowerCase() === name.toLowerCase() &&
            f.brand.toLowerCase() === brand.toLowerCase(),
        );
      const category = seed
        ? starterCategory(name)
        : explicit ||
          (match && match.category) ||
          inferFoodCategory(name, categories, existing);
      if (!category) throw Error(`No reviewed starter category for ${name}.`);
      foods.push({
        id: uid(),
        name,
        brand,
        category,
        ...(!seed && !explicit && (!match || match.autoCategory)
          ? { autoCategory: true }
          : {}),
        ...portion,
        type: !seed ? "custom" : starterRecipeDishes.includes(name) ? "dish" : "individual",
        favorite: false,
        archived: false,
        createdAt: stamp(),
        updatedAt: stamp(),
        nutrients: nutrients((k) => {
          const s = get(k);
          if (!s) return null;
          const v = Number(s);
          if (!Number.isFinite(v) || v < 0)
            throw Error(`Invalid ${labels[k]}.`);
          return v;
        }),
      });
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : e}`);
    }
  });
  return { foods, errors };
}
export function mergeFoods(
  existing: Food[],
  incoming: Food[],
  mode: "skip" | "replace" | "variation",
) {
  const result = [...existing];
  for (const f of incoming) {
    const idx = result.findIndex(
      (x) =>
        x.name.toLowerCase() === f.name.toLowerCase() &&
        x.brand.toLowerCase() === f.brand.toLowerCase(),
    );
    if (idx < 0 || mode === "variation") result.push(f);
    else if (mode === "replace")
      result[idx] = {
        ...f,
        id: result[idx].id,
        createdAt: result[idx].createdAt,
      };
  }
  return result;
}
export function seedFoods(source = raw) {
  const [head, ...rows] = parseCSV(source),
    p = preview(rows, mapping(head), { seed: true });
  if (p.errors.length) throw Error(p.errors.join("\n"));
  return mergeFoods([], p.foods, "skip");
}
export function exportCSV(foods: Food[]) {
  const escape = (v: string | number | null) =>
    `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [
    [
      "Food Item",
      "Quantity",
      "Category",
      "Brand",
      ...keys.map((k) => `${labels[k]} (${unit(k)})`),
    ],
    ...foods.map((f) => [
      f.name,
      `${f.quantity} ${f.unit}`,
      f.category,
      f.brand,
      ...keys.map((k) => f.nutrients[k]),
    ]),
  ]
    .map((r) => r.map(escape).join(","))
    .join("\r\n");
}

/** Column order of the pantry table; also used for pasted rows without headers. */
export const tableColumns = [
  "name",
  "quantity",
  ...keys,
  "category",
  "brand",
] as const;
type TableColumn = (typeof tableColumns)[number];
/** Serving amount as typed in a sheet: 1/3 rather than 0.3333. */
export const amount = (q: number) => {
  if (Number.isInteger(q)) return String(q);
  for (const d of [2, 3, 4, 8]) {
    const n = Math.round(q * d);
    if (Math.abs(q * d - n) < 1e-6) return `${n}/${d}`;
  }
  return String(+q.toFixed(4));
};
export function pantryCell(f: Food, col: TableColumn) {
  if (col === "quantity") return `${amount(f.quantity)} ${f.unit}`;
  if (col === "name" || col === "brand" || col === "category") return f[col];
  return String(f.nutrients[col] ?? "");
}
export function pantryHeading(col: TableColumn) {
  switch (col) {
    case "name":
      return "Food item";
    case "quantity":
      return "Serving";
    case "category":
      return "Category";
    case "brand":
      return "Brand";
    default:
      return `${labels[col]} (${unit(col)})`;
  }
}
export function pantryTSV(
  foods: Food[],
  columns: readonly TableColumn[],
  headers: boolean,
) {
  const rows = foods.map((f) => columns.map((c) => pantryCell(f, c)));
  if (headers) rows.unshift(columns.map(pantryHeading));
  return rows
    .map((row) =>
      row
        .map((value) => {
          // Keep user-entered food names and brands as text, not spreadsheet formulas.
          const text = /^\s*[=+\-@]/.test(value) ? "'" + value : value;
          return /[\t\r\n"]/.test(text)
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        })
        .join("\t"),
    )
    .join("\n");
}
/** A Markdown divider describes alignment; the row above it can still be food data. */
const pipeDivider = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
export function parseClipboard(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim());
  if (normalized.includes("\t"))
    return lines.map((l) => l.split("\t").map((s) => s.trim()));
  if (
    lines.some((l) => pipeDivider.test(l)) ||
    (lines.length > 0 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l)))
  )
    return lines
      .filter((l) => !pipeDivider.test(l))
      .map((l) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split(/(?<!\\)\|/)
          .map((s) => s.trim().replaceAll("\\|", "|")),
      );
  return parseCSV(normalized);
}
/** Matches a sheet section heading such as "PROTIEN" or "Veggies" to a category. */
export function headingCategory(heading: string, categories: string[]) {
  const h = heading.trim().toLowerCase(),
    exact = categories.find((c) => c.toLowerCase() === h);
  if (exact) return exact;
  const known = sections[heading.trim().toUpperCase()];
  if (known) return known;
  const stem = h.slice(0, 4);
  return stem.length < 4
    ? undefined
    : categories.find((c) =>
        c
          .toLowerCase()
          .split(/[^a-z]+/)
          .some((w) => w.startsWith(stem)),
      );
}
/**
 * Turns pasted spreadsheet rows into foods. Headers are optional (otherwise the
 * table's column order is assumed). Rows without a serving are section headings
 * that set the category for the rows below, or are skipped (e.g. "IDEAL RANGE").
 */
export function pastedFoods(
  text: string,
  categories: string[],
  existing: Food[] = [],
) {
  const rows = parseClipboard(text);
  if (!rows.length)
    return { foods: [] as Food[], errors: ["Nothing to paste."] };
  const head = mapping(rows[0]),
    hasHeader = head.name >= 0 && head.quantity >= 0,
    map = hasHeader
      ? head
      : Object.fromEntries(tableColumns.map((c, i) => [c, i])),
    data = hasHeader ? rows.slice(1) : rows,
    cell = (r: string[], c: string) => (map[c] >= 0 ? (r[map[c]] ?? "") : ""),
    known = (c: string) =>
      categories.find((x) => x.toLowerCase() === c.trim().toLowerCase()) ??
      sections[c.trim().toUpperCase()] ??
      c.trim(),
    clean: string[][] = [];
  let group: string | undefined;
  for (const r of data) {
    const name = cell(r, "name");
    if (!name) continue;
    if (!cell(r, "quantity")) {
      group = headingCategory(name, categories) ?? group;
      continue;
    }
    clean.push([
      name,
      cell(r, "quantity"),
      cell(r, "category") ? known(cell(r, "category")) : (group ?? ""),
      cell(r, "brand"),
      ...keys.map((k) =>
        cell(r, k).replace(
          /^(\d{1,3}(?:,\d{3})+)(\.\d+)?$/,
          (_, a, b = "") => a.replaceAll(",", "") + b,
        ),
      ),
    ]);
  }
  const p = preview(
    clean,
    Object.fromEntries(
      ["name", "quantity", "category", "brand", ...keys].map((c, i) => [c, i]),
    ),
    { categories, existing },
  );
  return {
    foods: p.foods,
    errors: p.errors.map((e) =>
      e.replace(/^Row (\d+)/, (_, n) => `“${clean[+n - 2]?.[0] ?? "?"}”`),
    ),
  };
}
/** Adds pasted foods; a food with the same name and brand is updated in place. */
export function upsertFoods(existing: Food[], incoming: Food[]) {
  const foods = [...existing];
  const affected = new Set<string>();
  let added = 0,
    updated = 0;
  for (const f of incoming) {
    const i = foods.findIndex(
      (x) =>
        x.name.toLowerCase() === f.name.toLowerCase() &&
        x.brand.toLowerCase() === f.brand.toLowerCase(),
    );
    if (i < 0) {
      foods.push(f);
      affected.add(f.id);
      added++;
    } else {
      const { id, createdAt, type, favorite, archived } = foods[i];
      foods[i] = { ...f, id, createdAt, type, favorite, archived };
      affected.add(id);
      updated++;
    }
  }
  return { foods, added, updated, affected };
}
