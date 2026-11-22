import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  fmt,
  keys,
  MIN_INGREDIENT_AMOUNT,
  nextPortion,
  labels,
  nutrients,
  stamp,
  stepIngredient,
  uid,
  unit,
  type Dish,
  type Entry,
  type Food,
  type Kitchen,
} from "./model";
import { categoryIcon } from "./categoryIcons";
import { useArtworkTheme } from "./theme";
import { BookTabIcon, bookTabs, FavoriteHeart } from "./BookTabIcon";
import { inferFoodCategory, needsCategory } from "./data/foodCategory";
type Props = {
  data: Kitchen;
  day: Entry[];
  add: (f: Food, q?: number) => void;
  remove: (e: Entry) => void;
  edit: (f?: Food) => void;
  fav: (f: Food) => void;
  dish: (d?: Dish) => void;
  serve: (d: Dish) => void;
  tabSound: () => void;
  stepSound: () => void;
};
const categoryRank = (name: string) =>
  name === needsCategory ? 0 : name === "Dairy & Protein" ? 1 : 2;
export function Library({
  data,
  day,
  add,
  remove,
  edit,
  fav,
  dish,
  serve,
  tabSound,
  stepSound,
}: Props) {
  const { sprites } = useArtworkTheme();
  const [tab, setTab] = useState("Category"),
    [query, setQuery] = useState(""),
    [amounts, setAmounts] = useState<Record<string, string>>({}),
    [open, setOpen] = useState<string[]>([]);
  const bookRef = useRef<HTMLElement>(null);
  const recent = [
    ...new Set(
      [...data.entries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((e) => e.food.id),
    ),
  ];
  const term = query.trim().toLowerCase();
  const foods = data.foods
    .filter(
      (f) =>
        !f.archived &&
        (term
          ? `${f.name} ${f.brand} ${f.category}`.toLowerCase().includes(term)
          : (tab !== "Favorites" || f.favorite) &&
            (tab !== "Recents" || recent.includes(f.id))),
    )
    .sort((a, b) =>
      !term && tab === "Recents"
        ? recent.indexOf(a.id) - recent.indexOf(b.id)
        : a.name.localeCompare(b.name),
    );
  const dishes = data.dishes.filter((d) => d.name.toLowerCase().includes(term));
  const dishFoods = foods.filter(
      (f) =>
        f.category === "Dishes" ||
        (f.type === "dish" && !data.categories.includes(f.category)),
    ),
    dishCount = dishFoods.length + (tab === "Category" ? dishes.length : 0);
  const shown = data.categories
      .filter((c) => c !== "Dishes" && foods.some((f) => f.category === c))
      .sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b)),
    groups = dishCount ? ["Dishes", ...shown] : shown,
    allOpen = groups.length > 0 && groups.every((c) => open.includes(c));
  useLayoutEffect(() => {
    const book = bookRef.current;
    const list = book?.querySelector<HTMLElement>(".list");
    if (!book || !list || tab !== "Category" || term) return;
    const headings = [...list.querySelectorAll("details > summary")];
    const fitIndex = () => {
      const frame = book.getBoundingClientRect().height - list.clientHeight;
      const index = headings.reduce(
        (height, el) => height + el.getBoundingClientRect().height,
        0,
      );
      book.style.setProperty("--index-height", `${Math.ceil(frame + index)}px`);
    };
    fitIndex();
    const observer = new ResizeObserver(fitIndex);
    observer.observe(list);
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [tab, term, data.foods, data.categories, data.dishes]);
  const group = (
    key: string,
    label: string,
    count: number,
    children: ReactNode,
  ) => (
    <details
      key={key}
      open={open.includes(key)}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen((o) =>
          isOpen === o.includes(key)
            ? o
            : isOpen
              ? [...o, key]
              : o.filter((x) => x !== key),
        );
      }}
    >
      <summary>
        <img className="cat-icon" src={categoryIcon(label, sprites)} alt="" />
        {label}
        <small>{count}</small>
        <ChevronDown size={16} />
      </summary>
      {children}
    </details>
  );
  const wholeDishes = data.foods
    .filter(
      (f) => (f.type === "dish" || f.category === "Dishes") && !f.archived,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const dishRow = (d: Dish) => (
    <div className="between" key={d.id}>
      <button onClick={() => serve(d)}>＋ {d.name}</button>
      <button aria-label={`Edit ${d.name}`} onClick={() => dish(d)}>
        <Pencil size={15} />
      </button>
    </div>
  );
  const row = (f: Food) => {
    const e = day.filter((e) => e.food.id === f.id).at(-1),
      q = Number(amounts[f.id] ?? f.quantity),
      valid = Number.isFinite(q) && q > 0;
    return (
      <div className="foodrow" key={f.id}>
        <button
          className={"check " + (e ? "checked" : "")}
          aria-label={`${e ? "Remove one" : "Add"} ${f.name}`}
          aria-pressed={!!e}
          disabled={!e && !valid}
          onClick={() => (e ? remove(e) : add(f, q))}
        >
          {e ? <Check size={19} /> : <Plus size={17} />}
        </button>
        <button className="foodname" onClick={() => edit(f)}>
          {f.name}
          {f.brand && <small>{f.brand}</small>}
        </button>
        <button
          className="plain"
          aria-label={`Add another ${f.name}`}
          disabled={!valid}
          onClick={() => add(f, q)}
        >
          <Plus size={17} />
        </button>
        <button
          className="plain"
          aria-label={`${f.favorite ? "Unfavorite" : "Favorite"} ${f.name}`}
          aria-pressed={f.favorite}
          onClick={() => fav(f)}
        >
          <FavoriteHeart filled={f.favorite} />
        </button>
        <Portion
          name={f.name}
          unit={f.unit}
          value={amounts[f.id] ?? String(f.quantity)}
          set={(v) => setAmounts({ ...amounts, [f.id]: v })}
          tick={stepSound}
        />
      </div>
    );
  };
  return (
    <section className="book" aria-label="Food library" ref={bookRef}>
      <nav aria-label="Library sections">
        {bookTabs.map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={() => {
              setTab(name);
              tabSound();
            }}
          >
            <BookTabIcon tab={name} />
            {name}
          </button>
        ))}
      </nav>
      <div className="page">
        <div className="search">
          <Search size={19} />
          <input
            aria-label="Search recipe book"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
        </div>
        {!term && tab === "Category" && groups.length > 1 && (
          <button
            className="fold-all"
            aria-expanded={allOpen}
            onClick={() => {
              setOpen(allOpen ? [] : groups);
              tabSound();
            }}
          >
            {allOpen ? (
              <ChevronsDownUp size={16} />
            ) : (
              <ChevronsUpDown size={16} />
            )}
            {allOpen ? "Close all" : "Open all"}
          </button>
        )}
        <div className="list">
          {term ? (
            <>
              <p role="status">
                Whole recipe book: {foods.length}{" "}
                {foods.length === 1 ? "food" : "foods"} and {dishes.length}{" "}
                {dishes.length === 1 ? "dish" : "dishes"} found.
              </p>
              {foods.map(row)}
              {dishes.length > 0 && <h3>Saved dishes</h3>}
              {dishes.map(dishRow)}
            </>
          ) : tab === "Dishes" ? (
            <>
              {wholeDishes.map(row)}
              {dishes.map(dishRow)}
              {!data.dishes.length && !wholeDishes.length && (
                <p>
                  Save a combination of ingredients you cook together, or a
                  whole dish with its own nutrition.
                </p>
              )}
            </>
          ) : tab === "Category" ? (
            groups.map((c) => {
              if (c === "Dishes")
                return group(
                  c,
                  c,
                  dishCount,
                  <>
                    {dishFoods.map(row)}
                    {dishes.map(dishRow)}
                  </>,
                );
              const items = foods.filter((f) => f.category === c);
              return group(c, c, items.length, items.map(row));
            })
          ) : (
            foods.map(row)
          )}
          {!term && tab !== "Dishes" && !foods.length && !dishCount && (
            <p>No matching foods here. Browse Category or add a new food.</p>
          )}
        </div>
      </div>
      <div className="bookhead">
        {tab === "Dishes" && (
          <button className="book-add dish-add" onClick={() => dish()}>
            <Plus size={16} /> Write a dish
          </button>
        )}
        <button className="book-add" onClick={() => edit()}>
          <Plus size={16} /> Add new food
        </button>
      </div>
    </section>
  );
}
export function FoodEditor({
  food,
  foods,
  categories,
  save,
  discard,
  duplicate,
  kind = food?.type ?? "custom",
}: {
  food?: Food;
  foods: Food[];
  kind?: Food["type"];
  categories: string[];
  save: (f: Food) => void;
  discard: (f: Food) => void;
  duplicate: (f: Food) => void;
}) {
  const [f, set] = useState<Food>(
    () =>
      food ?? {
        id: uid(),
        type: kind,
        name: "",
        brand: "",
        category: kind === "dish" ? "Dishes" : needsCategory,
        autoCategory: kind !== "dish",
        quantity: 1,
        unit: "serving",
        nutrients: nutrients(() => null),
        favorite: false,
        archived: false,
        createdAt: stamp(),
        updatedAt: stamp(),
      },
  );
  const field = <K extends keyof Food>(k: K, v: Food[K]) =>
    set({ ...f, [k]: v });
  const whole = f.type === "dish";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (f.name.trim() && f.unit.trim())
          save({
            ...f,
            name: f.name.trim(),
            unit: f.unit.trim(),
            updatedAt: stamp(),
          });
      }}
    >
      <div className="grid">
        <label>
          {whole ? "Dish name" : "Food name"}
          <input
            required
            pattern=".*\S.*"
            value={f.name}
            onChange={(e) => {
              const name = e.target.value;
              set({
                ...f,
                name,
                category:
                  f.autoCategory && !whole
                    ? inferFoodCategory(name, categories, foods, f.id)
                    : f.category,
              });
            }}
          />
        </label>
        {!whole && (
          <>
            <label>
              Brand
              <input
                value={f.brand}
                onChange={(e) => field("brand", e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                aria-label="Category"
                value={f.category}
                onChange={(e) =>
                  set({ ...f, category: e.target.value, autoCategory: false })
                }
              >
                {[...new Set([...categories, f.category])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Reference quantity
          <input
            type="number"
            required
            min=".000001"
            step="any"
            value={f.quantity || ""}
            onChange={(e) => field("quantity", Number(e.target.value))}
          />
        </label>
        <label>
          Serving unit
          <input
            required
            pattern=".*\S.*"
            value={f.unit}
            onChange={(e) => field("unit", e.target.value)}
          />
        </label>
        <label className="food-favorite">
          <input
            type="checkbox"
            checked={f.favorite}
            onChange={(e) => field("favorite", e.target.checked)}
          />
          <FavoriteHeart filled={f.favorite} />
          Favorite
        </label>
      </div>
      <h3>
        {whole ? "Per serving of the whole dish" : "Per reference serving"}
      </h3>
      <p>Leave unknown values blank. Enter 0 only for a known zero.</p>
      <div className="grid">
        {keys.map((k) => (
          <label key={k}>
            {labels[k]} ({unit(k)})
            <input
              type="number"
              step="any"
              min="0"
              value={f.nutrients[k] ?? ""}
              onChange={(e) =>
                field("nutrients", {
                  ...f.nutrients,
                  [k]: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="actions">
        <button className="primary">{whole ? "Save dish" : "Save food"}</button>
        {food && (
          <>
            <button type="button" onClick={() => duplicate(f)}>
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => save({ ...f, archived: !f.archived })}
            >
              {f.archived ? "Unarchive" : "Archive"}
            </button>
            <button type="button" onClick={() => discard(f)}>
              Delete
            </button>
          </>
        )}
      </div>
    </form>
  );
}
export function DishEditor({
  dish,
  foods,
  save,
  discard,
  categories,
  saveWhole,
  start = "ingredients",
}: {
  dish?: Dish;
  foods: Food[];
  save: (d: Dish) => void;
  discard: (d: Dish) => void;
  categories: string[];
  saveWhole: (f: Food) => void;
  start?: "food" | "whole" | "ingredients";
}) {
  const [mode, setMode] = useState(dish ? "ingredients" : start);
  const [name, setName] = useState(dish?.name ?? "");
  const [items, setItems] = useState(dish?.ingredients ?? []);
  const modes = !dish && (
    <div className="dishmode" role="group" aria-label="What are you adding?">
      {(
        [
          ["food", "Food"],
          ["whole", "Whole dish"],
          ["ingredients", "From ingredients"],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  if (mode !== "ingredients")
    return (
      <>
        {modes}
        <p>
          {mode === "whole"
            ? "Name the dish and enter its nutrition per serving."
            : "A single food with its nutrition per reference serving."}
        </p>
        <FoodEditor
          key={mode}
          foods={foods}
          kind={mode === "whole" ? "dish" : "custom"}
          categories={categories}
          save={saveWhole}
          discard={() => {}}
          duplicate={() => {}}
        />
      </>
    );
  return (
    <>
      {modes}
      <Ingredients
        dish={dish}
        foods={foods}
        save={save}
        discard={discard}
        name={name}
        setName={setName}
        items={items}
        setItems={setItems}
      />
    </>
  );
}
function Ingredients({
  dish,
  foods,
  save,
  discard,
  name,
  setName,
  items,
  setItems,
}: {
  dish?: Dish;
  foods: Food[];
  save: (d: Dish) => void;
  discard: (d: Dish) => void;
  name: string;
  setName: (v: string) => void;
  items: Dish["ingredients"];
  setItems: (v: Dish["ingredients"]) => void;
}) {
  const [query, search] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const term = query.trim().toLowerCase();
  const available = foods.filter((f) => !f.archived);
  const matches = available
    .filter((f) => `${f.name} ${f.brand}`.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name));
  const canSave =
    name.trim() &&
    items.length > 0 &&
    items.every(
      (i) => Number.isFinite(i.quantity) && i.quantity >= MIN_INGREDIENT_AMOUNT,
    );
  return (
    <form
      className="ingredient-recipe"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave)
          save({
            id: dish?.id ?? uid(),
            name: name.trim(),
            ingredients: items,
          });
      }}
    >
      <p>
        Choose foods for one serving, then adjust their amounts below. Saving
        keeps the recipe in your book; serving it adds those foods to your
        plate.
      </p>
      <label>
        Dish name
        <input
          required
          pattern=".*\S.*"
          placeholder="e.g. Breakfast bowl"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <section aria-label="Choose ingredients" className="ingredient-picker">
        <label>
          Find an ingredient
          <input
            type="search"
            ref={searchRef}
            value={query}
            placeholder="Search by food or brand"
            onChange={(e) => search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </label>
        <ul className="ingredient-options" aria-label="Matching foods">
          {matches.map((f) => {
            const added = items.some((item) => item.foodId === f.id);
            return (
              <li key={f.id}>
                <span>
                  {f.name}
                  <small>
                    {[f.brand, `${fmt(f.quantity)} ${f.unit}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <button
                  type="button"
                  disabled={added}
                  aria-label={`${added ? "Already added" : "Add ingredient"}: ${f.name}`}
                  onClick={() => {
                    setItems([
                      ...items,
                      { foodId: f.id, quantity: f.quantity },
                    ]);
                    searchRef.current?.focus({ preventScroll: true });
                    searchRef.current?.select();
                  }}
                >
                  {added ? "Added" : "+ Add"}
                </button>
              </li>
            );
          })}
        </ul>
        {!matches.length && (
          <p role="status">
            {available.length
              ? "No matching foods. Try another name or brand."
              : "Add a food to your recipe book first."}
          </p>
        )}
      </section>
      <section aria-labelledby="ingredients-heading">
        <h3 id="ingredients-heading" aria-live="polite">
          In this dish ({items.length})
        </h3>
        {!items.length && (
          <p>Choose a food above to start your ingredient list.</p>
        )}
        <ul className="ingredient-lines">
          {items.map((v, i) => {
            const f = foods.find((f) => f.id === v.foodId)!;
            const setAmount = (quantity: number) =>
              setItems(items.map((x, j) => (i === j ? { ...x, quantity } : x)));
            const lower = stepIngredient(v.quantity, f.quantity, -1);
            const higher = stepIngredient(v.quantity, f.quantity, 1);
            return (
              <li key={`${v.foodId}-${i}`}>
                <span>
                  {f.name}
                  {f.brand && <small>{f.brand}</small>}
                </span>
                <div className="ingredient-quantity">
                  <div className="ingredient-amount">
                    <button
                      type="button"
                      aria-label={`Decrease amount of ${f.name}`}
                      title="Subtract half a reference serving"
                      disabled={lower === v.quantity}
                      onClick={() => setAmount(lower)}
                    >
                      −
                    </button>
                    <input
                      aria-label={`Amount of ${f.name} (${f.unit})`}
                      required
                      step="any"
                      min={MIN_INGREDIENT_AMOUNT}
                      type="number"
                      value={v.quantity || ""}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowUp" && e.key !== "ArrowDown")
                          return;
                        e.preventDefault();
                        setAmount(e.key === "ArrowUp" ? higher : lower);
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Increase amount of ${f.name}`}
                      title="Add half a reference serving"
                      disabled={higher === v.quantity}
                      onClick={() => setAmount(higher)}
                    >
                      +
                    </button>
                  </div>
                  <span className="ingredient-unit">{f.unit}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ingredient: ${f.name}`}
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="actions">
        <button disabled={!canSave} className="primary">
          Save dish
        </button>
        {dish && (
          <button type="button" onClick={() => discard(dish)}>
            Delete dish
          </button>
        )}
      </div>
    </form>
  );
}

/** Serving pill: type, step with arrows, or drag vertically on mobile. */
const DRAG_STEP = 22;
function Portion({
  name,
  unit,
  value,
  set,
  tick,
}: {
  name: string;
  unit: string;
  value: string;
  set: (v: string) => void;
  tick: () => void;
}) {
  const inputId = useId();
  const suppressClick = useRef(false);
  const drag = useRef<{
      pointerId: number;
      y: number;
      from: number;
      steps: number;
      moved: boolean;
    } | null>(null),
    [dragging, setDragging] = useState(false),
    [bump, setBump] = useState(0);
  const walk = (from: number, steps: number) => {
    let q = from;
    for (let i = 0; i < Math.abs(steps); i++)
      q = nextPortion(q, steps > 0 ? 1 : -1);
    return q;
  };
  const go = (q: number) => {
    if (q === Number(value)) return;
    set(String(q));
    setBump((b) => b + 1);
    tick();
  };
  const step = (dir: 1 | -1) => go(nextPortion(Number(value), dir));
  const endDrag = (id: number) => {
    if (drag.current?.pointerId !== id) return;
    drag.current = null;
    setDragging(false);
  };
  return (
    <label
      htmlFor={inputId}
      className={
        "portion" +
        (dragging ? " dragging" : "") +
        (bump ? (bump % 2 ? " bump-a" : " bump-b") : "")
      }
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0) return;
        suppressClick.current = false;
        if (
          (e.pointerType === "mouse" && !window.matchMedia("(max-width: 650px)").matches) ||
          !(e.target instanceof Element) || e.target.closest("button")
        )
          return;
        // Capture on the original target so a plain tap still edits the number.
        e.target.setPointerCapture(e.pointerId);
        drag.current = {
          pointerId: e.pointerId,
          y: e.clientY,
          from: Number(value) || 1,
          steps: 0,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const dy = d.y - e.clientY;
        if (!d.moved && Math.abs(dy) > 6) {
          d.moved = true;
          suppressClick.current = true;
          setDragging(true);
          (document.activeElement as HTMLElement | null)?.blur();
        }
        const steps = Math.trunc(dy / DRAG_STEP);
        if (steps !== d.steps) {
          d.steps = steps;
          go(walk(d.from, steps));
          navigator.vibrate?.(6);
        }
      }}
      onPointerUp={(e) => endDrag(e.pointerId)}
      onPointerCancel={(e) => endDrag(e.pointerId)}
      onLostPointerCapture={(e) => endDrag(e.pointerId)}
      onClickCapture={(e) => {
        if (suppressClick.current && e.detail !== 0) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      <button
        type="button"
        className="portion-step up"
        tabIndex={-1}
        aria-label={`Increase serving of ${name}`}
        onClick={(e) => {
          e.preventDefault();
          step(1);
        }}
      >
        <svg viewBox="0 0 20 14" aria-hidden="true">
          <path d="M10 2 18 12H2Z" />
        </svg>
      </button>
      <input
        id={inputId}
        aria-label={`Serving quantity for ${name}`}
        aria-description={`Unit: ${unit}`}
        type="number"
        min=".000001"
        step="any"
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          step(e.key === "ArrowUp" ? 1 : -1);
        }}
      />
      <span className="portion-unit" title={unit}>
        {unit}
      </span>
      <button
        type="button"
        className="portion-step down"
        tabIndex={-1}
        aria-label={`Decrease serving of ${name}`}
        onClick={(e) => {
          e.preventDefault();
          step(-1);
        }}
      >
        <svg viewBox="0 0 20 14" aria-hidden="true">
          <path d="M10 12 18 2H2Z" />
        </svg>
      </button>
    </label>
  );
}
