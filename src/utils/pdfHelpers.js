// src/utils/pdfHelpers.js

/**
 * Convierte un objeto jsPDF a Blob
 * @param {jsPDF} doc - Instancia de jsPDF
 * @returns {Promise<Blob>}
 */
export const jsPDFToBlob = (doc) => {
  return new Promise((resolve) => {
    const blob = doc.output("blob");
    resolve(blob);
  });
};

/**
 * Convierte un Blob a File
 * @param {Blob} blob - Blob a convertir
 * @param {string} filename - Nombre del archivo
 * @returns {File}
 */
export const blobToFile = (blob, filename) => {
  return new File([blob], filename, { type: "application/pdf" });
};

/**
 * Convierte un jsPDF directamente a File
 * @param {jsPDF} doc - Instancia de jsPDF
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<File>}
 */
export const jsPDFToFile = async (doc, filename) => {
  const blob = await jsPDFToBlob(doc);
  return blobToFile(blob, filename);
};

/**
 * Descarga un Blob como archivo
 * @param {Blob} blob - Blob a descargar
 * @param {string} filename - Nombre del archivo
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
