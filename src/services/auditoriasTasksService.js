// services/auditoriasTasksService.js
import apiRequest from "./api";

/**
 * Construye los query params para los endpoints de tareas de auditoría
 * @param {Object} params - Parámetros de filtro
 * @returns {string} Query string
 */
const buildQueryParams = (params) => {
  const queryParams = new URLSearchParams();
  
  if (params.run_id) queryParams.append("run_id", params.run_id);
  if (params.item_id) queryParams.append("item_id", params.item_id);
  if (params.cliente_id) queryParams.append("cliente_id", params.cliente_id);
  if (params.cobertura_id) queryParams.append("cobertura_id", params.cobertura_id);
  if (params.grupo_familiar_id) queryParams.append("grupo_familiar_id", params.grupo_familiar_id);
  if (params.status) queryParams.append("status", params.status);
  if (params.assigned_user_id) queryParams.append("assigned_user_id", params.assigned_user_id);
  if (params.page) queryParams.append("page", params.page);
  if (params.per_page) queryParams.append("per_page", params.per_page);
  
  // Soporte para ambos formatos de fecha (según documentación: fecha_inicio/fecha_fin)
  if (params.fecha_inicio) queryParams.append("fecha_inicio", params.fecha_inicio);
  if (params.fecha_fin) queryParams.append("fecha_fin", params.fecha_fin);
  // También mantener compatibilidad con date_from/date_to
  if (params.date_from) queryParams.append("date_from", params.date_from);
  if (params.date_to) queryParams.append("date_to", params.date_to);
  
  return queryParams.toString();
};

/**
 * Lista las tareas de auditoría con filtros opcionales
 * @param {Object} params - Parámetros de filtro
 * @returns {Promise<Object>} Respuesta con data y meta
 */
