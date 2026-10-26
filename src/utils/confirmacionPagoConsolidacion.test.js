import assert from "node:assert/strict";
import test from "node:test";
import { pagoAConfirmarAlConsolidar } from "./confirmacionPagoConsolidacion.js";

test("solo persiste el pago si la confirmación cambia lo ya guardado", () => {
  assert.equal(pagoAConfirmarAlConsolidar({
    marcado: true,
    yaConfirmado: false,
  }), true);
  assert.equal(pagoAConfirmarAlConsolidar({
    marcado: false,
    yaConfirmado: true,
  }), false);
  assert.equal(pagoAConfirmarAlConsolidar({
    marcado: true,
    yaConfirmado: true,
  }), null);
  assert.equal(pagoAConfirmarAlConsolidar({
    marcado: false,
    yaConfirmado: false,
  }), null);
});

test("un cierre sin año destino no modifica la confirmación de pago", () => {
  assert.equal(pagoAConfirmarAlConsolidar({
    esCierreSinDestino: true,
    marcado: true,
    yaConfirmado: false,
  }), null);
});
