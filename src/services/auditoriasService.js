// services/auditoriasService.js
import apiRequest from "./api";

// Lee la variable del entorno
const RAW = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = RAW.replace(/\/+$/, "") || "/api";

// Obtiene el token de autenticación del localStorage
const getAuthToken = () => localStorage.getItem("auth_token");

/**
 * Construye los query params para los endpoints de auditorías
 * @param {Object} params - Parámetros de filtro
 * @returns {string} Query string
 */
const buildQueryParams = (params) => {
  const queryParams = new URLSearchParams();
  
  // Parámetros para listar runs
  if (params.audit_type) queryParams.append("audit_type", params.audit_type);
  if (params.audit_type_id) queryParams.append("audit_type_id", params.audit_type_id);
  if (params.target_type) queryParams.append("target_type", params.target_type);
  if (params.periodo) queryParams.append("periodo", params.periodo);
  
  // Parámetros para reportes
  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);
  if (params.compania_id) queryParams.append("compania_id", params.compania_id);
  if (params.zip_code) queryParams.append("zip_code", params.zip_code);
  const gfRaw = params.grupo_familiar_id ?? params.gf_id;
  if (gfRaw !== undefined && gfRaw !== null && String(gfRaw).trim() !== "") {
    const gfv = String(gfRaw).trim();
    queryParams.append("grupo_familiar_id", gfv);
  }
  if (params.audit_status) queryParams.append("audit_status", params.audit_status);
  if (params.only_pending === true) {
    queryParams.append("only_pending", "true");
  }
  if (params.date_from) queryParams.append("date_from", params.date_from);
  if (params.date_to) queryParams.append("date_to", params.date_to);
  if (params.search) queryParams.append("search", params.search);
  if (params.sort_by) {
    queryParams.append("sort_by", params.sort_by);
    if (params.sort_dir) {
      queryParams.append("sort_dir", params.sort_dir);
    }
  }
  
  return queryParams.toString();
};

/**
 * Lista los runs de auditorías
 * @param {Object} params - Parámetros de filtro (audit_type?, periodo?)
 * @param {AbortSignal} signal - Signal para cancelar la petición
 * @returns {Promise<Array>} Lista de runs con métricas
 */
