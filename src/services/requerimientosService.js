// services/requerimientosService.js
import apiRequest from "./api";

// Lee la variable del entorno
const RAW = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = RAW.replace(/\/+$/, "") || "/api";

// Obtiene el token de autenticación del localStorage
const getAuthToken = () => localStorage.getItem("auth_token");

/**
 * Obtiene los requerimientos de una cobertura específica
 * @param {number|string} coberturaId - ID de la cobertura
 * @param {Object} params - Parámetros opcionales (page, per_page)
 * @param {AbortSignal} signal - Signal para cancelar la petición
 * @returns {Promise<Object>} Respuesta con data y meta (si aplica)
 */
export const getRequerimientosByCobertura = async (
  coberturaId,
  params = {},
  signal = null
) => {
  if (!coberturaId) {
    throw new Error("coberturaId es requerido");
  }

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);

  const queryString = queryParams.toString();
  const endpoint = `coberturas/${coberturaId}/requerimientos${
    queryString ? `?${queryString}` : ""
  }`;

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

export default getRequerimientosByCobertura;

