import apiRequest from "./api";
import { getItemFromApi, getListFromApi } from "../utils/apiResponse";

const BASE = "recursos/actas";

const buildQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") q.append(key, value);
  });
  const qs = q.toString();
  return qs ? `?${qs}` : "";
};

export const ACTA_ESTADOS = {
  BORRADOR: "borrador",
  PUBLICADA: "publicada",
  ARCHIVADA: "archivada",
};

export const actasService = {
  list: async (params = {}) => {
    const res = await apiRequest(`${BASE}${buildQuery(params)}`, "GET");
    return {
      items: getListFromApi(res),
      meta: res?.meta ?? res?.data?.meta ?? null,
    };
  },

  get: async (id) => {
    const res = await apiRequest(`${BASE}/${id}`, "GET");
    return getItemFromApi(res);
  },

  create: async (payload) => {
    const res = await apiRequest(BASE, "POST", payload);
    return getItemFromApi(res);
  },

  update: async (id, payload) => {
    const res = await apiRequest(`${BASE}/${id}`, "PUT", payload);
    return getItemFromApi(res);
  },

  archivar: async (id) => {
    const res = await apiRequest(`${BASE}/${id}/archivar`, "POST");
    return getItemFromApi(res);
  },

  /**
   * Crea una tarea operativa vinculada al acta (requiere endpoint en backend).
   */
  crearCompromisoTarea: async (actaId, payload) => {
    const res = await apiRequest(`${BASE}/${actaId}/compromisos/tarea`, "POST", payload);
    return getItemFromApi(res);
  },
};

export default actasService;
