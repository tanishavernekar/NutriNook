import { useMemo, useState } from "react";
import { ArtworkSettings } from "./ArtworkSettings";
import {
  columns,
  exportCSV,
  mapping,
  mergeFoods,
  parseCSV,
  preview,
} from "./data/csv";
import { download } from "./shared";
import { play } from "./audio";
import { validateBackup } from "./storage";
import { keys, labels, type Kitchen, type Food, type Settings } from "./model";
type Change = (d: Kitchen) => void;
export function SoundSettings({
  s,
  change,
}: {
  s: Settings;
  change: (s: Settings) => void;
}) {
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={s.sound}
          onChange={(e) => change({ ...s, sound: e.target.checked })}
        />{" "}
        Kitchen sounds
      </label>
      <label>
        Volume · {Math.round(s.volume * 100)}%
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="100"
          value={s.volume * 100}
          onChange={(e) => change({ ...s, volume: +e.target.value / 100 })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={s.celebrate}
          onChange={(e) => change({ ...s, celebrate: e.target.checked })}
        />{" "}
        Celebrate reaching goals
      </label>
      <button disabled={!s.sound} onClick={() => play("add", s)}>
        Preview sound
      </button>
    </>
  );
}
function Importer({ data, update }: { data: Kitchen; update: Change }) {
  const [rows, set] = useState<string[][]>([]),
    [map, remap] = useState<Record<string, number>>({}),
    [mode, setMode] = useState<"skip" | "replace" | "variation">("skip"),
    [msg, note] = useState("");
  const p = useMemo(() => {
    try {
      return rows.length
        ? preview(rows.slice(1), map, {
            categories: data.categories,
            existing: data.foods,
          })
        : null;
    } catch (e) {
      return { foods: [], errors: [String(e)] };
    }
  }, [rows, map, data.categories, data.foods]);
  return (
    <>
      <label>
        Choose food CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const r = parseCSV(await f.text());
              if (r.length < 2) throw Error("No data rows.");
              set(r);
              remap(mapping(r[0]));
              note("");
            } catch (e) {
              set([]);
              note(String(e));
            }
          }}
        />
      </label>
      {p && (
        <>
          <div className="grid">
            {columns.map((k) => (
              <label key={k}>
                {labels[k as keyof typeof labels] ?? k}
                <select
                  value={map[k]}
                  onChange={(e) => remap({ ...map, [k]: +e.target.value })}
                >
                  <option value="-1">Not mapped</option>
                  {rows[0].map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p>
            {p.foods.length} food rows ·{" "}
            {data.foods.length +
              p.foods.length -
              mergeFoods(data.foods, p.foods, "skip").length}{" "}
            duplicates ·{" "}
            {
              p.foods.filter((f) => keys.some((k) => f.nutrients[k] === null))
                .length
            }{" "}
            with missing values
          </p>
          <details>
            <summary>Preview foods</summary>
            {p.foods.map((f) => (
              <p key={f.id}>
                {f.name} · {f.quantity} {f.unit}
              </p>
            ))}
          </details>
          {p.errors.map((err) => (
            <p key={err} role="alert">
              {err}
            </p>
          ))}
          <label>
            Duplicates
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="skip">Skip</option>
              <option value="replace">Replace existing definitions</option>
              <option value="variation">Import as new variations</option>
            </select>
          </label>
          <button
            disabled={!p.foods.length || !!p.errors.length}
            onClick={() => {
              update({
                ...data,
                foods: mergeFoods(data.foods, p.foods, mode),
                categories: [
                  ...new Set([
                    ...data.categories,
                    ...p.foods.map((f) => f.category),
                  ]),
                ],
              });
              set([]);
              note("Import complete.");
            }}
          >
            Confirm CSV import
          </button>
        </>
      )}
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
export function SettingsPanel({
  data,
  update,
  restore,
  goals,
  edit,
}: {
  data: Kitchen;
  update: Change;
  restore: Change;
  goals: () => void;
  edit: (f: Food) => void;
}) {
  const [backup, setBackup] = useState<Kitchen | null>(null),
    [error, fail] = useState(""),
    [name, setName] = useState(""),
    [old, select] = useState("");
  return (
    <>
      <p>
        Your kitchen is stored on this device in IndexedDB. Clearing browser
        data removes it. Export a backup regularly.
      </p>
      <button onClick={goals}>Profile & nutrient targets</button>
      <label>
        <input
          type="checkbox"
          checked={data.settings.reduced}
          onChange={(e) =>
            update({
              ...data,
              settings: { ...data.settings, reduced: e.target.checked },
            })
          }
        />{" "}
        Reduce motion (system preference is also respected)
      </label>
      <details>
        <summary>Sounds & celebrations</summary>
        <SoundSettings
          s={data.settings}
          change={(settings) => update({ ...data, settings })}
        />
      </details>
      <details>
        <summary>Food database & categories</summary>
        <label>
          Manage a food
          <select
            defaultValue=""
            onChange={(e) => {
              const f = data.foods.find((f) => f.id === e.target.value);
              if (f) edit(f);
            }}
          >
            <option value="">Select a food…</option>
            {data.foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.archived ? " · archived" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category action
          <select value={old} onChange={(e) => select(e.target.value)}>
            <option value="">Create new</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                Rename {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          disabled={
            !name.trim() ||
            data.categories.some(
              (c) => c.toLowerCase() === name.trim().toLowerCase(),
            )
          }
          onClick={() => {
            const n = name.trim();
            update({
              ...data,
              categories: old
                ? data.categories.map((c) => (c === old ? n : c))
                : [...data.categories, n],
              foods: data.foods.map((f) =>
                old && f.category === old ? { ...f, category: n } : f,
              ),
            });
            select("");
            setName("");
          }}
        >
          Save category
        </button>
      </details>
      <details>
        <summary>Import or export food CSV</summary>
        <Importer data={data} update={update} />
        <button
          onClick={() =>
            download("nutrinook-food-library.csv", exportCSV(data.foods), "text/csv")
          }
        >
          Export library CSV
        </button>
      </details>
      <details>
        <summary>Complete backup & restore</summary>
        <button
          onClick={() =>
            download(
              "nutrinook-backup.json",
              JSON.stringify(data, null, 2),
              "application/json",
            )
          }
        >
          Download JSON backup
        </button>
        <label>
          Restore JSON
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBackup(null);
              try {
                setBackup(validateBackup(JSON.parse(await f.text())));
                fail("");
              } catch (e) {
                fail(String(e));
              }
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {backup && (
          <>
            <p>
              Replace your kitchen with {backup.foods.length} foods and{" "}
              {backup.entries.length} entries? This cannot be undone.
            </p>
            <button onClick={() => restore(backup)}>Confirm replacement</button>
          </>
        )}
      </details>
      <ArtworkSettings
        appearance={data.settings.appearance ?? "periwinkle"}
        choose={(appearance) =>
          update({ ...data, settings: { ...data.settings, appearance } })
        }
      />
    </>
  );
}
