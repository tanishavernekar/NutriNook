import { useRef, useState } from "react";
import { pantryCell, pantryHeading, pantryTSV, tableColumns } from "./data/csv";
import type { Food } from "./model";
import { usePantryClipboard } from "./pantryClipboard";

type Point = { row: number; col: number };
type Range = { anchor: Point; end: Point };
const same = (a: Point, b: Point) => a.row === b.row && a.col === b.col;

export function PantryCopy({
  foods,
  done,
}: {
  foods: Food[];
  done: () => void;
}) {
  const [range, setRange] = useState<Range | null>(null);
  const [headers, setHeaders] = useState(false);
  const clipboard = usePantryClipboard();
  const awaitingEnd = useRef(false);
  const dragging = useRef(false);
  const grid = useRef<HTMLTableElement>(null);
  const bounds = range && {
    top: Math.min(range.anchor.row, range.end.row),
    bottom: Math.max(range.anchor.row, range.end.row),
    left: Math.min(range.anchor.col, range.end.col),
    right: Math.max(range.anchor.col, range.end.col),
  };
  const count = bounds
    ? `${bounds.bottom - bounds.top + 1} rows × ${bounds.right - bounds.left + 1} columns`
    : "No cells selected";
  function pick(p: Point, extend: boolean) {
    setRange((old) => ({ anchor: extend && old ? old.anchor : p, end: p }));
    clipboard.reset();
  }
  function focus(p: Point, scroll: boolean) {
    const el = grid.current?.tBodies[0]?.rows[p.row]?.cells[p.col];
    el?.focus({ preventScroll: true });
    if (scroll) el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function selectAll() {
    if (!foods.length) return;
    const anchor = { row: 0, col: 0 };
    setRange({
      anchor,
      end: { row: foods.length - 1, col: tableColumns.length - 1 },
    });
    awaitingEnd.current = false;
    clipboard.reset();
  }
  function text() {
    return bounds
      ? pantryTSV(
          foods.slice(bounds.top, bounds.bottom + 1),
          tableColumns.slice(bounds.left, bounds.right + 1),
          headers,
        )
      : "";
  }
  return (
    <div
      className="pantry-copy-panel"
      onCopy={(e) => {
        if (!range || e.target instanceof HTMLTextAreaElement) return;
        clipboard.native(e, text(), `Copied ${count}.`);
      }}
    >
      <p className="copy-hint" id="pantry-copy-hint">
        Drag across cells or tap two opposite corners. Shift + arrows extends
        the range; ⌘C or Ctrl+C copies it.
      </p>
      <div className="sheet-scroll copy-scroll">
        <table
          role="grid"
          aria-label="Pantry cells to copy"
          aria-multiselectable="true"
          aria-describedby="pantry-copy-hint"
          ref={grid}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
              e.preventDefault();
              selectAll();
              return;
            }
            const el = e.target;
            if (!(el instanceof HTMLTableCellElement)) return;
            const point = {
              row: (el.parentElement as HTMLTableRowElement).sectionRowIndex,
              col: el.cellIndex,
            };
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick(point, e.shiftKey || awaitingEnd.current);
              awaitingEnd.current = !awaitingEnd.current;
              return;
            }
            const deltas: Record<string, [number, number]> = {
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
            };
            const delta = deltas[e.key];
            if (!delta) return;
            e.preventDefault();
            const p = {
              row: Math.max(
                0,
                Math.min(foods.length - 1, point.row + delta[0]),
              ),
              col: Math.max(
                0,
                Math.min(tableColumns.length - 1, point.col + delta[1]),
              ),
            };
            if (e.shiftKey && !range) setRange({ anchor: point, end: p });
            else pick(p, e.shiftKey);
            awaitingEnd.current = false;
            focus(p, true);
          }}
          onMouseUp={() => {
            dragging.current = false;
          }}
        >
          <thead>
            <tr>
              {tableColumns.map((c) => (
                <th scope="col" key={c}>
                  {pantryHeading(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {foods.map((f, row) => (
              <tr key={f.id}>
                {tableColumns.map((c, col) => {
                  const p = { row, col };
                  const selected =
                    !!bounds &&
                    row >= bounds.top &&
                    row <= bounds.bottom &&
                    col >= bounds.left &&
                    col <= bounds.right;
                  const Tag = col === 0 ? "th" : "td";
                  return (
                    <Tag
                      key={c}
                      scope={col === 0 ? "row" : undefined}
                      role="gridcell"
                      aria-selected={selected}
                      tabIndex={
                        same(range?.end ?? { row: 0, col: 0 }, p) ? 0 : -1
                      }
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        dragging.current = true;
                        const extend = e.shiftKey || awaitingEnd.current;
                        pick(p, extend);
                        awaitingEnd.current = !extend;
                        focus(p, false);
                      }}
                      onMouseEnter={(e) => {
                        if (e.buttons !== 1 || !dragging.current) return;
                        awaitingEnd.current = false;
                        pick(p, true);
                        focus(p, false);
                      }}
                    >
                      {pantryCell(f, c)}
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!foods.length && <p>No matching foods to copy.</p>}
      </div>
      <div className="pantry-bar copy-controls">
        <button
          className="plain"
          type="button"
          disabled={!foods.length}
          onClick={selectAll}
        >
          Select all cells
        </button>
        <button
          className="plain"
          type="button"
          disabled={!range}
          onClick={() => {
            if (!range) return;
            setRange({
              anchor: { ...range.anchor, col: 0 },
              end: { ...range.end, col: tableColumns.length - 1 },
            });
            awaitingEnd.current = false;
            clipboard.reset();
          }}
        >
          Select full rows
        </button>
        <label>
          <input
            type="checkbox"
            checked={headers}
            onChange={(e) => {
              setHeaders(e.target.checked);
              clipboard.reset();
            }}
          />{" "}
          Include headings
        </label>
        <button
          className="primary"
          type="button"
          disabled={!range}
          onClick={() => clipboard.write(text(), `Copied ${count}.`)}
        >
          Copy selection
        </button>
        <button className="plain" type="button" onClick={done}>
          Done
        </button>
      </div>
      <output aria-live="polite">{clipboard.message || count}</output>
      {clipboard.fallback}
    </div>
  );
}
