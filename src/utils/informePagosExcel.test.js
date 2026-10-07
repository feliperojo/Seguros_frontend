import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { filasInformePagos } from "./informePagosCobertura.js";
import { indicadorMorosidadPagosPorMes } from "./pagosMorosidad.js";
import {
  FILA_ENCABEZADO,
  HOJA_DETALLE,
  HOJA_RESUMEN,
  crearLibroInformePagos,
  nombreArchivoInformePagos,
} from "./informePagosExcel.js";

const FISCAL = {
  compania_nombre: "Actual",
  plan: "Plan fiscal",
  pagador_nombre: "Pagador externo",
  codigo_poliza: "00100",
};

function pago(parcial) {
  const fiscal = parcial.fiscal === null
    ? null
    : { ...FISCAL, ...(parcial.fiscal || {}) };
  return {
    id: parcial.id,
    cobertura_id: parcial.coberturaId,
    anio_generado: parcial.anio ?? 2026,
    mes_generado: parcial.mes,
    estado: parcial.estado ?? "pendiente",
    monto: parcial.monto,
    fecha_pago: parcial.fechaPago ?? "",
    grupo_familiar_id: Object.prototype.hasOwnProperty.call(parcial, "grupo") ? parcial.grupo : 500,
    cliente: { nombre_completo: parcial.cliente ?? "Ana López", id: 9 },
    cliente_id: 9,
    cobertura_fiscal_informe: fiscal,
    cobertura_snapshot: Object.prototype.hasOwnProperty.call(parcial, "snapshot") ? parcial.snapshot : null,
    updated_at: parcial.updatedAt,
    plan: "Plan actual que no debe exportarse",
    compania_nombre: "Compañía actual que no debe exportarse",
    pagador_nombre: "Pagador actual que no debe exportarse",
  };
}

function libroDe(pagos, filtros) {
  const filas = filasInformePagos(pagos, filtros);
  const libro = crearLibroInformePagos({
    filas,
    filtros,
    fechaDescarga: "2026-10-07",
  });
  return { filas, libro };
}

function leerLibro(libro) {
  const archivo = fileURLToPath(new URL(
    `./.tmp-informe-pagos-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`,
    import.meta.url,
  ));
  try {
    const buffer = XLSX.write(libro, { bookType: "xlsx", type: "buffer" });
    fs.writeFileSync(archivo, buffer);
    return XLSX.read(fs.readFileSync(archivo), { type: "buffer", cellNF: true, cellStyles: true });
  } finally {
    fs.rmSync(archivo, { force: true });
  }
}

function celda(hoja, fila, columna) {
  return hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
}

function columnas(hoja) {
  const rango = XLSX.utils.decode_range(hoja["!ref"]);
  const mapa = new Map();
  for (let columna = 0; columna <= rango.e.c; columna += 1) {
    const titulo = celda(hoja, FILA_ENCABEZADO, columna);
    if (titulo) mapa.set(titulo.v, columna);
  }
  return mapa;
}

function registros(hoja) {
  const cols = columnas(hoja);
  const rango = XLSX.utils.decode_range(hoja["!ref"]);
  const filas = [];
  for (let fila = FILA_ENCABEZADO + 1; fila <= rango.e.r; fila += 1) {
    const registro = {};
    for (const [titulo, columna] of cols) registro[titulo] = celda(hoja, fila, columna);
    filas.push(registro);
  }
  return filas;
}

function valor(celdaActual) {
  return celdaActual ? celdaActual.v : undefined;
}

function assertTexto(celdaActual, esperado) {
  assert.ok(celdaActual, `se esperaba el texto ${esperado}`);
  assert.ok(celdaActual.t === "s" || celdaActual.t === "str");
  assert.equal(celdaActual.v, esperado);
  assert.equal(celdaActual.f, undefined);
}

function assertMoneda(celdaActual, esperado) {
  assert.ok(celdaActual);
  assert.equal(celdaActual.t, "n");
  assert.equal(celdaActual.v, esperado);
  assert.equal(celdaActual.z, '"$"#,##0.00');
  assert.equal(celdaActual.f, undefined);
}

function assertSinFormulas(hoja) {
  for (const clave of Object.keys(hoja)) {
    if (clave.startsWith("!")) continue;
    assert.notEqual(hoja[clave].t, "f");
    assert.equal(hoja[clave].f, undefined);
  }
}

