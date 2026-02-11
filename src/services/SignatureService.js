// src/services/SignatureService.js
import { apiRequestFormData, apiRequest } from "./api";

/**
 * Crea una solicitud de firma enviando un PDF al backend
 * @param {Object} params - Parámetros de la solicitud
 * @param {Blob|File} params.pdfBlob - Archivo PDF como Blob o File
 * @param {string} params.filename - Nombre del archivo
 * @param {string} params.documentType - Tipo de documento: "AUTORIZACION" o "CONFIRMACION"
 * @param {Array<Object>} params.signers - Lista de firmantes con email, name y order
 * @param {string} params.signers[].email - Email del firmante (requerido)
 * @param {string} [params.signers[].name] - Nombre del firmante (opcional)
 * @param {number} [params.signers[].order] - Orden de firma (opcional, default: 1)
 * @param {Object} [params.metadata] - Metadatos adicionales (opcional)
 * @param {number|string} [params.metadata.cliente_id] - ID del cliente
 * @param {number|string} [params.metadata.grupo_familiar_id] - ID del grupo familiar
 * @param {string} [params.emailSubject] - Asunto del email (opcional)
 * @param {string} [params.emailBody] - Cuerpo del email (opcional)
 * @param {string} [params.language] - Idioma del documento: "es" o "en" (opcional, para coordenadas de firma)
 * @returns {Promise<{submission_id: string, embed_src: string, success: boolean, message?: string}>}
 */
export const createSubmission = async ({ 
  pdfBlob, 
  filename, 
  documentType, 
  signers, 
  metadata = {},
  emailSubject,
  emailBody,
  language = "es" // Idioma por defecto: español
}) => {
  // Validar que haya al menos un firmante
  if (!signers || signers.length === 0) {
    throw new Error("Debe haber al menos un firmante");
  }

  // Validar documentType
  if (!documentType || !["AUTORIZACION", "CONFIRMACION"].includes(documentType.toUpperCase())) {
    throw new Error("documentType debe ser 'AUTORIZACION' o 'CONFIRMACION'");
  }

  // Validar emails y preparar signers con order (1-indexed según validación del backend)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const preparedSigners = signers.map((signer, index) => {
    if (!signer.email || !emailRegex.test(signer.email)) {
      throw new Error(`Email inválido: ${signer.email}`);
    }
    const preparedSigner = {
      email: signer.email.trim(),
      order: signer.order !== undefined ? signer.order : index + 1, // 1-indexed para el backend Laravel
    };
    
    // Agregar name solo si está presente (opcional)
    if (signer.name && signer.name.trim()) {
      preparedSigner.name = signer.name.trim();
    }
    
    // Agregar role si está presente (opcional)
    if (signer.role && signer.role.trim()) {
      preparedSigner.role = signer.role.trim();
    }
    
    return preparedSigner;
  });

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

  // Agregar document_type
  formData.append("document_type", documentType.toUpperCase());

  // Agregar language para que el backend maneje coordenadas por formato + idioma
  if (language && (language === "es" || language === "en")) {
    formData.append("language", language);
  }

  // Agregar firmantes como JSON stringificado
  formData.append("signers", JSON.stringify(preparedSigners));

  // Agregar metadata como JSON stringificado
  formData.append("metadata", JSON.stringify(metadata));

  // Agregar email_subject si está disponible
  if (emailSubject && emailSubject.trim()) {
    formData.append("email_subject", emailSubject.trim());
  }

  // Agregar email_body si está disponible
  if (emailBody && emailBody.trim()) {
    formData.append("email_body", emailBody.trim());
  }

  // Llamar al endpoint del backend
  const response = await apiRequestFormData(
    "signatures/submissions",
    "POST",
    formData
  );

  // Validar respuesta
  if (response.success === false) {
    throw new Error(response.message || "Error al crear la solicitud de firma");
  }

  return response;
};

/**
 * Obtiene el estado de una solicitud de firma
 * @param {string} submissionId - ID de la solicitud
 * @returns {Promise<Object>} Estado de la solicitud
 */
export const getSubmissionStatus = async (submissionId) => {
  if (!submissionId) {
    throw new Error("submissionId es requerido");
  }

  const response = await apiRequest(
    `signatures/submissions/${submissionId}`,
    "GET"
  );

  return response;
};

export default { createSubmission, getSubmissionStatus };