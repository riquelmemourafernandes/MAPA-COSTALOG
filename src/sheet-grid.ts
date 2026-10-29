// Small, pure helpers for spreadsheet-like grid interactions.
export type GridPosition = { row: number; column: number };

export function selectionBounds(a: GridPosition, b: GridPosition) {
  return {
    top: Math.min(a.row, b.row), bottom: Math.max(a.row, b.row),
    left: Math.min(a.column, b.column), right: Math.max(a.column, b.column)
  };
}

// Google Sheets clipboard: rows separated by line breaks, columns by tabs.
// A final newline is a terminator, not an extra row.
export function parseClipboardGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  return normalized.split("\n").map(row => row.split("\t"));
}

export function serializeSelection(
  bounds: ReturnType<typeof selectionBounds>,
  cellAt: (row: number, column: number) => string
): string {
  const lines: string[] = [];
  for (let r = bounds.top; r <= bounds.bottom; r++) {
    const values: string[] = [];
    for (let c = bounds.left; c <= bounds.right; c++) {
      values.push(cellAt(r, c).replace(/[\t\r\n]/g, " "));
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

export function moveGridPosition(
  from: GridPosition, key: string, rowCount: number, columnCount: number,
  backwards = false
): GridPosition {
  if (!rowCount || !columnCount) return from;
  const next = { ...from };
  if (key === "ArrowUp") next.row--;
  if (key === "ArrowDown") next.row++;
  if (key === "ArrowLeft") next.column--;
  if (key === "ArrowRight") next.column++;
  if (key === "Enter") next.row += backwards ? -1 : 1;
  if (key === "Tab") {
    next.column += backwards ? -1 : 1;
    if (next.column >= columnCount) { next.column = 0; next.row++; }
    else if (next.column < 0) { next.column = columnCount - 1; next.row--; }
  }
  return {
    row: Math.min(rowCount - 1, Math.max(0, next.row)),
    column: Math.min(columnCount - 1, Math.max(0, next.column))
  };
}

export type GridValue = string | number | boolean | null;
export function parseEditableValue(
  dataType: string,
  text: string
): { ok: true; value: GridValue } | { ok: false; message: string } {
  if (text === "") return { ok: true, value: null };
  if (dataType === "number" || dataType === "currency") {
    const number = Number(text.trim().replace(",", "."));
    return Number.isFinite(number)
      ? { ok: true, value: number }
      : { ok: false, message: "Número inválido" };
  }
  if (dataType === "boolean") {
    const normalized = text.trim().toLocaleLowerCase("pt-BR");
    if (["sim", "true", "1", "yes"].includes(normalized)) return { ok: true, value: true };
    if (["não", "nao", "false", "0", "no"].includes(normalized)) return { ok: true, value: false };
    return { ok: false, message: "Use Sim ou Não" };
  }
  return { ok: true, value: text };
}

// Prevent gigantic or out-of-range clipboard pastes before any API writes.
export function canPasteMatrix(
  matrix: string[][],
  start: GridPosition,
  rowCount: number,
  columnCount: number,
  maxCells = 200
): boolean {
  const width = Math.max(0, ...matrix.map(row => row.length));
  return matrix.length > 0 && width > 0 &&
    matrix.length * width <= maxCells &&
    start.row >= 0 && start.column >= 0 &&
    start.row + matrix.length <= rowCount &&
    start.column + width <= columnCount &&
    matrix.every(row => row.length === width);
}


export type GridKeyboardAction = "move" | "edit" | "confirm" | "cancel" | "ignore";

// Spreadsheet mode: Enter opens an existing cell for partial editing.
// While editing, Enter confirms and moves down; Tab confirms and moves right.
export function gridKeyboardAction(key: string, editing: boolean): GridKeyboardAction {
  if (editing) {
    if (key === "Enter" || key === "Tab") return "confirm";
    if (key === "Escape") return "cancel";
    return "ignore";
  }
  if (key === "F2" || key === "Enter") return "edit";
  if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return "move";
  return "ignore";
}

// Delete/Backspace clears selected grid cells, never removes rows or formatting.
// Returns null on a protected target or an excessively large selection.
export function planClearSelection(
  bounds: ReturnType<typeof selectionBounds>,
  rows: {id:string;data:Record<string,unknown>}[],
  columns: {key:string;editable:boolean}[], maxCells = 2000
): {rowId:string;changes:Record<string,null>}[] | null {
  const count = (bounds.bottom-bounds.top+1)*(bounds.right-bounds.left+1);
  if(count<=0||count>maxCells||bounds.top<0||bounds.left<0||
      bounds.bottom>=rows.length||bounds.right>=columns.length)return null;
  const edits:{rowId:string;changes:Record<string,null>}[]=[];
  for(let r=bounds.top;r<=bounds.bottom;r++){
    const row=rows[r],changes:Record<string,null>={};
    for(let c=bounds.left;c<=bounds.right;c++){
      const column=columns[c];
      if(!column.editable)return null;
      const value=row.data?.[column.key];
      if(value!==null && value!==undefined && value!=="") changes[column.key]=null;
    }
    if(Object.keys(changes).length)edits.push({rowId:row.id,changes});
  }
  return edits;
}