function pagosInformeCompleto() {
  const pagos = [
    pago({
      id: 1, coberturaId: 21, mes: 10, estado: "pagado", monto: 10.5,
      fechaPago: "2026-10-20", updatedAt: "2026-10-21",
      snapshot: {
        compania_nombre: "OSCAR",
        plan: "Gold historico",
        pagador_nombre: "Pagador snapshot",
        codigo_poliza: "00123",
        fecha_activacion: "2026-01-15",
        tipo_pago: "MANUAL",
        dia_pago: 8,
      },
    }),
    pago({
      id: 2, coberturaId: 21, mes: 10, estado: "pendiente", monto: 20.25,
      fechaPago: "2026-10-22",
      snapshot: {
        compania_nombre: "AMBETTER",
        plan: "Silver",
        pagador_nombre: "Pagador externo",
        policy_number: "00999",
        fecha_activacion: "2026-02-01",
        tipo_pago: "AUTO",
        dia_pago: "08",
      },
    }),
    pago({
      id: 3, coberturaId: 21, mes: 11, estado: "pagado", monto: 15,
      fechaPago: "2026-11-02", updatedAt: "2026-11-03", snapshot: null,
    }),
    pago({
      id: 4, coberturaId: 22, mes: 3, estado: "pagado", monto: 10.1,
      snapshot: { compania_nombre: "OSCAR", codigo_poliza: "00010" },
    }),
    pago({
      id: 5, coberturaId: 22, mes: 3, estado: "pagado", monto: 10.2,
      snapshot: { compania_nombre: "OSCAR", codigo_poliza: "00010" },
    }),
    pago({ id: 6, coberturaId: 23, mes: 1, estado: "pendiente", monto: 1, snapshot: null }),
    pago({ id: 7, coberturaId: 23, mes: 2, estado: "pendiente", monto: 1, snapshot: null }),
    pago({ id: 8, coberturaId: 23, mes: 3, estado: "pendiente", monto: 1, snapshot: null }),
    pago({ id: 900, coberturaId: 99, anio: 2027, mes: 1, estado: "pagado", monto: 999, snapshot: null }),
    pago({ id: 901, coberturaId: 21, mes: 13, estado: "pagado", monto: 999, snapshot: null }),
  ];
  for (let coberturaId = 24; coberturaId <= 33; coberturaId += 1) {
    pagos.push(pago({
      id: 100 + coberturaId,
      coberturaId,
      mes: 1,
      estado: "pagado",
      monto: 5,
      cliente: coberturaId === 33 ? "=1+1" : "Ana López",
      grupo: coberturaId === 33 ? null : 500,
      snapshot: { compania_nombre: "Solo snapshot", codigo_poliza: "00077" },
    }));
  }
  return pagos;
}

