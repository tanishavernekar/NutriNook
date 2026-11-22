import type { Entry } from "./model";
export type Change = { date: string; before: Entry[]; after: Entry[] };
export class PlateHistory {
  past: Change[] = [];
  future: Change[] = [];
  push(change: Change) {
    this.past.push(change);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  step(redo: boolean) {
    const c = (redo ? this.future : this.past).pop();
    if (!c) return;
    (redo ? this.past : this.future).push(c);
    return { date: c.date, entries: redo ? c.after : c.before };
  }
}
export const replaceDay = (entries: Entry[], date: string, day: Entry[]) => [
  ...entries.filter((e) => e.date !== date),
  ...day,
];
