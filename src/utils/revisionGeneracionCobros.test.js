import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coberturaEnAlcance,
  coberturasPorCorregir,
  describirRevisionProductos,
  prepararGeneracionCobros,
  productosDelAlcance,
  resumenConfirmacionCobros,
} from "./revisionGeneracionCobros.js";

const vistaMixta = {
  periodo: "marzo 2026",
  huella: "abc",
  requiere_confirmacion_periodo: true,
  items: [
    { cobertura_id: 1, elegible: true, ya_existe: false, motivos: [] },
    { cobertura_id: 2, elegible: true, ya_existe: true, motivos: [] },
    {
      cobertura_id: 3,
      elegible: false,
      ya_existe: false,
      motivos: ["No tiene cliente asociado.", "No tiene grupo familiar asociado."],
    },
  ],
};

test("un lote mixto deja solo las coberturas no elegibles y todos sus motivos", () => {
  const problemas = coberturasPorCorregir(vistaMixta);
  assert.deepEqual(
    problemas.map((item) => item.cobertura_id),
    [3]
  );
  assert.deepEqual(problemas[0].motivos, [
    "No tiene cliente asociado.",
    "No tiene grupo familiar asociado.",
  ]);
});

test("un cobro existente no se clasifica como problema", () => {
  const problemas = coberturasPorCorregir({
    items: [{ cobertura_id: 2, elegible: true, ya_existe: true, motivos: [] }],
  });
  assert.equal(problemas.length, 0);
  const resumen = resumenConfirmacionCobros({
    periodo: "octubre 2026",
    items: [{ cobertura_id: 2, elegible: true, ya_existe: true }],
  });
  assert.equal(resumen.nuevos, 0);
  assert.equal(resumen.existentes, 1);
});

test("un lote válido resume nuevos y existentes sin abrir problemas", () => {
  const problemas = coberturasPorCorregir({
    items: [
      { cobertura_id: 1, elegible: true, ya_existe: false },
      { cobertura_id: 2, elegible: true, ya_existe: true },
    ],
  });
  assert.equal(problemas.length, 0);
  const resumen = resumenConfirmacionCobros({
    periodo: "octubre 2026",
    requiere_confirmacion_periodo: false,
    items: [
      { cobertura_id: 1, elegible: true, ya_existe: false },
      { cobertura_id: 2, elegible: true, ya_existe: true },
    ],
  });
  assert.equal(resumen.periodo, "octubre 2026");
  assert.equal(resumen.nuevos, 1);
  assert.equal(resumen.existentes, 1);
  assert.equal(resumen.requiereConfirmacion, false);
});

test("filtrar las filas visibles no cambia los ids enviados", () => {
  const problemas = coberturasPorCorregir(vistaMixta);
  const payload = prepararGeneracionCobros({
    idsLote: [1, 2, 3],
    huella: vistaMixta.huella,
    confirmarDatosPeriodo: true,
    productos: ["dental_ms", "salud"],
  });
  assert.deepEqual(
    payload.cobertura_ids,
    [1, 2, 3]
  );
  assert.notDeepEqual(
    payload.cobertura_ids,
    problemas.map((item) => item.cobertura_id)
  );
  assert.deepEqual(payload.productos, ["dental_ms", "salud"]);
  assert.equal(payload.huella, "abc");
  assert.equal(
    prepararGeneracionCobros({ idsLote: [1], huella: "abc", productos: [] }),
    null
  );
  assert.equal(payload.confirmar_datos_periodo, true);
  assert.deepEqual(payload.ajustes, []);
});

test("el modal no genera al validar y no lista coberturas válidas ni formularios", () => {
  const modal = readFileSync(
    new URL("../components/VistaPreviaCobrosModal.jsx", import.meta.url),
    "utf8"
  );
  const pantalla = readFileSync(
    new URL("../components/TablaConfiguracionPagos.jsx", import.meta.url),
    "utf8"
  );
  assert.match(modal, /Coberturas por corregir/);
  assert.match(modal, /Volver a validar/);
  assert.match(modal, /Ir a corregir/);
  assert.match(modal, /Generar cobros/);
  assert.doesNotMatch(modal, /Form\.Select|compania_id|pagador_modo/);
  const efecto = modal.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[vista\?\.huella\]\);/);
  assert.ok(efecto);
  assert.doesNotMatch(efecto[1], /onConfirmar/);
  assert.match(pantalla, /prepararGeneracionCobros/);
  assert.match(pantalla, /idsLoteRef\.current/);
  assert.doesNotMatch(pantalla, /cobertura_ids: polizasFiltradas\.map/);
});

test("el filtro de producto usa los ids habilitados y una selección vacía no entra al lote", () => {
  const habilitados = ["salud", "dental_ms"];
  assert.deepEqual(productosDelAlcance({ modo: "todos", elegidos: [], habilitados }), habilitados);
  assert.deepEqual(
    productosDelAlcance({ modo: "elegidos", elegidos: ["dental_ms", "vision"], habilitados }),
    ["dental_ms"]
  );
  assert.deepEqual(productosDelAlcance({ modo: "elegidos", elegidos: [], habilitados }), []);
  assert.equal(coberturaEnAlcance({ producto_id: "dental_ms" }, ["dental_ms"]), true);
  assert.equal(coberturaEnAlcance({ producto_id: null }, habilitados), false);
  assert.equal(coberturaEnAlcance({ producto_id: "salud" }, []), false);
  assert.equal(
    describirRevisionProductos({
      cantidad: 120,
      etiquetas: ["Dental MS"],
      periodo: "octubre de 2026",
      todos: false,
    }),
    "Se revisarán 120 coberturas de Dental MS para octubre de 2026."
  );
});

test("la confirmación de un período anterior se conserva como aviso", () => {
  const resumen = resumenConfirmacionCobros(vistaMixta);
  assert.equal(resumen.requiereConfirmacion, true);
  assert.equal(coberturasPorCorregir(vistaMixta).some((item) => item.cobertura_id === 1), false);
});
