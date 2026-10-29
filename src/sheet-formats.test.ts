import assert from "node:assert/strict";
import test from "node:test";
import {LOCKED_COLUMN_FORMAT,formatSheetValue,parseCurrency,parseSheetValue,toDateInput} from "./sheet-formats.js";
test("A sempre data e Q sempre moeda",()=>{
 assert.equal(LOCKED_COLUMN_FORMAT.A,"date");
 assert.equal(LOCKED_COLUMN_FORMAT.Q,"currency");
});
test("datas brasileiras e ISO são validadas sem trocar dia e mês",()=>{
 assert.equal(toDateInput("30/10/2026 05:00:00"),"2026-10-30");
 assert.equal(toDateInput("2026-10-30T00:00:00Z"),"2026-10-30");
 assert.equal(toDateInput("31/02/2026"),"");
 assert.equal(parseSheetValue("31/02/2026","date").ok,false);
 assert.deepEqual(parseSheetValue("30/10/2026","date"),{ok:true,value:"2026-10-30"});
 assert.equal(formatSheetValue("2026-10-30","date"),"30/10/2026");
});
test("moeda aceita entrada brasileira e é armazenada numericamente",()=>{
 assert.equal(parseCurrency("R$ 1.234,56"),1234.56);
 assert.equal(parseCurrency("1234,56"),1234.56);
 assert.equal(parseCurrency("1234.56"),1234.56);
 assert.equal(parseCurrency("não é moeda"),null);
 assert.deepEqual(parseSheetValue("R$ 125,00","currency"),{ok:true,value:125});
 assert.match(formatSheetValue(125,"currency"),/125,00/);
});
