import assert from "node:assert/strict";
import test from "node:test";
import {
  construirDetalleHistorialCobertura,
  combinarFilasHistorialCobertura,
  esCampoDeCoberturaExacta,
  extraerCambiosCoberturaDesdeEventoGrupo,
  filasDesdeEventosCobertura,
  filasDesdeEventosGrupoParaCobertura,
} from "./historialCoberturaDetalle.js";

/** Fixture inspirado en el evento GF #16758 / cobertura #1241 (sandbox QA). */
const eventoGrupo16758 = {
  id: 16758,
  modelo_afectado: "GrupoFamiliar",
  modelo_id: 604,
  accion: "update",
  usuario: "qa.user",
  created_at: "2026-10-06T15:20:00.000000Z",
  operacion_id: null,
  cambios: {
    "cobertura_1241.codigo_poliza": {
      anterior: "OSC74723021-01",
      nuevo: "UZ0164579-01",
    },
    "cobertura_1241.precio": {
      anterior: 53.78,
      nuevo: 60.78,
    },
    "cobertura_1241.compania": {
      anterior: "OSCAR",
      nuevo: "AMBETTER",
    },
    "cobertura_1240.precio": {
      anterior: 10,
      nuevo: 20,
    },
    "cobertura_1241.cliente.nombre_completo": {
      anterior: "A",
      nuevo: "B",
    },
    ingreso_familiar_anual: {
      anterior: 1000,
      nuevo: 2000,
    },
  },
};

test("solo extrae campos de la cobertura exacta (no otras coberturas, cliente ni grupo)", () => {
  assert.equal(esCampoDeCoberturaExacta("cobertura_1241.precio", 1241), true);
  assert.equal(esCampoDeCoberturaExacta("cobertura_12410.precio", 1241), false);
  assert.equal(esCampoDeCoberturaExacta("cobertura_1241", 1241), false);
  assert.equal(esCampoDeCoberturaExacta("cobertura_1241.cliente.nombre_completo", 1241), false);

  const extraidos = extraerCambiosCoberturaDesdeEventoGrupo(eventoGrupo16758, 1241);
  assert.deepEqual(Object.keys(extraidos).sort(), [
    "codigo_poliza",
    "compania",
    "precio",
  ]);
  assert.equal(extraidos.codigo_poliza.nuevo, "UZ0164579-01");
  assert.equal(extraidos.compania.anterior, "OSCAR");
});

test("caso QA #16758: el detalle de cobertura #1241 incluye las tres modificaciones del grupo", () => {
  const detalle = construirDetalleHistorialCobertura({
    coberturaId: 1241,
    eventosCobertura: [],
    eventosGrupo: [eventoGrupo16758],
  });

  assert.equal(detalle.vacio, false);
  assert.equal(detalle.filas.length, 3);
  const campos = detalle.filas.map((f) => f.campo).sort();
  assert.deepEqual(campos, ["codigo_poliza", "compania", "precio"]);
  assert.ok(detalle.filas.every((f) => f.fuente === "grupo"));
  assert.ok(detalle.filas.every((f) => f.eventoId === 16758));
});

test("otra cobertura del mismo grupo no recibe esos cambios", () => {
  const detalle = construirDetalleHistorialCobertura({
    coberturaId: 1240,
    eventosCobertura: [],
    eventosGrupo: [eventoGrupo16758],
  });
  assert.equal(detalle.filas.length, 1);
  assert.equal(detalle.filas[0].campo, "precio");
  assert.equal(detalle.filas[0].nuevo, 20);
});

test("deduplica solo con operacion_id + campo; conserva campos distintos de la misma operación", () => {
  const op = "op-shared-1";
  const eventoCob = {
    id: 9001,
    modelo_afectado: "Cobertura",
    modelo_id: 1241,
    created_at: "2026-10-06T16:00:00.000000Z",
    usuario: "qa.user",
    operacion_id: op,
    cambios: {
      codigo_poliza: { anterior: "OSC74723021-01", nuevo: "UZ0164579-01" },
    },
  };
  const eventoGf = {
    id: 16758,
    modelo_afectado: "GrupoFamiliar",
    modelo_id: 604,
    created_at: "2026-10-06T16:00:01.000000Z",
    usuario: "qa.user",
    operacion_id: op,
    cambios: {
      "cobertura_1241.codigo_poliza": {
        anterior: "OSC74723021-01",
        nuevo: "UZ0164579-01",
      },
      "cobertura_1241.precio": { anterior: 53.78, nuevo: 60.78 },
    },
  };

  const filasCob = filasDesdeEventosCobertura([eventoCob]);
  const filasGf = filasDesdeEventosGrupoParaCobertura([eventoGf], 1241);
  const combinado = combinarFilasHistorialCobertura(filasCob, filasGf);

  assert.equal(combinado.deduplicadas, 1);
  const campos = combinado.filas.map((f) => f.campo).sort();
  assert.deepEqual(campos, ["codigo_poliza", "precio"]);
  const poliza = combinado.filas.find((f) => f.campo === "codigo_poliza");
  assert.equal(poliza.fuente, "cobertura");
  assert.equal(poliza.eventoId, 9001);
});

test("sin operacion_id no deduplica por fecha/usuario/valores; marca fuentes mixtas", () => {
  const eventoCob = {
    id: 1,
    modelo_afectado: "Cobertura",
    modelo_id: 1241,
    created_at: "2026-10-06T15:20:00.000000Z",
    usuario: "qa.user",
    operacion_id: null,
    cambios: {
      precio: { anterior: 53.78, nuevo: 60.78 },
    },
  };

  const detalle = construirDetalleHistorialCobertura({
    coberturaId: 1241,
    eventosCobertura: [eventoCob],
    eventosGrupo: [eventoGrupo16758],
  });

  const precios = detalle.filas.filter((f) => f.campo === "precio");
  assert.equal(precios.length, 2);
  assert.equal(detalle.distinguirFuentes, true);
});

test("error parcial de una fuente no se presenta como vacío ni como completo", () => {
  const conErrorCob = construirDetalleHistorialCobertura({
    coberturaId: 1241,
    eventosCobertura: [],
    eventosGrupo: [eventoGrupo16758],
    errorCobertura: new Error("fail"),
  });
  assert.equal(conErrorCob.filas.length, 3);
  assert.match(conErrorCob.warning || "", /historial individual/i);
  assert.equal(conErrorCob.error, null);

  const conErrorGrupo = construirDetalleHistorialCobertura({
    coberturaId: 1241,
    eventosCobertura: [
      {
        id: 2,
        modelo_afectado: "Cobertura",
        modelo_id: 1241,
        created_at: "2026-01-01T00:00:00Z",
        cambios: { plan: { anterior: "A", nuevo: "B" } },
      },
    ],
    eventosGrupo: [],
    errorGrupo: new Error("fail"),
  });
  assert.equal(conErrorGrupo.filas.length, 1);
  assert.match(conErrorGrupo.warning || "", /historial del grupo/i);

  const ambos = construirDetalleHistorialCobertura({
    coberturaId: 1241,
    errorCobertura: new Error("a"),
    errorGrupo: new Error("b"),
  });
  assert.equal(ambos.vacio, true);
  assert.ok(ambos.error);
});

test("sin grupo id advierte y no inventa asociaciones", () => {
  const detalle = construirDetalleHistorialCobertura({
    coberturaId: 1241,
    eventosCobertura: [],
    sinGrupoId: true,
  });
  assert.equal(detalle.vacio, true);
  assert.match(detalle.warning || "", /grupo familiar/i);
});
