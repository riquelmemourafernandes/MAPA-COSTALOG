import assert from "node:assert/strict";
import test from "node:test";
import { matchesColumnFilters, uniqueFilterValues } from "./column-filter.js";
test("filtro de valores exatos em mais de uma coluna, incluindo vazios", () => {
 const f={B:{values:["João",""]},C:{values:["AG. DOCS"]}};
 assert.equal(matchesColumnFilters({B:"João",C:"AG. DOCS"},f),true);
 assert.equal(matchesColumnFilters({B:"João",C:"FINALIZADO"},f),false);
 assert.equal(matchesColumnFilters({C:"AG. DOCS"},f),true);
 assert.equal(matchesColumnFilters({B:"João",C:"FINALIZADO"},f,"C"),true);
 assert.equal(matchesColumnFilters({B:"João"}, {B:{values:[]}}),false);
});
test("pesquisa e lista distinta ignoram caixa e preservam vazio", () => {
 const rows=[{A:"DPWORLD"},{A:"DPWORLD"},{A:"DpwORld"},{A:"BTP"},{}];
 assert.deepEqual(uniqueFilterValues(rows,"A","dp"),["DPWORLD","DpwORld"]);
 assert.deepEqual(uniqueFilterValues(rows,"A"),["","BTP","DPWORLD","DpwORld"]);
});