export const listTasks = async (params = {}) => {
  const queryString = buildQueryParams(params);
  const endpoint = `auditorias/tasks${queryString ? `?${queryString}` : ""}`;
  
  try {
    const response = await apiRequest(endpoint, "GET");
    // El backend puede devolver { data: [...], meta: {...} } o directamente un array
    if (Array.isArray(response)) {
      return { data: response, meta: { total: response.length } };
    }
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Obtiene una tarea específica por ID
 * @param {number|string} taskId - ID de la tarea
 * @returns {Promise<Object>} Tarea completa con comentarios
 */
export const getTask = async (taskId) => {
  if (!taskId) {
    throw new Error("taskId es requerido");
  }
  
  const endpoint = `auditorias/tasks/${taskId}`;
  
  try {
    const response = await apiRequest(endpoint, "GET");
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Crea una nueva tarea desde un item de auditoría (LEGACY - usar createTaskFromRun)
 * @param {number|string} itemId - ID del item de auditoría
 * @param {Object} payload - { assigned_user_id, scheduled_date?, due_date?, response_note?, mentioned_user_ids? }
 * @returns {Promise<Object>} Tarea creada
 * @deprecated Usar createTaskFromRun en su lugar
 */
export const createTaskFromItem = async (itemId, payload) => {
  if (!itemId) {
    throw new Error("itemId es requerido");
  }
  
  const endpoint = `auditorias/items/${itemId}/tasks`;
  
  try {
    const response = await apiRequest(endpoint, "POST", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Crea una nueva tarea de auditoría usando run_id + cobertura_id/cliente_id
 * @param {number|string} runId - ID del run de auditoría
 * @param {Object} payload - { assigned_user_id, cobertura_id? (o cliente_id?), scheduled_date?, due_date?, response_note?, mentioned_user_ids? }
 * @returns {Promise<Object>} Tarea creada
 */
export const createTaskFromRun = async (runId, payload) => {
  if (!runId) {
    throw new Error("runId es requerido");
  }
  
  if (!payload.assigned_user_id) {
    throw new Error("assigned_user_id es requerido");
  }
  
  if (!payload.cobertura_id && !payload.cliente_id) {
    throw new Error("cobertura_id o cliente_id es requerido");
  }
  
  const endpoint = `auditorias/runs/${runId}/tasks`;
  
  try {
    const response = await apiRequest(endpoint, "POST", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Actualiza una tarea de auditoría
 * @param {number|string} taskId - ID de la tarea
 * @param {Object} payload - Datos a actualizar
 * @returns {Promise<Object>} Tarea actualizada
 */
export const updateTask = async (taskId, payload) => {
  if (!taskId) {
    throw new Error("taskId es requerido");
  }
  
  const endpoint = `auditorias/tasks/${taskId}`;
  
  try {
    const response = await apiRequest(endpoint, "PUT", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Asigna o reasigna una tarea a un usuario
 * @param {number|string} taskId - ID de la tarea
 * @param {number|string} userId - ID del usuario
 * @returns {Promise<Object>} Tarea actualizada
 */
export const assignTask = async (taskId, userId) => {
  if (!taskId || !userId) {
    throw new Error("taskId y userId son requeridos");
  }
  
  const endpoint = `auditorias/tasks/${taskId}/assign`;
  
  try {
    const response = await apiRequest(endpoint, "PUT", { assigned_user_id: userId });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Completa una tarea de auditoría
 * @param {number|string} taskId - ID de la tarea
 * @param {string} responseNote - Nota de respuesta opcional
 * @returns {Promise<Object>} Tarea completada
 */
export const completeTask = async (taskId, responseNote = null) => {
  if (!taskId) {
    throw new Error("taskId es requerido");
  }
  
  const endpoint = `auditorias/tasks/${taskId}/complete`;
  const payload = {};
  if (responseNote) {
    payload.response_note = responseNote;
  }
  
  try {
    const response = await apiRequest(endpoint, "POST", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Reprograma una tarea (actualiza fechas)
 * @param {number|string} taskId - ID de la tarea
 * @param {Object} payload - { scheduled_date?, due_date? }
 * @returns {Promise<Object>} Tarea actualizada
 */
export const rescheduleTask = async (taskId, payload) => {
  if (!taskId) {
    throw new Error("taskId es requerido");
  }
  
  const endpoint = `auditorias/tasks/${taskId}/reschedule`;
  
  try {
    const response = await apiRequest(endpoint, "PUT", payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Lista las tareas de un item específico
 * @param {number|string} itemId - ID del item de auditoría
 * @returns {Promise<Array>} Lista de tareas del item
 */
export const getItemTasks = async (itemId) => {
  if (!itemId) {
    throw new Error("itemId es requerido");
  }
  
  const endpoint = `auditorias/items/${itemId}/tasks`;
  
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
 * Obtiene el conteo de tareas pendientes
 * @param {Object} params - Parámetros de filtro opcionales
 * @returns {Promise<number>} Número de tareas pendientes
 */
export const getPendingTasksCount = async (params = {}) => {
  const queryString = buildQueryParams({ ...params, status: "pending" });
  const endpoint = `auditorias/tasks/pendientes${queryString ? `?${queryString}` : ""}`;
  
  try {
    const response = await apiRequest(endpoint, "GET");
    // El backend puede devolver { count: number } o directamente un número
    return response?.count || response || 0;
  } catch (error) {
    throw error;
  }
};

/**
 * Agrega un comentario a una tarea de auditoría
 * @param {number|string} taskId - ID de la tarea
 * @param {FormData} formData - FormData con comment, mentioned_user_ids (JSON), archivos[]
 * @returns {Promise<Object>} Comentario creado
 */
export const addComment = async (taskId, formData) => {
  if (!taskId) {
    throw new Error("taskId es requerido");
  }
  
  const endpoint = `auditorias/tasks/${taskId}/comments`;
  
  // Para FormData, no usar apiRequest (que envía JSON), usar fetch directamente
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "/api";
  const token = localStorage.getItem("auth_token");
  
  const headers = {
    Accept: "application/json",
  };
  
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // NO incluir Content-Type para FormData, el navegador lo hará automáticamente
  
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
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
    throw error;
  }
};

/**
 * Obtiene los comentarios de una tarea
 * @param {number|string} taskId - ID de la tarea
 * @returns {Promise<Array>} Lista de comentarios
 */
export const getTaskComments = async (taskId) => {
  if (!taskId) {
    throw new Error("taskId es requerido");
  }
  
  const endpoint = `auditorias/tasks/${taskId}/comments`;
  
  try {
    const response = await apiRequest(endpoint, "GET");
    // El backend puede devolver { data: [...] } o directamente un array
    const result = Array.isArray(response) ? response : (response?.data || []);
    return result;
  } catch (error) {
    throw error;
  }
};

export default {
  listTasks,
  getTask,
  createTaskFromItem,
  createTaskFromRun,
  updateTask,
  assignTask,
  completeTask,
  rescheduleTask,
  getItemTasks,
  getPendingTasksCount,
  addComment,
  getTaskComments,
};

