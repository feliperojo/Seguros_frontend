import apiRequest from "./api";
import { getItemFromApi, getListFromApi } from "../utils/apiResponse";
import {
  ESTADO_API_CANDIDATES,
  normalizeTableroItem,
} from "../utils/tableroEstados";

const BASE = "recursos/tablero";

export const TABLERO_COLUMNAS = [
  { id: "pendiente", label: "Pendiente", color: "#64748b", hint: "Por iniciar" },
  { id: "en_progreso", label: "En curso", color: "#1e40af", hint: "En ejecución" },
  { id: "completado", label: "Completado", color: "#0f766e", hint: "Finalizado" },
];

export const tableroPersonalService = {
  list: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.user_id) q.append("user_id", params.user_id);
    const qs = q.toString();
    const res = await apiRequest(`${BASE}${qs ? `?${qs}` : ""}`, "GET");
    return getListFromApi(res).map(normalizeTableroItem);
  },

  create: async (payload) => {
    const res = await apiRequest(BASE, "POST", payload);
    return getItemFromApi(res);
  },

  update: async (id, payload) => {
    const res = await apiRequest(`${BASE}/${id}`, "PUT", payload);
    return getItemFromApi(res);
  },

  /**
   * Mueve tarjeta de columna. Prueba variantes de `estado` y PUT si /mover devuelve 422.
   */
  move: async (id, estadoFront, orden = null) => {
    const candidates = ESTADO_API_CANDIDATES[estadoFront] ?? [estadoFront];
    let lastError = null;

    for (const estadoApi of candidates) {
      const body = { estado: estadoApi };
      if (orden != null) body.orden = orden;
      try {
        const res = await apiRequest(`${BASE}/${id}/mover`, "PATCH", body);
        return normalizeTableroItem(getItemFromApi(res));
      } catch (e) {
        lastError = e;
        if (e?.response?.status !== 422) throw e;
      }
    }

    for (const estadoApi of candidates) {
      try {
        const res = await apiRequest(`${BASE}/${id}`, "PUT", {
          estado: estadoApi,
          ...(orden != null ? { orden } : {}),
        });
        return normalizeTableroItem(getItemFromApi(res));
      } catch (e) {
        lastError = e;
        if (e?.response?.status !== 422) throw e;
      }
    }

    throw lastError;
  },

  remove: async (id) => {
    return apiRequest(`${BASE}/${id}`, "DELETE");
  },

  historial: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.user_id) q.append("user_id", params.user_id);
    if (params.page) q.append("page", params.page);
    if (params.per_page) q.append("per_page", params.per_page);
    const qs = q.toString();
    const res = await apiRequest(`${BASE}/historial${qs ? `?${qs}` : ""}`, "GET");
    const list = getListFromApi(res);
    return {
      items: list.map(normalizeTableroItem),
      meta: res?.meta ?? res?.data?.meta ?? null,
    };
  },

  archivarCompletados: async () => {
    return apiRequest(`${BASE}/archivar-completados`, "POST");
  },
};

export default tableroPersonalService;
