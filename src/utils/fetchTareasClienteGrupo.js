import apiRequest from "../services/api";

function getListFromResponse(res) {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.tasks)) return res.data.tasks;
  if (Array.isArray(res?.tasks)) return res.tasks;
  return [];
}

/**
 * Lista tareas operativas filtradas por cliente y grupo familiar.
 * Prueba varias rutas/params por compatibilidad con distintas versiones del API.
 */
export async function fetchTareasOperativasClienteGrupo(clienteId, grupoId, perPage = 20) {
  const qsFull = new URLSearchParams({
    include: "log,log.cliente,concept,comments,assignedUser",
    per_page: String(perPage),
  });
  const qsLite = new URLSearchParams({ per_page: String(perPage) });

  const urls = [
    `tareas_operativas/cliente/${clienteId}/grupo/${grupoId}?${qsFull}`,
    `tareas_operativas?${qsFull}&cliente_id=${clienteId}&grupo_familiar_id=${grupoId}`,
    `tareas_operativas?${qsFull}&cliente=${clienteId}&grupo_familiar_id=${grupoId}`,
    `tareas_operativas?${qsLite}&cliente_id=${clienteId}&grupo_familiar_id=${grupoId}`,
    `tareas_operativas?${qsLite}&cliente=${clienteId}&grupo_familiar_id=${grupoId}`,
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const res = await apiRequest(url, "GET");
      return getListFromResponse(res);
    } catch (err) {
      lastError = err;
      if (import.meta.env.DEV) {
        console.warn("[tareas cliente/grupo] intento fallido:", url, err?.response?.status ?? "", err?.message);
      }
    }
  }
  throw lastError ?? new Error("No se pudieron obtener las tareas");
}
