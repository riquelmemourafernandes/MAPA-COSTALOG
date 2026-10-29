import assert from "node:assert/strict";
import test from "node:test";
import {normalizeRowHeight,normalizeCreateCount,shouldLoadNextBatch,mergeLoadedRows,SCROLL_BATCH_SIZE,EMPTY_GRID_ROWS,sparseSheetWindow,SHEET_MAX_ROW,
 normalizeColumnWidth,totalSheetWidth,MIN_ROW_HEIGHT,MAX_ROW_HEIGHT,
 MIN_COLUMN_WIDTH,MAX_COLUMN_WIDTH} from "./sheet-layout.js";

test("infinite scrolling fetches only when near bottom and more records exist",()=>{
 assert.equal(SCROLL_BATCH_SIZE,100);
 assert.equal(shouldLoadNextBatch({scrollTop:1600,scrollHeight:2200,clientHeight:500,loadedCount:100,total:220,busy:false}),true);
 assert.equal(shouldLoadNextBatch({scrollTop:0,scrollHeight:2200,clientHeight:500,loadedCount:100,total:220,busy:false}),false);
 assert.equal(shouldLoadNextBatch({scrollTop:1600,scrollHeight:2200,clientHeight:500,loadedCount:220,total:220,busy:false}),false);
 assert.equal(shouldLoadNextBatch({scrollTop:1600,scrollHeight:2200,clientHeight:500,loadedCount:100,total:220,busy:true}),false);
});
test("loaded pages append in order without duplicating existing rows",()=>{
 assert.deepEqual(mergeLoadedRows([{id:"3"},{id:"2"}],[{id:"2"},{id:"1"}]),[{id:"3"},{id:"2"},{id:"1"}]);
});
test("height and creation limits protect against unbounded mutations",()=>{
 assert.equal(EMPTY_GRID_ROWS,35);
 assert.equal(MIN_ROW_HEIGHT,12);
 assert.equal(MAX_ROW_HEIGHT,2000);
 assert.equal(normalizeRowHeight(12),12);
 assert.equal(normalizeRowHeight(1),12);
 assert.equal(normalizeRowHeight(157.7),158);
 assert.equal(normalizeRowHeight(500),500);
 assert.equal(normalizeRowHeight(900),900);
 assert.equal(normalizeRowHeight(2001),2000);
 assert.equal(normalizeCreateCount(25),25);
 for(const value of [0,-1,101,2.5,NaN])assert.equal(normalizeCreateCount(value),null);
});

test("100 linhas virtuais de teste, de 2 até 101, sem inserir vazias no banco",()=>{
 const first=sparseSheetWindow(0,560,{});
 assert.equal(SHEET_MAX_ROW,101);
 assert.equal(first.start,0);
 assert.equal(first.totalHeight,3500);
 assert.ok(first.end<40);
 const middle=sparseSheetWindow(1750,560,{});
 assert.ok(middle.start<=50 && middle.end>50);
 const resized=sparseSheetWindow(1000,560,{2:90,20:100});
 assert.equal(resized.totalHeight,3620);
 const last=sparseSheetWindow(3500,560,{});
 assert.equal(last.end,100);
});

test("largura pode ficar menor do que o texto sem alargar a tabela",()=>{
 assert.equal(MIN_COLUMN_WIDTH,24);
 assert.equal(MAX_COLUMN_WIDTH,2400);
 assert.equal(normalizeColumnWidth(1),24);
 assert.equal(normalizeColumnWidth(26.6),27);
 assert.equal(normalizeColumnWidth(900),900);
 assert.equal(normalizeColumnWidth(3000),2400);
 assert.equal(totalSheetWidth(["A","B","C"],{A:24,B:200,C:45}),334);
 assert.equal(totalSheetWidth(["A","B"],{}),425);
});
test("linha pequena mantém janela virtual com altura exata",()=>{
 const compact=sparseSheetWindow(0,100,{2:12,3:18});
 assert.equal(compact.totalHeight,3460);
 assert.equal(compact.start,0);
 assert.ok(compact.end<=15);
});
