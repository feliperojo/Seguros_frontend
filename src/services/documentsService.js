/**
 * Servicio para listar, detallar y descargar documentos/submissions de DocuSeal.
 * Endpoints esperados en el backend Laravel.
 */
import apiRequest from "./api";

const BASE = "documents/submissions";

/**
 * Lista documentos (submissions) con filtros y paginación.
 * @param {Object} filters - { status: 'all'|'pending'|'completed', email: string, page: number, date_from?: string, date_to?: string }
 * @returns {Promise<{ data: Array, meta?: Object }>}
 */
export async function getDocuments(filters = {}) {
  const params = new URLSearchParams();
  params.set("status", filters.status || "all");
  if (filters.email?.trim()) params.set("email", filters.email.trim());
  params.set("page", String(filters.page || 1));
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);

  const query = params.toString();
  const endpoint = query ? `${BASE}?${query}` : BASE;
  const response = await apiRequest(endpoint, "GET");
  // Backend retorna { success, message, data: { data: [...], pagination: { page, limit, total, next, prev } } }
  // Devolvemos tal cual para que la vista extraiga data.data y data.pagination
  return response;
}

/**
 * Obtiene el detalle de una submission por ID.
 * @param {string|number} id - ID de la submission
 * @returns {Promise<Object>}
 */
export async function getDocumentDetail(id) {
  if (!id) throw new Error("ID es requerido");
  return apiRequest(`${BASE}/${id}`, "GET");
}

/**
 * Obtiene la URL o el blob para descargar el documento firmado.
 * @param {string|number} id - ID de la submission
 * @returns {Promise<{ url?: string, blob?: Blob }>}
 */
export async function downloadDocument(id) {
  if (!id) throw new Error("ID es requerido");
  const response = await apiRequest(`${BASE}/${id}/download`, "GET");

  if (response.url) return { url: response.url };
  if (response.download_url) return { url: response.download_url };
  throw new Error(response.message || "No se pudo obtener el enlace de descarga");
}
