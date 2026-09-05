// services/companies.js
import apiRequest from "./api";
import {
  isDentalMsCoberturaTipo,
  normalizeCoberturaTipo,
} from "../constants/coberturaTipos";

/**
 * Catálogo de productos configurables por compañía.
 * key = query/filtro; flag = columna BD.
 */
export const COMPANIA_PRODUCTOS = [
  {
    key: "salud",
    flag: "aplica_salud",
    label: "Salud",
    short: "Salud",
    defaultOn: true,
    strict: false,
  },
  {
    key: "dental_ms",
    flag: "aplica_dental_ms",
    label: "Dental MS",
    short: "Dental MS",
    defaultOn: false,
    strict: true,
  },
  {
    key: "plan_dental",
    flag: "aplica_plan_dental",
    label: "Plan Dental",
    short: "Plan Dental",
    defaultOn: true,
    strict: false,
  },
  {
    key: "vision",
    flag: "aplica_vision",
    label: "Vision",
    short: "Vision",
    defaultOn: true,
    strict: false,
  },
  {
    key: "vida",
    flag: "aplica_vida",
    label: "Plan de vida",
    short: "Vida",
    defaultOn: true,
    strict: false,
  },
  {
    key: "descuentos",
    flag: "aplica_descuentos",
    label: "Plan de Descuentos",
    short: "Descuentos",
    defaultOn: true,
    strict: false,
  },
];

const PRODUCTO_BY_KEY = COMPANIA_PRODUCTOS.reduce((acc, p) => {
  acc[p.key] = p;
  return acc;
}, {});

/** Aliases de producto → key canónica */
const PRODUCTO_ALIASES = {
  dentalms: "dental_ms",
  dental_privado: "plan_dental",
  dentalprivado: "plan_dental",
};

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

export function normalizeProductoKey(producto = null) {
  if (producto == null || producto === "") return null;
  const raw = String(producto).trim().toLowerCase();
  if (!raw) return null;
  if (PRODUCTO_BY_KEY[raw]) return raw;
  return PRODUCTO_ALIASES[raw] || null;
}

/**
 * Mapea cobertura_tipo (label libre) → key de producto para filtrar compañías.
 */
export function resolveProductoKeyFromCoberturaTipo(tipo = null) {
  const norm = normalizeCoberturaTipo(tipo);
  if (!norm) return "salud";

  if (isDentalMsCoberturaTipo(norm)) return "dental_ms";

  const lower = norm.toLowerCase();
  if (lower.includes("vision") || lower.includes("visión")) return "vision";
  if (lower.includes("vida")) return "vida";
  if (lower.includes("descuento")) return "descuentos";
  // Plan Dental / Seguro dental (no MS)
  if (lower.includes("dental")) return "plan_dental";
  if (
    lower.includes("salud") ||
    lower.includes("medico") ||
    lower.includes("médico") ||
    lower.includes("obama") ||
    lower === "seguro medico obama"
  ) {
    return "salud";
  }

  return "salud";
}

/**
 * Filtra compañías por producto (salud / dental_ms / plan_dental / vision / vida / descuentos).
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

  const key = normalizeProductoKey(producto);
  if (!key) return list;

  const meta = PRODUCTO_BY_KEY[key];
  if (!meta) return list;

  const { flag, strict } = meta;

  list = list.filter((c) => {
    if (String(c?.id) === String(includeId)) return true;
    if (strict) return hasFlag(c, flag);
    // Compat: si el flag aún no existe en BD/respuesta, no ocultar.
    if (c?.[flag] === undefined || c?.[flag] === null) return true;
    return hasFlag(c, flag);
  });

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
