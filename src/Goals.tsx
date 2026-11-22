import { useEffect, useRef, useState } from "react";
import { exampleProfile, recommendations } from "./data/recommendations";
import {
  fmt,
  keys,
  labels,
  unit,
  type Goal,
  type Goals,
  type Key,
  type Profile,
} from "./model";
const activities = [
  "Sedentary · ordinary daily living",
  "Lightly active · some additional movement",
  "Moderately active · regular active movement",
  "Very active · sustained high activity",
];
export function GoalEditor({
  profile,
  isExample,
  existing,
  date,
  initialNutrient,
  save,
}: {
  profile: Profile | null;
  isExample: boolean;
  existing: Goals;
  date: string;
  initialNutrient?: Key;
  save: (profile: Profile | null, goals: Goals) => void;
}) {
  const [p, set] = useState<Profile>(profile ?? { ...exampleProfile }),
    [profileOn, enable] = useState(!!profile);
  const [over, setOver] = useState<Goals>(
      Object.fromEntries(Object.entries(existing).filter(([, g]) => g.custom)),
    ),
    rec = recommendations(profileOn ? p : null);
  const linkedSection = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const section = linkedSection.current;
    if (!section) return;
    section.open = true;
    section.querySelector("summary")?.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  }, [initialNutrient]);
  const change = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    set({
      ...p,
      [k]: v,
      ...(k === "sex" && v === "male" ? { stage: "Standard" } : {}),
    });
  const custom = (k: Key, g: Partial<Goal>) =>
    setOver({
      ...over,
      [k]: {
        kind: "minimum",
        value: 0,
        reference: "Your setting",
        source: "",
        custom: true,
        ...over[k],
        ...g,
      },
    });
  const reset = (k: Key) => {
    const next = { ...over };
    delete next[k];
    setOver(next);
  };
  const result: Goals = { ...rec };
  for (const k of keys)
    if (over[k]) result[k] = { ...over[k]!, ul: rec[k]?.ul };
  return (
    <form
      className="goal-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save(profileOn ? p : null, result);
      }}
    >
      <p>
        General estimates, not individualized medical advice. Your profile stays
        in this browser. Changes apply from <b>{date}</b>.
      </p>
      <label>
        <input
          type="checkbox"
          checked={profileOn}
          onChange={(e) => enable(e.target.checked)}
        />{" "}
        Use my profile for recommendations
      </label>
      {profileOn && (isExample || !profile) && (
        <p>
          <strong>Example profile:</strong> Review these details before saving
          your goals.
        </p>
      )}
      {profileOn && (
        <div className="grid">
          <label>
            Age in years
            <input
              required
              type="number"
              min="1"
              max="120"
              value={p.age || ""}
              onChange={(e) => change("age", Number(e.target.value))}
            />
          </label>
          <label>
            Sex<span className="dri-label-detail"> for DRI reference</span>
            <select
              aria-label="Sex for DRI reference"
              value={p.sex}
              onChange={(e) => change("sex", e.target.value as Profile["sex"])}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          {(["height", "weight"] as const).map((k) => {
            const isHeight = k === "height";
            const label = isHeight ? "Height" : "Weight";
            const metric = isHeight ? "cm" : "kg";
            const imperial = isHeight ? "in" : "lb";
            const displayUnit =
              (isHeight ? p.heightUnit : p.weightUnit) ??
              (p.imperial ? imperial : metric);
            const factor =
              displayUnit === "in"
                ? 2.54
                : displayUnit === "lb"
                  ? 0.45359237
                  : 1;
            return (
              <div className="profile-measure" key={k}>
                <select
                  aria-label={`${label} unit`}
                  value={displayUnit}
                  onChange={(e) =>
                    isHeight
                      ? change(
                          "heightUnit",
                          e.target.value === "in" ? "in" : "cm",
                        )
                      : change(
                          "weightUnit",
                          e.target.value === "lb" ? "lb" : "kg",
                        )
                  }
                >
                  <option value={metric}>
                    {label} ({metric})
                  </option>
                  <option value={imperial}>
                    {label} ({imperial})
                  </option>
                </select>
                <input
                  aria-label={`${label} (${displayUnit})`}
                  type="number"
                  required
                  min=".01"
                  step="any"
                  value={p[k] ? +(p[k] / factor).toFixed(4) : ""}
                  onChange={(e) => change(k, Number(e.target.value) * factor)}
                />
              </div>
            );
          })}
          <label>
            Activity
            <select
              value={p.activity}
              onChange={(e) => change("activity", +e.target.value)}
            >
              {activities.map((a, i) => (
                <option key={a} value={i}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Life stage
            <select
              disabled={p.sex === "male"}
              value={p.stage}
              onChange={(e) => change("stage", e.target.value)}
            >
              {["Standard", "Pregnant", "Breastfeeding"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Purpose
            <select
              value={p.intent}
              onChange={(e) => change("intent", e.target.value)}
            >
              {["General wellness", "Weight maintenance", "Custom targets"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
        </div>
      )}
      <h3>Daily goals</h3>
      <p>
        Adult references start at 19. Without a supported reference, the jar
        tracks intake only. An upper limit is not a goal.
      </p>
      {keys.map((k) => {
        const g = result[k];
        return (
          <details key={k} ref={k === initialNutrient ? linkedSection : undefined}>
            <summary>
              {labels[k]}
              <small>
                {g
                  ? `${fmt(g.value)}${g.kind === "range" ? `–${fmt(g.max ?? 0)}` : ""} ${unit(k)} · ${g.custom ? "Custom" : g.reference.split(" · ")[0]}`
                  : k === "totalSugar" ? "No target" : "Unavailable"}
              </small>
            </summary>
            <p>
              {rec[k] ? (
                <>
                  {rec[k]!.reference} · {rec[k]!.kind} ·{" "}
                  <a href={rec[k]!.source} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                  {rec[k]!.ul && ` · Applicable UL: ${rec[k]!.ul} ${unit(k)}`}
                </>
              ) : k === "totalSugar" ? (
                "Without a personal goal, your jar tracks grams only."
              ) : (
                "No recommendation provided for this nutrient and profile."
              )}
            </p>
            {over[k] ? (
              <>
                <label>
                  Goal type
                  <select
                    value={over[k]!.kind}
                    onChange={(e) =>
                      custom(k, { kind: e.target.value as Goal["kind"] })
                    }
                  >
                    {Object.entries({
                      minimum: "Minimum",
                      range: "Range",
                      maximum: "Recommended maximum",
                      ul: "Upper limit",
                      energy: "Estimated energy",
                    }).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount / lower bound ({unit(k)})
                  <input
                    required
                    type="number"
                    min=".000001"
                    step="any"
                    value={over[k]!.value || ""}
                    onChange={(e) => custom(k, { value: +e.target.value })}
                  />
                </label>
                {over[k]!.kind === "range" && (
                  <label>
                    Upper bound
                    <input
                      required
                      type="number"
                      step="any"
                      min={over[k]!.value}
                      value={over[k]!.max || ""}
                      onChange={(e) => custom(k, { max: +e.target.value })}
                    />
                  </label>
                )}
                <button type="button" onClick={() => reset(k)}>
                  {k === "totalSugar" ? "Remove custom target" : "Reset to recommended"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => custom(k, { value: rec[k]?.value ?? 0 })}
              >
                Set custom target
              </button>
            )}
          </details>
        );
      })}
      <button className="primary">Save goals</button>
    </form>
  );
}
