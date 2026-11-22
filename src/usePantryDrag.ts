import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { tableColumns } from "./data/csv";

type Point = { row: number; col: number };
const same = (a: Point, b: Point) => a.row === b.row && a.col === b.col;

function cellAt(el: Element | null): Point | null {
  const cell = el?.closest("tbody td, tbody th");
  const row = cell?.parentElement;
  if (
    !(cell instanceof HTMLTableCellElement) ||
    !(row instanceof HTMLTableRowElement) ||
    cell.cellIndex >= tableColumns.length
  )
    return null;
  return { row: row.sectionRowIndex, col: cell.cellIndex };
}

/** An ordinary click edits text. Crossing a cell boundary takes the gesture away from the input. */
export function usePantryDrag(
  grid: RefObject<HTMLDivElement | null>,
  view: string,
) {
  const [range, setRange] = useState<{
    start: Point;
    end: Point;
    view: string;
  } | null>(null);
  const lastAnchor = useRef<{ point: Point; view: string } | null>(null);
  const endGesture = useRef<(() => void) | null>(null);
  useEffect(() => {
    setRange(null);
    lastAnchor.current = null;
    return () => endGesture.current?.();
  }, [view]);
  const clear = () => {
    endGesture.current?.();
    lastAnchor.current = null;
    setRange(null);
  };
  function startGesture(e: MouseEvent<HTMLDivElement>) {
    const scroller = grid.current;
    if (
      !scroller ||
      e.button !== 0 ||
      !(e.target instanceof Element) ||
      e.target.closest("button, label, textarea")
    )
      return;
    const origin = cellAt(e.target);
    if (!origin) return;
    const root = scroller;
    endGesture.current?.();
    const extend = e.shiftKey && lastAnchor.current?.view === view;
    const start =
      extend && lastAnchor.current ? lastAnchor.current.point : origin;
    lastAnchor.current = { point: start, view };
    let active = false,
      end: Point | null = null,
      frame = 0;
    let x = e.clientX,
      y = e.clientY;
    function choose(p: Point) {
      if (end && same(end, p)) return;
      active = true;
      end = p;
      root.focus({ preventScroll: true });
      window.getSelection()?.removeAllRanges();
      setRange({ start, end: p, view });
    }
    if (extend) {
      e.preventDefault();
      choose(origin);
    } else setRange(null);
    function track() {
      frame = 0;
      const r = root.getBoundingClientRect();
      const table = root.querySelector("table");
      if (!table || !r.width || !r.height) return;
      const top = r.top + (table.tHead?.offsetHeight ?? 0) + 2;
      const bottom = r.bottom - (table.tFoot?.offsetHeight ?? 0) - 2;
      const point = cellAt(
        document.elementFromPoint(
          Math.max(r.left + 2, Math.min(r.right - 2, x)),
          Math.max(top, Math.min(bottom, y)),
        ),
      );
      if (point && (active || !same(start, point))) choose(point);
      if (!active) return;
      const dx = x > r.right - 20 ? 16 : x < r.left + 20 ? -16 : 0;
      const dy = y > bottom - 12 ? 12 : y < top + 12 ? -12 : 0;
      const beforeX = root.scrollLeft,
        beforeY = root.scrollTop;
      root.scrollBy(dx, dy);
      if (beforeX !== root.scrollLeft || beforeY !== root.scrollTop)
        frame = requestAnimationFrame(track);
    }
    function move(event: globalThis.MouseEvent) {
      if (event.buttons !== 1) {
        stop();
        return;
      }
      x = event.clientX;
      y = event.clientY;
      if (!frame) track();
      if (active) event.preventDefault();
    }
    function stop() {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", stop, true);
      window.removeEventListener("blur", stop);
      endGesture.current = null;
    }
    endGesture.current = stop;
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", stop, true);
    window.addEventListener("blur", stop);
  }
  const bounds =
    range?.view === view
      ? {
          top: Math.min(range.start.row, range.end.row),
          bottom: Math.max(range.start.row, range.end.row),
          left: Math.min(range.start.col, range.end.col),
          right: Math.max(range.start.col, range.end.col),
        }
      : null;
  return {
    bounds,
    clear,
    startGesture,
    selected: (r: number, c: number) =>
      (!!bounds &&
        r >= bounds.top &&
        r <= bounds.bottom &&
        c >= bounds.left &&
        c <= bounds.right) ||
      undefined,
  };
}
