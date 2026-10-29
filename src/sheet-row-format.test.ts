import assert from "node:assert/strict";
import test from "node:test";
import {inheritRowPresentation,nearestPreviousRowId} from "./sheet-row-format.js";
test("uma nova linha copia cores, texto, formato, alinhamento e altura da anterior",()=>{
  const old={
    rowStyles:{"anterior":{bold:true,background:"#ffe599",align:"center" as const}},
    cellStyles:{"anterior:A":{format:"date" as const},"anterior:Q":{format:"currency" as const,color:"#112233"}},
    rowHeights:{"anterior":52}
  };
  const next=inheritRowPresentation("anterior","nova",["A","B","Q"],old);
  assert.deepEqual(next.rowStyles.nova,{bold:true,background:"#ffe599",align:"center"});
  assert.deepEqual(next.cellStyles["nova:A"],{format:"date"});
  assert.deepEqual(next.cellStyles["nova:Q"],{format:"currency",color:"#112233"});
  assert.equal(next.rowHeights.nova,52);
  assert.equal(old.rowStyles.nova,undefined);
  assert.equal(old.cellStyles["nova:A"],undefined);
  assert.notStrictEqual(next.rowStyles.nova,old.rowStyles.anterior);
  assert.ok(!("data" in next));
});
test("nenhum formato explícito mantém o padrão da coluna",()=>{
  const old={rowStyles:{},cellStyles:{},rowHeights:{}};
  const next=inheritRowPresentation(null,"nova",["A"],old);
  assert.strictEqual(next,old);
});
test("não sobrescreve personalização própria da linha destino",()=>{
 const previous={rowStyles:{a:{background:"#f00"},b:{background:"#0f0"}},
   cellStyles:{"a:B":{bold:true},"b:B":{bold:false}},rowHeights:{a:60,b:40}};
 const next=inheritRowPresentation("a","b",["B"],previous);
 assert.deepEqual(next.rowStyles.b,{background:"#0f0"});
 assert.deepEqual(next.cellStyles["b:B"],{bold:false});
 assert.equal(next.rowHeights.b,40);
});
test("busca linha anterior mais próxima mesmo com linhas virtuais vazias",()=>{
 const rows=[{id:"a",sheetRowNumber:2,sequence:1},
   {id:"b",sheetRowNumber:9,sequence:8},{id:"c",sheetRowNumber:20,sequence:19}];
 assert.equal(nearestPreviousRowId(rows,10),"b");
 assert.equal(nearestPreviousRowId(rows,5),"a");
 assert.equal(nearestPreviousRowId(rows,2),null);
 assert.equal(nearestPreviousRowId(rows,101),"c");
});
