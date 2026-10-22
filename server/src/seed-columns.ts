import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Column keys are the original spreadsheet letters, so repeated labels (for example STATUS)
// remain distinct. Formula counts are metadata only; they do not execute spreadsheet formulas.
const columns: Array<{ key: string; label: string; dataType: string; formulaCount: number }> = [
  ["A","DATA","date",0],["B","ATENDENTE","text",0],["C","STATUS","status",0],["D","CTE","text",0],
  ["E","MODALIDADE","lookup",0],["F","DI / DTA","text",0],["G","ARM","lookup",0],["H","DEM","date",7639],
  ["I","PROC.","text",0],["J","PROG.","text",0],["K","ID PROG.","text",7751],["L","CLIENTE","lookup",0],
  ["M","ISCA","text",0],["N","REFERENCIA","text",1],["O","BL","text",0],["P","NAVIO","text",1],
  ["Q","VALORES","number",1303],["R","QTD","number",36],["S","PESO","number",521],["T","CONTAINER","container",0],
  ["U","TIPO","lookup",0],["V","IMO","text",0],["W","CAVALO","vehicle",0],["X","CARRETA","vehicle",0],
  ["Y","MOTORISTA","lookup",0],["Z","CONTATO","text",0],["AA","OK?","boolean",0],["AB","2º VIAGEM","text",0],
  ["AC","FRETE","currency",0],["AD","RV","text",0],["AE","CIOT","text",0],["AF","MDF","text",0],
  ["AG","CATEGORIA","lookup",12989],["AH","SM/AE","text",0],["AI","TRAVA GR","boolean",0],
  ["AJ","TERMINAL COLETA","lookup",0],["AK","CIDADE","city",0],["AL","DATA / HORA - COLETA","datetime",0],
  ["AM","Nº AGEND.","text",0],["AN","ENTREGA - 1","address",0],["AO","KM","number",12837],
  ["AP","DATA / HORA - ENTREGA - 1","datetime",0],["AQ","ENDERECO - ENTREGA - 1","address",0],
  ["AR","ENTREGA - 2","address",0],["AS","DATA / HORA - ENTREGA - 2","datetime",0],
  ["AT","ENDERECO - ENTREGA - 2","address",0],["AU","CHEGADA NO TERMINAL / EADI","datetime",0],
  ["AV","SAÍDA DO TERMINAL / EADI","datetime",0],["AW","CHEGADA NO CLIENTE","datetime",0],
  ["AX","SAÍDA DO CLIENTE","datetime",0],["AY","STATUS","status",0],["AZ","ARMADOR","lookup",0],
  ["BA","OBS","text",0],["BB","STATUS UNIDADE VAZIA","status",0],["BC","MINUTA/AG","text",0],
  ["BD","TERMINAL DE VAZIO","lookup",0],["BE","CIDADE - DEPOT","city",0],["BF","DATA / HORA - DEPOT","datetime",0],
  ["BG","P.S.","text",12050],["BH","DATA ENTREGA VAZIO","date",0],["BI","P.S. DEVIDO?","boolean",0],
  ["BJ","EIR ENVIADO","boolean",0],["BK","📷","attachment",61],["BQ","CRÍTICO?","boolean",0],
  ["BR","ENVIADO P/ FATURAMENTO","status",0],["BS","PROG.ENCERRADA","status",0],
  ["BT","PROC. ENCERRADO","status",0],["BU","VALIDAÇÃO CONTAINER","status",12051]
].map(([key,label,dataType,formulaCount]) => ({
  key: String(key), label: String(label), dataType: String(dataType), formulaCount: Number(formulaCount)
}));

function columnNumber(letters: string): number {
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

async function main() {
  for (const column of columns) {
    await prisma.mapaColumn.upsert({
      where: { key: column.key },
      create: {
        key: column.key,
        label: column.label,
        position: columnNumber(column.key),
        dataType: column.dataType,
        editable: true,
        visible: true,
        config: { formulaCount: column.formulaCount, source: "MAPA 1.0 dictionary" }
      },
      update: {
        label: column.label,
        position: columnNumber(column.key),
        dataType: column.dataType,
        config: { formulaCount: column.formulaCount, source: "MAPA 1.0 dictionary" }
      }
    });
  }
  console.log(`Metadados de ${columns.length} colunas inseridos/atualizados.`);
}

main()
  .catch((error) => {
    console.error("Falha ao cadastrar colunas:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
