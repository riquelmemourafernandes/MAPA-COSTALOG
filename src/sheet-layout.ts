// Spreadsheet layout helpers shared by rendering, scrolling and batch creation.
export const SCROLL_BATCH_SIZE = 100;
export const MAX_CREATE_ROWS = 100;
export const EMPTY_GRID_ROWS = 35;
// Sizes may deliberately hide text, exactly as in Excel/Google Sheets.
export const MIN_ROW_HEIGHT = 12;
export const MAX_ROW_HEIGHT = 2000;
export const MIN_COLUMN_WIDTH = 24;
export const MAX_COLUMN_WIDTH = 2400;
export const DEFAULT_COLUMN_WIDTH = 180;
export const ROW_NUMBER_COLUMN_WIDTH = 65;

export function normalizeRowHeight(value: number): number {
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT,
    Math.round(Number.isFinite(value) ? value : 35)));
}
export function normalizeColumnWidth(value:number):number{
  return Math.max(MIN_COLUMN_WIDTH,Math.min(MAX_COLUMN_WIDTH,
    Math.round(Number.isFinite(value)?value:DEFAULT_COLUMN_WIDTH)));
}
export function totalSheetWidth(keys:readonly string[],sizes:Record<string,number>):number{
  return ROW_NUMBER_COLUMN_WIDTH + keys.reduce((total,key)=>
    total+normalizeColumnWidth(sizes[key]??DEFAULT_COLUMN_WIDTH),0);
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

// Test mode: 100 editable virtual rows (2–101); row 1 remains the header.
// Only filled rows are ever persisted to the API.
export const SHEET_MAX_ROW = 101;
export const SHEET_DEFAULT_HEIGHT = 35;
export function sparseSheetWindow(
  scrollTop:number,viewportHeight:number,heights:Record<number,number>,
  rowCount=SHEET_MAX_ROW-1,overscan=8
):{start:number;end:number;top:number;bottom:number;totalHeight:number}{
  const adjustments=Object.entries(heights).map(([key,value])=>[Number(key)-2,normalizeRowHeight(value)-SHEET_DEFAULT_HEIGHT] as const)
    .filter(([index,delta])=>index>=0&&index<rowCount&&delta!==0)
    .sort((a,b)=>a[0]-b[0]);
  function offset(index:number){
    let result=index*SHEET_DEFAULT_HEIGHT;
    for(const [at,delta] of adjustments){if(at>=index)break;result+=delta;}
    return result;
  }
  function findRow(y:number){
    let lo=0,hi=rowCount;
    while(lo<hi){
      const mid=(lo+hi)>>1;
      if(offset(mid+1)<=y)lo=mid+1;else hi=mid;
    }
    return lo;
  }
  const totalHeight=offset(rowCount);
  const start=Math.max(0,findRow(Math.max(0,scrollTop))-overscan);
  const end=Math.min(rowCount,findRow(scrollTop+Math.max(0,viewportHeight))+overscan+1);
  return {start,end,top:offset(start),bottom:totalHeight-offset(end),totalHeight};
}
