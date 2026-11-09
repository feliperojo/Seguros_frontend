import assert from "node:assert/strict";
import test from "node:test";
import {
  MENSAJE_CIERRE_NO_DISPONIBLE,
  debeEnriquecerTareaTerminada,
  fechaCierreReal,
  textoFechaCierre,
} from "./fechaCierreTarea.js";

const cierre = "2026-04-02T15:30:45+00:00";

test("muestra el día del completed_at válido", () => {
  const tarea = { id: 1, completed_at: cierre };
  assert.equal(fechaCierreReal(tarea), cierre);
  assert.equal(textoFechaCierre(tarea), "04-02-2026");
});

test("un comentario posterior no cambia la fecha de finalización", () => {
  const tarea = {
    id: 2,
    completed_at: cierre,
    comentarios: [{ created_at: "2026-04-04T20:00:00+00:00", fecha: "04/04/2026 20:00:00" }],
    comments: [{ created_at: "2026-05-01T12:00:00+00:00" }],
  };
  assert.equal(fechaCierreReal(tarea), cierre);
  assert.equal(textoFechaCierre(tarea), "04-02-2026");
});

test("un updated_at posterior no cambia la fecha de finalización", () => {
  const tarea = {
    id: 3,
    completed_at: cierre,
    updated_at: "2026-04-03T18:00:00+00:00",
    fecha_raw: "2026-04-01T08:00:00+00:00",
    created_at: "2026-04-01T08:00:00+00:00",
    last_activity_at_iso: "2026-04-04T20:00:00+00:00",
  };
  assert.equal(fechaCierreReal(tarea), cierre);
  assert.equal(textoFechaCierre(tarea), "04-02-2026");
});

test("completed_at null, ausente o inválido muestra que el cierre no está disponible", () => {
  for (const tarea of [
    { id: 4, completed_at: null, updated_at: "2026-04-03T18:00:00+00:00" },
    { id: 5, updated_at: "2026-04-03T18:00:00+00:00", comentarios: [{ created_at: cierre }] },
    { id: 6, completed_at: "" },
    { id: 7, completed_at: "   " },
    { id: 8, completed_at: "sin-fecha" },
    { id: 9, completed_at: "2026-13-40" },
  ]) {
    assert.equal(fechaCierreReal(tarea), null);
    assert.equal(textoFechaCierre(tarea), MENSAJE_CIERRE_NO_DISPONIBLE);
  }
});

test("una hora cercana a medianoche conserva el día que trae el ISO", () => {
  const antesDeMedianoche = "2026-03-07T23:30:00-05:00";
  const despuesDeMedianoche = "2026-03-08T00:30:00-05:00";

  assert.equal(fechaCierreReal({ completed_at: antesDeMedianoche }), antesDeMedianoche);
  assert.equal(textoFechaCierre({ completed_at: antesDeMedianoche }), "03-07-2026");
  assert.equal(fechaCierreReal({ completed_at: despuesDeMedianoche }), despuesDeMedianoche);
  assert.equal(textoFechaCierre({ completed_at: despuesDeMedianoche }), "03-08-2026");
});

test("rechaza los timestamps con hora o zona inválida que el formateador aceptaría", () => {
  for (const completed_at of [
    "2026-04-02T99:99:99+00:00",
    "2026-04-02Tsin-fecha",
    "2026-04-02T15:30:45+99:00",
  ]) {
    assert.equal(fechaCierreReal({ completed_at }), null);
    assert.equal(textoFechaCierre({ completed_at }), MENSAJE_CIERRE_NO_DISPONIBLE);
  }
});

