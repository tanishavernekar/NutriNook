import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Utensils,
  X,
  CalendarCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { CalendarFlower, NutrientJar, descriptions } from "./Artwork";
import { NutrientBar } from "./NutrientBar";
import { FoodSources } from "./FoodSources";
import { nutrientGuides } from "./data/nutrientGuides";
import {
  convert,
  fmt,
  getNutrientVisualStatus,
  keys,
  labels,
  localDate,
  parseDate,
  scaled,
  totals,
  unit,
  type Entry,
  type Food,
  type Dish,
  type Goals,
  type Key,
} from "./model";
/** Nutrients shown on the shelf, in shelf order. */
export const shelfKeys = (goals: Goals) =>
  keys.filter((k) => k !== "addedSugar" || goals[k]);
export type NutrientView = "breakdown" | "guide" | "sources";
/** Swipeable jar detail card: touch swipe, side chevrons and arrow keys. */
export function NutrientCards({
  k,
  date,
  view,
  dive,
  entries,
  goals,
  go,
}: {
  k: Key;
  date: string;
  view: NutrientView;
  dive: () => void;
  entries: Entry[];
  goals: Goals;
  go: (k: Key) => void;
}) {
  const list = shelfKeys(goals),
    i = Math.max(0, list.indexOf(k)),
    at = (d: number) => list[(i + d + list.length) % list.length],
    [dir, setDir] = useState(0),
    start = useRef<{ x: number; y: number } | null>(null),
    step = (d: number) => {
      setDir(d);
      go(at(d));
    },
    latest = useRef(step);
  latest.current = step;
  const body = useRef<HTMLDivElement>(null);
  const previousView = useRef(view);
  useEffect(() => {
    if (view === "sources")
      body.current?.querySelector<HTMLElement>(".source-deep-dive")?.focus();
    else if (previousView.current === "sources" && view === "guide")
      body.current?.querySelector<HTMLButtonElement>(".dive-deeper")?.focus();
    previousView.current = view;
  }, [view]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") latest.current(-1);
      if (e.key === "ArrowRight") latest.current(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {[-1, 1].map((d) => (
        <button
          key={d}
          className={"card-step " + (d < 0 ? "prev" : "next")}
          aria-label={`${d < 0 ? "Previous" : "Next"} nutrient: ${labels[at(d)]}`}
          onClick={() => step(d)}
        >
          {d < 0 ? <ChevronLeft /> : <ChevronRight />}
        </button>
      ))}
      <div
        id="nutrient-page"
        ref={body}
        key={`${k}:${view}`}
        className="card-body"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse")
            start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const dx = e.clientX - s.x,
            dy = e.clientY - s.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy))
            step(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (start.current = null)}
      >
        <div
          className={
            "card-page " + (dir > 0 ? "from-right" : dir < 0 ? "from-left" : "")
          }
        >
          {view === "sources" ? (
            <section
              className="nutrient-guide source-deep-dive"
              tabIndex={-1}
              aria-label={`${labels[k]} food source deep dive`}
            >
              <FoodSources nutrient={k} goal={goals[k]} date={date} />
            </section>
          ) : view === "guide" ? (
            <NutrientGuide nutrient={k} dive={dive} />
          ) : (
            <Breakdown k={k} entries={entries} goals={goals} />
          )}
        </div>
      </div>
      <p className="card-count" aria-hidden="true">
        {i + 1} / {list.length}
      </p>
    </>
  );
}
function NutrientGuide({
  nutrient,
  dive,
}: {
  nutrient: Key;
  dive: () => void;
}) {
  const { role, foods, low, high, source } = nutrientGuides[nutrient];
  return (
    <section
      className="nutrient-guide"
      aria-label={`${labels[nutrient]} guide`}
    >
      <h3>What it does</h3>
      <p>{role}</p>
      <div className="guide-source-heading">
        <h3>
          {nutrient === "calories" ? "Energy-dense foods" : "Rich food sources"}
        </h3>
        <button type="button" className="dive-deeper" onClick={dive}>
          Dive deeper <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <ul className="guide-food-chips" aria-label="Featured food sources">
        {foods.map((food) => (
          <li key={food}>{food}</li>
        ))}
      </ul>
      <h3>Too little</h3>
      <p>{low}</p>
      <h3>Too much</h3>
      <p>{high}</p>
      <p className="guide-footnote">
        One day’s plate cannot diagnose a deficiency or excess.{" "}
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.name} ↗
        </a>
      </p>
    </section>
  );
}
export function Shelf({
  entries,
  goals,
  detail,
  celebrating,
}: {
  entries: Entry[];
  goals: Goals;
  detail: (k: Key) => void;
  celebrating: Key[];
}) {
  const rail = useRef<HTMLDivElement>(null);
  return (
    <section className="shelfscene" aria-label="Nutrient shelf">
      <div className="sceneheading">
        <div className="arrows">
          {[-1, 1].map((dir) => (
            <button
              key={dir}
              aria-label={dir < 0 ? "Previous jars" : "More jars"}
              onClick={() => rail.current?.scrollBy({ left: dir * 280 })}
            >
              {dir < 0 ? <ChevronLeft /> : <ChevronRight />}
            </button>
          ))}
        </div>
      </div>
      <div className="shelfrow">
        <div
          className="shelfrail"
          ref={rail}
          tabIndex={0}
          aria-label="Scrollable nutrient jars"
        >
          {shelfKeys(goals).map((k) => {
            const { sum, missing } = totals(entries, k),
              s = getNutrientVisualStatus(sum, goals[k], missing);
            return (
              <button
                key={k}
                className={"jar " + (celebrating.includes(k) ? "spark" : "")}
                aria-label={`${labels[k]}: ${fmt(sum)} ${unit(k)}, ${s.text}${s.percent === null ? "" : `, ${missing ? "at least " : ""}${s.percent}% of reference`}`}
                onClick={() => detail(k)}
              >
                <NutrientJar
                  nutrient={k}
                  label={k === "carbohydrates" ? "Carbs" : labels[k]}
                  value={
                    s.percent === null
                      ? `${fmt(sum)} ${unit(k)}`
                      : `${missing ? "≥" : ""}${s.percent}%`
                  }
                  color={s.color}
                  fill={s.fill}
                  marker={goals[k]?.kind}
                />
                <span className="visually-hidden">{s.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
export function Plate({
  entries,
  date,
  viewAll,
  calendar,
  remove,
  clear,
  label,
  quantity,
  today,
}: {
  entries: Entry[];
  date: string;
  viewAll: () => void;
  calendar: () => void;
  today: () => void;
  remove: (e: Entry) => void;
  clear: () => void;
  label: (e: Entry) => void;
  quantity: (e: Entry) => void;
}) {
  const d = parseDate(date);
  const now = localDate();
  const away = date !== now;
  const listButton = useRef<HTMLButtonElement>(null);
  return (
    <section
      className={away ? "plate away" : "plate"}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest("button")
        ) {
          listButton.current?.focus({ preventScroll: true });
          viewAll();
        }
      }}
    >
      <button
        className="wallcalendar"
        aria-label={`Open calendar for ${date}`}
        onClick={calendar}
      >
        <b>{d.toLocaleDateString(undefined, { weekday: "short" })}</b>
        <strong>
          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </strong>
        <span>{d.getFullYear()}</span>
      </button>
      <div className={away ? "sectiontitle" : "visually-hidden"}>
        <Utensils />
        <h2>
          {away
            ? `${d.toLocaleDateString(undefined, { month: "long", day: "numeric" })}’s plate`
            : "Today’s plate"}
        </h2>
        {away && (
          <>
            <span className="daytag">
              {date < now ? "Past day" : "Upcoming day"}
            </span>
            <button className="todaybtn" onClick={today}>
              <CalendarCheck aria-hidden="true" />
              Back to today
            </button>
          </>
        )}
        <small>
          {entries.length} {entries.length === 1 ? "ENTRY" : "ENTRIES"}
        </small>
      </div>
      <div className="pills" tabIndex={0}>
        {!entries.length ? (
          <div className="empty">
            <span className="saucer" aria-hidden="true" />
            Your plate is ready. Pick something from the recipe book!
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className={`pill ${e.dish ? "dish" : e.food.type}`}>
              <button
                aria-label={`Remove ${e.food.name}`}
                onClick={() => remove(e)}
              >
                <X size={17} aria-hidden="true" />
              </button>
              <button
                aria-label={`View nutrition for ${e.food.name}`}
                onClick={() => label(e)}
              >
                {e.food.name}
              </button>
              <button
                aria-label={`Change quantity of ${e.food.name}`}
                onClick={() => quantity(e)}
              >
                {fmt(e.quantity)} {e.food.unit}
              </button>
            </div>
          ))
        )}
        {entries.length > 1 && (
          <button
            className="clearplate"
            aria-label={`Remove all ${entries.length} foods from the plate`}
            onClick={clear}
          >
            Clear all
          </button>
        )}
      </div>
      <button
        ref={listButton}
        className="plate-list-button"
        aria-haspopup="dialog"
        onClick={viewAll}
      >
        View all ({entries.length})
      </button>
    </section>
  );
}
export function PlateList({
  date,
  entries,
  foods,
  dishes,
  add,
  serve,
  change,
  remove,
  undo,
}: {
  date: string;
  entries: Entry[];
  foods: Food[];
  dishes: Dish[];
  add: (food: Food, quantity: number) => void;
  serve: (dish: Dish) => void;
  change: (entry: Entry, quantity: number) => void;
  remove: (entry: Entry) => void;
  undo?: () => void;
}) {
  const [selected, select] = useState("");
  const [editing, edit] = useState<string | null>(null);
  const picker = useRef<HTMLSelectElement>(null);
  const food = foods.find((f) => !f.archived && `food:${f.id}` === selected);
  const dish = dishes.find((d) => `dish:${d.id}` === selected);
  return (
    <>
      <p>
        <time dateTime={date}>
          {parseDate(date).toLocaleDateString(undefined, { dateStyle: "full" })}
        </time>
      </p>
      <form
        className="plate-picker"
        onSubmit={(event) => {
          event.preventDefault();
          if (food) add(food, food.quantity);
          else if (dish) serve(dish);
          select("");
          picker.current?.focus();
        }}
      >
        <label htmlFor="plate-food">Add from recipe book</label>
        <select
          id="plate-food"
          ref={picker}
          value={selected}
          required
          onChange={(e) => select(e.target.value)}
        >
          <option value="">Choose a food or dish…</option>
          <optgroup label="Foods">
            {foods
              .filter((f) => !f.archived)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((f) => (
                <option key={f.id} value={`food:${f.id}`}>
                  {f.name}
                  {f.brand && ` · ${f.brand}`} · {fmt(f.quantity)} {f.unit}
                </option>
              ))}
          </optgroup>
          {dishes.length > 0 && (
            <optgroup label="Ingredient dishes">
              {dishes.map((d) => (
                <option key={d.id} value={`dish:${d.id}`}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button className="primary" disabled={!food && !dish}>
          Add
        </button>
      </form>
      {entries.length ? (
        <ul className="plate-list">
          {entries.map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.food.name}</strong>
                {e.dish && <small>From {e.dish}</small>}
              </span>
              <button
                aria-label={`Edit serving for ${e.food.name}: ${fmt(e.quantity)} ${e.food.unit}`}
                aria-expanded={editing === e.id}
                id={`plate-serving-${e.id}`}
                onClick={() => edit(editing === e.id ? null : e.id)}
              >
                {fmt(e.quantity)} {e.food.unit}{" "}
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                className="plate-remove"
                title="Remove from this plate"
                aria-label={`Remove ${e.food.name} from this plate`}
                onClick={() => {
                  if (editing === e.id) edit(null);
                  remove(e);
                  picker.current?.focus({ preventScroll: true });
                }}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
              {editing === e.id && (
                <div className="plate-serving-editor">
                  <Quantity
                    q={e.quantity}
                    base={e.food.quantity}
                    u={e.food.unit}
                    change={(q) => {
                      change(e, q);
                      edit(null);
                      document.getElementById(`plate-serving-${e.id}`)?.focus();
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No foods logged for this day.</p>
      )}
      <button
        disabled={!undo}
        onClick={() => {
          edit(null);
          undo?.();
        }}
      >
        Undo last change
      </button>
    </>
  );
}
export function Nutrition({ e }: { e: Entry }) {
  return (
    <>
      <p>
        {e.food.brand} · {fmt(e.quantity)} {e.food.unit}
        {e.dish && ` · From ${e.dish}`}
      </p>
      <dl>
        {keys.map((k) => (
          <div key={k}>
            <dt>{labels[k]}</dt>
            <dd>
              {scaled(e, k) === null
                ? "Unavailable"
                : `${fmt(scaled(e, k)!)} ${unit(k)}`}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
export function Breakdown({
  k,
  entries,
  goals,
}: {
  k: Key;
  entries: Entry[];
  goals: Goals;
}) {
  const g = goals[k],
    { sum, missing } = totals(entries, k),
    s = getNutrientVisualStatus(sum, g, missing);
  return (
    <>
      <p>{descriptions[k]}</p>
      <h3>
        {missing ? "Known subtotal: " : ""}
        {fmt(sum)} {unit(k)} · {s.text}
      </h3>
      <NutrientBar
        nutrient={k}
        sum={sum}
        missing={missing}
        goal={g}
        status={s}
      />
      {g && (
        <p>
          {g.reference}
          {g.ul !== undefined && ` · UL ${fmt(g.ul)} ${unit(k)}`}{" "}
          {g.source && (
            <a href={g.source} target="_blank" rel="noreferrer">
              Reference ↗
            </a>
          )}
        </p>
      )}
      {missing > 0 && <p>{missing} entries have unavailable values.</p>}
      <h3>From this plate</h3>
      <dl>
        {entries.map((e) => (
          <div key={e.id}>
            <dt>{e.food.name}</dt>
            <dd>
              {scaled(e, k) === null
                ? "Unavailable"
                : `${fmt(scaled(e, k)!)} ${unit(k)}`}
            </dd>
          </div>
        ))}
      </dl>
      {!entries.length && <p>No foods logged.</p>}
    </>
  );
}
export function Quantity({
  q,
  u,
  change,
  base,
}: {
  q: number;
  u: string;
  change: (q: number) => void;
  base: number;
}) {
  const [v, set] = useState(String(q)),
    [display, setDisplay] = useState(u),
    units = [
      ["cup", "tbsp", "tsp"],
      ["g", "kg", "mg"],
      ["ml", "l"],
    ].find((group) => group.includes(u)) ?? [u],
    step = convert(base / 4, u, display);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        change(convert(Number(v), display, u));
      }}
    >
      <p>Choose an amount in {u}.</p>
      <div className="actions">
        {[0.25, 0.5, 0.75, 1, 1.5, 2].map((x) => (
          <button type="button" key={x} onClick={() => change(x)}>
            {x} {u}
          </button>
        ))}
      </div>
      {units.length > 1 && (
        <label>
          Compatible unit
          <select
            value={display}
            onChange={(e) => {
              if (Number(v) > 0)
                set(String(convert(Number(v), display, e.target.value)));
              setDisplay(e.target.value);
            }}
          >
            {units.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Custom quantity ({display})
        <input
          required
          type="number"
          min="0.000001"
          step="any"
          value={v}
          onChange={(e) => set(e.target.value)}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => set(String(Math.max(step, Number(v) - step)))}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => set(String(Number(v) + step))}
        >
          +
        </button>
        <button className="primary">Apply quantity</button>
      </div>
    </form>
  );
}
export function Calendar({
  date,
  entries,
  pick,
}: {
  date: string;
  entries: Entry[];
  pick: (v: string) => void;
}) {
  const [month, set] = useState(
    () =>
      new Date(parseDate(date).getFullYear(), parseDate(date).getMonth(), 1),
  );
  const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    logged = new Set(entries.map((e) => e.date));
  return (
    <>
      <div className="between">
        <button
          aria-label="Previous month"
          onClick={() =>
            set(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronLeft />
        </button>
        <h3>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <button
          aria-label="Next month"
          onClick={() =>
            set(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronRight />
        </button>
      </div>
      <div className="dates">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((s) => (
          <small key={s}>{s}</small>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => (
          <i key={i} />
        ))}
        {Array.from({ length: n }, (_, i) => {
          const v = localDate(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          return (
            <button
              key={v}
              aria-label={`${v}${logged.has(v) ? ", logged" : ""}`}
              aria-current={v === localDate() ? "date" : undefined}
              className={date === v ? "primary" : ""}
              onClick={() => pick(v)}
            >
              {i + 1}
              {logged.has(v) && <CalendarFlower />}
            </button>
          );
        })}
      </div>
      <button onClick={() => pick(localDate())}>Return to today</button>
    </>
  );
}
