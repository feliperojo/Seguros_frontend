// src/services/api.js

// Lee la variable del entorno (.env.production o .env.development)
const RAW = import.meta.env.VITE_API_BASE_URL || "";

// Elimina cualquier barra final duplicada y usa "/api" como fallback
const API_BASE_URL = RAW.replace(/\/+$/, "") || "/api";

// Obtiene el token de autenticación del localStorage
const getAuthToken = () => localStorage.getItem("auth_token");

// Utilidad opcional: genera un UUID sencillo (para idempotencia)
const genUUID = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );

/**
 * apiRequest
 * @param {string} endpoint - Ruta del endpoint (ej: "login" o "/login")
 * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
 * @param {object|null} body - Datos a enviar en JSON
 * @param {object} extraHeaders - Headers adicionales opcionales
 */
const apiRequest = async (endpoint, method = "GET", body = null, extraHeaders = {}) => {
  const token = getAuthToken();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  // Construye la URL final garantizando una sola barra
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Error en la petición");
  }
  return data;
};

/**
 * apiRequestFormData - Para subir archivos con FormData
 * @param {string} endpoint - Ruta del endpoint
 * @param {string} method - Método HTTP (POST, PUT)
 * @param {FormData} formData - FormData con los archivos y campos
 */
const apiRequestFormData = async (endpoint, method = "POST", formData = null) => {
  const token = getAuthToken();

  const headers = {
    Accept: "application/json",
    // NO incluir Content-Type, el navegador lo establece automáticamente con el boundary
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const options = { method, headers };
  if (formData) options.body = formData;

  // Construye la URL final garantizando una sola barra
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Error en la petición");
  }
  return data;
};

export { apiRequest, apiRequestFormData, genUUID };
export default apiRequest;
