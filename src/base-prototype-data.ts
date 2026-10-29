// Local-only demo of the MAPA IMPORTAÇÃO > BASE and 55-row import.
// Never sends data to an API and never changes production data.
export type DemoCatalogItem = {
  id: string;
  label: string;
  active: boolean;
  city?: string;
  km?: number;
};
export type DemoCatalog = Record<string, DemoCatalogItem[]>;
export type DemoImportRow = { sourceRow: number; values: string[] };
export const IMPORT_START = 12202;
export const IMPORT_END = 12256;
export const IMPORT_COUNT = IMPORT_END - IMPORT_START + 1;
export const IMPORT_COLUMNS = 72;

export const DEMO_LISTS = [
  { id: "ATENDENTE", label: "Atendentes", base: "A", mapa: ["B"] },
  { id: "MODALIDADE", label: "Modalidades", base: "B", mapa: ["E"] },
  { id: "CLIENTE", label: "Clientes", base: "C", mapa: ["L"] },
  { id: "COLETA", label: "Terminais de coleta", base: "D/E", mapa: ["AJ","AK"] },
  { id: "ENTREGA", label: "Cidades de entrega e KM", base: "F/G", mapa: ["AN","AO","AR"] },
  { id: "DEPOT", label: "Terminais de vazio / depot", base: "H", mapa: ["BD"] },
  { id: "CIDADE_DEPOT", label: "Cidades do depot", base: "I", mapa: ["BE"] },
  { id: "STATUS", label: "Status", base: "J", mapa: ["C"] },
  { id: "ARMADOR", label: "Armadores", base: "K", mapa: ["AZ"] },
  { id: "STATUS_PROG", label: "Status da programação", base: "O", mapa: ["AB"] },
  { id: "TIPO_CC", label: "Tipos de contêiner", base: "U", mapa: ["U"] }
] as const;

export function excelColumn(index: number): string {
  let n = index+1, label = "";
  while (n > 0) { n--; label = String.fromCharCode(65+n%26)+label; n=Math.floor(n/26); }
  return label;
}

export const PREVIEW_COLUMNS = [
  { key: "A", label: "DATA" },
  { key: "B", label: "ATENDENTE" },
  { key: "C", label: "STATUS" },
  { key: "E", label: "MODALIDADE" },
  { key: "L", label: "CLIENTE" },
  { key: "T", label: "CONTAINER" },
  { key: "AJ", label: "TERMINAL COLETA" },
  { key: "AN", label: "ENTREGA - 1" },
  { key: "AO", label: "KM" },
  { key: "AZ", label: "ARMADOR" },
  { key: "BD", label: "TERMINAL DE VAZIO" }
] as const;

const sampleValues: Record<string, string[]> = {
  ATENDENTE: ["Atendente de exemplo 01", "Atendente de exemplo 02"],
  MODALIDADE: ["DI", "DUIMP", "CABOTAGEM"],
  CLIENTE: ["Cliente de demonstração A", "Cliente de demonstração B"],
  COLETA: ["Terminal exemplo Santos", "Terminal exemplo Guarujá"],
  ENTREGA: ["SANTOS - SP", "PIRACICABA - SP"],
  DEPOT: ["Depot exemplo A", "Depot exemplo B"],
  CIDADE_DEPOT: ["SANTOS - SP", "GUARUJÁ - SP"],
  STATUS: ["NOVO", "AG. DOCS", "EM ABERTO", "FINALIZADO"],
  ARMADOR: ["Armador de exemplo A", "Armador de exemplo B"],
  STATUS_PROG: ["2º VIAGEM", "REUTILIZAÇÃO"],
  TIPO_CC: ["20DC", "40HC"]
};
export function createDemoCatalog(): DemoCatalog {
  const result: DemoCatalog = {};
  for (const list of DEMO_LISTS) {
    result[list.id] = (sampleValues[list.id] || []).map((label, index) => ({
      id: "demo-" + list.id + "-" + index,
      label, active: true,
      ...(list.id === "COLETA" ? {city: index ? "GUARUJÁ - SP" : "SANTOS - SP"} : {}),
      ...(list.id === "ENTREGA" ? {km: index ? 190 : 0} : {})
    }));
  }
  return result;
}

