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
  
  let data = {};
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (parseError) {
    data = { message: "Error al procesar la respuesta del servidor" };
  }

  if (!response.ok) {
    let errorMessage = data?.message || "Error en la petición";
    
    // Mensajes específicos según el código de estado
    if (response.status === 401) {
      errorMessage = data?.message || "No autorizado. Por favor, inicia sesión nuevamente.";
      // No borrar el token si el 401 es por contraseña incorrecta del super admin (el usuario sigue autenticado)
      const isVerifySuperAdminPassword = url.includes("verify-super-admin-password");
      // 401 en login = credenciales incorrectas: no debe cerrar sesiones válidas (otras pestañas / token previo)
      const isAuthLoginAttempt =
        url.includes("/v1/auth/login") || url.includes("/auth/login");
      if (!isVerifySuperAdminPassword && !isAuthLoginAttempt) {
        localStorage.removeItem("auth_token");
      }
    } else if (response.status === 403) {
      errorMessage = data?.message || "No tienes permisos para realizar esta acción";
    } else if (response.status === 404) {
      errorMessage = data?.message || "Recurso no encontrado";
    } else if (response.status === 422) {
      const detallesValidacion = data?.errors
        ? Object.values(data.errors).flat().join(" ")
        : "";
      errorMessage = detallesValidacion || data?.message || "Error de validación";
    } else if (response.status >= 500) {
      errorMessage = data?.message || "Error del servidor. Por favor, intenta más tarde.";
    }
    
    const error = new Error(errorMessage);
    error.response = {
      status: response.status,
      data: data,
      errors: data?.errors || null,
      code: data?.code || null,
      url: url,
    };
    
    // Log para debugging en desarrollo
    // 409 en creación de runs de auditoría es un caso esperado (duplicado) y genera ruido en consola.
    const isAuditoriaRunDuplicate =
      response.status === 409 &&
      method === "POST" &&
      typeof url === "string" &&
      url.includes("/auditorias/runs") &&
      !url.includes("/close");

    if (import.meta.env.DEV && !isAuditoriaRunDuplicate) {
      console.error("❌ API Error:", {
        url,
        method,
        status: response.status,
        message: errorMessage,
        data,
        hasToken: !!token,
      });
    }
    
    throw error;
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
  
  let data = {};
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch (parseError) {
    data = { message: "Error al procesar la respuesta del servidor" };
  }

  if (!response.ok) {
    let errorMessage = data?.message || "Error en la petición";
    
    // Mensajes específicos según el código de estado
    if (response.status === 401) {
      errorMessage = data?.message || "No autorizado. Por favor, inicia sesión nuevamente.";
      const isVerifySuperAdminPassword = url.includes("verify-super-admin-password");
      const isAuthLoginAttempt =
        url.includes("/v1/auth/login") || url.includes("/auth/login");
      if (!isVerifySuperAdminPassword && !isAuthLoginAttempt) {
        localStorage.removeItem("auth_token");
      }
    } else if (response.status === 403) {
      errorMessage = data?.message || "No tienes permisos para realizar esta acción";
    } else if (response.status === 404) {
      errorMessage = data?.message || "Recurso no encontrado";
    } else if (response.status === 422) {
      const detallesValidacion = data?.errors
        ? Object.values(data.errors).flat().join(" ")
        : "";
      errorMessage = detallesValidacion || data?.message || "Error de validación";
    } else if (response.status >= 500) {
      errorMessage = data?.message || "Error del servidor. Por favor, intenta más tarde.";
    }
    
    const error = new Error(errorMessage);
    error.response = {
      status: response.status,
      data: data,
      errors: data?.errors || null,
      code: data?.code || null,
      url: url,
    };
    
    // Log para debugging en desarrollo
    if (import.meta.env.DEV) {
      console.error("❌ API Error (FormData):", {
        url,
        method,
        status: response.status,
        message: errorMessage,
        data,
        hasToken: !!token,
      });
    }
    
    throw error;
  }
  return data;
};

export { apiRequest, apiRequestFormData, genUUID };
export default apiRequest;
