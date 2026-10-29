// Columns with Google Sheets ONE_OF_RANGE validation linked to BASE.
export const BASE_COLUMN_LIST: Record<string,string> = {
  B:"ATENDENTE", C:"STATUS", E:"MODALIDADE", L:"CLIENTE",
  U:"TIPO_CC", AB:"STATUS_PROG", AJ:"COLETA", AK:"CIDADE_COLETA",
  AN:"ENTREGA", AR:"ENTREGA", AZ:"ARMADOR",
  BD:"DEPOT", BE:"CIDADE_DEPOT"
};
export function searchOptions(options:string[],query:string):string[] {
  const normalized=query.trim().toLocaleLowerCase("pt-BR");
  return Array.from(new Set(options.filter(Boolean)))
    .filter(value=>value.toLocaleLowerCase("pt-BR").includes(normalized))
    .sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true,sensitivity:"base"}));
}
// Only options from BASE (or existing values read from a row) can be submitted.
export function resolveDropdownValue(
  typed: string, options:string[], highlightedIndex:number
):string|null {
  const exact=options.find(x=>x.toLocaleLowerCase("pt-BR")===typed.trim().toLocaleLowerCase("pt-BR"));
  if(exact)return exact;
  if(highlightedIndex>=0 && highlightedIndex<options.length)return options[highlightedIndex];
  return null;
}

/** Clicking an existing cell opens every option; typing starts a search. */
export function initialDropdownSearch(currentValue:string,initialQuery:string):string {
  return initialQuery===currentValue ? "" : initialQuery;
}
/** Enter/Tab without a new choice preserves the original value. */
export function confirmDropdownValue(
  query:string,currentValue:string,options:string[],highlightedIndex:number
):string|null {
  if(!query.trim()&&highlightedIndex<0)return currentValue;
  return resolveDropdownValue(query,options,highlightedIndex);
}
