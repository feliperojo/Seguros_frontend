import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { filasInformePagos } from "./informePagosCobertura.js";
import { indicadorMorosidadPagosPorMes } from "./pagosMorosidad.js";
import {
  paginaTrasConsulta,
  prepararActualizacionEstadoInforme,
  puedeEditarEstadoInforme,
  reflejarEstadoGuardado,
} from "./informePagosEstado.js";

test("pendiente, procesando y pagado preparan solo el estado de ese pago", () => {
  const aProcesando = prepararActualizacionEstadoInforme({
    pagoId: 15,
    estadoActual: "pendiente",
    estadoNuevo: "procesando",
  });
  const aPagado = prepararActualizacionEstadoInforme({
    pagoId: 15,
    estadoActual: "procesando",
    estadoNuevo: "pagado",
  });

  assert.deepEqual(aProcesando, {
    enviar: true,
    motivo: null,
    path: "cobertura/pagos/15",
    body: { estado: "procesando" },
  });
  assert.deepEqual(aPagado.body, { estado: "pagado" });
  assert.deepEqual(Object.keys(aProcesando.body), ["estado"]);
});

test("cancelar y guardar sin cambio no preparan solicitud", () => {
  assert.equal(
    prepararActualizacionEstadoInforme({
      pagoId: 15,
      estadoActual: "pendiente",
      estadoNuevo: "pendiente",
    }).enviar,
    false
  );
  assert.equal(
    prepararActualizacionEstadoInforme({
      pagoId: 15,
      estadoActual: "Pagado",
      estadoNuevo: "pagado",
    }).motivo,
    "sin_cambio"
  );
});

test("no usa el id del cliente ni de la cobertura y rechaza estados ajenos", () => {
  const preparado = prepararActualizacionEstadoInforme({
    pagoId: 88,
    estadoActual: "pendiente",
    estadoNuevo: "pagado",
  });
  assert.equal(preparado.path, "cobertura/pagos/88");
  assert.equal(preparado.path.includes("21"), false);

  assert.equal(
    prepararActualizacionEstadoInforme({
      pagoId: 0,
      estadoActual: "pendiente",
      estadoNuevo: "pagado",
    }).motivo,
    "id"
  );
  assert.equal(
    prepararActualizacionEstadoInforme({
      pagoId: 88,
      estadoActual: "pendiente",
      estadoNuevo: "cancelado",
    }).motivo,
    "estado"
  );
});

test("la página se conserva y baja solo si la actual ya no existe", () => {
  assert.equal(paginaTrasConsulta(2, 25, 10), 2);
  assert.equal(paginaTrasConsulta(4, 12, 10), 2);
  assert.equal(paginaTrasConsulta(3, 0, 10), 1);
});

test("un cobro guardado no cambia a los demás y la situación se recalcula", () => {
  const base = (id, mes, estado) => ({
    id,
    cobertura_id: 21,
    anio_generado: 2026,
    mes_generado: mes,
    estado,
    monto: 10,
    cliente: { nombre_completo: "Ana" },
    cobertura_fiscal_informe: { compania_nombre: "Ambetter", plan: "Silver" },
  });
  const pagos = [base(1, "10", "pendiente"), base(2, "10", "pendiente"), base(3, "11", "pagado")];
  const parcial = reflejarEstadoGuardado(pagos, 1, "pagado");
  const filaParcial = filasInformePagos(parcial, { anio: 2026 })[0];
  assert.deepEqual(filaParcial.pagos[9].cobros.map((cobro) => [cobro.id, cobro.estado]), [[1, "pagado"], [2, "pendiente"]]);
  assert.equal(indicadorMorosidadPagosPorMes(filaParcial.pagos).nivel, "mora");

  const alDia = filasInformePagos(reflejarEstadoGuardado(parcial, 2, "pagado"), { anio: 2026 })[0];
  assert.equal(indicadorMorosidadPagosPorMes(alDia.pagos).nivel, "al_dia");
});

test("ver el informe no habilita la edición", () => {
  assert.equal(
    puedeEditarEstadoInforme({
      moduloActualizacionVisible: false,
      puedeAbrirModuloOculto: false,
    }),
    false
  );
  assert.equal(
    puedeEditarEstadoInforme({
      moduloActualizacionVisible: true,
      puedeAbrirModuloOculto: false,
    }),
    true
  );
  assert.equal(
    puedeEditarEstadoInforme({
      moduloActualizacionVisible: false,
      puedeAbrirModuloOculto: true,
    }),
    true
  );
});

test("el informe actualiza por el id del cobro y conserva consulta, excel e histórico", () => {
  const fuente = fs.readFileSync(new URL("../pages/PagosInforme.jsx", import.meta.url), "utf8");
  const guardar = fuente.slice(fuente.indexOf("const guardarEstado"), fuente.indexOf("const handleFiltroChange"));

  assert.match(fuente, /cobertura\/pagos\/listado\?informe_anual=1/);
  assert.match(fuente, /Descargar Excel/);
  assert.match(fuente, /OverlayTrigger/);
  assert.match(fuente, /pagos-informe__celda-vacia/);
  assert.match(fuente, /pagoId: cobro\.id/);
  assert.match(guardar, /prepararActualizacionEstadoInforme/);
  assert.match(guardar, /apiRequest\(preparado\.path, "PUT", preparado\.body\)/);
  assert.doesNotMatch(guardar, /portal/);
  assert.doesNotMatch(guardar, /cliente_id/);
  assert.doesNotMatch(guardar, /cobertura_id/);
  assert.match(fuente, /puedeEditarEstadoInforme/);
  assert.match(fuente, /puedeEditar \? \(/);
});
