import assert from "node:assert/strict";
import {
  resolverToggleSeleccion,
  esDentalVinculadaASaludSeleccionada,
  idsDentalVinculadosASalud,
  getEtiquetaProducto,
} from "../src/utils/coberturaDentalSeleccion.js";

const coberturas = [
  {
    id: 1,
    cliente_id: 10,
    cobertura_tipo: "Plan de salud",
    plan: "Gold",
  },
  {
    id: 2,
    cliente_id: 10,
    cobertura_tipo: "Dental MS",
    plan: "Dental Gold",
  },
  {
    id: 3,
    cliente_id: 20,
    cobertura_tipo: "Dental MS",
    plan: "Dental Solo",
  },
];

// Regla UI 1: seleccionar salud incluye dental del mismo miembro
{
  const r = resolverToggleSeleccion({
    coberturaId: 1,
    coberturas,
    seleccionados: new Set(),
  });
  assert.equal(r.ok, true);
  assert.deepEqual([...r.seleccionados].sort(), [1, 2]);
}

// Regla UI 1: no se puede desmarcar dental si salud sigue seleccionada
{
  const r = resolverToggleSeleccion({
    coberturaId: 2,
    coberturas,
    seleccionados: new Set([1, 2]),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /obligatoriamente/);
}

// Regla UI 2: se puede seleccionar solo dental
{
  const r = resolverToggleSeleccion({
    coberturaId: 2,
    coberturas,
    seleccionados: new Set(),
  });
  assert.equal(r.ok, true);
  assert.deepEqual([...r.seleccionados], [2]);
}

// Deseleccionar salud quita dental vinculado
{
  const r = resolverToggleSeleccion({
    coberturaId: 1,
    coberturas,
    seleccionados: new Set([1, 2]),
  });
  assert.equal(r.ok, true);
  assert.equal(r.seleccionados.size, 0);
}

// Vinculación dental ↔ salud
assert.equal(
  esDentalVinculadaASaludSeleccionada(2, coberturas, new Set([1, 2])),
  true
);
assert.equal(
  esDentalVinculadaASaludSeleccionada(2, coberturas, new Set([2])),
  false
);

// Grupo masivo con salud incluye dental
assert.deepEqual(
  [...idsDentalVinculadosASalud([1], coberturas)].sort(),
  [2]
);

// Etiquetas de producto
assert.equal(getEtiquetaProducto(coberturas[0]), "Plan de salud");
assert.equal(getEtiquetaProducto(coberturas[1]), "Dental MS");

console.log("✅ Pruebas de selección dental/salud: OK");
