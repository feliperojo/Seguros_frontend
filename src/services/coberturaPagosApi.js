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

/**
 * Resumen de cobros de un año. Sin año, el backend usa el período vigente
 * de la zona horaria configurada en la aplicación.
 * GET /cobertura/pagos/resumen-anual?anio=YYYY
 */
export async function fetchResumenAnual(anio) {
  const q = anio ? `?anio=${encodeURIComponent(anio)}` : "";
  const res = await apiRequest(`cobertura/pagos/resumen-anual${q}`, "GET");
  return res?.data ?? res ?? {};
}

/**
 * Consulta de solo lectura de los pagos elegibles de un grupo familiar.
 * Sin año, el backend usa el año vigente de la zona horaria del negocio.
 * GET /cobertura/pagos/grupo-familiar/{id}?anio=YYYY
 */
export async function fetchPagosGrupoFamiliar(grupoFamiliarId, anio) {
  const params = new URLSearchParams();
  if (anio) params.set("anio", String(anio));
  const q = params.toString();
  const res = await apiRequest(
    `cobertura/pagos/grupo-familiar/${grupoFamiliarId}${q ? `?${q}` : ""}`,
    "GET"
  );
  return res?.data ?? res ?? {};
}

/**
 * Listado de cobros de un período. Mes y año son obligatorios.
 * GET /cobertura/pagos/listado?anio=YYYY&mes=MM
 */
export async function fetchListadoPagosPeriodo(anio, mes) {
  const mesNorm = String(mes).padStart(2, "0");
  const params = new URLSearchParams({
    anio: String(anio),
    mes: mesNorm,
  });
  const res = await apiRequest(`cobertura/pagos/listado?${params.toString()}`, "GET");
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}
