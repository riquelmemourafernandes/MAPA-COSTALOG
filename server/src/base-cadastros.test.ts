import assert from "node:assert/strict";
import test from "node:test";
import { BASE_LISTS, baseItemSchema, baseUpdateSchema, columnLetter, importRowsSchema, importSourceKey, normalizeBaseLabel } from "./base-cadastros.js";
test("BASE cobre dropdowns reais e evita cadastro de tipos arbitrários", () => {
 assert.equal(BASE_LISTS.find(x=>x.key==="CLIENTE")?.mapaColumns[0], "L");
 assert.equal(baseItemSchema.safeParse({listName:"USER_PREFERENCES",label:"secret"}).success, false);
 assert.equal(baseItemSchema.safeParse({listName:"CLIENTE",label:"Novo cliente"}).success, true);
 assert.equal(normalizeBaseLabel(" São   Vicente "), "sao vicente");
 assert.equal(baseUpdateSchema.safeParse({active:false}).success,true);
});
test("importação aceita só 55 linhas em sequência e 72 colunas", () => {
 const rows=Array.from({length:55},(_,i)=>({sourceRow:12202+i,values:Array(72).fill(null)}));
 assert.equal(importRowsSchema.safeParse({rows}).success,true);
 rows[2].sourceRow=12204;
 assert.equal(importRowsSchema.safeParse({rows}).success,false);
 assert.equal(importSourceKey(12202),"TEST-MAPA-1.0-ORIGEM-12202");
 assert.equal(columnLetter(0),"A"); assert.equal(columnLetter(71),"BT");
});
