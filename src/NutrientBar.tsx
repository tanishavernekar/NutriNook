import {
  fmt,
  getNutrientVisualStatus,
  labels,
  unit,
  type Goal,
  type Key,
} from "./model";
import { totalSugarSettingsHash } from "./goalLinks";

const referenceLabels = {
  minimum: "Minimum",
  range: "Target range",
  maximum: "Recommended maximum",
  ul: "Upper limit",
  energy: "Energy estimate",
};

export function NutrientBar({
  nutrient,
  sum,
  missing,
  goal,
  status,
}: {
  nutrient: Key;
  sum: number;
  missing: number;
  goal?: Goal;
  status: ReturnType<typeof getNutrientVisualStatus>;
}) {
  const amount = (n: number) => `${fmt(n)} ${unit(nutrient)}`;
  if (!goal)
    return (
      <div className="nutrient-bar unscaled">
        <div className="bar-track" aria-hidden="true" />
        {nutrient === "totalSugar" ? (
          <>
            Total sugar has no <abbr title="Dietary Reference Intake">DRI</abbr> target.{" "}
            <a href={totalSugarSettingsHash}>Set a personal sugar goal</a>.
          </>
        ) : (
          "No verified or custom target for this date."
        )}
      </div>
    );

  const isRange = goal.kind === "range" && goal.max !== undefined;
  const end = isRange ? goal.max! : goal.value;
  const axis = Math.max(end, sum);
  const pct = (n: number) => `${(n / axis) * 100}%`;
  const boundary = Math.min(end, goal.ul ?? end);
  const extra = sum - boundary;
  const beyond =
    goal.ul === boundary || goal.kind === "ul"
      ? "upper limit"
      : isRange
        ? "range"
        : referenceLabels[goal.kind].toLowerCase();
  const reference = `${referenceLabels[goal.kind]}: ${isRange ? `${fmt(goal.value)}–` : ""}${amount(end)}`;
  const percent = `${missing ? "≥" : ""}${status.percent}%${isRange ? " of minimum" : ""}`;
  const overflowLabel = `${missing ? "At least " : ""}${amount(extra)} beyond ${beyond}`;
  return (
    <div
      className="nutrient-bar"
      role="img"
      aria-label={`${labels[nutrient]}: ${missing ? "at least " : ""}${amount(sum)}. ${reference}. ${percent}. ${status.text}.${extra > 0 ? ` ${overflowLabel}.` : ""}`}
    >
      <div className="bar-caption">{reference}</div>
      <div
        className="bar-track"
        style={{ gridTemplateColumns: `minmax(max-content, ${pct(sum)}) 1fr` }}
      >
        {isRange && (
          <span
            className="bar-range"
            style={{ left: pct(goal.value), width: pct(end - goal.value) }}
          />
        )}
        <span
          className="bar-fill"
          style={{
            width: pct(Math.min(sum, boundary)),
            backgroundColor: status.color,
          }}
        />
        {extra > 0 && (
          <span
            className="bar-overflow"
            style={{
              left: pct(boundary),
              width: pct(extra),
              backgroundColor: status.color,
            }}
          />
        )}
        {isRange && (
          <span className="bar-tick" style={{ left: pct(goal.value) }} />
        )}
        <span className="bar-tick" style={{ left: pct(end) }} />
        {goal.ul !== undefined && goal.ul < axis && goal.ul !== end && (
          <span className="bar-tick ul" style={{ left: pct(goal.ul) }} />
        )}
        <strong className="bar-percent">{percent}</strong>
      </div>
      {extra > 0 && (
        <p className="bar-key">
          <i aria-hidden="true" />
          {overflowLabel}
        </p>
      )}
    </div>
  );
}
