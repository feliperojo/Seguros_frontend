// services/reportesService.js
import apiRequest from "./api";

// Lee la variable del entorno
const RAW = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = RAW.replace(/\/+$/, "") || "/api";

// Obtiene el token de autenticación del localStorage
const getAuthToken = () => localStorage.getItem("auth_token");

/**
 * Construye los query params para el endpoint de reportes
 * @param {Object} params - Parámetros de filtro y paginación
 * @returns {string} Query string
 */
const buildQueryParams = (params) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);
  if (params.compania_id) queryParams.append("compania_id", params.compania_id);
  if (params.zip_code) queryParams.append("zip_code", params.zip_code);
  // Solo enviar only_pending si es true
  if (params.only_pending === true) {
    queryParams.append("only_pending", "true");
  }
  if (params.date_from) queryParams.append("date_from", params.date_from);
  if (params.date_to) queryParams.append("date_to", params.date_to);
  if (params.search) queryParams.append("search", params.search);
  // Solo enviar sort_by y sort_dir si sort_by tiene valor
  if (params.sort_by) {
    queryParams.append("sort_by", params.sort_by);
    if (params.sort_dir) {
      queryParams.append("sort_dir", params.sort_dir);
    }
  }
  
  return queryParams.toString();
};

/**
 * Obtiene el reporte de coberturas con filtros y paginación
 * @param {Object} params - Parámetros de filtro y paginación
 * @param {AbortSignal} signal - Signal para cancelar la petición
 * @returns {Promise<Object>} Respuesta con data, meta y filters
 */
export const getReporteCoberturas = async (params = {}, signal = null) => {
  const queryString = buildQueryParams(params);
  const endpoint = `reportes/coberturas${queryString ? `?${queryString}` : ""}`;
  
  // Si hay signal, usar fetch directamente para poder cancelar
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
  
  // Si no hay signal, usar apiRequest normal
  try {
    const response = await apiRequest(endpoint, "GET");
    return response;
  } catch (error) {
    throw error;
  }
};

export default getReporteCoberturas;

