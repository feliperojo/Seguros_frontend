/**
 * Consulta de tareas operativas de un cliente dentro de un grupo familiar.
 * Una sola ruta: tareas_operativas/cliente/{id}/grupo/{id}.
 * No reintenta otros listados si la respuesta falla.
 */

export const ESTADOS_TAREA_PENDIENTES = ["pending", "in_progress"];
export const ESTADOS_TAREA_TERMINADAS = ["completed"];
export const ORDEN_TAREA_CREACION = "creacion";
export const ORDEN_TAREA_CIERRE = "cierre";

export function armarConsultaTareasClienteGrupo({
  clienteId,
  grupoId,
  perPage = 20,
  page = 1,
  statuses,
  orden,
} = {}) {
  if (clienteId == null || clienteId === "" || grupoId == null || grupoId === "") {
    throw new Error("Cliente y grupo familiar son obligatorios");
  }

  const params = new URLSearchParams();
  params.set("include", "log,log.cliente,concept,comments,assignedUser");
  params.set("per_page", String(perPage));
  params.set("page", String(page));
  if (Array.isArray(statuses)) {
    for (const status of statuses) {
      if (status) params.append("statuses[]", String(status));
    }
  }
  if (orden === ORDEN_TAREA_CREACION || orden === ORDEN_TAREA_CIERRE) {
    params.set("orden", orden);
  }

  return `tareas_operativas/cliente/${encodeURIComponent(clienteId)}/grupo/${encodeURIComponent(grupoId)}?${params.toString()}`;
}

export function interpretarRespuestaTareasClienteGrupo(res) {
  if (!res || typeof res !== "object" || Array.isArray(res) || !Array.isArray(res.data)) {
    throw new Error("Respuesta de tareas inválida");
  }

  const meta = res.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw new Error("Respuesta de tareas inválida");
  }

  const total = Number(meta.total);
  const perPage = Number(meta.per_page);
  const currentPage = Number(meta.current_page);
  const lastPage = Number(meta.last_page);
  if (![total, perPage, currentPage, lastPage].every((value) => Number.isFinite(value))) {
    throw new Error("Respuesta de tareas inválida");
  }

  return {
    data: res.data,
    meta: {
      total,
      per_page: perPage,
      current_page: currentPage,
      last_page: lastPage,
    },
  };
}

export function paginaTrasConsulta(paginaSolicitada, meta) {
  const solicitada = Number(paginaSolicitada);
  if (!Number.isFinite(solicitada) || solicitada < 1) return 1;
  if (!meta || Number(meta.total) <= 0) return 1;
  const ultima = Number(meta.last_page);
  if (!Number.isFinite(ultima) || ultima < 1) return 1;
  if (solicitada > ultima) return ultima;
  return solicitada;
}

export function tareasUnicasEnOrden(list) {
  const vistas = new Set();
  const unicas = [];
  for (const tarea of Array.isArray(list) ? list : []) {
    if (!tarea || tarea.id == null || vistas.has(tarea.id)) continue;
    vistas.add(tarea.id);
    unicas.push(tarea);
  }
  return unicas;
}

/**
 * Pide la página y, si ya no existe, consulta una sola vez el límite válido.
 * Una respuesta que dejó de ser vigente no dispara la segunda consulta.
 */
export async function cargarListadoTareasClienteGrupo({
  clienteId,
  grupoId,
  perPage = 20,
  page = 1,
  statuses,
  orden,
  request,
  sigueVigente = () => true,
} = {}) {
  const pedir = (pagina) => fetchTareasOperativasClienteGrupo(clienteId, grupoId, perPage, {
    page: pagina,
    statuses,
    orden,
    request,
  });

  let list = await pedir(page);
  if (!sigueVigente()) return { descartada: true };

  const destino = paginaTrasConsulta(page, list.meta);
  if (destino !== page) {
    list = await pedir(destino);
    if (!sigueVigente()) return { descartada: true };
    return { descartada: false, pagina: destino, list };
  }

  return { descartada: false, pagina: page, list };
}

export function crearGuardiaDeConsulta() {
  let vigente = 0;
  return {
    iniciar() {
      vigente += 1;
      return vigente;
    },
    sigueVigente(token) {
      return token === vigente;
    },
  };
}

/**
 * Lista paginada del cliente y grupo.
 * Sin options.statuses conserva el listado completo de ese alcance.
 * Devuelve el arreglo de tareas con meta de paginación, para que un
 * consumidor que solo recorra la lista siga funcionando.
 */
export async function fetchTareasOperativasClienteGrupo(clienteId, grupoId, perPage = 20, options = {}) {
  const request = options.request ?? (await import("../services/api")).default;
  const url = armarConsultaTareasClienteGrupo({
    clienteId,
    grupoId,
    perPage,
    page: options.page ?? 1,
    statuses: options.statuses,
    orden: options.orden,
  });

  const res = await request(url, "GET");
  const parsed = interpretarRespuestaTareasClienteGrupo(res);
  const list = parsed.data;
  list.meta = parsed.meta;
  return list;
}