test("el archivo usa todas las filas filtradas, conserva tipos y no inventa meses ni snapshots", () => {
  const filtros = { anio: 2026, cliente: "", compania: "", estado: "" };
  const { filas, libro } = libroDe(pagosInformeCompleto(), filtros);
  assert.equal(filas.length, 13);
  assert.equal(filas.some((fila) => fila.cobertura_id === 99), false);

  const leido = leerLibro(libro);
  assert.deepEqual(leido.SheetNames, [HOJA_RESUMEN, HOJA_DETALLE]);
  const resumen = leido.Sheets[HOJA_RESUMEN];
  const detalle = leido.Sheets[HOJA_DETALLE];
  assertSinFormulas(resumen);
  assertSinFormulas(detalle);

  assert.equal(valor(celda(resumen, 0, 1)), 2026);
  assert.equal(celda(resumen, 0, 1).t, "n");
  assertTexto(celda(resumen, 1, 1), "Todos");
  assertTexto(celda(resumen, 2, 1), "Todas");
  assertTexto(celda(resumen, 3, 1), "Todos los estados");
  assertTexto(celda(resumen, 4, 1), "2026-10-07");
  assert.equal(valor(celda(resumen, 5, 1)), 13);
  assert.equal(valor(celda(resumen, 6, 1)), 18);

  const filtroResumen = XLSX.utils.decode_range(resumen["!autofilter"].ref);
  assert.equal(filtroResumen.s.r, FILA_ENCABEZADO);
  assert.equal(filtroResumen.e.r, FILA_ENCABEZADO + 12);
  assert.ok(resumen["!cols"].length >= 8);

  const filasResumen = registros(resumen);
  assert.equal(filasResumen.length, 13);
  const cobertura21 = filasResumen.find((fila) => valor(fila["ID interno de cobertura"]) === 21);
  const cobertura22 = filasResumen.find((fila) => valor(fila["ID interno de cobertura"]) === 22);
  const cobertura23 = filasResumen.find((fila) => valor(fila["ID interno de cobertura"]) === 23);
  const cobertura33 = filasResumen.find((fila) => valor(fila["ID interno de cobertura"]) === 33);
  assert.equal(valor(cobertura21["ID de grupo familiar"]), 500);
  assertTexto(cobertura21["Identificador de póliza"], "00100");
  assertTexto(cobertura21.Compañía, "Actual");
  assertTexto(cobertura21.Plan, "Plan fiscal");
  assertTexto(cobertura21.Pagador, "Pagador externo");
  assertTexto(cobertura21.Situación, indicadorMorosidadPagosPorMes(filas.find((fila) => fila.cobertura_id === 21).pagos).etiqueta);
  assert.equal(valor(cobertura21.Situación), "Mora");
  assert.equal("Diciembre monto" in cobertura21, true);
  assertMoneda(cobertura21["Octubre monto"], 30.75);
  assertTexto(cobertura21["Octubre estado"], "Varios estados");
  assertMoneda(cobertura21["Noviembre monto"], 15);
  assertTexto(cobertura21["Noviembre estado"], "pagado");
  assert.equal(cobertura21["Diciembre monto"], undefined);
  assert.equal(cobertura21["Diciembre estado"], undefined);
  assert.equal(cobertura21["Enero monto"], undefined);

  assertMoneda(cobertura22["Marzo monto"], 20.3);
  assertTexto(cobertura22["Marzo estado"], "pagado");
  assert.equal(valor(cobertura22.Situación), "Al día");
  assert.equal(valor(cobertura23.Situación), "Riesgo");
  assertTexto(cobertura33.Cliente, "=1+1");
  assertTexto(cobertura33["ID de grupo familiar"], "—");
  assert.equal(filasResumen.some((fila) => valor(fila["ID interno de cobertura"]) === 99), false);

  const filasDetalle = registros(detalle);
  assert.equal(filasDetalle.length, 18);
  assert.equal(valor(celda(detalle, 6, 1)), 18);
  const octubre = filasDetalle.filter((fila) => (
    valor(fila["ID interno de cobertura"]) === 21 && valor(fila["Mes de generación"]) === 10
  ));
  assert.deepEqual(octubre.map((fila) => valor(fila["ID del cobro"])), [1, 2]);
  assertMoneda(octubre[0].Monto, 10.5);
  assertMoneda(octubre[1].Monto, 20.25);
  assert.equal(
    Math.round((octubre[0].Monto.v + octubre[1].Monto.v) * 100) / 100,
    cobertura21["Octubre monto"].v,
  );
  assertTexto(octubre[0]["Compañía del snapshot"], "OSCAR");
  assertTexto(octubre[0]["Plan del snapshot"], "Gold historico");
  assertTexto(octubre[0]["Pagador del snapshot"], "Pagador snapshot");
  assertTexto(octubre[0]["Identificador de póliza del snapshot"], "00123");
  assertTexto(octubre[0]["Fecha de activación"], "2026-01-15");
  assertTexto(octubre[0]["Tipo de pago"], "MANUAL");
  assertTexto(octubre[0]["Día de pago"], "8");
  assertTexto(octubre[0]["Fecha de pago"], "2026-10-20");
  assertTexto(octubre[0]["Fecha de actualización"], "10-21-2026");
  assert.equal(octubre[0].Snapshot, undefined);
  assertTexto(octubre[1]["Compañía del snapshot"], "AMBETTER");
  assertTexto(octubre[1]["Identificador de póliza del snapshot"], "00999");
  assertTexto(octubre[1]["Día de pago"], "08");
  assertTexto(octubre[1]["Pagador del snapshot"], "Pagador externo");
  assert.equal(octubre[1]["Fecha de actualización"], undefined);

  const noviembre = filasDetalle.find((fila) => valor(fila["ID del cobro"]) === 3);
  assertTexto(noviembre.Snapshot, "Snapshot no disponible");
  assert.equal(noviembre["Compañía del snapshot"], undefined);
  assert.equal(noviembre["Plan del snapshot"], undefined);
  assert.equal(noviembre["Pagador del snapshot"], undefined);
  assert.equal(noviembre["Identificador de póliza del snapshot"], undefined);
  assert.equal(noviembre["Fecha de activación"], undefined);
  assert.notEqual(valor(noviembre["Compañía del snapshot"]), "Actual");
  assertTexto(noviembre["Fecha de actualización"], "11-03-2026");

  const marzo = filasDetalle.filter((fila) => (
    valor(fila["ID interno de cobertura"]) === 22 && valor(fila["Mes de generación"]) === 3
  ));
  assert.equal(marzo.length, 2);
  assert.equal(
    Math.round((marzo[0].Monto.v + marzo[1].Monto.v) * 100) / 100,
    cobertura22["Marzo monto"].v,
  );
  assert.equal(filasDetalle.some((fila) => valor(fila["ID del cobro"]) === 900), false);
  assert.equal(filasDetalle.some((fila) => valor(fila["ID del cobro"]) === 901), false);
  assert.equal(nombreArchivoInformePagos(2026, "2026-10-07"), "informe-pagos-2026-2026-10-07.xlsx");
});

