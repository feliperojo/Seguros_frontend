/**
 * Plantilla y constantes para generación de PDFs de contrato con tag de firma DocuSeal.
 * El tag {{signature}} será reconocido por DocuSeal para colocar el campo de firma electrónica.
 */

/** Nombre de la empresa para header/footer */
export const COMPANY_NAME = "Tu Empresa";

/** Opciones para el dropdown "Tipo de contrato" */
export const CONTRACT_TYPES = [
  { value: "servicios", label: "Contrato de Servicios" },
  { value: "confidencialidad", label: "Acuerdo de Confidencialidad" },
  { value: "prestacion", label: "Contrato de Prestación de Servicios" },
  { value: "adhesion", label: "Contrato de Adhesión" },
  { value: "otro", label: "Otro" },
];

/**
 * Obtiene el título del contrato según el tipo
 * @param {string} type - Valor del tipo (value)
 * @returns {string}
 */
export function getContractTitle(type) {
  const found = CONTRACT_TYPES.find((t) => t.value === type);
  return found ? found.label : "Contrato";
}

/**
 * Cuerpo de texto genérico del contrato (se puede personalizar por tipo)
 * @param {string} contractType - Tipo de contrato
 * @returns {string}
 */
export function getContractBody(contractType) {
  const title = getContractTitle(contractType);
  return (
    `Por medio del presente documento se formaliza el ${title.toLowerCase()} entre ${COMPANY_NAME} (en adelante "La Empresa") y el cliente cuyos datos se detallan a continuación.\n\n` +
    `El cliente declara que la información proporcionada es veraz y acepta los términos y condiciones establecidos por La Empresa para la prestación del servicio.\n\n` +
    `La firma del presente documento implica la aceptación íntegra de los términos, obligaciones y derechos aquí establecidos.`
  );
}

/** Texto del footer con fecha y términos */
export function getFooterText() {
  const date = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `Documento generado el ${date}. ${COMPANY_NAME}. Este documento es válido una vez firmado electrónicamente.`;
}

/** Etiqueta que DocuSeal interpreta como campo de firma */

