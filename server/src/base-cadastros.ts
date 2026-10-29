import { z } from "zod";

// Existing lookup_values table stores BASE records; no schema migration.
export const BASE_LISTS = [
  { key: "ATENDENTE", label: "Atendentes", sheetColumn: "A", mapaColumns: ["B"] },
  { key: "MODALIDADE", label: "Modalidades", sheetColumn: "B", mapaColumns: ["E"] },
  { key: "CLIENTE", label: "Clientes", sheetColumn: "C", mapaColumns: ["L"] },
  { key: "COLETA", label: "Terminais de coleta", sheetColumn: "D", mapaColumns: ["AJ"] },
  { key: "ENTREGA", label: "Cidades de entrega", sheetColumn: "F", mapaColumns: ["AN", "AR"] },
  { key: "DEPOT", label: "Terminais de vazio / Depot", sheetColumn: "H", mapaColumns: ["BD"] },
  { key: "CIDADE_DEPOT", label: "Cidades de depot", sheetColumn: "I", mapaColumns: ["BE"] },
  { key: "STATUS", label: "Status", sheetColumn: "J", mapaColumns: ["C"] },
  { key: "ARMADOR", label: "Armadores", sheetColumn: "K", mapaColumns: ["AZ"] },
  { key: "STATUS_PROG", label: "Segunda viagem / programação", sheetColumn: "O", mapaColumns: ["AB"] },
  { key: "TIPO_CC", label: "Tipos de contêiner", sheetColumn: "U", mapaColumns: ["U"] }
] as const;

export const BASE_LIST_KEYS = new Set<string>(BASE_LISTS.map(list => list.key));
export function normalizeBaseLabel(input: string) {
  return input.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
export const baseItemSchema = z.object({
  listName: z.string().max(40).refine(value => BASE_LIST_KEYS.has(value), "Tipo de cadastro inválido."),
  label: z.string().trim().min(1).max(255),
  metadata: z.object({
    cidade: z.string().trim().max(160).optional(),
    km: z.number().finite().min(0).max(100000).optional()
  }).strict().default({})
}).strict();
export const baseUpdateSchema = z.object({
  label: z.string().trim().min(1).max(255).optional(),
  active: z.boolean().optional(),
  metadata: baseItemSchema.shape.metadata.optional()
}).strict().refine(value => Object.keys(value).length > 0, "Informe o que será alterado.");

export const importRowSchema = z.object({
  sourceRow: z.number().int().min(12202).max(12256),
  values: z.array(z.union([z.string().max(20000), z.number().finite(), z.boolean(), z.null()])).length(72)
}).strict();
export const importRowsSchema = z.object({
  rows: z.array(importRowSchema).length(55)
    .refine(rows => new Set(rows.map(row => row.sourceRow)).size === 55, "Linhas de origem repetidas.")
    .refine(rows => rows.every((row,i) => row.sourceRow === 12202+i), "As linhas devem estar em sequência da 12202 à 12256.")
}).strict();
export function importSourceKey(rowNumber: number) {
  return "TEST-MAPA-1.0-ORIGEM-" + rowNumber;
}
export function columnLetter(index: number): string {
  let index1 = index+1, label = "";
  do { index1--; label = String.fromCharCode(65+index1%26)+label; index1=Math.floor(index1/26); } while (index1>0);
  return label;
}
