import assert from "node:assert/strict";
import test from "node:test";
import {
  estadoBotonAplicarPrecio,
  filaElegible,
  idsPendientesElegibles,
  mapaPreciosGuardados,
  MENSAJE_COBERTURA_SIN_GUARDAR,
  MENSAJE_PRECIO_SIN_GUARDAR,
  mensajeSinPagos,
  motivoValido,
  preciosDifieren,
  resumenSeleccion,
} from "./aplicarPrecioCobros.js";

test("cobertura sin guardar y precio modificado bloquean el botón", () => {
  assert.equal(
    estadoBotonAplicarPrecio({ coberturaId: null, precioDigitado: "10", preciosGuardados: {} }).explicacion,
    MENSAJE_COBERTURA_SIN_GUARDAR
  );
  const guardados = { "4": "100.00" };
  assert.equal(
    estadoBotonAplicarPrecio({ coberturaId: 4, precioDigitado: "120,00", preciosGuardados: guardados }).explicacion,
    MENSAJE_PRECIO_SIN_GUARDAR
  );
  assert.equal(
    estadoBotonAplicarPrecio({ coberturaId: 4, precioDigitado: "100.00", preciosGuardados: guardados }).habilitado,
    true
  );
});

test("el precio cero no se trata como vacío", () => {
  assert.equal(preciosDifieren(0, 0), false);
  assert.equal(preciosDifieren("0,00", 0), false);
  assert.equal(preciosDifieren("", 0), true);
  assert.equal(preciosDifieren(0, 10), true);
  const estado = estadoBotonAplicarPrecio({
    coberturaId: 3,
    precioDigitado: 0,
    preciosGuardados: { "3": 0 },
  });
  assert.equal(estado.habilitado, true);
});

test("la selección respeta mes, estado, importe igual y cobros distintos del mismo mes", () => {
  const filas = [
    { pago_id: 1, mes: "04", estado: "pendiente", monto: 80, nuevo_importe: 150, seleccionable: true, sin_cobro: false },
    { pago_id: 2, mes: "06", estado: "pendiente", monto: 80, nuevo_importe: 150, seleccionable: true, sin_cobro: false },
    { pago_id: 3, mes: "06", estado: "pagado", monto: 80, nuevo_importe: 150, seleccionable: false, sin_cobro: false },
    { pago_id: 4, mes: "06", estado: "procesando", monto: 80, nuevo_importe: 150, seleccionable: false, sin_cobro: false },
    { pago_id: 5, mes: "07", estado: "pendiente", monto: 150, nuevo_importe: 150, seleccionable: false, sin_cobro: false },
    { pago_id: null, mes: "08", sin_cobro: true, seleccionable: false, motivo: "Sin cobro" },
  ];

  assert.deepEqual(idsPendientesElegibles(filas, "06"), [2]);
  assert.equal(filaElegible(filas[0], "06"), false);
  assert.equal(filaElegible(filas[5], "06"), false);
  const resumen = resumenSeleccion(filas, [2]);
  assert.equal(resumen.cantidad, 1);
  assert.equal(resumen.cambios[0].pagoId, 2);
  assert.equal(motivoValido("abc"), false);
  assert.equal(motivoValido("Ajuste de precio"), true);
});

test("sin pagos el mensaje nombra el rango y no pide una acción imposible", () => {
  const filas = [
    { mes: "10", pago_id: null, sin_cobro: true },
    { mes: "11", pago_id: null, sin_cobro: true },
    { mes: "12", pago_id: null, sin_cobro: true },
  ];
  const texto = mensajeSinPagos({ filas, meses: ["10", "11", "12"], anio: 2026, mesDesde: "11" });
  assert.match(texto, /de octubre a diciembre de 2026/);
  assert.match(texto, /no se crea ninguno/i);
  assert.equal(
    mensajeSinPagos({
      filas: [{ mes: "10", pago_id: 4, sin_cobro: false, seleccionable: true }],
      meses: ["10", "11", "12"],
      anio: 2026,
      mesDesde: "11",
    }),
    "Desde noviembre de 2026 no hay cobros generados. Elija un mes anterior para ver los que ya existen."
  );
  assert.equal(
    mensajeSinPagos({
      filas: [{ mes: "11", pago_id: 4, sin_cobro: false, seleccionable: true }],
      meses: ["10", "11", "12"],
      anio: 2026,
      mesDesde: "11",
    }),
    ""
  );
});

test("el mapa de precios usa la cobertura y su dental, no otro grupo", () => {
  const mapa = mapaPreciosGuardados([
    { cobertura_id: 9, precio: "10", coberturaDental: { cobertura_id: 10, precio: 0 } },
  ]);
  assert.equal(mapa["9"], "10");
  assert.equal(mapa["10"], 0);
});
