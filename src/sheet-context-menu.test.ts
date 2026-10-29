import assert from "node:assert/strict";
import test from "node:test";
import {getSheetContextOptions,safeMenuPosition} from "./sheet-context-menu.js";
test("somente administrador recebe menu de contexto",()=>{
  for(const kind of ["cell","row","column","all"] as const)
    assert.equal(getSheetContextOptions(kind,false).length,0);
});
test("coluna e linha mostram operações corretas e atalhos",()=>{
  const column=getSheetContextOptions("column",true);
  assert.ok(column.some(item=>item.id==="delete-column" && item.danger));
  assert.ok(column.some(item=>item.id==="hide-column"));
  assert.ok(column.some(item=>item.id==="sort-asc"));
  assert.ok(column.some(item=>item.id==="paste" && item.shortcut==="Ctrl+V"));
  const row=getSheetContextOptions("row",true);
  assert.ok(row.some(item=>item.id==="delete-rows" && item.danger));
  assert.ok(row.some(item=>item.id==="resize-row"));
  assert.ok(!row.some(item=>item.id==="delete-column"));
  assert.ok(getSheetContextOptions("cell",true).some(item=>item.id==="select-all"));
  assert.ok(getSheetContextOptions("cell",true).some(item=>item.id==="delete-column" && item.danger));
});
test("menu permanece dentro da janela",()=>{
  assert.deepEqual(safeMenuPosition(1450,900,270,420,1500,1000),{left:1222,top:572});
});
