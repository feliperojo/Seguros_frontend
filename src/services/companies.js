// services/companies.js
import apiRequest from "./api";

/** Obtiene el catálogo de compañías desde la API */
export async function fetchCompanies(params = {}) {
  const query = new URLSearchParams();
  if (params.producto) query.set("producto", params.producto);
  if (params.solo_activas) query.set("solo_activas", "1");
  const qs = query.toString();
  const res = await apiRequest(`compania/${qs ? `?${qs}` : ""}`, "GET");
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export async function createCompany(data) {
  return apiRequest("compania/create", "POST", data);
}

export async function updateCompany(id, data) {
  return apiRequest(`compania/${id}`, "PUT", data);
}

export async function deleteCompany(id) {
  return apiRequest(`compania/${id}`, "DELETE");
}

const isActiveStatus = (c) => c?.status === true || c?.status === 1 || c?.status === "1";

const hasFlag = (c, flag) => c?.[flag] === true || c?.[flag] === 1 || c?.[flag] === "1";

/**
 * Filtra compañías por producto (salud / dental_ms).
 * includeId: mantiene la compañía actual aunque ya no aplique al producto.
 */
export function filterCompaniesForProducto(
  companies = [],
  producto = null,
  { includeId = null, soloActivas = true } = {}
) {
  let list = Array.isArray(companies) ? [...companies] : [];

  if (soloActivas) {
    list = list.filter(
      (c) => isActiveStatus(c) || String(c?.id) === String(includeId)
    );
  }

  if (producto === "dental_ms") {
    list = list.filter(
      (c) =>
        hasFlag(c, "aplica_dental_ms") || String(c?.id) === String(includeId)
    );
  } else if (producto === "salud") {
    // Compat: si el flag aún no existe en BD, no ocultar.
    list = list.filter(
      (c) =>
        c?.aplica_salud === undefined ||
        c?.aplica_salud === null ||
        hasFlag(c, "aplica_salud") ||
        String(c?.id) === String(includeId)
    );
  }

  return list;
}

/** Busca nombre por id (id puede venir string/number) */
export function getCompanyNameById(companies, id) {
  if (!id) return "Sin compañía";
  const found = companies.find((c) => String(c.id) === String(id));
  return found?.nombre || "Compañía desconocida";
}

/** Mapa de colores opcional por nombre */
export const companyColorMap = {
  AMBETER: "#FF99FF",
  "BCBS TEXAS": "#89CFF0",
  "BRIGHT HEALTH": "#9EFF00",
  "FLORIDA BLUE": "#6FCFFF",
};
export function getCompanyColor(companies, compania_id) {
  const name = getCompanyNameById(companies, compania_id);
  return companyColorMap[name] || "#d3d3d3";
}
