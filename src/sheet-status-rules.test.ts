import assert from "node:assert/strict";
import test from "node:test";
import { STATUS_COLORS, hasStatusRule, normalizeStatus, statusRowColor, statusRowTextColor } from "./sheet-status-rules.js";

test("todos os 16 status preservam cores exatas combinadas", () => {
  const expected: Record<string, string> = {
    "NOVO": "#ffffff", "EM ABERTO": "#ffff00",
    "DOC. - EMITIDO": "#00a7ff", "A CAMINHO DO DEPOT": "#ff9900",
    "AG. INTERCAMBIO": "#999999", "AG. CTE SUB.": "#ffff00",
    "PROC. - CANCELADO": "#ff0000", "PROC. - FINALIZADO": "#00b050",
    "AG. DOCS": "#ffffff", "PATIO AG. ENTREGA": "#ff00ff",
    "RETIRADA": "#f1c232", "PATIO AG. ESCALA": "#ffe599",
    "FRETE MORTO": "#9900ff", "CAMINHO TERM. APOIO": "#d9d2e9",
    "AG. CONF. REUSE": "#ff9900", "EM EMISSÃO": "#00ffff"
  };
  assert.equal(STATUS_COLORS.length, 16);
  assert.deepEqual(Object.fromEntries(STATUS_COLORS.map(rule => [rule.status, rule.background])), expected);
  for (const [name, hex] of Object.entries(expected)) assert.equal(statusRowColor(name), hex);
});
test("cor automática tolera espaços e variação de caixa/acentos", () => {
  assert.equal(statusRowColor("  em emissão  "), "#00ffff");
  assert.equal(statusRowColor("em emissao"), "#00ffff");
  assert.equal(statusRowColor("ag.   intercambio"), "#999999");
  assert.equal(normalizeStatus("  Pátio   AG. ENTREGA "), "PATIO AG. ENTREGA");
  assert.equal(statusRowColor(""), null);
  assert.equal(statusRowColor(undefined), null);
  assert.equal(statusRowColor("outro status não previsto"), null);
  assert.equal(hasStatusRule("novo"), true);
});
test("texto mantém contraste suficiente sobre fundos fortes", () => {
  assert.equal(statusRowTextColor("#9900ff"), "#ffffff");
  assert.equal(statusRowTextColor("#ffffff"), "#17271d");
  assert.equal(statusRowTextColor("#ffff00"), "#17271d");
});
