import assert from "node:assert/strict";
import test from "node:test";
import { parseAppointment, shouldAlertAppointment } from "./appointment-date.js";

test("interpreta DD/MM/AAAA no fuso operacional de São Paulo", () => {
  assert.equal(new Date(parseAppointment("27/10/2026 09:30")).toISOString(), "2026-10-27T12:30:00.000Z");
});

test("aceita data com hífen e hora omitida", () => {
  assert.equal(new Date(parseAppointment("27-10-2026")).toISOString(), "2026-10-27T03:00:00.000Z");
});

test("aceita dia bissexto válido", () => {
  assert.ok(Number.isFinite(parseAppointment("29/02/2024 12:00")));
});

test("rejeita datas impossíveis e horários fora do intervalo", () => {
  for (const value of ["31/04/2026", "29/02/2025", "27/13/2026", "27/10/2026 24:00", "27/10/2026 09:60", "27/10/2026 09:30:61", ""]) {
    assert.ok(Number.isNaN(parseAppointment(value)), value);
  }
});

test("aceita timestamp ISO com fuso explícito", () => {
  assert.equal(parseAppointment("2026-10-27T09:00:00-03:00"), Date.parse("2026-10-27T12:00:00Z"));
});

test("gera alerta para agendamento válido no passado e pendente", () => {
  const now = Date.parse("2026-10-27T13:00:00Z");
  assert.equal(shouldAlertAppointment(Date.parse("2026-10-27T12:00:00Z"), false, now), true);
});

test("não gera alerta para agendamento futuro, concluído ou inválido", () => {
  const now = Date.parse("2026-10-27T13:00:00Z");
  assert.equal(shouldAlertAppointment(Date.parse("2026-10-27T14:00:00Z"), false, now), false);
  assert.equal(shouldAlertAppointment(Date.parse("2026-10-27T12:00:00Z"), true, now), false);
  assert.equal(shouldAlertAppointment(Number.NaN, false, now), false);
});

test("considera coleta concluída quando AU ou AV está preenchida", async () => {
  const { isCollectionCompleted } = await import("./appointment-date.js");
  assert.equal(isCollectionCompleted({ AU: "Chegou" }), true);
  assert.equal(isCollectionCompleted({ AV: "Saiu" }), true);
  assert.equal(isCollectionCompleted({ AU: "", AV: "" }), false);
});

test("considera entrega concluída somente quando AW está preenchida", async () => {
  const { isDeliveryCompleted } = await import("./appointment-date.js");
  assert.equal(isDeliveryCompleted({ AW: "Entregue" }), true);
  assert.equal(isDeliveryCompleted({ AS: "Outro marco" }), false);
  assert.equal(isDeliveryCompleted({ AW: "" }), false);
});
