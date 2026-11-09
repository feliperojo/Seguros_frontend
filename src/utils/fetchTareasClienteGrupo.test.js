import assert from "node:assert/strict";
import test from "node:test";
import {
  ESTADOS_TAREA_PENDIENTES,
  ESTADOS_TAREA_TERMINADAS,
  ORDEN_TAREA_CIERRE,
  ORDEN_TAREA_CREACION,
  armarConsultaTareasClienteGrupo,
  cargarListadoTareasClienteGrupo,
  crearGuardiaDeConsulta,
  fetchTareasOperativasClienteGrupo,
  interpretarRespuestaTareasClienteGrupo,
  paginaTrasConsulta,
  tareasUnicasEnOrden,
} from "./fetchTareasClienteGrupo.js";

const metaVacia = {
  total: 0,
  per_page: 20,
  current_page: 1,
  last_page: 1,
};

test("la consulta queda acotada al cliente, al grupo, al estado y a la página", () => {
  const url = armarConsultaTareasClienteGrupo({
    clienteId: 15,
    grupoId: 8,
    perPage: 20,
    page: 2,
    statuses: ESTADOS_TAREA_PENDIENTES,
  });
  const parsed = new URL(url, "http://vantun.local");

  assert.equal(parsed.pathname, "/tareas_operativas/cliente/15/grupo/8");
  assert.equal(parsed.searchParams.get("per_page"), "20");
  assert.equal(parsed.searchParams.get("page"), "2");
  assert.deepEqual(parsed.searchParams.getAll("statuses[]"), ["pending", "in_progress"]);
  assert.equal(parsed.searchParams.has("cliente_id"), false);
  assert.equal(parsed.searchParams.has("assigned_user_id"), false);
  assert.equal(url.startsWith("tareas_operativas?"), false);
});

test("terminadas consulta solo el estado de cierre que guarda el sistema", () => {
  const url = armarConsultaTareasClienteGrupo({
    clienteId: 4,
    grupoId: 9,
    page: 1,
    statuses: ESTADOS_TAREA_TERMINADAS,
  });
  const parsed = new URL(url, "http://vantun.local");

  assert.deepEqual(parsed.searchParams.getAll("statuses[]"), ["completed"]);
});

