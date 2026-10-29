import test from 'node:test';
import assert from 'node:assert/strict';
import { columnIndexToKey, columnKeyToIndex, evaluateFormula, parseCellAddress, translateFormulaReferences } from './formula-engine.js';

const values: Record<string, string | number | boolean | null> = {
  A2: 2, A3: 3, A4: 4, B2: 8, B3: 12, C2: 'Cliente', D2: true
};
const resolve = (row: number, column: string) => values[column + row] ?? null;

test('converts spreadsheet column keys and cell addresses', () => {
  assert.equal(columnKeyToIndex('A'), 0);
  assert.equal(columnKeyToIndex('AA'), 26);
  assert.equal(columnIndexToKey(27), 'AB');
  assert.deepEqual(parseCellAddress('$AB$17'), { row: 17, column: 'AB' });
  assert.equal(parseCellAddress('A0'), null);
});

test('evaluates arithmetic, precedence, percentages, and comparisons', () => {
  assert.equal(evaluateFormula('=2+3*4', resolve), 14);
  assert.equal(evaluateFormula('=(2+3)^2', resolve), 25);
  assert.equal(evaluateFormula('=50%', resolve), 0.5);
  assert.equal(evaluateFormula('=A2>1', resolve), true);
});

test('evaluates ranges and common English functions', () => {
  assert.equal(evaluateFormula('=SUM(A2:A4)', resolve), 9);
  assert.equal(evaluateFormula('=AVERAGE(A2:A4)', resolve), 3);
  assert.equal(evaluateFormula('=COUNT(A2:D2)', resolve), 2);
  assert.equal(evaluateFormula('=IF(A2=2,"yes","no")', resolve), 'yes');
  assert.equal(evaluateFormula('=IFERROR(1/0,99)', resolve), 99);
});

test('accepts Brazilian Portuguese function names and semicolon separators', () => {
  assert.equal(evaluateFormula('=SOMA(A2:A4)', resolve), 9);
  assert.equal(evaluateFormula('=SE(A2>1;"OK";"NÃO")', resolve), 'OK');
  assert.equal(evaluateFormula('=SEERRO(1/0;7)', resolve), 7);
  assert.equal(evaluateFormula('=MAIÚSCULA("custo")', resolve), 'CUSTO');
  assert.equal(evaluateFormula('=1,5+2', resolve), 3.5);
  assert.equal(evaluateFormula('=PROCV("Cliente";C2:D2;2;FALSO)', resolve), true);
  assert.equal(evaluateFormula('=ÍNDICE(A2:B3;2;2)', resolve), 12);
  assert.equal(evaluateFormula('=CORRESP(8;A2:B2;0)', resolve), 2);
});

test('reports calculation errors and detects circular references', () => {
  assert.equal(evaluateFormula('=1/0', resolve), '#DIV/0!');
  assert.equal(evaluateFormula('=A1', resolve, new Set(['A1'])), '#REF!');
  assert.equal(evaluateFormula('=UNKNOWN(1)', resolve), '#NAME?');
});

test('adjusts relative formula references but preserves absolute references and strings', () => {
  assert.equal(
    translateFormulaReferences('=SUM(A1:$B2)+$C$3&" A1"', 1, 1),
    '=SUM(B2:$B3)+$C$3&" A1"'
  );
});
