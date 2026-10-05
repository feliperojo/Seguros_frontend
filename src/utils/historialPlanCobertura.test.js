import assert from "node:assert/strict";
import test from "node:test";
import {
  esPlanRecuperable,
  filtrarHistorialPlanPorCoberturaYAnio,
  getAnioEfectivoRegistroPlan,
  getAnioHistorialPlan,
  referenciaHistorialPlanCancelacion,
} from "./historialPlanCobertura.js";

const registro = (extra) => ({
  id: extra.id,
  cobertura_id: extra.cobertura_id,
  plan: extra.plan || "Gold",
  cliente_nombre: "LIANNA LICET ALVAREZ",
  compania: { nombre: "OSCAR" },
  ...extra,
});

test("una fila usa su cobertura original y su año de cobertura", () => {
  const fila = {
    id: 900,
    cobertura_id_original: 42,
    ano_cobertura: "2026",
    cliente_info: { nombre_completo: "LIANNA" },
    plan: "Gold",
    compania: { nombre: "OSCAR" },
  };

  const ref = referenciaHistorialPlanCancelacion(fila);
  assert.deepEqual(
    { coberturaId: ref.coberturaId, anio: ref.anio, valida: ref.valida },
    { coberturaId: 42, anio: 2026, valida: true }
  );

  const visibles = filtrarHistorialPlanPorCoberturaYAnio(
    [
      registro({
        id: 1,
        cobertura_id: 42,
        fecha_activacion: "2026-01-01",
        fecha_expiracion: "2026-06-17",
      }),
      registro({
        id: 2,
        cobertura_id: 42,
        fecha_activacion: "2025-01-01",
        fecha_expiracion: "2025-12-31",
      }),
    ],
    ref.coberturaId,
    ref.anio
  );

  assert.deepEqual(visibles.map((item) => item.id), [1]);
});

test("el mismo cliente con otra cobertura no mezcla historiales", () => {
  const registros = [
    registro({
      id: 1,
      cobertura_id: 10,
      plan: "Gold",
      fecha_activacion: "2026-01-01",
    }),
    registro({
      id: 2,
      cobertura_id: 77,
      plan: "Gold",
      fecha_activacion: "2026-01-01",
      cliente_nombre: "LIANNA LICET ALVAREZ",
    }),
  ];

  const deLaFila = filtrarHistorialPlanPorCoberturaYAnio(registros, 10, 2026);
  assert.deepEqual(deLaFila.map((item) => item.id), [1]);
});

test("una modificación registrada en otro año calendario sigue en su año de cobertura", () => {
  const item = registro({
    id: 8,
    cobertura_id: 42,
    fecha_activacion: "2026-01-01",
    fecha_expiracion: "2026-08-01",
    created_at: "2027-02-03T16:16:35",
  });

  assert.equal(getAnioEfectivoRegistroPlan(item), 2026);
  assert.equal(getAnioHistorialPlan(item), 2026);

  const visibles = filtrarHistorialPlanPorCoberturaYAnio([item], 42, 2026);
  assert.equal(visibles.length, 1);
});

test("created_at no asigna el año cuando no hay fechas efectivas", () => {
  const item = registro({
    id: 9,
    cobertura_id: 42,
    fecha_activacion: null,
    fecha_expiracion: null,
    created_at: "2026-03-01T10:00:00",
  });

  assert.equal(getAnioEfectivoRegistroPlan(item), null);
  assert.equal(getAnioHistorialPlan(item), 2026);
  assert.deepEqual(filtrarHistorialPlanPorCoberturaYAnio([item], 42, 2026), []);
});

test("sin ID original o sin año no hay referencia válida", () => {
  assert.equal(
    referenciaHistorialPlanCancelacion({
      id: 1,
      ano_cobertura: "2026",
      cliente_info: { nombre_completo: "LIANNA" },
      plan: "Gold",
    }).valida,
    false
  );
  assert.equal(
    referenciaHistorialPlanCancelacion({
      id: 1,
      cobertura_id_original: 42,
      ano_cobertura: "",
    }).valida,
    false
  );
  assert.equal(
    referenciaHistorialPlanCancelacion({
      id: 55,
      cobertura_id_original: null,
      ano_cobertura: null,
    }).coberturaId,
    null
  );
});

test("solo es recuperable el plan de la misma cobertura y año, y no una anulación", () => {
  const base = {
    coberturaId: 42,
    anio: 2026,
  };

  assert.equal(
    esPlanRecuperable(
      registro({
        id: 1,
        cobertura_id: 42,
        fecha_activacion: "2026-02-01",
        fecha_expiracion: "2026-06-01",
        es_anulacion: false,
      }),
      base
    ),
    true
  );

  assert.equal(
    esPlanRecuperable(
      registro({
        id: 2,
        cobertura_id: 42,
        fecha_activacion: "2026-02-01",
        es_anulacion: true,
      }),
      base
    ),
    false
  );

  assert.equal(
    esPlanRecuperable(
      registro({
        id: 3,
        cobertura_id: 77,
        fecha_activacion: "2026-02-01",
      }),
      base
    ),
    false
  );

  assert.equal(
    esPlanRecuperable(
      registro({
        id: 4,
        cobertura_id: 42,
        fecha_activacion: "2025-02-01",
      }),
      base
    ),
    false
  );

  assert.equal(
    esPlanRecuperable(
      registro({
        id: 5,
        cobertura_id: 42,
        fecha_activacion: null,
        fecha_expiracion: null,
        created_at: "2026-03-01T10:00:00",
      }),
      base
    ),
    false
  );
});
