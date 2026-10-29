// Checkbox columns from the reference MAPA spreadsheet (not the bulk row selector).
export const CHECKBOX_COLUMN_KEYS = ["AA", "AI", "BI", "BJ", "BQ"] as const;

export function isCheckboxColumn(key: string, dataType: string): boolean {
  return dataType === "boolean" || (CHECKBOX_COLUMN_KEYS as readonly string[]).includes(key);
}

export function checkboxChecked(value: unknown): boolean {
  return value === true || value === 1 ||
    (typeof value === "string" && ["true", "1", "sim", "yes", "checked"].includes(value.trim().toLocaleLowerCase("pt-BR")));
}

export function checkboxSaveText(checked: boolean): string {
  return checked ? "true" : "false";
}
