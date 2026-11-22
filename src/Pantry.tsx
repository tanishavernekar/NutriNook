import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Download,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  amount,
  exportCSV,
  pantryTSV,
  pastedFoods,
  serving,
  tableColumns,
  upsertFoods,
} from "./data/csv";
import { PantryCopy } from "./PantryCopy";
import { usePantryDrag } from "./usePantryDrag";
import { usePantryClipboard } from "./pantryClipboard";
import { inferFoodCategory, needsCategory } from "./data/foodCategory";
import { download } from "./shared";
import {
  keys,
  labels,
  nutrients,
  stamp,
  uid,
  unit,
  type Food,
  type Key,
  type Kitchen,
} from "./model";
type SortField = "createdAt" | "name" | "category" | Key;
const isAlphabetical = (field: SortField) =>
  field === "name" || field === "category";
type PantrySort = { field: SortField; direction: "ascending" | "descending" };
const names = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});
const dateAdded = (f: Food) => {
  const time = Date.parse(f.createdAt);
  return Number.isFinite(time) ? time : null;
};
function compareFoods(a: Food, b: Food, { field, direction }: PantrySort) {
  const sign = direction === "ascending" ? 1 : -1;
  if (field === "category")
    return (
      sign * names.compare(a.category, b.category) ||
      names.compare(a.name, b.name) ||
      names.compare(a.brand, b.brand)
    );
  if (field === "name")
    return (
      sign * (names.compare(a.name, b.name) || names.compare(a.brand, b.brand))
    );
  const av = field === "createdAt" ? dateAdded(a) : a.nutrients[field];
  const bv = field === "createdAt" ? dateAdded(b) : b.nutrients[field];
  if (av === null || bv === null)
    return Number(av === null) - Number(bv === null);
  return sign * (av - bv);
}
type Commit = (raw: string) => string | null;
function Cell({
  value,
  label,
  row,
  col,
  numeric,
  commit,
}: {
  value: string;
  label: string;
  row: string;
  col: string;
  numeric?: boolean;
  commit: Commit;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);
  const save = () => {
    if (draft === value) return setError(null);
    setError(commit(draft));
  };
  return (
    <input
      value={draft}
      aria-label={label}
      aria-invalid={error ? true : undefined}
      title={error ?? (col === "name" ? draft : undefined)}
      data-row={row}
      data-col={col}
      inputMode={numeric ? "decimal" : undefined}
      className={numeric ? "num" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Escape") save();
        if (e.key !== "Enter") return;
        e.preventDefault();
        save();
        const cells = [
          ...document.querySelectorAll<HTMLInputElement>(
            `.pantry-sheet input[data-col="${col}"]`,
          ),
        ];
        cells[cells.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1)]?.focus();
      }}
    />
  );
}
const number = (raw: string) => {
  const s = raw.trim().replaceAll(",", "");
  if (!s) return null;
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0) throw Error("Use a number of 0 or more.");
  return v;
};
export function PantryTable({
  data,
  update,
  added,
}: {
  data: Kitchen;
  update: (d: Kitchen) => void;
  added: () => void;
}) {
  const [term, setTerm] = useState(""),
    [copyMode, setCopyMode] = useState(false),
    [sort, setSort] = useState<PantrySort>({
      field: "createdAt",
      direction: "ascending",
    }),
    [msg, note] = useState(""),
    [errors, setErrors] = useState<string[]>([]),
    [focus, setFocus] = useState(""),
    [lastPaste, setLastPaste] = useState<Set<string>>(() => new Set()),
    [pastedOnly, showPastedOnly] = useState(false),
    [selected, setSelected] = useState<Set<string>>(() => new Set()),
    appendBox = useRef<HTMLTextAreaElement>(null),
    grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector<HTMLInputElement>(
      `.pantry-sheet input[data-row="${focus}"][data-col="name"]`,
    );
    el?.focus();
    el?.select();
    el?.scrollIntoView({ block: "nearest" });
    setFocus("");
  }, [focus]);
  const patch = (f: Food, change: Partial<Food>) =>
    update({
      ...data,
      categories:
        change.category && !data.categories.includes(change.category)
          ? [...data.categories, change.category]
          : data.categories,
      foods: data.foods.map((x) =>
        x.id === f.id ? { ...x, ...change, updatedAt: stamp() } : x,
      ),
    });
  const attempt =
    (fn: (raw: string) => void): Commit =>
    (raw) => {
      try {
        fn(raw);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    };
  const paste = (text: string) => {
    let p: ReturnType<typeof pastedFoods>;
    try {
      p = pastedFoods(text, data.categories, data.foods);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)]);
      note("Could not read the pasted table.");
      return false;
    }
    setErrors(p.errors);
    if (!p.foods.length) {
      note(
        "No foods imported. Copy the food name, serving size and nutrient cells together.",
      );
      return false;
    }
    const r = upsertFoods(data.foods, p.foods),
      fresh = r.foods
        .map((f) => f.category)
        .filter((c) => !data.categories.includes(c));
    update({
      ...data,
      foods: r.foods,
      categories: [...data.categories, ...new Set(fresh)],
    });
    added();
    setLastPaste(r.affected);
    const examples = r.foods
      .filter((f) => r.affected.has(f.id))
      .slice(0, 3)
      .map((f) => f.name);
    note(
      `Pasted ${p.foods.length} rows: ${r.added} added, ${r.updated} updated.` +
        ` ${examples.join(", ")}${r.affected.size > examples.length ? ", …" : "."}` +
        (r.added === 0 ? " Matching foods were updated in place." : "") +
        (p.errors.length ? ` ${p.errors.length} skipped.` : ""),
    );
    return true;
  };
  const pasteClipboard = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      note(
        "Clipboard access was blocked. Press ⌘V or Ctrl+V in the blank bottom row.",
      );
      appendBox.current?.focus();
      return;
    }
    paste(text);
  };
  const protectedIds = new Set(
    data.dishes.flatMap((d) => d.ingredients.map((i) => i.foodId)),
  );
  const remove = (foods: Food[], hidden = 0) => {
    const protectedFood = foods.find((f) => protectedIds.has(f.id));
    if (protectedFood) {
      alert(
        `${protectedFood.name} is used in a saved dish. Remove it from the dish first.`,
      );
      return;
    }
    const subject =
      foods.length === 1 ? foods[0].name : `${foods.length} selected foods`;
    const names =
      foods.length > 1
        ? `\n${foods
            .slice(0, 8)
            .map((f) => f.name)
            .join(", ")}${foods.length > 8 ? ", …" : ""}\n`
        : "";
    if (
      !confirm(
        `Delete ${subject} from the pantry?${names}${hidden ? `\n${hidden} selected outside this filter.` : ""}\nLogged entries stay unchanged.`,
      )
    )
      return;
    const ids = new Set(foods.map((f) => f.id));
    update({ ...data, foods: data.foods.filter((f) => !ids.has(f.id)) });
    setSelected((prev) => new Set([...prev].filter((id) => !ids.has(id))));
    const remainingPaste = new Set([...lastPaste].filter((id) => !ids.has(id)));
    setLastPaste(remainingPaste);
    if (!remainingPaste.size) showPastedOnly(false);
    note(`${subject} deleted.`);
  };
  const addRow = () => {
    const f: Food = {
      id: uid(),
      name: "New food",
      brand: "",
      category: needsCategory,
      autoCategory: true,
      quantity: 1,
      unit: "serving",
      type: "custom",
      favorite: false,
      archived: false,
      createdAt: stamp(),
      updatedAt: stamp(),
      nutrients: nutrients(() => null),
    };
    update({
      ...data,
      foods: [...data.foods, f],
      categories: [...new Set([...data.categories, needsCategory])],
    });
    setTerm("");
    showPastedOnly(false);
    setFocus(f.id);
    added();
  };
  const t = term.trim().toLowerCase(),
    rows = data.foods
      .filter(
        (f) =>
          (!pastedOnly || lastPaste.has(f.id)) &&
          (!t ||
            [f.name, f.category, f.brand].some((v) =>
              v.toLowerCase().includes(t),
            )),
      )
      .sort((a, b) => compareFoods(a, b, sort));
  const checkedRows = rows.filter((f) => selected.has(f.id)),
    visibleCount = checkedRows.length,
    allVisible = rows.length > 0 && visibleCount === rows.length,
    hiddenCount = selected.size - visibleCount;
  const viewKey = JSON.stringify([
    copyMode,
    t,
    sort,
    pastedOnly,
    rows.map((f) => f.id),
  ]);
  const drag = usePantryDrag(grid, viewKey),
    clipboard = usePantryClipboard();
  const { bounds } = drag;
  const copyable = !!bounds || visibleCount > 0;
  const copySize = bounds
    ? `${bounds.bottom - bounds.top + 1} × ${bounds.right - bounds.left + 1} cells`
    : `${visibleCount} full ${visibleCount === 1 ? "row" : "rows"}`;
  const copyText = () =>
    bounds
      ? pantryTSV(
          rows.slice(bounds.top, bounds.bottom + 1),
          tableColumns.slice(bounds.left, bounds.right + 1),
          false,
        )
      : pantryTSV(checkedRows, tableColumns, false);
  const selectionHasProtected = [...selected].some((id) =>
    protectedIds.has(id),
  );
  const select = (foods: Food[], checked: boolean) => {
    drag.clear();
    clipboard.reset();
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of foods) {
        if (checked) next.add(f.id);
        else next.delete(f.id);
      }
      return next;
    });
  };
  const ascending = sort.direction === "ascending";
  const orderText =
    sort.field === "createdAt"
      ? ascending
        ? "Oldest first"
        : "Newest first"
      : isAlphabetical(sort.field)
        ? ascending
          ? "A to Z"
          : "Z to A"
        : ascending
          ? "Lowest first"
          : "Highest first";
  const chooseSort = (field: SortField) => {
    setSort({
      field,
      direction:
        field === sort.field
          ? ascending
            ? "descending"
            : "ascending"
          : isAlphabetical(field)
            ? "ascending"
            : "descending",
    });
    if (grid.current) grid.current.scrollTop = 0;
  };
  const DirectionIcon = ascending ? ArrowUp : ArrowDown;
  const headerButton = (field: Exclude<SortField, "createdAt">) => (
    <button
      type="button"
      className="sort-heading"
      onClick={() => chooseSort(field)}
    >
      {field === "name" ? (
        "Food item"
      ) : field === "category" ? (
        "Category"
      ) : (
        <>
          {labels[field]} <small>{unit(field)}</small>
        </>
      )}
      {field === sort.field && <DirectionIcon aria-hidden="true" />}
    </button>
  );
  return (
    <div
      className="pantry-body"
      onCopy={(e) => {
        if (copyMode || !copyable || !(e.target instanceof Element)) return;
        // Inside an editor, the user's text selection takes precedence.
        if (e.target.closest('textarea, select, input:not([type="checkbox"])'))
          return;
        clipboard.native(e, copyText(), `Copied ${copySize}.`);
      }}
      onPaste={(e) => {
        if (copyMode) return;
        const text = e.clipboardData.getData("text/plain");
        if (
          e.target instanceof HTMLInputElement &&
          !/[\t\n]/.test(text.trim()) &&
          !/^\s*\|.*\|\s*$/.test(text)
        )
          return;
        e.preventDefault();
        paste(text);
      }}
    >
      <div
        className="pantry-toolbar"
        role="group"
        aria-label="Pantry table controls"
      >
        <label className="pantry-search">
          <Search aria-hidden="true" />
          <input
            aria-label="Filter pantry table"
            placeholder="Filter foods"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              showPastedOnly(false);
            }}
          />
        </label>
        <div className="pantry-sort">
          <label>
            Sort by
            <select
              value={sort.field}
              onChange={(e) => chooseSort(e.target.value as SortField)}
            >
              <option value="createdAt">Date added</option>
              <option value="name">Food name</option>
              <option value="category">Category</option>
              <optgroup label="Nutrients per serving">
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {labels[k]}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            className="sort-direction"
            type="button"
            title="Reverse sort order"
            aria-label={`Reverse sort order: ${orderText}`}
            onClick={() => chooseSort(sort.field)}
          >
            <DirectionIcon aria-hidden="true" /> {orderText}
          </button>
        </div>
        {!copyMode && (
          <div
            className="pantry-actions"
            role="group"
            aria-label="Manage pantry rows"
          >
            <button className="pantry-add" type="button" onClick={addRow}>
              <Plus aria-hidden="true" /> Add row
            </button>
            <button type="button" onClick={pasteClipboard}>
              <ClipboardPaste aria-hidden="true" /> Paste rows
            </button>
            <button
              type="button"
              onClick={() =>
                download("nutrinook-pantry.csv", exportCSV(data.foods), "text/csv")
              }
            >
              <Download aria-hidden="true" /> Download CSV
            </button>
          </div>
        )}
      </div>
      {copyMode ? (
        <PantryCopy
          key={JSON.stringify([t, sort.field, sort.direction, pastedOnly])}
          foods={rows}
          done={() => setCopyMode(false)}
        />
      ) : (
        <>
          {errors.length > 0 && (
            <details className="paste-errors">
              <summary>{errors.length} rows skipped</summary>
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </details>
          )}
          <div
            className="sheet-scroll edit-scroll"
            ref={grid}
            tabIndex={-1}
            onMouseDownCapture={(e) => {
              clipboard.reset();
              drag.startGesture(e);
            }}
            onDragStart={(e) => {
              if (e.target instanceof HTMLInputElement) e.preventDefault();
            }}
          >
            <table>
              <thead>
                <tr>
                  <th
                    scope="col"
                    aria-sort={
                      sort.field === "name" ? sort.direction : undefined
                    }
                  >
                    <div className="pantry-name-cell">
                      <label className="pantry-check">
                        <input
                          type="checkbox"
                          aria-label="Select all foods in this view"
                          title="Select all visible rows"
                          disabled={!rows.length}
                          checked={allVisible}
                          ref={(el) => {
                            if (el)
                              el.indeterminate =
                                visibleCount > 0 && !allVisible;
                          }}
                          onChange={(e) => {
                            select(rows, e.target.checked);
                            e.currentTarget.focus({ preventScroll: true });
                          }}
                        />
                      </label>
                      {headerButton("name")}
                    </div>
                  </th>
                  <th scope="col">Serving</th>
                  {keys.map((k) => (
                    <th
                      scope="col"
                      key={k}
                      aria-sort={sort.field === k ? sort.direction : undefined}
                    >
                      {headerButton(k)}
                    </th>
                  ))}
                  <th
                    scope="col"
                    aria-sort={
                      sort.field === "category" ? sort.direction : undefined
                    }
                  >
                    {headerButton("category")}
                  </th>
                  <th scope="col">Brand</th>
                  <th scope="col">
                    <span className="visually-hidden">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f, row) => (
                  <tr
                    key={f.id}
                    className={f.archived ? "archived" : undefined}
                    data-selected={selected.has(f.id) || undefined}
                  >
                    <th scope="row" data-copy-cell={drag.selected(row, 0)}>
                      <div className="pantry-name-cell">
                        <label className="pantry-check">
                          <input
                            type="checkbox"
                            aria-label={`Select ${f.name}${f.brand ? ` (${f.brand})` : ""}`}
                            title={`Select the full row for ${f.name}${protectedIds.has(f.id) ? " (protected from deletion)" : ""}`}
                            checked={selected.has(f.id)}
                            onChange={(e) => {
                              select([f], e.target.checked);
                              e.currentTarget.focus({ preventScroll: true });
                            }}
                          />
                        </label>
                        <Cell
                          row={f.id}
                          col="name"
                          label={`Name of ${f.name}`}
                          value={f.name}
                          commit={attempt((raw) => {
                            if (!raw.trim()) throw Error("Name is required.");
                            const name = raw.trim();
                            if (!f.autoCategory) return patch(f, { name });
                            const category = inferFoodCategory(
                              name,
                              data.categories,
                              data.foods,
                              f.id,
                            );
                            patch(f, { name, category });
                            note(
                              category === needsCategory
                                ? `Choose a category for ${name} in the Category column.`
                                : `${name} filed under ${category}.`,
                            );
                          })}
                        />
                      </div>
                    </th>
                    <td data-copy-cell={drag.selected(row, 1)}>
                      <Cell
                        row={f.id}
                        col="quantity"
                        label={`Serving size of ${f.name}`}
                        value={`${amount(f.quantity)} ${f.unit}`}
                        commit={attempt((raw) => patch(f, serving(raw.trim())))}
                      />
                    </td>
                    {keys.map((k, i) => (
                      <td key={k} data-copy-cell={drag.selected(row, i + 2)}>
                        <Cell
                          row={f.id}
                          col={k}
                          numeric
                          label={`${labels[k]} in ${f.name}`}
                          value={String(f.nutrients[k] ?? "")}
                          commit={attempt((raw) =>
                            patch(f, {
                              nutrients: { ...f.nutrients, [k]: number(raw) },
                            }),
                          )}
                        />
                      </td>
                    ))}
                    <td
                      data-copy-cell={drag.selected(
                        row,
                        tableColumns.length - 2,
                      )}
                    >
                      <select
                        aria-label={`Category of ${f.name}`}
                        value={f.category}
                        onChange={(e) =>
                          patch(f, {
                            category: e.target.value,
                            autoCategory: false,
                          })
                        }
                      >
                        {[...new Set([...data.categories, f.category])].map(
                          (c) => (
                            <option key={c}>{c}</option>
                          ),
                        )}
                      </select>
                    </td>
                    <td
                      data-copy-cell={drag.selected(
                        row,
                        tableColumns.length - 1,
                      )}
                    >
                      <Cell
                        row={f.id}
                        col="brand"
                        label={`Brand of ${f.name}`}
                        value={f.brand}
                        commit={attempt((raw) =>
                          patch(f, { brand: raw.trim() }),
                        )}
                      />
                    </td>
                    <td>
                      <button
                        className="row-delete"
                        aria-label={`Delete ${f.name}`}
                        title="Delete"
                        onClick={() => remove([f])}
                      >
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="pantry-append">
                <tr onClick={() => appendBox.current?.focus()}>
                  <th scope="row">
                    <textarea
                      ref={appendBox}
                      rows={1}
                      aria-label="Paste new food rows"
                      placeholder="Paste food rows here…"
                      onKeyDown={(e) => {
                        if (
                          e.key !== "Enter" ||
                          e.shiftKey ||
                          !e.currentTarget.value.trim()
                        )
                          return;
                        e.preventDefault();
                        if (paste(e.currentTarget.value))
                          e.currentTarget.value = "";
                      }}
                    />
                  </th>
                  {["quantity", ...keys, "category", "brand", "delete"].map(
                    (col) => (
                      <td key={col} />
                    ),
                  )}
                </tr>
              </tfoot>
            </table>
            {!rows.length && <p>No foods match “{term}”.</p>}
          </div>
          <div
            className="pantry-bar pantry-selection"
            role="group"
            aria-label="Selected foods"
          >
            <div className="selection-summary" role="status" aria-atomic="true">
              <span>
                {bounds
                  ? copySize
                  : selected.size > 0
                    ? `${selected.size} selected`
                    : `${data.foods.length} food ${data.foods.length === 1 ? "item" : "items"}`}
              </span>
              {!bounds && hiddenCount > 0 && (
                <span title="Selected outside this filter">
                  {hiddenCount} hidden
                </span>
              )}
            </div>
            <button
              className="plain"
              type="button"
              disabled={!copyable}
              title="Copy the highlighted cells or checked visible rows"
              onClick={() => clipboard.write(copyText(), `Copied ${copySize}.`)}
            >
              Copy
            </button>
            <button
              className="plain"
              type="button"
              aria-label="Clear selection"
              disabled={!selected.size && !bounds}
              onClick={() => {
                setSelected(new Set());
                drag.clear();
                clipboard.reset();
              }}
            >
              Clear
            </button>
            <button
              className="plain bulk-delete"
              type="button"
              disabled={!selected.size || selectionHasProtected || !!bounds}
              title={
                selectionHasProtected
                  ? "Foods used in a saved dish cannot be deleted."
                  : undefined
              }
              onClick={() =>
                remove(
                  data.foods.filter((f) => selected.has(f.id)),
                  hiddenCount,
                )
              }
            >
              <Trash2 aria-hidden="true" /> Delete selected
            </button>
          </div>
          <div className="paste-receipt">
            <output aria-live="polite">{clipboard.message || msg}</output>
            {lastPaste.size > 0 && (
              <button
                className="plain"
                type="button"
                onClick={() => {
                  setTerm("");
                  showPastedOnly(!pastedOnly);
                }}
              >
                {pastedOnly ? "Show all foods" : "Show last pasted rows"}
              </button>
            )}
          </div>
          {clipboard.fallback}
          <div className="pantry-bar pantry-copy-entry">
            <button
              className="plain"
              type="button"
              onClick={() => {
                const invalid = grid.current?.querySelector<HTMLInputElement>(
                  'input[aria-invalid="true"]',
                );
                if (invalid) {
                  invalid.focus();
                  note(
                    `Finish editing ${invalid.getAttribute("aria-label")}: ${invalid.title}`,
                  );
                  return;
                }
                setCopyMode(true);
              }}
            >
              Select cells to copy
            </button>
            <p className="sheet-count">
              <span className="pantry-keyboard-hint">Check a box to copy a full row, or drag across cells and press ⌘C / Ctrl+C. Click a value to edit.</span>
              <span className="pantry-touch-hint">Check a row, then tap Copy. Tap a value to edit.</span>{" "}
              Blank nutrients are unavailable, not zero.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
