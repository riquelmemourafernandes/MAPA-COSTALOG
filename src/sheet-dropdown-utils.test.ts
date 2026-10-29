import assert from "node:assert/strict";
import test from "node:test";
import {BASE_COLUMN_LIST,resolveDropdownValue,searchOptions,initialDropdownSearch,confirmDropdownValue} from "./sheet-dropdown-utils.js";
test("opções BASE mapeadas para as colunas da planilha",()=>{
  assert.equal(BASE_COLUMN_LIST.L,"CLIENTE");
  assert.equal(BASE_COLUMN_LIST.AN,"ENTREGA");
  assert.equal(BASE_COLUMN_LIST.AR,"ENTREGA");
  assert.equal(BASE_COLUMN_LIST.AK,"CIDADE_COLETA");
  assert.equal(BASE_COLUMN_LIST.F,undefined);
});
test("pesquisa ignora caixa e só confirma item existente",()=>{
  const options=["GLOVIS / HYUNDAI MOTOR","GLOVIS / BRIDGESTONE","3D LAB"];
  const filtered=searchOptions(options,"glovis");
  assert.equal(filtered.length,2);
  assert.equal(resolveDropdownValue("glovis / hyundai motor",options,0),"GLOVIS / HYUNDAI MOTOR");
  assert.equal(resolveDropdownValue("inexistente",filtered,-1),null);
  assert.equal(resolveDropdownValue("glov",filtered,0),filtered[0]);
});

test("clique em célula preenchida abre todas as opções sem pesquisar o valor antigo", () => {
  const all=["JONNY","EVALDO","GUILHERME","IDEALL"];
  assert.equal(initialDropdownSearch("GUILHERME","GUILHERME"),"");
  assert.deepEqual(searchOptions(all,initialDropdownSearch("GUILHERME","GUILHERME")).length,4);
  assert.equal(confirmDropdownValue("","GUILHERME",all,-1),"GUILHERME");
  assert.equal(confirmDropdownValue("","",all,-1),"");
  assert.equal(confirmDropdownValue("","GUILHERME",all,2),"GUILHERME");
});
test("digitar pesquisa, Enter confirma opção, e valores inexistentes não são aceitos", () => {
  const all=["EVALDO","GUILHERME","JONNY"];
  assert.equal(initialDropdownSearch("EVALDO","gui"),"gui");
  const matching=searchOptions(all,"gui");
  assert.deepEqual(matching,["GUILHERME"]);
  assert.equal(confirmDropdownValue("gui","EVALDO",matching,0),"GUILHERME");
  assert.equal(confirmDropdownValue("texto estranho","EVALDO",matching,-1),null);
});
