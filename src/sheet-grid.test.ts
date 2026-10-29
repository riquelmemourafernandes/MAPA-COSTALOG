import assert from "node:assert/strict";
import test from "node:test";
import {
  canPasteMatrix, moveGridPosition, parseClipboardGrid,
  parseEditableValue, selectionBounds, serializeSelection, gridKeyboardAction
} from "./sheet-grid.js";

test("seleção retangular em qualquer sentido", () => {
  assert.deepEqual(selectionBounds({row:8,column:7},{row:2,column:3}),
    {top:2,bottom:8,left:3,right:7});
});

test("lê copiar/colar do Google Sheets preservando células vazias", () => {
  assert.deepEqual(parseClipboardGrid("A\t\tC\r\n1\t2\t3\r\n"),
    [["A","","C"],["1","2","3"]]);
  assert.deepEqual(parseClipboardGrid("valor"),[["valor"]]);
});

test("copia a seleção como dados tabulados", () => {
  assert.equal(serializeSelection({top:0,bottom:1,left:0,right:1},
    (r,c)=> [["A","B"],["C","D"]][r][c]), "A\tB\nC\tD");
});

test("navegação com tab e setas respeita os limites", () => {
  assert.deepEqual(moveGridPosition({row:0,column:2},"Tab",3,3),{row:1,column:0});
  assert.deepEqual(moveGridPosition({row:1,column:0},"Tab",3,3,true),{row:0,column:2});
  assert.deepEqual(moveGridPosition({row:0,column:0},"ArrowUp",3,3),{row:0,column:0});
  assert.deepEqual(moveGridPosition({row:2,column:2},"Enter",3,3),{row:2,column:2});
});

test("validação respeita campos numéricos e booleanos", () => {
  assert.deepEqual(parseEditableValue("number","12,5"),{ok:true,value:12.5});
  assert.equal(parseEditableValue("number","invalido").ok,false);
  assert.deepEqual(parseEditableValue("boolean","Não"),{ok:true,value:false});
  assert.equal(parseEditableValue("boolean","qualquer").ok,false);
  assert.deepEqual(parseEditableValue("text","=A1+B1"),{ok:true,value:"=A1+B1"});
  assert.deepEqual(parseEditableValue("text",""),{ok:true,value:null});
});

test("recusa colagem maior que a grade, truncada ou excessiva", () => {
  assert.equal(canPasteMatrix([["a","b"],["c","d"]],{row:0,column:1},2,3),true);
  assert.equal(canPasteMatrix([["a","b"],["c","d"]],{row:0,column:2},2,3),false);
  assert.equal(canPasteMatrix([["a"],["b"]],{row:1,column:0},2,3),false);
  assert.equal(canPasteMatrix([["a"],["b","c"]],{row:0,column:0},2,3),false);
  assert.equal(canPasteMatrix([Array(201).fill("x")],{row:0,column:0},2,202),false);
});

test("Enter move a seleção; F2 edita; Enter durante edição confirma", () => {
  assert.equal(gridKeyboardAction("Enter", false), "move");
  assert.equal(gridKeyboardAction("F2", false), "edit");
  assert.equal(gridKeyboardAction("Enter", true), "confirm");
  assert.equal(gridKeyboardAction("Tab", false), "move");
  assert.equal(gridKeyboardAction("Tab", true), "confirm");
  assert.equal(gridKeyboardAction("Escape", true), "cancel");
  assert.equal(gridKeyboardAction("Escape", false), "ignore");
  assert.deepEqual(moveGridPosition({row:1,column:1}, "Enter", 5, 4), {row:2,column:1});
  assert.deepEqual(moveGridPosition({row:1,column:1}, "Enter", 5, 4, true), {row:0,column:1});
  assert.deepEqual(moveGridPosition({row:1,column:1}, "Tab", 5, 4), {row:1,column:2});
  assert.deepEqual(moveGridPosition({row:1,column:1}, "Tab", 5, 4, true), {row:1,column:0});
  assert.deepEqual(moveGridPosition({row:1,column:3}, "Tab", 5, 4), {row:2,column:0});
  assert.deepEqual(moveGridPosition({row:1,column:0}, "Tab", 5, 4, true), {row:0,column:3});
  assert.deepEqual(moveGridPosition({row:4,column:3}, "Tab", 5, 4), {row:4,column:0});
  assert.equal(gridKeyboardAction("Enter", true), "confirm");
  assert.equal(gridKeyboardAction("Tab", true), "confirm");
});