export function parseSheetsClipboard(input: string): string[][] {
  const text = input.replace(/\r\n?/g, "\n");
  if (!text.trim()) return [];
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i=0; i<text.length; i++) {
    const character=text[i];
    if (character === '"') {
      if (quoted && text[i+1] === '"') { field+='"'; i++; }
      else if (quoted) quoted=false;
      else if (!field.length) quoted=true;
      else field+='"';
    } else if (character === "\t" && !quoted) {
      row.push(field); field="";
    } else if (character === "\n" && !quoted) {
      row.push(field); rows.push(row); row=[]; field="";
    } else {
      field+=character;
    }
  }
  if (quoted) throw new Error("Texto com aspas não fechadas. Copie novamente o intervalo no Sheets.");
  if (field.length || row.length) { row.push(field);rows.push(row); }
  return rows;
}
export function validateImportGrid(input: string): { rows: DemoImportRow[]; errors: string[] } {
  const errors: string[] = [];
  let matrix: string[][];
  try { matrix=parseSheetsClipboard(input); }
  catch(error) { return {rows:[],errors:[error instanceof Error ? error.message : "Erro ao ler colagem."]}; }
  if (matrix.length !== IMPORT_COUNT) errors.push("Esperadas 55 linhas; recebidas "+matrix.length+".");
  const bad = matrix.findIndex(line=>line.length !== IMPORT_COLUMNS);
  if (bad >= 0) errors.push("A linha "+(IMPORT_START+bad)+" tem "+matrix[bad].length+" colunas; esperado: 72 (A:BT).");
  if (matrix.some(line=>line.some(text=>text.length>20000))) errors.push("Uma célula ultrapassou o limite de 20.000 caracteres.");
  if (errors.length) return {rows:[],errors};
  return {rows:matrix.map((values,index)=>({sourceRow:IMPORT_START+index,values})),errors:[]};
}
export function makeSampleImportRows(): DemoImportRow[] {
  return Array.from({length:IMPORT_COUNT},(_,index)=>{
    const values=Array(IMPORT_COLUMNS).fill("") as string[];
    values[0]="31/10/2026";
    values[1]=index%2?"Atendente de exemplo 02":"Atendente de exemplo 01";
    values[2]=index%3?"AG. DOCS":"NOVO";
    values[4]="DUIMP";
    values[11]=index%2?"Cliente de demonstração B":"Cliente de demonstração A";
    values[19]="CONT-DEMO-"+String(index+1).padStart(4,"0");
    values[35]="Terminal exemplo Santos";
    values[39]=index%2?"PIRACICABA - SP":"SANTOS - SP";
    values[40]=index%2?"190":"0";
    values[51]="Armador de exemplo A";
    values[55]="Depot exemplo A";
    return {sourceRow:IMPORT_START+index,values};
  });
}
export function mergeImportedRows(current: DemoImportRow[], incoming: DemoImportRow[]) {
  const merged = new Map<number,DemoImportRow>();
  current.forEach(row=>merged.set(row.sourceRow,row));
  incoming.forEach(row=>merged.set(row.sourceRow,row));
  return [...merged.values()].sort((a,b)=>a.sourceRow-b.sourceRow);
}
export function normalizeCatalogLabel(value: string) {
  return value.trim().replace(/\s+/g," ").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
}
export function createCatalogItem(
  existing: DemoCatalogItem[], input: {label:string;city?:string;km?:string}
): DemoCatalogItem {
  const label=input.label.trim().replace(/\s+/g," ");
  if (!label || label.length>255) throw new Error("Informe um nome válido com até 255 caracteres.");
  if (existing.some(item=>normalizeCatalogLabel(item.label)===normalizeCatalogLabel(label)))
    throw new Error("Este valor já existe na BASE desta categoria.");
  const km = input.km?.trim() ? Number(input.km.replace(",",".")) : undefined;
  if (km !== undefined && (!Number.isFinite(km) || km<0 || km>100000))
    throw new Error("Informe uma quilometragem válida.");
  return {
    id:"local-"+Math.random().toString(36).slice(2),
    label,active:true,
    ...(input.city?.trim()?{city:input.city.trim()}:{}),
    ...(km!==undefined?{km}: {})
  };
}
