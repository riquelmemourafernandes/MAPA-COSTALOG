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

/** Window the visible rows: thousands of cells are never mounted at once. */
export function virtualRowWindow(
  heights: number[], scrollTop: number, viewportHeight: number, overscan = 8
): {start:number;end:number;top:number;bottom:number;totalHeight:number} {
  const offsets = [0];
  for (const height of heights) offsets.push(offsets[offsets.length - 1] + normalizeRowHeight(height));
  const totalHeight = offsets[offsets.length - 1];
  const binarySearch = (target: number) => {
    let low = 0, high = heights.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (offsets[mid + 1] <= target) low = mid + 1; else high = mid;
    }
    return low;
  };
  const first = binarySearch(Math.max(0,scrollTop));
  const last = binarySearch(Math.max(0,scrollTop) + Math.max(0,viewportHeight));
  const start = Math.max(0,first - overscan);
  const end = Math.min(heights.length,last + overscan + 1);
  return {start,end,top:offsets[start],bottom:totalHeight-offsets[end],totalHeight};
}
