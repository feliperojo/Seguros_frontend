/**
 * Utilidades compartidas: agrupación mensual de pagos (misma lógica que informe de cartera)
 * e indicador de mora / riesgo según meses con generación distinta de "pagado".
 *
 * Criterio (por año de generación ya reflejado en `porMes`):
 * - Solo cuentan meses donde existe registro de pago generado (celda no nula).
 * - 1 o 2 meses con estado ≠ pagado → Mora
 * - 3 o más meses con estado ≠ pagado → Riesgo
 * - Todos los meses con registro están pagados → Al día
 */

const parseDateMs = (v) => {
  if (v == null || v === "") return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Lista de pagos de API → 12 celdas (ene–dic) para un año.
 * Prioriza el año del periodo del run (YYYY-MM); si no hay datos, usa el año más reciente en la lista.
 *
 * @param {Array<Object>} items - Filas de `cobertura/pagos/listado` ya filtradas por póliza/cliente/cobertura
 * @param {string|null} periodoRunPreferido - "YYYY-MM" opcional
 * @returns {{ year: number, porMes: Array<null|{estado: string, monto: number}>, itemsInYear: Array }}
 */
export function agruparPagosPorMesEnAnio(items, periodoRunPreferido) {
  const porMes = Array(12).fill(null);
  if (!Array.isArray(items) || items.length === 0) {
    const y =
      periodoRunPreferido &&
      typeof periodoRunPreferido === "string" &&
      /^\d{4}-\d{2}$/.test(periodoRunPreferido.trim())
        ? Number(periodoRunPreferido.trim().slice(0, 4))
        : new Date().getFullYear();
    return { year: y, porMes, itemsInYear: [] };
  }

  let year =
    periodoRunPreferido &&
    typeof periodoRunPreferido === "string" &&
    /^\d{4}-\d{2}$/.test(periodoRunPreferido.trim())
      ? Number(periodoRunPreferido.trim().slice(0, 4))
      : new Date().getFullYear();

  let itemsInYear = items.filter(
    (p) => typeof p?.fecha_pago === "string" && p.fecha_pago.startsWith(`${year}-`)
  );

  if (itemsInYear.length === 0) {
    const years = [
      ...new Set(
        items
          .map((p) => (typeof p?.fecha_pago === "string" ? p.fecha_pago.slice(0, 4) : ""))
          .filter((ys) => /^\d{4}$/.test(ys))
      ),
    ]
      .map(Number)
      .sort((a, b) => b - a);
    if (years.length > 0) {
      year = years[0];
      itemsInYear = items.filter(
        (p) => typeof p?.fecha_pago === "string" && p.fecha_pago.startsWith(`${year}-`)
      );
    }
  }

  const sorted = [...itemsInYear].sort(
    (a, b) => (parseDateMs(b?.fecha_pago) ?? 0) - (parseDateMs(a?.fecha_pago) ?? 0)
  );
  for (const p of sorted) {
    const fp = p?.fecha_pago;
    if (typeof fp !== "string" || fp.length < 7) continue;
    const mesIdx = parseInt(fp.split("-")[1], 10) - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;
    if (!porMes[mesIdx]) {
      porMes[mesIdx] = { estado: p.estado, monto: p.monto };
    }
  }

  return { year, porMes, itemsInYear };
}

/**
 * @param {Array<null|{ estado?: string, monto?: number }>} porMes - 12 posiciones
 * @returns {{ nivel: string, etiqueta: string, mesesImpagos: number, mesesConRegistro: number, titulo: string }}
 */
export function indicadorMorosidadPagosPorMes(porMes) {
  if (!Array.isArray(porMes) || porMes.length !== 12) {
    return {
      nivel: "sin_datos",
      etiqueta: "—",
      mesesImpagos: 0,
      mesesConRegistro: 0,
      titulo: "Sin datos de pagos por mes",
    };
  }

  let mesesConRegistro = 0;
  let mesesImpagos = 0;
  for (let i = 0; i < 12; i++) {
    const c = porMes[i];
    if (!c) continue;
    mesesConRegistro += 1;
    const e = String(c.estado ?? "").trim().toLowerCase();
    if (e !== "pagado") mesesImpagos += 1;
  }

  if (mesesConRegistro === 0) {
    return {
      nivel: "sin_generacion",
      etiqueta: "—",
      mesesImpagos: 0,
      mesesConRegistro: 0,
      titulo: "Sin registros de pago generados en el año consultado",
    };
  }

  if (mesesImpagos >= 3) {
    return {
      nivel: "riesgo",
      etiqueta: "Riesgo",
      mesesImpagos,
      mesesConRegistro,
      titulo: `${mesesImpagos} mes(es) con pago generado y estado distinto de pagado (≥3: riesgo)`,
    };
  }

  if (mesesImpagos >= 1) {
    return {
      nivel: "mora",
      etiqueta: "Mora",
      mesesImpagos,
      mesesConRegistro,
      titulo: `${mesesImpagos} mes(es) con pago generado sin estado pagado (1–2: mora)`,
    };
  }

  return {
    nivel: "al_dia",
    etiqueta: "Al día",
    mesesImpagos: 0,
    mesesConRegistro,
    titulo: "Todos los meses con registro de generación están pagados",
  };
}

/** Abreviaturas de mes (misma convención que informe de cartera / auditoría). */
export const PAGOS_INFORME_MONTH_ABBR = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