export const listRuns = async (params = {}, signal = null) => {
  const queryString = buildQueryParams(params);
  const endpoint = `auditorias/runs${queryString ? `?${queryString}` : ""}`;
  
  if (signal) {
    const token = getAuthToken();
    const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal,
      });
      
      let data = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = { message: "Error al procesar la respuesta del servidor" };
      }
      
      if (!response.ok) {
        const error = new Error(data?.message || "Error en la petición");
        error.response = {
          status: response.status,
          data: data,
        };
        throw error;
      }
      
      // El backend devuelve { data: [...] } o directamente un array
      const result = Array.isArray(data) ? data : (data?.data || []);
      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Petición cancelada");
      }
      throw error;
    }
  }
  
  try {
    const response = await apiRequest(endpoint, "GET");
    // El backend devuelve { data: [...] } o directamente un array
    const result = Array.isArray(response) ? response : (response?.data || []);
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Crea un nuevo run de auditoría
 * @param {Object} payload - { audit_type: "SHERPA"|"DOCUMENTACION", periodo: "YYYY-MM" }
 * @returns {Promise<Object>} Run creado
 */
export const createRun = async (payload) => {
  const endpoint = "auditorias/runs";
  
  try {
    const response = await apiRequest(endpoint, "POST", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Obtiene el reporte de un run específico (genérico - detecta automáticamente coberturas o clientes)
 * @param {number|string} runId - ID del run
 * @param {Object} params - Parámetros de filtro y paginación
 * @param {AbortSignal} signal - Signal para cancelar la petición
 * @returns {Promise<Object>} Respuesta con data y meta
 */
export const getRunReporte = async (runId, params = {}, signal = null) => {
  if (!runId) {
    throw new Error("runId es requerido");
  }
  
  const queryString = buildQueryParams(params);
  // Usar la ruta genérica que detecta automáticamente el target_type
  const endpoint = `auditorias/runs/${runId}/reporte${queryString ? `?${queryString}` : ""}`;
  
  if (signal) {
    const token = getAuthToken();
    const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal,
      });
      
      let data = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = { message: "Error al procesar la respuesta del servidor" };
      }
      
      if (!response.ok) {
        const error = new Error(data?.message || "Error en la petición");
        error.response = {
          status: response.status,
          data: data,
        };
        throw error;
      }
      
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Petición cancelada");
      }
      throw error;
    }
  }
  
  try {
    const response = await apiRequest(endpoint, "GET");
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Obtiene un run específico con sus métricas detalladas
 * @param {number|string} runId - ID del run
 * @returns {Promise<Object>} Run completo con métricas
 */
export const getRun = async (runId) => {
  if (!runId) {
    throw new Error("runId es requerido");
  }
  
  const endpoint = `auditorias/runs/${runId}`;
  
  try {
    const response = await apiRequest(endpoint, "GET");
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Cierra un run de auditoría
 * @param {number|string} runId - ID del run
 * @returns {Promise<Object>} Run marcado como cerrado
 */
export const closeRun = async (runId) => {
  if (!runId) {
    throw new Error("runId es requerido");
  }
  
  const endpoint = `auditorias/runs/${runId}/close`;
  
  try {
    const response = await apiRequest(endpoint, "POST");
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Actualiza el estado de un item de auditoría (genérico - funciona para coberturas y clientes)
 * @param {number|string} runId - ID del run
 * @param {number|string} entityId - ID de la entidad (cobertura_id o cliente_id)
 * @param {Object} payload - { status: string, comment?: string }
 * @returns {Promise<Object>} Item actualizado
 */
export const updateItem = async (runId, entityId, payload) => {
  if (!runId || !entityId) {
    throw new Error("runId y entityId son requeridos");
  }
  
  // Usar la ruta genérica que detecta automáticamente el target_type del run
  const endpoint = `auditorias/runs/${runId}/items/${entityId}`;
  
  try {
    const response = await apiRequest(endpoint, "PUT", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Lista los tipos de auditoría disponibles
 * @param {Object} params - { target_type?: "coberturas"|"clientes", is_active?: boolean }
 * @returns {Promise<Array>} Lista de tipos de auditoría
 */
export const listAuditTypes = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.target_type) queryParams.append("target_type", params.target_type);
  if (params.is_active !== undefined && params.is_active !== null) {
    queryParams.append("is_active", params.is_active);
  }
  
  const queryString = queryParams.toString();
  const endpoint = `auditorias/types${queryString ? `?${queryString}` : ""}`;
  
  try {
    const response = await apiRequest(endpoint, "GET");
    // El backend puede devolver { data: [...] } o directamente un array
    const result = Array.isArray(response) ? response : (response?.data || []);
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Crea un nuevo tipo de auditoría
 * @param {Object} payload - { nombre, codigo, descripcion, target_type, is_active }
 * @returns {Promise<Object>} Tipo creado
 */
export const createAuditType = async (payload) => {
  const endpoint = "auditorias/types";
  
  try {
    const response = await apiRequest(endpoint, "POST", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Actualiza un tipo de auditoría
 * @param {number|string} typeId - ID del tipo
 * @param {Object} payload - Datos a actualizar
 * @returns {Promise<Object>} Tipo actualizado
 */
export const updateAuditType = async (typeId, payload) => {
  const endpoint = `auditorias/types/${typeId}`;
  
  try {
    const response = await apiRequest(endpoint, "PUT", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Elimina un tipo de auditoría
 * @param {number|string} typeId - ID del tipo
 * @returns {Promise<Object>} Respuesta de eliminación
 */
export const deleteAuditType = async (typeId) => {
  const endpoint = `auditorias/types/${typeId}`;
  
  try {
    const response = await apiRequest(endpoint, "DELETE");
    return response;
  } catch (error) {
    throw error;
  }
};

export default {
  listRuns,
  createRun,
  getRun,
  closeRun,
  getRunReporte,
  updateItem,
  listAuditTypes,
  createAuditType,
  updateAuditType,
  deleteAuditType,
};

