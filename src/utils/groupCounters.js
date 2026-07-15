// utils/groupCounters.js

const isEstadoSi = (estado) => {
  if (estado === null || estado === undefined || estado === "") return false;
  const lower = String(estado).toLowerCase().trim();
  return lower === "sí" || lower === "si" || lower === "yes";
};

const hasRetiro = (fechaRetiro) =>
  fechaRetiro !== null && fechaRetiro !== undefined && fechaRetiro !== "";

/** Cierre por renovación anual (no es retiro real). */
const esRenovacion = (motivoCancelacion) => {
  const motivo = String(motivoCancelacion ?? "").trim().toLowerCase();
  return motivo === "renovación" || motivo === "renovacion";
};

/** Retiro real (excluye de conteos). Renovación anual no cuenta como retiro. */
const esRetiroReal = (fechaRetiro, motivoCancelacion) => {
  if (esRenovacion(motivoCancelacion)) return false;
  return hasRetiro(fechaRetiro);
};

export const isActiveCoverage = (m = {}) => {
  if (m.activo === false) return false;
  if (esRetiroReal(m.fecha_retiro, m.motivo_cancelacion)) return false;

  const list = Array.isArray(m.coberturas)
    ? m.coberturas
    : [{
        estado_cobertura: m.estado_cobertura,
        fecha_retiro: m.fecha_retiro,
        motivo_cancelacion: m.motivo_cancelacion,
      }];

  return list.some((c) => {
    const motivo = c.motivo_cancelacion ?? m.motivo_cancelacion;
    if (esRetiroReal(c.fecha_retiro ?? m.fecha_retiro, motivo)) {
      return false;
    }
    // Renovado: tuvo cobertura ese año (período cerrado) — cuenta aunque estado sea "Cerrada"
    if (esRenovacion(motivo)) return true;
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
    const notRetired = !esRetiroReal(m.fecha_retiro, m.motivo_cancelacion);
    const inTaxes = isInTaxes(m);
    return isActive && notRetired && inTaxes;
  }).length;

export const countCoverageMembers = (members = []) =>
  members.filter(isActiveCoverage).length;

export const deriveCounts = (members = []) => ({
  taxes: countTaxesMembers(members),
  cobertura: countCoverageMembers(members),
});
