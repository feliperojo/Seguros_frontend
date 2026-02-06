/**
 * Servicio de API para DocuSeal vía backend Laravel.
 * - Crear template desde PDF base64
 * - Enviar para firma
 * - Consultar estado y descargar PDF firmado
 */
import apiRequest from "./api";

const BASE = "docuseal";

/**
 * Crea un template en el backend a partir del PDF en base64.
 * @param {string} name - Nombre del contrato/template
 * @param {string} pdfBase64 - Contenido del PDF en base64
 * @returns {Promise<{ template_id: number|string }>}
 */
export async function createTemplate(name, pdfBase64) {
  const body = {
    name: name || "Contrato",
    pdf_base64: pdfBase64,
  };
  const data = await apiRequest(`${BASE}/templates`, "POST", body);
  if (data.template_id === undefined && data.id !== undefined) {
    return { template_id: data.id };
  }
  return { template_id: data.template_id };
}

/**
 * Envía el contrato para firma usando el template_id.
 * @param {Object} params
 * @param {number|string} params.template_id - ID del template
 * @param {string} params.client_email - Email del firmante
 * @param {Object} params.client_data - nombre, email, telefono
 * @returns {Promise<{ submission_id?: string, success?: boolean, message?: string }>}
 */
export async function sendForSignature({ template_id, client_email, client_data }) {
  const body = {
    template_id,
    client_email: client_email || client_data?.email,
    client_data: client_data || {},
  };
  return apiRequest(`${BASE}/send`, "POST", body);
}

/**
 * Obtiene el estado de una presentación de firma.
 * @param {string} submissionId - ID de la submission
 * @returns {Promise<{ status: string, completed?: boolean, download_url?: string }>}
 */
export async function getSubmissionStatus(submissionId) {
  if (!submissionId) throw new Error("submission_id es requerido");
  return apiRequest(`${BASE}/status/${submissionId}`, "GET");
}

/**
 * Descarga el PDF firmado (si el backend devuelve URL o blob).
 * Si el backend retorna download_url en el status, se puede abrir en nueva pestaña.
 * @param {string} submissionId - ID de la submission
 * @returns {Promise<string>} URL de descarga o blob URL (según implementación backend)
 */
export async function getSignedPdfUrl(submissionId) {
  if (!submissionId) throw new Error("submission_id es requerido");
  const data = await apiRequest(`${BASE}/status/${submissionId}`, "GET");
  if (data.download_url) return data.download_url;
  if (data.signed_pdf_url) return data.signed_pdf_url;
  throw new Error("El backend no ha devuelto URL de descarga del PDF firmado.");
}
