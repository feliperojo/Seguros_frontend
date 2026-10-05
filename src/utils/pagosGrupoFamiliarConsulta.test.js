import assert from "node:assert/strict";
import test from "node:test";
import {
  detalleProyeccion,
  detalleSnapshotCobro,
  filasPagosGrupo,
  mesesParaSituacion,
  prepararGuardadoCobro,
  prepararGuardadoProyeccion,
} from "./pagosGrupoFamiliarConsulta.js";

test("una cobertura con cobros y proyección queda en una sola fila", () => {
  const filas = filasPagosGrupo([
    {
      cobertura_id: 10,
      miembro: "Ana",
      cobertura: "Salud MS",
      compania: "OSCAR",
      codigo_poliza: "POL-ANA",
      fecha_activacion: "2026-06-01",
      meses: [
        { mes: "01", cobros: [], proyectado: { monto: 80, compania_nombre: "AMBETTER", plan: "Silver", origen: "historial_plan" } },
        { mes: "05", cobros: [{ id: 1, estado: "pagado", monto: 55, cobertura_snapshot: { compania_nombre: "OSCAR" } }], proyectado: null },
      ],
    },
  ]);

  assert.equal(filas.length, 1);
  assert.equal(filas[0].id, 10);
  assert.equal(filas[0].meses[0].tipo, "proyectado");
  assert.equal(filas[0].meses[4].tipo, "cobro");
  assert.equal(filas[0].meses[4].cobros[0].id, 1);
  assert.equal(filas[0].fechaActivacion, "2026-06-01");
});

test("dos coberturas del mismo miembro permanecen separadas", () => {
  const filas = filasPagosGrupo([
    { cobertura_id: 1, miembro: "Ana", cobertura: "Salud MS", meses: [] },
    { cobertura_id: 2, miembro: "Ana", cobertura: "Dental MS", meses: [] },
  ]);
  assert.deepEqual(filas.map((fila) => fila.id), [1, 2]);
});

test("el cobro generado tiene prioridad y no descarta otro cobro del mismo mes", () => {
  const filas = filasPagosGrupo([
    {
      cobertura_id: 3,
      meses: [{
        mes: "05",
        proyectado: { monto: 999 },
        cobros: [
          { id: 8, estado: "pendiente", monto: 11, cobertura_snapshot: { plan: "Gold" } },
          { id: 9, estado: "pagado", monto: 22, cobertura_snapshot: { plan: "Silver" } },
        ],
      }],
    },
  ]);
  assert.equal(filas[0].meses[4].tipo, "cobro");
  assert.deepEqual(filas[0].meses[4].cobros.map((cobro) => cobro.id), [8, 9]);
  assert.equal(mesesParaSituacion(filas[0].meses)[4].estado, "pendiente");
});

test("cada tooltip usa el snapshot de su propio pago", () => {
  const oscar = detalleSnapshotCobro({
    id: 8,
    cobertura_snapshot: { compania_nombre: "OSCAR", plan: "Gold", codigo_poliza: "POL-A" },
  });
  const ambetter = detalleSnapshotCobro({
    id: 9,
    cobertura_snapshot: {
      compania_nombre: "AMBETTER",
      plan: "Silver",
      codigo_poliza: "POL-B",
      fecha_activacion: "2026-03-01",
      tipo_pago: "MANUAL",
      dia_pago: 8,
    },
  });
  assert.equal(oscar.campos.find((campo) => campo.etiqueta === "Compañía").valor, "OSCAR");
  assert.equal(ambetter.campos.find((campo) => campo.etiqueta === "Plan").valor, "Silver");
  assert.equal(ambetter.campos.find((campo) => campo.etiqueta === "Fecha de activación").valor, "2026-03-01");
  assert.equal(oscar.campos.some((campo) => campo.etiqueta === "Fecha de activación"), false);
});

test("sin snapshot no inventa datos históricos", () => {
  const detalle = detalleSnapshotCobro({ id: 4, cobertura_snapshot: null, plan: "Actual" });
  assert.equal(detalle.disponible, false);
  assert.equal(detalle.titulo, "Snapshot no disponible");
  assert.deepEqual(detalle.campos, []);
});

test("la proyección no se presenta como snapshot", () => {
  const detalle = detalleProyeccion({
    monto: 80,
    compania_nombre: "AMBETTER",
    plan: "Silver",
    origen: "historial_plan",
  });
  assert.equal(detalle.titulo, "Proyección");
  assert.match(detalle.nota, /no es el snapshot/i);
});

test("editar monto y estado apunta solo al id seleccionado y el monto va antes del estado", () => {
  const preparado = prepararGuardadoCobro({
    cobro: { id: 15, estado: "pendiente", monto: 55 },
    estado: "pagado",
    monto: "40.00",
    motivo: "Ajuste del importe de enero",
  });
  assert.equal(preparado.ok, true);
  assert.deepEqual(preparado.acciones.map((accion) => [accion.method, accion.path]), [
    ["POST", "cobertura/pagos/15/corregir"],
    ["PUT", "cobertura/pagos/15"],
  ]);
  assert.equal(preparado.acciones[0].body.monto, 40);
});

test("cancelar no arma ninguna escritura y un cobro pagado sí corrige el importe", () => {
  const sinCambios = prepararGuardadoCobro({
    cobro: { id: 15, estado: "pendiente", monto: 55 },
    estado: "pendiente",
    monto: "55.00",
    motivo: "",
  });
  assert.equal(sinCambios.ok, true);
  assert.deepEqual(sinCambios.acciones, []);

  const pagado = prepararGuardadoCobro({
    cobro: { id: 15, estado: "pagado", monto: 40 },
    estado: "pendiente",
    monto: "12.00",
    motivo: "Revision extra del importe",
  });
  assert.equal(pagado.ok, true);
  assert.deepEqual(pagado.acciones, [
    {
      method: "POST",
      path: "cobertura/pagos/15/corregir",
      body: {
        motivo: "Revision extra del importe",
        monto: 12,
        confirmar_importe_registrado: true,
      },
    },
    { method: "PUT", path: "cobertura/pagos/15", body: { estado: "pendiente" } },
  ]);
});

test("editar una proyección registra solo ese mes y no genera cobros del año", () => {
  const preparado = prepararGuardadoProyeccion({
    grupoFamiliarId: 9,
    coberturaId: 10,
    anio: 2026,
    mes: "03",
    estado: "pendiente",
    monto: "90.50",
    motivo: "Revision extra de marzo",
  });
  assert.equal(preparado.ok, true);
  assert.deepEqual(preparado.acciones, [
    {
      method: "POST",
      path: "cobertura/pagos/grupo-familiar/9/ajuste",
      body: {
        cobertura_id: 10,
        anio: 2026,
        mes: "03",
        estado: "pendiente",
        motivo: "Revision extra de marzo",
        monto: 90.5,
      },
    },
  ]);
  assert.equal(
    preparado.acciones.some((accion) => String(accion.path).includes("generar-cobros")),
    false
  );
});

test("un estado no permitido no se envía", () => {
  const preparado = prepararGuardadoCobro({
    cobro: { id: 15, estado: "pendiente", monto: 55 },
    estado: "cancelado",
    monto: "55.00",
    motivo: "",
  });
  assert.equal(preparado.ok, false);
  assert.equal(preparado.acciones.length, 0);
});
