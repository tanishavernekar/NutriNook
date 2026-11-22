import type { CSSProperties } from "react";
import { contents, geometry, jarArt } from "./jarAssets";
import { useArtworkTheme } from "./theme";
import type { Goal, Key } from "./model";
export function CalendarFlower() {
  return (
    <svg
      className="calendar-flower"
      aria-hidden="true"
      focusable="false"
      width="16"
      height="18"
      viewBox="0 0 24 27"
      stroke="var(--plum)"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 11c-.6 5.8-3.6 10-8.8 13" fill="none" />
      <path
        d="M10.2 21.6c-4.6-.3-7-3.2-7.6-7 4.6.4 7.4 2.5 7.6 7Z"
        fill="var(--sky)"
      />
      <path
        d="M11.8 19.8c1.6-4 5-5 9-4-2 3.6-5.2 5-9 4Z"
        fill="var(--periwinkle)"
      />
      <path
        d="M14.4 5.3c.8-4.6 5.8-4.3 6.1-1.2.2 1.3-.5 2.4-1.4 3.3
        4.6-.5 4.6 4.5 1.6 5.3-1.2.3-2.4-.1-3.4-.8.8 4.6-3.8 6-5.6 3
        -.6-1-.6-2.2-.3-3.4-3.7 2.3-6.9-1.2-4.7-3.8.8-.9 2.1-1.3 3.4-1.4
        -2.9-2.7-1.2-6 1.6-5.3 1.3.3 2.2 2.1 2.7 4.3Z"
        fill="var(--blush)"
      />
      <path
        d="M12.5 8.3c.2-1.5 1.8-2.3 3.3-1.7 1.6.9 1.8 2.6.5 3.7-1.6 1.3-4 .2-3.8-2Z"
        fill="var(--paper)"
      />
    </svg>
  );
}
export function Sprig() {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 72">
      <g stroke="#34495a" strokeWidth="2.3" strokeLinecap="round">
        <path fill="none" d="M8 64Q44 49 67 7" />
        {[
          [17, 58, -65],
          [30, 48, 5],
          [40, 37, -55],
          [50, 27, 8],
          [60, 16, -35],
        ].map(([x, y, a], i) => (
          <path
            key={i}
            transform={`translate(${x} ${y}) rotate(${a})`}
            d="M0 0Q-7-17 3-23Q12-8 0 0Z"
            fill={i % 2 ? "#a5c0b9" : "#85aaac"}
          />
        ))}
      </g>
    </svg>
  );
}
const markNames: Record<Goal["kind"], string> = {
  minimum: "goal",
  range: "range minimum",
  maximum: "recommended maximum",
  ul: "upper limit",
  energy: "energy estimate",
};
const g = geometry.interior;
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
// Painted layers, back to front: glass back, masked contents (moved by fill,
// tinted by status), target line, glass front, paper label, badge.
export function NutrientJar({
  nutrient,
  fill,
  color,
  marker,
  label,
  value,
}: {
  nutrient: Key;
  fill: number;
  color: string;
  marker?: Goal["kind"];
  label: string;
  value: string;
}) {
  const { sprites } = useArtworkTheme();
  return (
    <span
      className="jar-glass"
      aria-hidden="true"
      style={
        {
          "--tint": color,
          "--mask": `url(${sprites["jars/interior-mask.png"] ?? jarArt.interiorMask})`,
          aspectRatio: `${geometry.width} / ${geometry.height}`,
        } as CSSProperties
      }
    >
      <img
        className="jar-back"
        src={sprites["jars/glass-back.png"] ?? jarArt.glassBack}
        alt=""
      />
      <span className="jar-interior">
        <span
          className="material jar-contents"
          style={{
            top: pct(g.shoulder),
            height: pct(g.bottom - g.shoulder + 0.03),
            transform: `translateY(${(1 - fill) * 100}%)`,
            backgroundImage: `url(${sprites[`jars/contents/${nutrient}.webp`] ?? contents[nutrient]})`,
          }}
        />
      </span>
      {marker && (
        <span
          className="jar-target"
          title={`Target line: ${markNames[marker]}`}
          style={{
            top: pct(g.shoulder),
            left: pct(g.left + 0.04),
            right: pct(1 - g.right + 0.04),
          }}
        />
      )}
      <img
        className="jar-front"
        src={sprites["jars/glass-front.png"] ?? jarArt.glassFront}
        alt=""
      />
      <span
        className="jar-label"
        style={{
          backgroundImage: `url(${sprites["jars/label.png"] ?? jarArt.label})`,
          top: pct(g.shoulder + 0.03),
          fontSize:
            label.length > 12
              ? "11.5cqw"
              : label.length > 8
                ? "14cqw"
                : "17cqw",
        }}
      >
        {label}
      </span>
      <span
        className="jar-badge"
        style={{
          backgroundImage: `url(${sprites["jars/badge.png"] ?? jarArt.badge})`,
          fontSize:
            value.length > 7 ? "12cqw" : value.length > 5 ? "15cqw" : "20cqw",
        }}
      >
        {value}
      </span>
    </span>
  );
}
export const descriptions: Record<Key, string> = {
  calories: "Energy supplied by the foods on your plate.",
  protein: "A building material for tissues and enzymes.",
  fiber: "Plant carbohydrate that supports digestion.",
  fat: "A source of energy and essential fatty acids.",
  carbohydrates: "A major source of dietary energy.",
  totalSugar:
    "All sugars, including naturally occurring and added sugars. There is no total-sugar DRI target.",
  addedSugar: "Sugars added during preparation. Not inferred from total sugar.",
  calcium: "A mineral used in bones and muscle function.",
  iron: "Helps carry oxygen in the blood.",
  magnesium:
    "Supports muscle, nerve and enzyme function. The supplement-only UL does not apply to food.",
  potassium: "An electrolyte used by nerves and muscles.",
  vitaminK: "Supports blood clotting and bone proteins.",
};
