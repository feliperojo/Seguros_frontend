// utils/groupCounters.js

const isEstadoSi = (estado) => {
  if (estado === null || estado === undefined || estado === "") return false;
  const lower = String(estado).toLowerCase().trim();
  return lower === "sí" || lower === "si" || lower === "yes";
};

const hasFecha = (fecha) =>
  fecha !== null && fecha !== undefined && fecha !== "";

/**
 * Renovación pura: incluida en lote de renovación y sin cancelación real.
 * Esos miembros siguen contando en Personas en Cobertura / Taxes.
 */
const esRenovacionPura = (c = {}, fallback = {}) => {
  const fueRenovado = Boolean(c?.fue_renovado ?? fallback?.fue_renovado);
  if (!fueRenovado) return false;
  return !hasFecha(c?.fecha_cancelacion ?? fallback?.fecha_cancelacion);
};

/** Retiro real (excluye de conteos). Renovación pura no cuenta como retiro. */
const esRetiroReal = (fechaRetiro, c = {}, fallback = {}) => {
  if (esRenovacionPura(c, fallback)) return false;
  return hasFecha(fechaRetiro);
};

export const isActiveCoverage = (m = {}) => {
  if (m.activo === false) return false;
  if (esRetiroReal(m.fecha_retiro, m, m)) return false;

  const list = Array.isArray(m.coberturas)
    ? m.coberturas
    : [{
        estado_cobertura: m.estado_cobertura,
        fecha_retiro: m.fecha_retiro,
        fecha_cancelacion: m.fecha_cancelacion,
        fue_renovado: m.fue_renovado,
      }];

  return list.some((c) => {
    if (esRetiroReal(c.fecha_retiro ?? m.fecha_retiro, c, m)) {
      return false;
    }
    // Renovación pura: tuvo cobertura activa ese año — cuenta aunque el período esté cerrado
    if (esRenovacionPura(c, m)) return true;
    return isEstadoSi(c.estado_cobertura ?? m.estado_cobertura);
  });
};

// Si en tu modelo existe un flag explícito de impuestos (ej. en_taxes / incluye_en_taxes),
// úsalo; si no existe, cuenta todos por defecto.
export const isInTaxes = (m = {}) => {
  if (typeof m.en_taxes === "boolean") return m.en_taxes;
  if (typeof m.in_taxes === "boolean") return m.in_taxes;
  if (typeof m.incluye_en_taxes === "boolean") return m.incluye_en_taxes;
  return true;
};

export const countTaxesMembers = (members = []) =>
  members.filter((m) => {
    const isActive = m.activo !== false;
    const notRetired = !esRetiroReal(m.fecha_retiro, m, m);
    const inTaxes = isInTaxes(m);
    return isActive && notRetired && inTaxes;
  }).length;

export const countCoverageMembers = (members = []) =>
  members.filter(isActiveCoverage).length;

export const deriveCounts = (members = []) => ({
  taxes: countTaxesMembers(members),
  cobertura: countCoverageMembers(members),
});
