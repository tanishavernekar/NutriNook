import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CircleHelp, Redo2, Scale, Settings2, Sheet, Undo2 } from "lucide-react";
import { KitchenManual } from "./KitchenManual";
import {
  entry,
  goalsOn,
  getNutrientVisualStatus,
  keys,
  labels,
  localDate,
  stamp,
  totals,
  uid,
  type Entry,
  type Key,
  type Kitchen,
  type Dish,
  type Food,
} from "./model";
import { load, save } from "./storage";
import { loadSiteArtwork, setAppearance } from "./theme";
import { play, type Cue } from "./audio";
import { PlateHistory, replaceDay } from "./history";
import { Modal } from "./shared";
import {
  NutrientCards,
  type NutrientView,
  Calendar,
  Nutrition,
  Plate,
  PlateList,
  Quantity,
  Shelf,
} from "./Journal";
import { Library, DishEditor, FoodEditor } from "./Library";
import { GoalEditor } from "./Goals";
import { totalSugarSettingsHash } from "./goalLinks";
import { SettingsPanel } from "./Settings";
import { PantryTable } from "./Pantry";
import "@fontsource/special-elite/latin-400.css";
import "./style.css";
type Panel =
  | { kind: "food"; food?: Food }
  | { kind: "dish"; dish?: Dish }
  | { kind: "nutrition" | "quantity"; e: Entry }
  | { kind: "jar"; k: Key; view: NutrientView }
  | { kind: "calendar" | "goals" | "settings" | "pantry" | "plate" | "manual" };