test("la exportación respeta año, cliente, compañía o plan y estado ya filtrados", () => {
  const filtros = { anio: "2026", cliente: "Ana", compania: "Actual", estado: "pagado" };
  const pagos = [
    pago({
      id: 1, coberturaId: 21, mes: 10, estado: "pagado", monto: 10.5,
      snapshot: { compania_nombre: "OSCAR", codigo_poliza: "00123" },
    }),
    pago({
      id: 2, coberturaId: 21, mes: 10, estado: "pendiente", monto: 20.25,
      snapshot: { compania_nombre: "AMBETTER", codigo_poliza: "00999" },
    }),
    pago({ id: 3, coberturaId: 21, mes: 11, estado: "pagado", monto: 15, snapshot: null }),
    pago({ id: 4, coberturaId: 22, mes: 3, estado: "pagado", monto: 7, snapshot: null }),
    pago({ id: 5, coberturaId: 50, mes: 1, estado: "cancelado", monto: 4, snapshot: null }),
    pago({
      id: 6, coberturaId: 51, mes: 1, estado: "pagado", monto: 4,
      cliente: "Pedro Excluido", snapshot: null,
    }),
    pago({
      id: 7, coberturaId: 52, mes: 1, estado: "pagado", monto: 4,
      fiscal: { compania_nombre: "Otra", plan: "Ajeno", codigo_poliza: "00900" },
      snapshot: { compania_nombre: "Actual", plan: "Actual" },
    }),
    pago({ id: 8, coberturaId: 53, anio: 2025, mes: 1, estado: "pagado", monto: 4, snapshot: null }),
    pago({
      id: 9, coberturaId: 60, mes: 4, estado: "pagado", monto: 8,
      fiscal: { compania_nombre: "Vieja", plan: "Otro", codigo_poliza: "00111" },
      snapshot: { compania_nombre: "Actual", plan: "Actual", codigo_poliza: "00001" },
    }),
    pago({
      id: 10, coberturaId: 61, mes: 5, estado: "pagado", monto: 6,
      fiscal: { compania_nombre: "X", plan: "Actual Gold", codigo_poliza: "00150", pagador_nombre: "Pagador externo" },
      snapshot: { compania_nombre: "Historica" },
    }),
  ];
  const { filas, libro } = libroDe(pagos, filtros);
  assert.deepEqual(filas.map((fila) => fila.cobertura_id), [21, 22, 61]);
  const leido = leerLibro(libro);
  const resumen = registros(leido.Sheets[HOJA_RESUMEN]);
  const detalle = registros(leido.Sheets[HOJA_DETALLE]);
  assert.deepEqual(resumen.map((fila) => valor(fila["ID interno de cobertura"])), [21, 22, 61]);
  assert.equal(detalle.length, 4);
  assert.deepEqual(detalle.map((fila) => valor(fila["ID del cobro"])), [1, 3, 4, 10]);
  const cobertura21 = resumen[0];
  assertMoneda(cobertura21["Octubre monto"], 10.5);
  assertTexto(cobertura21["Octubre estado"], "pagado");
  assertTexto(cobertura21.Compañía, "Actual");
  assertTexto(cobertura21["Identificador de póliza"], "00100");
  const porPlan = resumen.find((fila) => valor(fila["ID interno de cobertura"]) === 61);
  assertTexto(porPlan.Compañía, "X");
  assertTexto(porPlan.Plan, "Actual Gold");
  assertTexto(porPlan.Pagador, "Pagador externo");
  const cobroPlan = detalle.find((fila) => valor(fila["ID del cobro"]) === 10);
  assertTexto(cobroPlan["Compañía del snapshot"], "Historica");
  assert.equal(cobroPlan["Plan del snapshot"], undefined);
  assertTexto(celda(leido.Sheets[HOJA_RESUMEN], 1, 1), "Ana");
  assertTexto(celda(leido.Sheets[HOJA_RESUMEN], 2, 1), "Actual");
  assertTexto(celda(leido.Sheets[HOJA_RESUMEN], 3, 1), "Pagado");
  assert.equal(valor(celda(leido.Sheets[HOJA_RESUMEN], 0, 1)), 2026);
});

test("el botón exporta las filas del informe y no consulta ni escribe cobros", () => {
  const fuente = fs.readFileSync(new URL("../pages/PagosInforme.jsx", import.meta.url), "utf8");
  const funcion = fuente.slice(fuente.indexOf("const descargarExcel"), fuente.indexOf("const totalPages"));
  assert.match(funcion, /filas:\s*rows/);
  assert.doesNotMatch(funcion, /currentRows/);
  assert.doesNotMatch(funcion, /apiRequest/);
  assert.match(fuente, /disabled=\{loading \|\| exportando \|\| rows\.length === 0\}/);
  assert.match(fuente, /Descargar Excel/);
});
