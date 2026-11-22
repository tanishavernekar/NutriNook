import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { fmt, labels, unit, type Goal, type Key } from "./model";
import {
  bookFor,
  fpedPage,
  loadBook,
  portionFor,
  rankedSources,
  type ReferenceBook,
  type ReferenceFood,
} from "./data/foodReference";

const pageSize = 5;
const approx = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 }).format(n);
const span = (low: number, high?: number) =>
  high === undefined ? approx(low) : `${approx(low)}–${approx(high)}`;
const referenceAmount = (n: number) => (n > 0 && n < 0.01 ? approx(n) : fmt(n));
const pluralMeasures: Record<string, string> = {
  cup: "cups",
  piece: "pieces",
  slice: "slices",
  patty: "patties",
};
const portionSources = {
  sr: ["USDA labeled serving", "https://fdc.nal.usda.gov/download-datasets/"],
  fndds: [
    "USDA survey default portion",
    "https://www.ars.usda.gov/ARSUserFiles/80400530/pdf/fndds/2017_2018_FNDDS_Doc.pdf",
  ],
  fda: [
    "FDA customary portion",
    "https://www.law.cornell.edu/cfr/text/21/101.12",
  ],
  meat: [
    "USDA customary meat portion",
    "https://www.law.cornell.edu/cfr/text/9/317.312",
  ],
  poultry: [
    "USDA customary poultry portion",
    "https://www.law.cornell.edu/cfr/text/9/381.412",
  ],
} as const;

function Portion({
  food,
  per100,
  nutrient,
  goal,
  date,
}: {
  food: ReferenceFood;
  per100: number;
  nutrient: Key;
  goal?: Goal;
  date: string;
}) {
  const result = portionFor(per100, goal);
  const added = nutrient === "addedSugar";
  const basis = food.portion && portionSources[food.portion.basis];
  return (
    <div className="source-portion" id={`portion-${food.id}`}>
      {"note" in result ? (
        <p>{result.note}</p>
      ) : (
        goal && (
          <>
            <p>
              {result.label}:{" "}
              <strong>
                about {span(result.low, result.high)} g of this food
              </strong>
              .
            </p>
            <p>
              {goal.custom ? "Custom setting" : goal.reference} for {date}:{" "}
              {referenceAmount(goal.value)}
              {goal.kind === "range" && `–${referenceAmount(goal.max!)}`}{" "}
              {unit(nutrient)} {labels[nutrient].toLowerCase()}.
            </p>
            {food.measure && (
              <p>
                About{" "}
                {span(
                  result.low / food.measure.grams,
                  result.high === undefined
                    ? undefined
                    : result.high / food.measure.grams,
                )}{" "}
                {(result.high ?? result.low) === food.measure.grams
                  ? food.measure.name
                  : (pluralMeasures[food.measure.name] ??
                    food.measure.name)}{" "}
                (USDA: 1 {food.measure.name} weighs {fmt(food.measure.grams)}{" "}
                g).
              </p>
            )}
            {basis && (
              <p>
                {fmt(per100)} {unit(nutrient)} per 100 g. Portion basis:{" "}
                <a href={basis[1]} target="_blank" rel="noreferrer">
                  {basis[0]} ↗
                </a>
                .
              </p>
            )}
            <p>
              {result.limit
                ? "This compares a limit, not an amount to aim for."
                : "This compares one food with the whole day’s reference, not a suggested serving."}
            </p>
          </>
        )
      )}
      <a
        href={
          added
            ? fpedPage
            : `https://fdc.nal.usda.gov/food-details/${food.id}/nutrients`
        }
        target="_blank"
        rel="noreferrer"
      >
        {added
          ? `USDA FPED 2017–18 · food code ${food.id}`
          : `USDA SR Legacy · FDC ${food.id}`}{" "}
        ↗
      </a>
    </div>
  );
}

