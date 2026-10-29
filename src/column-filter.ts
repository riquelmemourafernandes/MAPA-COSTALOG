// Pure, deterministic spreadsheet filter helpers. Empty selections mean no
// restriction; a filter applied with zero matches means no rows.
export type ColumnFilter = { values: string[] };
export type ColumnFilterMap = Record<string, ColumnFilter>;
export function matchesColumnFilters(
  data: Record<string, unknown>, filters: ColumnFilterMap, excludedKey?: string
): boolean {
  return Object.entries(filters).every(([key, selection]) => {
    if (key === excludedKey || !selection || !Array.isArray(selection.values)) return true;
    return selection.values.includes(data[key] == null ? "" : String(data[key]));
  });
}
export function uniqueFilterValues(
  data: Array<Record<string, unknown>>, key: string, search = ""
): string[] {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  return [...new Set(data.map(row => row[key] == null ? "" : String(row[key])))]
    .filter(value => value.toLocaleLowerCase("pt-BR").includes(term))
    .sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true,sensitivity:"base"}));
}
