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
  if (params.estado_cobertura) queryParams.append("estado_cobertura", params.estado_cobertura);
  if (params.date_from) queryParams.append("date_from", params.date_from);
  if (params.date_to) queryParams.append("date_to", params.date_to);
  if (params.search) queryParams.append("search", params.search);
  if (params.exclude_retiradas === true) queryParams.append("exclude_retiradas", "1");
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

/**
 * Construye los query params para el endpoint de reporte de cumpleaños
 * @param {Object} params - Parámetros de filtro y paginación
 * @returns {string} Query string
 */
const buildCumpleanosQueryParams = (params) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);
  if (params.fecha_desde) queryParams.append("fecha_desde", params.fecha_desde);
  if (params.fecha_hasta) queryParams.append("fecha_hasta", params.fecha_hasta);
  if (params.mes) queryParams.append("mes", params.mes);
  if (params.dia) queryParams.append("dia", params.dia);
  if (params.solo_hoy === true) {
    queryParams.append("solo_hoy", "true");
  }
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
 * Obtiene el reporte de cumpleaños con filtros y paginación
 * @param {Object} params - Parámetros de filtro y paginación
 * @param {AbortSignal} signal - Signal para cancelar la petición
 * @returns {Promise<Object>} Respuesta con data, meta y filters
 */
export const getReporteCumpleanos = async (params = {}, signal = null) => {
  const queryString = buildCumpleanosQueryParams(params);
  const endpoint = `reportes/cumpleanos${queryString ? `?${queryString}` : ""}`;
  
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

/**
 * Construye query params para el reporte de medios de pago por cliente
 */
const buildMediosPagoQueryParams = (params) => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);
  if (params.search) queryParams.append("search", params.search);
  if (params.tipo_medio) queryParams.append("tipo_medio", params.tipo_medio);
  if (params.forma_pago) queryParams.append("forma_pago", params.forma_pago);
  if (params.tipo_tarjeta) queryParams.append("tipo_tarjeta", params.tipo_tarjeta);
  if (params.activo === true) queryParams.append("activo", "true");
  if (params.activo === false) queryParams.append("activo", "false");
  if (params.solo_con_medios === false) queryParams.append("solo_con_medios", "false");
  if (params.sort_by) {
    queryParams.append("sort_by", params.sort_by);
    if (params.sort_dir) queryParams.append("sort_dir", params.sort_dir);
  }

  return queryParams.toString();
};

export const getReporteMediosPago = async (params = {}, signal = null) => {
  const queryString = buildMediosPagoQueryParams(params);
  const endpoint = `reportes/medios-pago${queryString ? `?${queryString}` : ""}`;

  if (signal) {
    const token = getAuthToken();
    const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { method: "GET", headers, signal });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        const error = new Error(data?.message || "Error en la petición");
        error.response = { status: response.status, data };
        throw error;
      }

      return data;
    } catch (err) {
      if (err?.name === "AbortError") {
        const cancelled = new Error("Petición cancelada");
        cancelled.name = "AbortError";
        throw cancelled;
      }
      throw err;
    }
  }

  return apiRequest(endpoint, "GET");
};

const buildCoberturasCanceladasRetiradasQueryParams = (params) => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);
  if (params.tipo) queryParams.append("tipo", params.tipo);
  if (params.search) queryParams.append("search", params.search);
  if (params.date_from) queryParams.append("date_from", params.date_from);
  if (params.date_to) queryParams.append("date_to", params.date_to);
  if (params.mes) queryParams.append("mes", params.mes);
  if (params.anio) queryParams.append("anio", params.anio);
  if (params.sort_by) {
    queryParams.append("sort_by", params.sort_by);
    if (params.sort_dir) queryParams.append("sort_dir", params.sort_dir);
  }

  return queryParams.toString();
};

/**
 * Informe completo de coberturas canceladas y retiradas.
 */
export const getReporteCoberturasCanceladasRetiradas = async (params = {}, signal = null) => {
  const queryString = buildCoberturasCanceladasRetiradasQueryParams(params);
  const endpoint = `reportes/coberturas-canceladas-retiradas${queryString ? `?${queryString}` : ""}`;

  if (signal) {
    const token = getAuthToken();
    const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { method: "GET", headers, signal });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        const error = new Error(data?.message || "Error en la petición");
        error.response = { status: response.status, data };
        throw error;
      }

      return data;
    } catch (err) {
      if (err?.name === "AbortError") {
        const cancelled = new Error("Petición cancelada");
        cancelled.name = "AbortError";
        throw cancelled;
      }
      throw err;
    }
  }

  return apiRequest(endpoint, "GET");
};

export default getReporteCoberturas;

