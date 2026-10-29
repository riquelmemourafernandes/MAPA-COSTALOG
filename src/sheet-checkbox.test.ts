import assert from "node:assert/strict";
import test from "node:test";
import { CHECKBOX_COLUMN_KEYS, checkboxChecked, checkboxSaveText, isCheckboxColumn } from "./sheet-checkbox.js";

test("caixas de seleção nas colunas booleanas reais", () => {
  assert.deepEqual(CHECKBOX_COLUMN_KEYS, ["AA","AI","BI","BJ","BQ"]);
  assert.equal(isCheckboxColumn("AA", "boolean"), true);
  assert.equal(isCheckboxColumn("BQ", "boolean"), true);
  assert.equal(isCheckboxColumn("X", "boolean"), true);
  assert.equal(isCheckboxColumn("B", "lookup"), false);
});
test("valores antigos e novos aparecem corretamente marcados", () => {
  for (const value of [true, 1, "Sim", "TRUE", "checked", "1"]) assert.equal(checkboxChecked(value), true);
  for (const value of [false, 0, null, undefined, "Não", "", "false"]) assert.equal(checkboxChecked(value), false);
  assert.equal(checkboxSaveText(true),"true");
  assert.equal(checkboxSaveText(false),"false");
});
