import assert from "node:assert/strict";
import test from "node:test";
import {
  etiquetaActivacionPrevista,
  vistaExpandidaCotizacion,
} from "./cotizacionFuturaListado.js";

test("la cotización de 2027 se muestra aparte y no como cobertura de 2026", () => {
  const vista = vistaExpandidaCotizacion({
    coberturasAnio: [],
    cotizacionFutura: [{
      id: 9,
      cobertura_tipo: "Plan de salud",
      fecha_activacion: "2027-01-01",
      precio: 80,
    }],
    anioOperacion: 2026,
  });

  assert.equal(vista.mostrarSinProducto, false);
  assert.equal(vista.mostrarSinCoberturas, false);
  assert.equal(vista.mostrarConteoCoberturaVigente, false);
  assert.deepEqual(vista.etiquetas, ["Activación prevista: 01/01/2027"]);
  assert.equal(vista.futuras.length, 1);
});

test("una activación dentro del año operativo no usa la sección futura", () => {
  const vista = vistaExpandidaCotizacion({
    coberturasAnio: [{ id: 3, cobertura_tipo: "Plan de salud", fecha_activacion: "2026-04-01" }],
    cotizacionFutura: [{ id: 3, fecha_activacion: "2026-04-01" }],
    anioOperacion: 2026,
  });

  assert.equal(vista.futuras.length, 0);
  assert.equal(vista.mostrarConteoCoberturaVigente, true);
  assert.equal(vista.mostrarSinCoberturas, false);
  assert.equal(etiquetaActivacionPrevista("2026-04-01", 2026), null);
});

test("sin cobertura se conservan los mensajes de ausencia", () => {
  const vista = vistaExpandidaCotizacion({
    coberturasAnio: [],
    cotizacionFutura: [],
    anioOperacion: 2026,
  });

  assert.equal(vista.mostrarSinProducto, true);
  assert.equal(vista.mostrarSinCoberturas, true);
});

test("la histórica no se mezcla con la futura y el año consultado se conserva", () => {
  const vista = vistaExpandidaCotizacion({
    coberturasAnio: [{ id: 1, cobertura_tipo: "Plan de salud", fecha_activacion: "2026-02-01" }],
    cotizacionFutura: [
      { id: 1, fecha_activacion: "2026-02-01" },
      { id: 2, fecha_activacion: "2024-05-01" },
      { id: 4, cobertura_tipo: "Plan de salud", fecha_activacion: "2027-01-01" },
    ],
    anioOperacion: 2026,
  });

  assert.deepEqual(vista.futuras.map((item) => item.id), [4]);
  assert.equal(vista.mostrarConteoCoberturaVigente, true);
  assert.equal(vista.mostrarSinProducto, false);
});

test("en simulación 2027 la indicación usa el año de operación", () => {
  assert.equal(etiquetaActivacionPrevista("2027-01-01", 2027), null);
  assert.equal(
    etiquetaActivacionPrevista("2028-01-15", 2027),
    "Activación prevista: 01/15/2028"
  );
  const vista = vistaExpandidaCotizacion({
    coberturasAnio: [],
    cotizacionFutura: [{ id: 8, fecha_activacion: "2028-01-15" }],
    anioOperacion: 2027,
  });
  assert.deepEqual(vista.etiquetas, ["Activación prevista: 01/15/2028"]);
});
