import assert from "node:assert/strict";
import test from "node:test";
import {
  createCatalogItem, createDemoCatalog, DEMO_LISTS, excelColumn,
  IMPORT_COLUMNS, IMPORT_COUNT, IMPORT_END, IMPORT_START,
  makeSampleImportRows, mergeImportedRows, normalizeCatalogLabel,
  parseSheetsClipboard, validateImportGrid
} from "./base-prototype-data.js";

test("o protótipo oferece 11 categorias BASE relacionadas ao MAPA", () => {
  const base=createDemoCatalog();
  assert.equal(DEMO_LISTS.length,11);
  assert.ok(base.CLIENTE.length>0);
  assert.equal(DEMO_LISTS.find(x=>x.id==="ENTREGA")?.mapa.includes("AO"), true);
  assert.equal(excelColumn(0),"A");
  assert.equal(excelColumn(71),"BT");
});

test("criação de cadastros não aceita duplicados ou KM inválido", () => {
  const base=createDemoCatalog();
  assert.equal(normalizeCatalogLabel(" São  Vicente "), "sao vicente");
  assert.throws(()=>createCatalogItem(base.CLIENTE,{label:"CLIENTE DE DEMONSTRAÇÃO A"}),/já existe/);
  assert.throws(()=>createCatalogItem([],{label:"Terminal",km:"invalido"}),/quilometragem/);
  assert.equal(createCatalogItem([],{label:"Entrega Nova",km:"12,5"}).km,12.5);
});

test("55 linhas fictícias de A até BT para prévia, sem duplicidade", () => {
  const sample=makeSampleImportRows();
  assert.equal(IMPORT_START,12202);assert.equal(IMPORT_END,12256);
  assert.equal(sample.length,IMPORT_COUNT);assert.equal(sample.length,55);
  assert.ok(sample.every(row=>row.values.length===IMPORT_COLUMNS));
  assert.equal(mergeImportedRows(sample,sample).length,55);
});

test("parser TSV aceita aspas, quebras internas e células vazias", () => {
  assert.deepEqual(parseSheetsClipboard('A\t"B\tC"\t\r\n1\t"linha 1\nlinha 2"\t3\n'), [
    ["A","B\tC",""],["1","linha 1\nlinha 2","3"]
  ]);
  assert.deepEqual(parseSheetsClipboard('"com ""aspas"""\tX'),[['com "aspas"','X']]);
  assert.deepEqual(parseSheetsClipboard(''),[]);
  assert.throws(()=>parseSheetsClipboard('"incompleto'),/aspas/);
});

test("validação exige 55 linhas x 72 colunas, sem truncar nem inventar dados", () => {
  const valid=Array.from({length:55},(_,i)=>Array.from({length:72},(_,j)=>
    i===0&&j===0?"31/10/2026":""));
  const csv=valid.map(row=>row.join("\t")).join("\n");
  assert.equal(validateImportGrid(csv).rows.length,55);
  const invalid=valid.map(row=>row.slice(0,71).join("\t")).join("\n");
  assert.equal(validateImportGrid(invalid).rows.length,0);
  assert.match(validateImportGrid(invalid).errors.join(" "),/72/);
});
