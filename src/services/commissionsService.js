// src/services/commissionsService.js
import { apiRequestFormData } from "./api";

/**
 * Envía el formulario de conciliación al endpoint de comparación de comisiones.
 * @param {Object} params
 * @param {File} params.file - Archivo CSV
 * @param {string|number} params.company_id - ID de compañía
 * @param {string|number} params.month - Mes (1-12)
 * @param {string|number} params.year - Año
 * @returns {Promise<{ summary?: object, data?: array, message?: string }>} Respuesta del servidor
 */
export const compareCommissions = async ({ file, company_id, month, year }) => {
  const formData = new FormData();
  formData.append("file", file);
  if (company_id != null && company_id !== "") formData.append("company_id", String(company_id));
  if (month != null && month !== "") formData.append("month", String(month));
  if (year != null && year !== "") formData.append("year", String(year));
  return apiRequestFormData("/commissions/compare", "POST", formData);
};
