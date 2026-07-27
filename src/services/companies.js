// services/companies.js
import apiRequest from "./api";

/** Obtiene el catálogo de compañías desde la API */
export async function fetchCompanies() {
  const res = await apiRequest("compania/", "GET");
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

/** Busca nombre por id (id puede venir string/number) */
export function getCompanyNameById(companies, id) {
  if (!id) return "Sin compañía";
  const found = companies.find(c => String(c.id) === String(id));
  return found?.nombre || "Compañía desconocida";
}

/** Mapa de colores opcional por nombre */
export const companyColorMap = {
  "AMBETER": "#FF99FF",
  "BCBS TEXAS": "#89CFF0",
  "BRIGHT HEALTH": "#9EFF00",
  "FLORIDA BLUE": "#6FCFFF",
};
export function getCompanyColor(companies, compania_id) {
  const name = getCompanyNameById(companies, compania_id);
  return companyColorMap[name] || "#d3d3d3";
}
