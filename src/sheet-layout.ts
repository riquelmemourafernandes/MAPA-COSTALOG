// Spreadsheet layout helpers shared by rendering, scrolling and batch creation.
export const SCROLL_BATCH_SIZE = 100;
export const MAX_CREATE_ROWS = 100;
export const EMPTY_GRID_ROWS = 35;

export function normalizeRowHeight(value: number): number {
  return Math.max(32, Math.min(800, Math.round(Number.isFinite(value) ? value : 35)));
}
export function normalizeCreateCount(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= MAX_CREATE_ROWS ? value : null;
}
export function shouldLoadNextBatch(args: {
  scrollTop: number; scrollHeight: number; clientHeight: number;
  loadedCount: number; total: number; busy: boolean;
}): boolean {
  if (args.busy || args.total <= args.loadedCount || args.clientHeight <= 0) return false;
  return args.scrollHeight - (args.scrollTop + args.clientHeight) < 350;
}
export function mergeLoadedRows<T extends {id:string}>(previous:T[], next:T[]):T[] {
  const seen = new Set<string>();
  return [...previous, ...next].filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id); return true;
  });
}
