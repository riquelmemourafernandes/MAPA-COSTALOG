import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// Estrutura completa da aba MAPA 1.0: 128 colunas originais de A a DX.
const columns = [
  {
    "key": "A",
    "label": "DATA",
    "dataType": "date",
    "formulaCount": 0
  },
  {
    "key": "B",
    "label": "ATENDENTE",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "C",
    "label": "STATUS",
    "dataType": "status",
    "formulaCount": 0
  },
  {
    "key": "D",
    "label": "CTE",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "E",
    "label": "MODALIDADE",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "F",
    "label": "DI / DTA",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "G",
    "label": "ARM",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "H",
    "label": "DEM",
    "dataType": "date",
    "formulaCount": 7639
  },
  {
    "key": "I",
    "label": "PROC.",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "J",
    "label": "PROG.",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "K",
    "label": "ID PROG.",
    "dataType": "text",
    "formulaCount": 7751
  },
  {
    "key": "L",
    "label": "CLIENTE",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "M",
    "label": "ISCA",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "N",
    "label": "REFERENCIA",
    "dataType": "text",
    "formulaCount": 1
  },
  {
    "key": "O",
    "label": "BL",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "P",
    "label": "NAVIO",
    "dataType": "text",
    "formulaCount": 1
  },
  {
    "key": "Q",
    "label": "VALORES",
    "dataType": "number",
    "formulaCount": 1303
  },
  {
    "key": "R",
    "label": "QTD",
    "dataType": "number",
    "formulaCount": 36
  },
  {
    "key": "S",
    "label": "PESO",
    "dataType": "number",
    "formulaCount": 521
  },
  {
    "key": "T",
    "label": "CONTAINER",
    "dataType": "container",
    "formulaCount": 0
  },
  {
    "key": "U",
    "label": "TIPO",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "V",
    "label": "IMO",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "W",
    "label": "CAVALO",
    "dataType": "vehicle",
    "formulaCount": 0
  },
  {
    "key": "X",
    "label": "CARRETA",
    "dataType": "vehicle",
    "formulaCount": 0
  },
  {
    "key": "Y",
    "label": "MOTORISTA",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "Z",
    "label": "CONTATO",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AA",
    "label": "OK?",
    "dataType": "boolean",
    "formulaCount": 0
  },
  {
    "key": "AB",
    "label": "2º VIAGEM",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AC",
    "label": "FRETE",
    "dataType": "currency",
    "formulaCount": 0
  },
  {
    "key": "AD",
    "label": "RV",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AE",
    "label": "CIOT",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AF",
    "label": "MDF",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AG",
    "label": "CATEGORIA",
    "dataType": "lookup",
    "formulaCount": 12989
  },
  {
    "key": "AH",
    "label": "SM/AE",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AI",
    "label": "TRAVA GR",
    "dataType": "boolean",
    "formulaCount": 0
  },
  {
    "key": "AJ",
    "label": "TERMINAL COLETA",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "AK",
    "label": "CIDADE",
    "dataType": "city",
    "formulaCount": 0
  },
  {
    "key": "AL",
    "label": "DATA / HORA - COLETA",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AM",
    "label": "Nº AGEND.",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "AN",
    "label": "ENTREGA - 1",
    "dataType": "address",
    "formulaCount": 0
  },
  {
    "key": "AO",
    "label": "KM",
    "dataType": "number",
    "formulaCount": 12837
  },
  {
    "key": "AP",
    "label": "DATA / HORA - ENTREGA - 1",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AQ",
    "label": "ENDERECO - ENTREGA - 1",
    "dataType": "address",
    "formulaCount": 0
  },
  {
    "key": "AR",
    "label": "ENTREGA - 2",
    "dataType": "address",
    "formulaCount": 0
  },
  {
    "key": "AS",
    "label": "DATA / HORA - ENTREGA - 2",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AT",
    "label": "ENDERECO - ENTREGA - 2",
    "dataType": "address",
    "formulaCount": 0
  },
  {
    "key": "AU",
    "label": "CHEGADA NO TERMINAL / EADI",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AV",
    "label": "SAÍDA DO TERMINAL / EADI",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AW",
    "label": "CHEGADA NO CLIENTE",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AX",
    "label": "SAÍDA DO CLIENTE",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "AY",
    "label": "STATUS",
    "dataType": "status",
    "formulaCount": 0
  },
  {
    "key": "AZ",
    "label": "ARMADOR",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "BA",
    "label": "OBS",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BB",
    "label": "STATUS UNIDADE VAZIA",
    "dataType": "status",
    "formulaCount": 0
  },
  {
    "key": "BC",
    "label": "MINUTA/AG",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BD",
    "label": "TERMINAL DE VAZIO",
    "dataType": "lookup",
    "formulaCount": 0
  },
  {
    "key": "BE",
    "label": "CIDADE - DEPOT",
    "dataType": "city",
    "formulaCount": 0
  },
  {
    "key": "BF",
    "label": "DATA / HORA - DEPOT",
    "dataType": "datetime",
    "formulaCount": 0
  },
  {
    "key": "BG",
    "label": "P.S.",
    "dataType": "text",
    "formulaCount": 12050
  },
  {
    "key": "BH",
    "label": "DATA ENTREGA VAZIO",
    "dataType": "date",
    "formulaCount": 0
  },
  {
    "key": "BI",
    "label": "P.S. DEVIDO?",
    "dataType": "boolean",
    "formulaCount": 0
  },
  {
    "key": "BJ",
    "label": "EIR ENVIADO",
    "dataType": "boolean",
    "formulaCount": 0
  },
  {
    "key": "BK",
    "label": "📷",
    "dataType": "attachment",
    "formulaCount": 61
  },
  {
    "key": "BL",
    "label": "Coluna BL",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BM",
    "label": "Coluna BM",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BN",
    "label": "Coluna BN",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BO",
    "label": "Coluna BO",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BP",
    "label": "Coluna BP",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BQ",
    "label": "CRÍTICO?",
    "dataType": "boolean",
    "formulaCount": 0
  },
  {
    "key": "BR",
    "label": "ENVIADO P/ FATURAMENTO",
    "dataType": "status",
    "formulaCount": 0
  },
  {
    "key": "BS",
    "label": "PROG.ENCERRADA",
    "dataType": "status",
    "formulaCount": 0
  },
  {
    "key": "BT",
    "label": "PROC. ENCERRADO",
    "dataType": "status",
    "formulaCount": 0
  },
  {
    "key": "BU",
    "label": "VALIDAÇÃO CONTAINER",
    "dataType": "status",
    "formulaCount": 12051
  },
  {
    "key": "BV",
    "label": "Coluna BV",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BW",
    "label": "Coluna BW",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BX",
    "label": "Coluna BX",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BY",
    "label": "Coluna BY",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "BZ",
    "label": "Coluna BZ",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CA",
    "label": "Coluna CA",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CB",
    "label": "Coluna CB",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CC",
    "label": "Coluna CC",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CD",
    "label": "Coluna CD",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CE",
    "label": "Coluna CE",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CF",
    "label": "Coluna CF",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CG",
    "label": "Coluna CG",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CH",
    "label": "Coluna CH",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CI",
    "label": "Coluna CI",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CJ",
    "label": "Coluna CJ",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CK",
    "label": "Coluna CK",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CL",
    "label": "Coluna CL",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CM",
    "label": "Coluna CM",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CN",
    "label": "Coluna CN",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CO",
    "label": "Coluna CO",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CP",
    "label": "Coluna CP",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CQ",
    "label": "Coluna CQ",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CR",
    "label": "Coluna CR",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CS",
    "label": "Coluna CS",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CT",
    "label": "Coluna CT",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CU",
    "label": "Coluna CU",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CV",
    "label": "Coluna CV",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CW",
    "label": "Coluna CW",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CX",
    "label": "Coluna CX",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CY",
    "label": "Coluna CY",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "CZ",
    "label": "Coluna CZ",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DA",
    "label": "Coluna DA",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DB",
    "label": "Coluna DB",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DC",
    "label": "Coluna DC",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DD",
    "label": "Coluna DD",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DE",
    "label": "Coluna DE",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DF",
    "label": "Coluna DF",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DG",
    "label": "Coluna DG",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DH",
    "label": "Coluna DH",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DI",
    "label": "Coluna DI",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DJ",
    "label": "Coluna DJ",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DK",
    "label": "Coluna DK",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DL",
    "label": "Coluna DL",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DM",
    "label": "Coluna DM",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DN",
    "label": "Coluna DN",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DO",
    "label": "Coluna DO",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DP",
    "label": "Coluna DP",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DQ",
    "label": "Coluna DQ",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DR",
    "label": "Coluna DR",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DS",
    "label": "Coluna DS",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DT",
    "label": "Coluna DT",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DU",
    "label": "Coluna DU",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DV",
    "label": "Coluna DV",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DW",
    "label": "Coluna DW",
    "dataType": "text",
    "formulaCount": 0
  },
  {
    "key": "DX",
    "label": "Coluna DX",
    "dataType": "text",
    "formulaCount": 0
  }
];
function columnNumber(letters: string): number { return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0); }
async function main() {
 for (const column of columns) await prisma.mapaColumn.upsert({
  where: { key: column.key },
  create: { key: column.key, label: column.label, position: columnNumber(column.key), dataType: column.dataType, editable: column.formulaCount === 0, visible: true, config: { formulaCount: column.formulaCount, source: "MAPA 1.0 original workbook" } },
  update: { label: column.label, position: columnNumber(column.key), dataType: column.dataType, editable: column.formulaCount === 0, config: { formulaCount: column.formulaCount, source: "MAPA 1.0 original workbook" } }
 });
 console.log(`Metadados de ${columns.length} colunas (A:DX) inseridos/atualizados.`);
}
main().catch(error => { console.error("Falha ao cadastrar colunas:", error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
