// src/services/SignatureService.js
import { apiRequestFormData } from "./api";

/**
 * Crea una solicitud de firma enviando un PDF al backend
 * @param {Object} params - Parámetros de la solicitud
 * @param {Blob|File} params.pdfBlob - Archivo PDF como Blob o File
 * @param {string} params.filename - Nombre del archivo
 * @param {Array<Object>} params.signers - Lista de firmantes
 * @param {string} params.signers[].email - Email del firmante (requerido)
 * @param {string} [params.signers[].name] - Nombre del firmante (opcional)
 * @param {number|string} [params.clienteId] - ID del cliente (opcional pero recomendado)
 * @param {number|string} [params.grupoFamiliarId] - ID del grupo familiar (opcional)
 * @param {Object} [params.metadata] - Metadatos adicionales (opcional)
 * @param {string} [params.metadata.subject] - Asunto del email
 * @param {string} [params.metadata.message] - Mensaje adicional
 * @returns {Promise<{submission_id: string, redirect_url?: string, signing_url?: string}>}
 */
export const createSubmission = async ({ pdfBlob, filename, signers, clienteId, grupoFamiliarId, metadata = {} }) => {
  // Validar que haya al menos un firmante
  if (!signers || signers.length === 0) {
    throw new Error("Debe haber al menos un firmante");
  }

  // Validar emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const signer of signers) {
    if (!signer.email || !emailRegex.test(signer.email)) {
      throw new Error(`Email inválido: ${signer.email}`);
    }
  }

  // Crear FormData
  const formData = new FormData();

  // Convertir blob a File si es necesario
  let pdfFile;
  if (pdfBlob instanceof File) {
    pdfFile = pdfBlob;
  } else {
    pdfFile = new File([pdfBlob], filename || "documento.pdf", {
      type: "application/pdf",
    });
  }

  // Agregar el archivo PDF
  formData.append("file", pdfFile);
  
  // Agregar el nombre del archivo
  formData.append("filename", filename || "documento.pdf");

  // Agregar cliente_id si está disponible
  if (clienteId !== undefined && clienteId !== null) {
    formData.append("cliente_id", String(clienteId));
  }

  // Agregar grupo_familiar_id si está disponible
  if (grupoFamiliarId !== undefined && grupoFamiliarId !== null) {
    formData.append("grupo_familiar_id", String(grupoFamiliarId));
  }

  // Agregar firmantes como JSON stringificado
  formData.append("signers", JSON.stringify(signers));

  // Agregar metadata como JSON stringificado (si existe)
  if (Object.keys(metadata).length > 0) {
    formData.append("metadata", JSON.stringify(metadata));
  }

  // Llamar al endpoint del backend
  const response = await apiRequestFormData(
    "/v1/signatures/submissions",
    "POST",
    formData
  );

  return response;
};

export default { createSubmission };