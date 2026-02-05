// src/services/SignatureRequestService.js
import { apiRequestFormData } from "./api";

/**
 * Envía un PDF a firma usando DocuSeal
 * @param {File|Blob} pdfFile - Archivo PDF a enviar
 * @param {string} entityType - Tipo de entidad (ej: "cliente", "grupo_familiar")
 * @param {number|string} entityId - ID de la entidad
 * @param {Object} signer - Datos del firmante
 * @param {string} signer.name - Nombre del firmante
 * @param {string} signer.email - Email del firmante
 * @param {string} [signer.subject] - Asunto opcional
 * @param {string} [signer.message] - Mensaje opcional
 * @returns {Promise<{signing_url: string, token: string}>}
 */
export const sendToSignature = async (pdfFile, entityType, entityId, signer) => {
  const formData = new FormData();
  
  // Agregar el archivo PDF
  formData.append("file", pdfFile);
  
  // Agregar información de la entidad
  formData.append("entity_type", entityType);
  formData.append("entity_id", String(entityId));
  
  // Agregar información del firmante
  formData.append("signers[0][name]", signer.name);
  formData.append("signers[0][email]", signer.email);
  formData.append("signers[0][order]", "1");
  
  // Campos opcionales
  if (signer.subject) {
    formData.append("subject", signer.subject);
  }
  if (signer.message) {
    formData.append("message", signer.message);
  }

  // Llamar al endpoint del backend
  const response = await apiRequestFormData(
    "/v1/signature-requests",
    "POST",
    formData
  );

  return response;
};

export default { sendToSignature };
