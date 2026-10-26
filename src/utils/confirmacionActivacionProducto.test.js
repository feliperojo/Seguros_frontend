import assert from "node:assert/strict";
import test from "node:test";
import {
  camposConfirmacionActivacion,
  estadoInicialConfirmacionActivacion,
  previewSigueVigente,
  puedeConfirmarActivacion,
} from "./confirmacionActivacionProducto.js";

const huella = "a".repeat(64);
const previewValida = { confirmable: true, huella, items: [{ cobertura_id: 1 }] };

test("sin la confirmación el botón no se habilita", () => {
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: false,
    preview: previewValida,
  }), false);
});

test("el check único exige la vista de pagos porque la inscripción y el pago van juntos", () => {
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: true,
    preview: null,
  }), false);
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: true,
    previewLoading: true,
    preview: previewValida,
  }), false);
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: true,
    previewError: "No se pudieron consultar los pagos iniciales.",
    preview: previewValida,
  }), false);
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: true,
    preview: { confirmable: false, huella, bloqueos: [{ mensaje: "procesándose" }] },
  }), false);
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: true,
    preview: previewValida,
  }), true);
  assert.equal(puedeConfirmarActivacion({
    confirmoActivacion: true,
    preview: { confirmable: true, huella, requiere_pago: false, items: [] },
  }), true);
});

test("el check único autoriza la activación y el registro de pagos", () => {
  assert.deepEqual(camposConfirmacionActivacion({
    confirmar_activacion: false,
    huella,
  }), {});

  assert.deepEqual(camposConfirmacionActivacion({
    confirmar_activacion: true,
    huella,
    monto: 80,
    mes: "01",
    anio: 2025,
  }), {
    confirmar_activacion: true,
    confirmar_pagos_iniciales: true,
    huella,
  });
});

test("cerrar y reabrir deja la confirmación desmarcada y descarta una vista tardía", () => {
  const reabierto = estadoInicialConfirmacionActivacion();
  assert.equal(reabierto.confirmoActivacion, false);
  assert.equal(reabierto.preview, null);
  assert.equal(puedeConfirmarActivacion(reabierto), false);
  assert.deepEqual(camposConfirmacionActivacion({
    confirmar_activacion: reabierto.confirmoActivacion,
    huella,
  }), {});
  assert.equal(previewSigueVigente(1, 2), false);
  assert.equal(previewSigueVigente(2, 2), true);
});
