import assert from "node:assert/strict";
import test from "node:test";
import {
  eventoCorrespondeAlGrupo,
  indicadoresDesdeRespuesta,
  nivelIndicador,
  textoDetalleIndicador,
} from "./indicadorPagoCobertura.js";

test("un fallo o una consulta que no es la vigente no deja indicadores", () => {
  const previo = {
    4: { cobertura_id: 4, etiqueta: "Octubre pagado", nivel: "pagado" },
  };
  const fallo = indicadoresDesdeRespuesta(
    { mostrar: true, coberturas: [previo[4]] },
    new Error("no disponible")
  );
  const historica = indicadoresDesdeRespuesta({
    mostrar: false,
    motivo_oculto: "consulta_historica_sin_corte",
    coberturas: [previo[4]],
  });

  assert.deepEqual(fallo, {});
  assert.deepEqual(historica, {});
  assert.deepEqual(previo[4].etiqueta, "Octubre pagado");
});

test("indexa por cobertura y descarta un resumen sin etiqueta", () => {
  const map = indicadoresDesdeRespuesta({
    mostrar: true,
    coberturas: [
      { cobertura_id: 7, etiqueta: "Octubre pagado", nivel: "pagado" },
      { cobertura_id: 8, etiqueta: "Octubre pago pendiente", nivel: "pendiente" },
      { cobertura_id: 9, nivel: "pagado" },
    ],
  });

  assert.equal(map[7].etiqueta, "Octubre pagado");
  assert.equal(map[8].etiqueta, "Octubre pago pendiente");
  assert.equal(map[9], undefined);
});

test("el detalle nombra período, importe y estado sin llamarlo vencimiento", () => {
  const texto = textoDetalleIndicador({
    etiqueta: "Agosto pago pendiente",
    detalle: [
      {
        periodo: "Agosto 2026",
        estado: "pendiente",
        monto: 80,
        fecha_cobro_programada: "2026-08-10",
      },
      {
        periodo: "Septiembre 2026",
        estado: "procesando",
        monto: "30.50",
        fecha_cobro_programada: "2026-09-10",
      },
    ],
  });

  assert.match(texto, /Agosto 2026: pendiente, 80\.00, cobro programado 2026-08-10/);
  assert.match(texto, /Septiembre 2026: procesando, 30\.50/);
  assert.equal(texto.includes("venc"), false);
  assert.equal(nivelIndicador({ nivel: "procesando" }), "procesando");
  assert.equal(nivelIndicador({ nivel: "vencido" }), "otro");
});

test("solo un aviso del mismo grupo pide actualizar el indicador", () => {
  assert.equal(eventoCorrespondeAlGrupo({ detail: { grupoFamiliarId: 15 } }, 15), true);
  assert.equal(eventoCorrespondeAlGrupo({ detail: { grupoFamiliarId: 16 } }, 15), false);
  assert.equal(eventoCorrespondeAlGrupo({}, 15), false);
});
