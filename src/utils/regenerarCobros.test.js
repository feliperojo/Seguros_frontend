import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  alternarSeleccion,
  companiaDelCobro,
  conservarSeleccionEnFiltro,
  describirAlcance,
  filtrarCobrosParaRegenerar,
  prepararConfirmacionRegeneracion,
  seleccionarPagina,
  seleccionarTodosFiltrados,
  textoMontoRevision,
  MODALIDAD_COBERTURA_Y_MONTO,
  MODALIDAD_SOLO_COBERTURA,
} from "./regenerarCobros.js";

const filtrados = Array.from({ length: 12 }, (_, indice) => ({ id: indice + 1 }));
const pagina = filtrados.slice(0, 10);

test("seleccionar todos usa el período filtrado y no solo la página", () => {
  const todos = seleccionarTodosFiltrados(filtrados);
  const visibles = seleccionarPagina(pagina);
  assert.deepEqual(todos, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(visibles, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const alcanceTodos = describirAlcance({
    seleccion: todos,
    pagosFiltrados: filtrados,
    pagosPagina: pagina,
    periodo: "Octubre 2026",
  });
  assert.equal(alcanceTodos.esTodosLosFiltrados, true);
  assert.equal(alcanceTodos.esSoloLaPagina, false);
  assert.equal(alcanceTodos.cantidad, 12);
  assert.match(alcanceTodos.texto, /filtros activos/);
  assert.match(alcanceTodos.texto, /no solo los 10 visibles/);

  const alcancePagina = describirAlcance({
    seleccion: visibles,
    pagosFiltrados: filtrados,
    pagosPagina: pagina,
    periodo: "Octubre 2026",
  });
  assert.equal(alcancePagina.esSoloLaPagina, true);
  assert.equal(alcancePagina.esTodosLosFiltrados, false);
  assert.match(alcancePagina.texto, /página visible/);
});

test("la selección individual no arrastra cobros de otro filtro", () => {
  const seleccion = alternarSeleccion(alternarSeleccion([], 2), 11);
  assert.deepEqual(seleccion, [2, 11]);
  const soloCliente = filtrados.filter((pago) => pago.id === 2);
  assert.deepEqual(conservarSeleccionEnFiltro(seleccion, soloCliente), [2]);
});

test("confirmar arma solo los ids incluidos y la modalidad A no presenta el recálculo como importe", () => {
  const preparado = prepararConfirmacionRegeneracion({
    incluidos: [8],
    preview: {
      huella: "a".repeat(64),
      requiere_confirmacion_datos_actuales: false,
      items: [
        { pago_id: 8, bloqueado: false, importe_bloqueado: false, monto_conservado: 55, precio_referencia: 80, monto_recalculado: 80 },
        { pago_id: 9, bloqueado: false, importe_bloqueado: false },
      ],
    },
    modalidad: MODALIDAD_SOLO_COBERTURA,
    motivo: "Revision de la cobertura",
    confirmarDatosActuales: false,
  });
  assert.equal(preparado.ok, true);
  assert.deepEqual(preparado.body.pago_ids, [8]);
  assert.equal(preparado.body.modalidad, MODALIDAD_SOLO_COBERTURA);
  assert.equal(JSON.stringify(preparado.body).includes("generar-cobros"), false);

  const textos = textoMontoRevision(preparado && {
    monto_conservado: 55,
    precio_referencia: 80,
    monto_recalculado: 80,
  }, MODALIDAD_SOLO_COBERTURA);
  assert.deepEqual(textos.map((fila) => fila.etiqueta), [
    "Monto del cobro (se conserva)",
    "Precio de referencia",
  ]);
  assert.equal(textos[0].valor, "$55.00");
  assert.equal(textos[1].valor, "$80.00");
});

test("los filtros activos limitan la regeneración al período cargado", () => {
  const pagos = [
    {
      id: 1,
      cliente: { nombre_completo: "Ana Perez" },
      cobertura_snapshot: { compania_nombre: "AMBETTER" },
      cobertura: { compania: { nombre: "OSCAR" } },
      grupo_familiar: { responsable: "Luis" },
    },
    {
      id: 2,
      cliente: { nombre_completo: "Ana Perez" },
      cobertura_snapshot: { compania_nombre: "OSCAR" },
      grupoFamiliar: { responsable: "Marta" },
    },
  ];
  assert.equal(companiaDelCobro(pagos[0]), "AMBETTER");
  const filtrados = filtrarCobrosParaRegenerar(pagos, {
    cliente: "ana",
    compania: "ambetter",
    responsable: "luis",
  });
  assert.deepEqual(filtrados.map((pago) => pago.id), [1]);
  assert.deepEqual(seleccionarTodosFiltrados(filtrados), [1]);
});

test("actualización consulta y cambia estado; generación concentra faltantes y regeneración", () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const actualizar = fs.readFileSync(path.join(raiz, "pages/PagosActualizar.jsx"), "utf8");
  const generar = fs.readFileSync(path.join(raiz, "components/TablaConfiguracionPagos.jsx"), "utf8");

  assert.equal(actualizar.includes("RegenerarCobrosModal"), false);
  assert.equal(actualizar.includes("generar-cobros"), false);
  assert.equal(actualizar.includes("pagos/regenerar"), false);
  assert.equal(actualizar.includes("Corregir datos del cobro"), true);
  assert.equal(actualizar.includes("cobertura/pagos/${pagoId}"), true);

  assert.equal(generar.includes("Generar faltantes"), true);
  assert.equal(generar.includes("Regenerar existentes"), true);
  assert.equal(generar.includes("cobertura/generar-cobros"), true);
  assert.equal(generar.includes("RegenerarCobrosModal"), true);
  assert.equal(generar.includes('setIdsRevision(seleccionRegenerar)'), true);
});

test("la modalidad de monto no confirma un cobro pagado y cancelar no arma la escritura", () => {
  const bloqueado = prepararConfirmacionRegeneracion({
    incluidos: [4],
    preview: {
      huella: "b".repeat(64),
      items: [{ pago_id: 4, bloqueado: false, importe_bloqueado: true, motivo_importe: "importe bloqueado" }],
    },
    modalidad: MODALIDAD_COBERTURA_Y_MONTO,
    motivo: "Quiere cambiar el importe",
    confirmarDatosActuales: true,
  });
  assert.equal(bloqueado.ok, false);
  assert.equal(bloqueado.body, null);

  const cancelado = prepararConfirmacionRegeneracion({
    incluidos: [],
    preview: null,
    modalidad: MODALIDAD_SOLO_COBERTURA,
    motivo: "",
    confirmarDatosActuales: false,
  });
  assert.equal(cancelado.ok, false);
  assert.equal(cancelado.body, null);
});