function App({ initial }: { initial: Kitchen }) {
  const [data, set] = useState(initial),
    [date, setDate] = useState(localDate()),
    [underlyingPanel, open] = useState<Panel | null>(null),
    [sugarSettings, setSugarSettings] = useState(() => location.hash === totalSugarSettingsHash),
    [notice, note] = useState(""),
    [storageError, warn] = useState(""),
    [spark, light] = useState<Key[]>([]);
  const history = useRef(new PlateHistory()),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel: Panel | null = sugarSettings ? { kind: "goals" } : underlyingPanel;
  useEffect(() => {
    const sync = () => setSugarSettings(location.hash === totalSugarSettingsHash);
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useLayoutEffect(() => {
    let current = true;
    void save(data).then(
      () => {
        if (current) warn("");
      },
      (e) => {
        if (current)
          warn(
            "Not saved to this device. Download a backup from Settings. " +
              String(e),
          );
      },
    );
    return () => {
      current = false;
    };
  }, [data]);
  useEffect(() => {
    document.documentElement.dataset.reduced = String(data.settings.reduced);
  }, [data.settings.reduced]);
  useLayoutEffect(() => {
    setAppearance(data.settings.appearance ?? "periwinkle");
  }, [data.settings.appearance]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const openGoals = () => open({ kind: "goals" });
  const day = data.entries.filter((e) => e.date === date),
    goals = goalsOn(data, date),
    close = () => {
      if (sugarSettings) {
        window.history.replaceState(window.history.state, "", location.pathname + location.search);
        setSugarSettings(false);
      } else open(null);
    },
    sound = (c: Cue) => play(c, data.settings);
  function feedback(
    before: Entry[],
    after: Entry[],
    d: string,
    c: Cue,
    message: string,
  ) {
    const targets = goalsOn(data, d);
    const reached = keys.filter((k) => {
      const a = totals(before, k),
        b = totals(after, k);
      return (
        getNutrientVisualStatus(a.sum, targets[k], a.missing).state !==
          "success" &&
        getNutrientVisualStatus(b.sum, targets[k], b.missing).state ===
          "success"
      );
    });
    const limitExceeded = keys.some((k) => {
      const b = totals(after, k);
      return (
        getNutrientVisualStatus(b.sum, targets[k], b.missing).state === "limit"
      );
    });
    sound(c);
    if (reached.length && !limitExceeded && data.settings.celebrate) {
      sound("goal");
      light(reached);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => light([]), 850);
      note(
        `${message} · Goal reached: ${reached.map((k) => labels[k]).join(", ")}.`,
      );
    } else {
      if (
        keys.some(
          (k) => targets[k] && totals(after, k).sum !== totals(before, k).sum,
        )
      )
        sound("fill");
      light([]);
      note(message);
    }
  }
  function log(after: Entry[], c: Cue, message: string) {
    history.current.push({ date, before: day, after });
    set({ ...data, entries: replaceDay(data.entries, date, after) });
    feedback(day, after, date, c, message);
  }
  function step(redo: boolean) {
    const op = history.current.step(redo);
    if (!op) return;
    feedback(
      data.entries.filter((e) => e.date === op.date),
      op.entries,
      op.date,
      redo ? "redo" : "undo",
      redo ? "Change reapplied." : "Change undone.",
    );
    setDate(op.date);
    set({ ...data, entries: replaceDay(data.entries, op.date, op.entries) });
  }
  function remove(e: Entry) {
    log(
      day.filter((x) => x.id !== e.id),
      "remove",
      `${e.food.name} removed.`,
    );
  }
  function addFood(food: Food, quantity = food.quantity) {
    log([...day, entry(food, date, quantity)], "add", `${food.name} added.`);
  }
  function serveDish(dish: Dish) {
    const additions = dish.ingredients.map((i) =>
      entry(
        data.foods.find((f) => f.id === i.foodId)!,
        date,
        i.quantity,
        dish.name,
      ),
    );
    log([...day, ...additions], "add", `${dish.name} served.`);
  }
  function changeQuantity(item: Entry, quantity: number) {
    if (item.quantity === quantity) return;
    log(
      day.map((e) =>
        e.id === item.id ? { ...e, quantity, updatedAt: stamp() } : e,
      ),
      "quantity",
      "Serving updated.",
    );
  }
  function clearPlate() {
    log(
      [],
      "remove",
      `Plate cleared (${day.length} removed). Use undo to restore.`,
    );
  }
  const edit = (food?: Food) => {
    sound("book");
    open({ kind: "food", food });
  };
  const update = (d: Kitchen) => {
    history.current.future = [];
    set(d);
  };
  const saveFood = (f: Food) => {
    update({
      ...data,
      categories:
        f.type !== "dish" && !data.categories.includes(f.category)
          ? [...data.categories, f.category]
          : data.categories,
      foods: data.foods.some((x) => x.id === f.id)
        ? data.foods.map((x) => (x.id === f.id ? f : x))
        : [...data.foods, f],
    });
    close();
    note(`${f.name} saved.`);
  };
  const saveDish = (dish: Dish) => {
    update({
      ...data,
      dishes: [...data.dishes.filter((d) => d.id !== dish.id), dish],
    });
    close();
  };
  const dialog = () => {
    if (!panel) return null;
    switch (panel.kind) {
      case "jar":
        return [
          labels[panel.k],
          <NutrientCards
            k={panel.k}
            date={date}
            view={panel.view}
            dive={() => {
              sound("tab");
              open({ ...panel, view: "sources" });
            }}
            entries={day}
            goals={goals}
            go={(k) => {
              sound("tab");
              open({ ...panel, k });
            }}
          />,
        ] as const;
      case "nutrition":
        return [panel.e.food.name, <Nutrition e={panel.e} />] as const;
      case "quantity":
        return [
          `Quantity · ${panel.e.food.name}`,
          <Quantity
            q={panel.e.quantity}
            u={panel.e.food.unit}
            base={panel.e.food.quantity}
            change={(quantity) => {
              changeQuantity(panel.e, quantity);
              close();
            }}
          />,
        ] as const;
      case "food":
        if (!panel.food)
          return [
            "Add to the recipe book",
            <DishEditor
              start="food"
              foods={data.foods}
              categories={data.categories}
              saveWhole={saveFood}
              save={saveDish}
              discard={() => {}}
            />,
          ] as const;
        return [
          panel.food.type === "dish" ? "Dish recipe card" : "Food recipe card",
          <FoodEditor
            key={panel.food.id}
            food={panel.food}
            foods={data.foods}
            categories={data.categories}
            save={saveFood}
            duplicate={(f) =>
              open({
                kind: "food",
                food: {
                  ...f,
                  id: uid(),
                  type: "custom",
                  name: f.name + " (copy)",
                  createdAt: stamp(),
                  updatedAt: stamp(),
                },
              })
            }
            discard={(f) => {
              if (
                data.dishes.some((d) =>
                  d.ingredients.some((i) => i.foodId === f.id),
                )
              ) {
                alert(
                  "Remove this ingredient from saved dishes first, or archive the food.",
                );
                return;
              }
              if (
                confirm(
                  `Delete ${f.name} from the library? Logged entries stay unchanged.`,
                )
              ) {
                update({
                  ...data,
                  foods: data.foods.filter((x) => x.id !== f.id),
                });
                close();
              }
            }}
          />,
        ] as const;
      case "dish":
        return [
          panel.dish ? "Edit dish" : "Add to the recipe book",
          <DishEditor
            dish={panel.dish}
            foods={data.foods}
            categories={data.categories}
            saveWhole={saveFood}
            save={saveDish}
            discard={(dish) => {
              if (confirm(`Delete ${dish.name}?`)) {
                update({
                  ...data,
                  dishes: data.dishes.filter((d) => d.id !== dish.id),
                });
                close();
              }
            }}
          />,
        ] as const;
      case "plate":
        return [
          "On the plate",
          <PlateList
            date={date}
            entries={day}
            foods={data.foods}
            dishes={data.dishes}
            add={addFood}
            serve={serveDish}
            change={changeQuantity}
            remove={remove}
            undo={
              history.current.past.at(-1)?.date === date
                ? () => step(false)
                : undefined
            }
          />,
        ] as const;
      case "calendar":
        return [
          "Kitchen calendar",
          <Calendar
            date={date}
            entries={data.entries}
            pick={(v) => {
              setDate(v);
              light([]);
              note("");
              sound("calendar");
              close();
            }}
          />,
        ] as const;
      case "goals":
        return [
          "My goals",
          <GoalEditor
            initialNutrient={sugarSettings ? "totalSugar" : undefined}
            profile={data.profile}
            isExample={data.profileIsExample === true}
            existing={goals}
            date={date}
            save={(profile, values) => {
              update({
                ...data,
                profile,
                profileIsExample: false,
                goals: [
                  ...data.goals.filter((g) => g.date !== date),
                  { date, values },
                ],
              });
              light([]);
              note(`Goals saved from ${date}.`);
              close();
            }}
          />,
        ] as const;
      case "manual":
        return ["Kitchen manual", <KitchenManual />] as const;
      case "settings":
        return [
          "Kitchen settings",
          <SettingsPanel
            data={data}
            update={update}
            edit={edit}
            goals={openGoals}
            restore={(d) => {
              history.current = new PlateHistory();
              set(d);
              light([]);
              note("Backup restored.");
              close();
            }}
          />,
        ] as const;
      case "pantry":
        return [
          "Pantry table",
          <PantryTable
            data={data}
            update={update}
            added={() => sound("add")}
          />,
        ] as const;
    }
  };
  const content = dialog();
  const tools = (
    <nav className="tools kitchen-tools" aria-label="Kitchen tools">
      <button aria-label="My goals" title="My goals" onClick={openGoals}>
        <Scale size={17} />
      </button>
      <button
        aria-label="Undo"
        title="Undo"
        disabled={!history.current.past.length}
        onClick={() => step(false)}
      >
        <Undo2 />
      </button>
      <button
        aria-label="Redo"
        title="Redo"
        disabled={!history.current.future.length}
        onClick={() => step(true)}
      >
        <Redo2 />
      </button>
      <button
        aria-label="Pantry table"
        title="Pantry table"
        onClick={() => {
          sound("book");
          open({ kind: "pantry" });
        }}
      >
        <Sheet />
      </button>
      <button
        aria-label="Kitchen settings"
        title="Kitchen settings"
        onClick={() => open({ kind: "settings" })}
      >
        <Settings2 />
      </button>
      <button aria-label="Kitchen manual" title="Kitchen manual" onClick={() => { sound("book"); open({ kind: "manual" }); }}>
        <CircleHelp aria-hidden="true" />
      </button>
    </nav>
  );
  return (
    <>
      <div className="kitchen-backdrop" aria-hidden="true">
        <span className="decor ivy" />
        <span className="decor sprig" />
        <span className="decor plant" />
      </div>
      <main className="kitchen-scene" aria-label="NutriNook">
        {storageError && <p role="alert">{storageError}</p>}
        <Shelf
          entries={day}
          goals={goals}
          celebrating={spark}
          detail={(k) => {
            sound("book");
            open({ kind: "jar", k, view: "breakdown" });
          }}
        />
        <Plate
          date={date}
          viewAll={() => {
            sound("book");
            open({ kind: "plate" });
          }}
          calendar={() => {
            sound("calendar");
            open({ kind: "calendar" });
          }}
          entries={day}
          remove={remove}
          clear={clearPlate}
          label={(e) => {
            sound("book");
            open({ kind: "nutrition", e });
          }}
          quantity={(e) => open({ kind: "quantity", e })}
          today={() => {
            setDate(localDate());
            light([]);
            note("");
            sound("calendar");
          }}
        />
        <Library
          data={data}
          day={day}
          add={addFood}
          remove={remove}
          edit={edit}
          fav={(f) =>
            update({
              ...data,
              foods: data.foods.map((x) =>
                x.id === f.id
                  ? { ...x, favorite: !x.favorite, updatedAt: stamp() }
                  : x,
              ),
            })
          }
          dish={(dish) => {
            sound("book");
            open({ kind: "dish", dish });
          }}
          serve={serveDish}
          tabSound={() => sound("tab")}
          stepSound={() => sound("quantity")}
        />
        {tools}
        <output aria-live="polite">{notice}</output>
      </main>
      {content && (
        <Modal
          key={sugarSettings ? "sugar-settings" : "panel"}
          title={content[0]}
          close={close}
          scrollLabel={panel?.kind === "manual" ? "Scroll kitchen manual" : undefined}
          headerAction={
            panel?.kind === "jar" && (
              <button
                className="guide-toggle"
                type="button"
                aria-pressed={panel.view !== "breakdown"}
                aria-controls="nutrient-page"
                onClick={() => {
                  sound("tab");
                  open({
                    ...panel,
                    view: panel.view === "guide" ? "breakdown" : "guide",
                  });
                }}
              >
                {panel.view === "breakdown" ? "Guide" : "Back"}
              </button>
            )
          }
          className={
            panel?.kind === "jar"
              ? "nutrient-card"
              : panel?.kind === "pantry"
                ? "pantry-sheet"
                : undefined
          }
        >
          {content[1]}
        </Modal>
      )}
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<p>Opening your kitchen journal…</p>);
load().then(
  ({ kitchen }) => {
    if (
      !kitchen.settings.appearance ||
      new URLSearchParams(location.search).has("theme")
    )
      void loadSiteArtwork();
    root.render(<App initial={kitchen} />);
  },
  (e) =>
    root.render(
      <main role="alert">
        <h1>Could not open your journal</h1>
        <p>
          {String(e)}. Existing data has not been replaced. Enable browser
          storage and reload.
        </p>
      </main>,
    ),
);