test("rechaza días imposibles y distingue los años bisiestos", () => {
  assert.equal(fechaCierreReal({ completed_at: "2024-02-29T00:00:00Z" }), "2024-02-29T00:00:00Z");
  assert.equal(textoFechaCierre({ completed_at: "2024-02-29T00:00:00Z" }), "02-29-2024");
  assert.equal(fechaCierreReal({ completed_at: "2000-02-29T12:00:00Z" }), "2000-02-29T12:00:00Z");
  assert.equal(fechaCierreReal({ completed_at: "2026-02-28T23:59:59Z" }), "2026-02-28T23:59:59Z");

  for (const completed_at of [
    "2025-02-29T00:00:00Z",
    "2026-02-29T00:00:00Z",
    "1900-02-29T00:00:00Z",
    "2026-04-31T00:00:00Z",
    "2026-00-10T00:00:00Z",
    "2026-04-00T00:00:00Z",
  ]) {
    assert.equal(fechaCierreReal({ completed_at }), null, completed_at);
  }
});

test("rechaza horas, minutos y segundos fuera de rango", () => {
  assert.equal(fechaCierreReal({ completed_at: "2026-04-02T23:59:59Z" }), "2026-04-02T23:59:59Z");
  for (const completed_at of [
    "2026-04-02T24:00:00Z",
    "2026-04-02T23:60:00Z",
    "2026-04-02T23:59:60Z",
  ]) {
    assert.equal(fechaCierreReal({ completed_at }), null, completed_at);
  }
});

test("rechaza una zona malformada o fuera de rango y acepta Z y offsets válidos", () => {
  assert.equal(fechaCierreReal({ completed_at: "2026-04-02T15:30:45Z" }), "2026-04-02T15:30:45Z");
  assert.equal(textoFechaCierre({ completed_at: "2026-04-02T15:30:45Z" }), "04-02-2026");
  assert.equal(fechaCierreReal({ completed_at: "2026-04-02T15:30:45+05:30" }), "2026-04-02T15:30:45+05:30");
  assert.equal(fechaCierreReal({ completed_at: "2026-04-02T15:30:45-12:00" }), "2026-04-02T15:30:45-12:00");
  assert.equal(fechaCierreReal({ completed_at: "2026-04-02T15:30:45+14:00" }), "2026-04-02T15:30:45+14:00");

  for (const completed_at of [
    "2026-04-02T15:30:45+24:00",
    "2026-04-02T15:30:45+00:60",
    "2026-04-02T15:30:45+5:00",
    "2026-04-02T15:30:45+0000",
    "2026-04-02T15:30:45+00",
  ]) {
    assert.equal(fechaCierreReal({ completed_at }), null, completed_at);
  }
});

test("rechaza texto sobrante y fracciones de segundo ajenas al contrato", () => {
  for (const completed_at of [
    "2026-04-02T15:30:45+00:00 ",
    "2026-04-02T15:30:45+00:00Z",
    "2026-04-02T15:30:45+00:00extra",
    "2026-04-02T15:30:45.123456+00:00",
    "2026-04-02T15:30:45.1Z",
    "2026-04-02",
  ]) {
    assert.equal(fechaCierreReal({ completed_at }), null, completed_at);
  }
});

test("null, vacío y tipos inesperados no inventan un cierre", () => {
  for (const completed_at of [null, undefined, "", "   ", 0, 1712060000, true, {}, [], new Date("2026-04-02T15:30:45Z")]) {
    assert.equal(fechaCierreReal({ completed_at }), null);
    assert.equal(textoFechaCierre({ completed_at }), MENSAJE_CIERRE_NO_DISPONIBLE);
  }
  assert.equal(fechaCierreReal({}), null);
});

test("un cierre null con bitácora no pide el detalle, y sin bitácora sí", () => {
  const sinCierre = { id: 10, completed_at: null, updated_at: "2026-04-03T18:00:00+00:00" };
  const conCierre = { id: 11, completed_at: cierre };

  assert.equal(debeEnriquecerTareaTerminada(sinCierre, true), false);
  assert.equal(debeEnriquecerTareaTerminada(conCierre, true), false);
  assert.equal(debeEnriquecerTareaTerminada(sinCierre, false), true);
  assert.equal(debeEnriquecerTareaTerminada(conCierre, false), true);
  assert.equal(debeEnriquecerTareaTerminada({ completed_at: null }, false), false);
});