export function FoodSources({
  nutrient,
  goal,
  date,
}: {
  nutrient: Key;
  goal?: Goal;
  date: string;
}) {
  const source = bookFor(nutrient);
  const [book, setBook] = useState<ReferenceBook>();
  const [failed, setFailed] = useState(false),
    [attempt, retry] = useState(0);
  const [query, setQuery] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const infoId = `food-source-info-${nutrient}`;
  const [page, setPage] = useState(0),
    [selected, select] = useState<number>();
  useEffect(() => {
    let active = true;
    setFailed(false);
    loadBook(source).then(
      (data) => {
        if (active) setBook(data);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [source, attempt]);
  const ranked = useMemo(
    () => book && rankedSources(book, nutrient, goal),
    [book, nutrient, goal],
  );
  const matches = useMemo(() => {
    if (!ranked) return [];
    const words = query.trim().toLowerCase().split(/\s+/);
    return ranked.foods.filter(({ food }) =>
      words.every((w) => food.name.toLowerCase().includes(w)),
    );
  }, [ranked, query]);
  const changePage = (n: number) => {
    setPage(n);
    select(undefined);
  };
  const first = page * pageSize,
    last = Math.min(first + pageSize, matches.length);
  const u = unit(nutrient);
  const referenceLabel =
    goal?.kind === "range"
      ? "range minimum"
      : goal?.kind === "maximum" || goal?.kind === "ul"
        ? "limit"
        : goal?.kind === "energy"
          ? "energy estimate"
          : "daily goal";
  if (failed)
    return (
      <p role="alert">
        The local food reference could not be loaded.{" "}
        <button onClick={() => retry(attempt + 1)}>Try again</button>
      </p>
    );
  if (!ranked) return <p role="status">Opening the food reference…</p>;
  return (
    <div className="food-sources">
      <div className="source-heading">
        <h3>
          {nutrient === "calories" ? "Energy-dense foods" : "Rich food sources"}
        </h3>
        <button
          type="button"
          aria-label="About these food sources"
          title="About these food sources"
          aria-controls={infoId}
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen((open) => !open)}
        >
          <Info size={18} aria-hidden="true" />
        </button>
      </div>
      <div id={infoId} className="source-info" hidden={!infoOpen}>
        <p>
          {nutrient === "addedSugar"
            ? "USDA FPED 2017–18 · estimated added sugars"
            : "USDA SR Legacy 2018"}
          {nutrient === "vitaminK" && " · vitamin K₁ only"}. Foods are ranked by
          the amount in one typical portion, not per 100 g.
        </p>
        <p>
          Each portion must account for at least 10% of the {referenceLabel}{" "}
          saved for this date. Foods without a documented portion are left out.
          This is a browsing filter, not serving advice.
        </p>
      </div>
      {!ranked.note && (
        <input
          type="search"
          aria-label="Search food sources"
          placeholder="Search foods or preparations…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            changePage(0);
          }}
        />
      )}
      <p className="source-count" role="status">
        {ranked.note ??
          (matches.length
            ? `${fmt(first + 1)}–${fmt(last)} of ${fmt(matches.length)} foods`
            : query.trim()
              ? "No matching foods meet the 10% cutoff. Try another food."
              : "No foods with a documented portion meet the 10% cutoff for this reference.")}
      </p>
      <ul className="source-list">
        {matches
          .slice(first, last)
          .map(({ food, per100, portion, amount, percent }) => (
            <li key={food.id}>
              <button
                type="button"
                aria-expanded={selected === food.id}
                aria-controls={
                  selected === food.id ? `portion-${food.id}` : undefined
                }
                onClick={() =>
                  select(selected === food.id ? undefined : food.id)
                }
              >
                <span>
                  {food.name}
                  <small>
                    {referenceAmount(amount)} {u} in a{" "}
                    {referenceAmount(portion.grams)} g portion · {fmt(percent)}%
                    of your {referenceLabel}
                  </small>
                </span>
                {selected === food.id ? (
                  <ChevronDown size={17} />
                ) : (
                  <ChevronRight size={17} />
                )}
              </button>
              {selected === food.id && (
                <Portion {...{ food, per100, nutrient, date, goal }} />
              )}
            </li>
          ))}
      </ul>
      {matches.length > pageSize && (
        <div className="source-paging">
          <button
            aria-label="Previous food results"
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          >
            Previous
          </button>
          <button
            aria-label="Next food results"
            disabled={last === matches.length}
            onClick={() => changePage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