test("sin estados conserva el listado del mismo cliente y grupo", async () => {
  const calls = [];
  const list = await fetchTareasOperativasClienteGrupo(4, 9, 20, {
    request: async (url, method) => {
      calls.push({ url, method });
      return {
        data: [{ id: 3, estado: "pending" }],
        meta: { total: 1, per_page: 20, current_page: 1, last_page: 1 },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url.startsWith("tareas_operativas/cliente/4/grupo/9?"), true);
  assert.equal(new URL(calls[0].url, "http://vantun.local").searchParams.has("statuses[]"), false);
  assert.equal(Array.isArray(list), true);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 3);
  assert.equal(list.meta.total, 1);
});

test("una lista vacía con metadatos es un resultado vacío, no un error", () => {
  const parsed = interpretarRespuestaTareasClienteGrupo({
    data: [],
    meta: metaVacia,
    success: true,
  });

  assert.deepEqual(parsed.data, []);
  assert.equal(parsed.meta.total, 0);
});

test("una respuesta sin listado o sin paginación no se convierte en lista vacía", () => {
  assert.throws(() => interpretarRespuestaTareasClienteGrupo(null));
  assert.throws(() => interpretarRespuestaTareasClienteGrupo([]));
  assert.throws(() => interpretarRespuestaTareasClienteGrupo({ success: false, message: "falló" }));
  assert.throws(() => interpretarRespuestaTareasClienteGrupo({ data: [] }));
  assert.throws(() => interpretarRespuestaTareasClienteGrupo({ data: [], meta: { total: [1, 1] } }));
});

test("un 403 no dispara otra consulta", async () => {
  let calls = 0;
  const error = new Error("No tienes permisos para realizar esta acción");
  error.response = { status: 403 };

  await assert.rejects(
    () => fetchTareasOperativasClienteGrupo(1, 2, 20, {
      page: 1,
      statuses: ESTADOS_TAREA_PENDIENTES,
      request: async () => {
        calls += 1;
        throw error;
      },
    }),
    (err) => err?.response?.status === 403
  );

  assert.equal(calls, 1);
});

test("al cambiar de alcance solo la última consulta sigue vigente", () => {
  const guardia = crearGuardiaDeConsulta();
  const primera = guardia.iniciar();
  const segunda = guardia.iniciar();

  assert.equal(guardia.sigueVigente(primera), false);
  assert.equal(guardia.sigueVigente(segunda), true);
});

function metaDe({ total, page, last }) {
  return {
    total,
    per_page: 20,
    current_page: page,
    last_page: last,
  };
}

test("la página que quedó fuera de rango se recupera una sola vez con el mismo filtro", async () => {
  const calls = [];
  const resultado = await cargarListadoTareasClienteGrupo({
    clienteId: 15,
    grupoId: 8,
    perPage: 20,
    page: 2,
    statuses: ESTADOS_TAREA_PENDIENTES,
    orden: ORDEN_TAREA_CREACION,
    request: async (url) => {
      calls.push(url);
      const pagina = Number(new URL(url, "http://vantun.local").searchParams.get("page"));
      if (pagina === 2) {
        return { data: [], meta: metaDe({ total: 20, page: 2, last: 1 }) };
      }
      return {
        data: Array.from({ length: 20 }, (_, indice) => ({ id: indice + 1, estado: "pending" })),
        meta: metaDe({ total: 20, page: 1, last: 1 }),
      };
    },
  });

  assert.equal(resultado.descartada, false);
  assert.equal(resultado.pagina, 1);
  assert.equal(resultado.list.length, 20);
  assert.equal(calls.length, 2);
  for (const url of calls) {
    const parsed = new URL(url, "http://vantun.local");
    assert.equal(parsed.pathname, "/tareas_operativas/cliente/15/grupo/8");
    assert.deepEqual(parsed.searchParams.getAll("statuses[]"), ["pending", "in_progress"]);
    assert.equal(parsed.searchParams.get("orden"), "creacion");
  }
  assert.equal(new URL(calls[0], "http://vantun.local").searchParams.get("page"), "2");
  assert.equal(new URL(calls[1], "http://vantun.local").searchParams.get("page"), "1");
});

test("un total cero termina en la página 1 sin otra consulta si ya estaba ahí", async () => {
  let calls = 0;
  const enPrimera = await cargarListadoTareasClienteGrupo({
    clienteId: 4,
    grupoId: 9,
    page: 1,
    statuses: ESTADOS_TAREA_TERMINADAS,
    orden: ORDEN_TAREA_CIERRE,
    request: async () => {
      calls += 1;
      return { data: [], meta: metaDe({ total: 0, page: 1, last: 1 }) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(enPrimera.pagina, 1);
  assert.equal(enPrimera.list.length, 0);
  assert.equal(paginaTrasConsulta(1, enPrimera.list.meta), 1);
});

test("un total cero en una página alta consulta la página 1 una sola vez", async () => {
  const calls = [];
  const resultado = await cargarListadoTareasClienteGrupo({
    clienteId: 4,
    grupoId: 9,
    page: 3,
    statuses: ESTADOS_TAREA_TERMINADAS,
    orden: ORDEN_TAREA_CIERRE,
    request: async (url) => {
      calls.push(url);
      const pagina = Number(new URL(url, "http://vantun.local").searchParams.get("page"));
      return { data: [], meta: metaDe({ total: 0, page: pagina, last: 1 }) };
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(resultado.pagina, 1);
  assert.equal(resultado.list.meta.total, 0);
  assert.equal(new URL(calls[1], "http://vantun.local").searchParams.get("orden"), "cierre");
});

test("una respuesta anterior no lanza la recuperación ni cambia la página", async () => {
  let vigente = true;
  const calls = [];
  let continuar;
  const espera = new Promise((resolver) => {
    continuar = resolver;
  });
  const carga = cargarListadoTareasClienteGrupo({
    clienteId: 1,
    grupoId: 2,
    page: 2,
    statuses: ESTADOS_TAREA_PENDIENTES,
    orden: ORDEN_TAREA_CREACION,
    sigueVigente: () => vigente,
    request: async (url) => {
      calls.push(url);
      await espera;
      return { data: [], meta: metaDe({ total: 20, page: 2, last: 1 }) };
    },
  });

  vigente = false;
  continuar();
  const resultado = await carga;

  assert.equal(resultado.descartada, true);
  assert.equal(calls.length, 1);
  assert.equal(Object.hasOwn(resultado, "pagina"), false);
});

test("el listado conserva el orden recibido y no reordena los id", () => {
  const unicas = tareasUnicasEnOrden([
    { id: 30, estado: "pending" },
    { id: 10, estado: "pending" },
    { id: 30, estado: "pending" },
    { id: 20, estado: "pending" },
  ]);
  assert.deepEqual(unicas.map((tarea) => tarea.id), [30, 10, 20]);
});
