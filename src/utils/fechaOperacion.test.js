import assert from "node:assert/strict";
import test from "node:test";
import {
  anioDestinoRenovacionPorDefecto,
  claveFechaOperacion,
  parseFechaPared,
  publicarFechaOperacion,
  resolverFechaOperacion,
} from "./fechaOperacion.js";

const reloj = new Date(2026, 9, 16, 10, 12, 0);

test("sin simulación conserva el reloj recibido", () => {
  const resuelto = resolverFechaOperacion(null, reloj);
  assert.equal(resuelto.activa, false);
  assert.equal(resuelto.anio, 2026);
  assert.equal(resuelto.aviso, null);
});

test("una configuración activa usa el año que informa el backend", () => {
  const resuelto = resolverFechaOperacion({
    simulacion_permitida: true,
    activa: true,
    fecha: "2027-01-01 01:00:00",
    zona_horaria: "America/Bogota",
    anio: 2027,
    aviso: "Sandbox · Fecha de operación simulada: 1 de enero de 2027, 01:00.",
  }, reloj);

  assert.equal(resuelto.activa, true);
  assert.equal(resuelto.anio, 2027);
  assert.equal(resuelto.fecha.getMonth(), 0);
  assert.equal(resuelto.fecha.getDate(), 1);
  assert.match(resuelto.aviso, /^Sandbox · Fecha de operación simulada:/);
});

test("sin permiso del servidor no activa aunque el payload diga que sí", () => {
  const resuelto = resolverFechaOperacion({
    simulacion_permitida: false,
    activa: true,
    fecha: "2027-01-05 09:00:00",
    anio: 2027,
  }, reloj);

  assert.equal(resuelto.activa, false);
  assert.equal(resuelto.anio, 2026);
});

test("desactivar vuelve al reloj real sin conservar el año simulado", () => {
  publicarFechaOperacion({
    simulacion_permitida: true,
    activa: true,
    fecha: "2027-01-01 01:00:00",
    anio: 2027,
  }, reloj);
  const resuelto = publicarFechaOperacion({
    simulacion_permitida: true,
    activa: false,
    fecha: "2026-10-16 10:12:00",
    anio: 2026,
  }, reloj);

  assert.equal(resuelto.activa, false);
  assert.equal(resuelto.anio, 2026);
});

test("rechaza una fecha de pared imposible", () => {
  assert.equal(parseFechaPared("2027-02-31 01:00:00"), null);
});

test("el destino por defecto es el año siguiente con fecha real o simulada", () => {
  const enero = resolverFechaOperacion({
    simulacion_permitida: true,
    activa: true,
    fecha: "2027-01-05 09:00:00",
    anio: 2027,
  }, reloj);
  const real = resolverFechaOperacion(null, parseFechaPared("2027-01-05 09:00:00"));
  assert.equal(anioDestinoRenovacionPorDefecto(enero), 2028);
  assert.equal(anioDestinoRenovacionPorDefecto(real), anioDestinoRenovacionPorDefecto(enero));
  assert.notEqual(claveFechaOperacion(enero), claveFechaOperacion({
    ...enero,
    fecha: parseFechaPared("2027-01-01 01:00:00"),
  }));
});
