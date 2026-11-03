import assert from "node:assert/strict";
import test from "node:test";
import {
  leerCambiosSinGuardar,
  registrarCambiosSinGuardar,
} from "./cambiosSinGuardar.js";
import { edicionDeGrupoTieneCambios } from "./grupoFamiliarConcurrentSave.js";

test("sin pantallas registradas no hay cambios pendientes", () => {
  assert.deepEqual(leerCambiosSinGuardar(), { pendiente: false, guardando: false });
});

test("el registro se limpia al desmontar", () => {
  const dejar = registrarCambiosSinGuardar(() => ({ pendiente: true, guardando: false }));
  assert.equal(leerCambiosSinGuardar().pendiente, true);
  dejar();
  assert.deepEqual(leerCambiosSinGuardar(), { pendiente: false, guardando: false });
});

test("un guardado en curso impide tratar la pantalla como solo pendiente", () => {
  const dejar = registrarCambiosSinGuardar(() => ({ pendiente: true, guardando: true }));
  assert.deepEqual(leerCambiosSinGuardar(), { pendiente: false, guardando: true });
  dejar();
});

test("abrir edición sin modificar datos no es un cambio pendiente", () => {
  const grupo = { responsable: "Ana" };
  const clientes = [{ id: 4, primer_nombre: "Ana" }];
  const coberturas = [{ id: 9, cliente_id: 4, precio: 10 }];
  const miembros = [{ cliente_id: 4, cobertura_id: 9 }];

  assert.equal(
    edicionDeGrupoTieneCambios({
      baselineMiembros: miembros,
      miembrosActuales: miembros,
      productoLabelBase: "Plan de salud",
      productoLabelActual: "Plan de salud",
      baselineGrupo: grupo,
      grupoActual: grupo,
      baselineClientes: clientes,
      clientesActuales: clientes,
      baselineCoberturas: coberturas,
      coberturasActuales: coberturas,
    }),
    false
  );
});

test("un campo distinto, un miembro nuevo o el plan sí son cambios pendientes", () => {
  const base = {
    baselineMiembros: [{ cliente_id: 4 }],
    miembrosActuales: [{ cliente_id: 4 }],
    productoLabelBase: "Plan de salud",
    productoLabelActual: "Plan de salud",
    baselineGrupo: { responsable: "Ana" },
    grupoActual: { responsable: "Ana" },
    baselineClientes: [{ id: 4, primer_nombre: "Ana" }],
    clientesActuales: [{ id: 4, primer_nombre: "Ana" }],
    baselineCoberturas: [{ id: 9, precio: 10 }],
    coberturasActuales: [{ id: 9, precio: 10 }],
  };

  assert.equal(
    edicionDeGrupoTieneCambios({
      ...base,
      grupoActual: { responsable: "Luis" },
    }),
    true
  );
  assert.equal(
    edicionDeGrupoTieneCambios({
      ...base,
      miembrosActuales: [{ cliente_id: 4 }, { nombre: "Nuevo" }],
    }),
    true
  );
  assert.equal(
    edicionDeGrupoTieneCambios({
      ...base,
      productoLabelActual: "Plan dental",
    }),
    true
  );
});
