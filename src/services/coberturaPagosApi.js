import apiRequest from "./api";

/**
 * Consulta si ya existen pagos generados (pago_poliza) para un periodo YYYY-MM.
 * GET /cobertura/pagos/existe?periodo=YYYY-MM
 *
 * @param {string} periodo - "YYYY-MM"
 * @returns {Promise<{ periodo: string, exists: boolean, count: number | null }>}
 */
export async function fetchPagosExistForPeriodo(periodo) {
  if (!periodo || typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo.trim())) {
    throw new Error("periodo debe ser YYYY-MM");
  }
  const q = encodeURIComponent(periodo.trim());
  const res = await apiRequest(`cobertura/pagos/existe?periodo=${q}`, "GET");
  const raw = res?.data ?? res ?? {};
  return {
    periodo: raw.periodo ?? periodo.trim(),
    exists: Boolean(raw.exists),
    count: typeof raw.count === "number" ? raw.count : raw.count != null ? Number(raw.count) : null,
  };
}
