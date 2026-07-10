// utils/groupCounters.js

const isEstadoSi = (estado) => {
  if (estado === null || estado === undefined || estado === "") return false;
  const lower = String(estado).toLowerCase().trim();
  return lower === "sí" || lower === "si" || lower === "yes";
};

const hasRetiro = (fechaRetiro) =>
  fechaRetiro !== null && fechaRetiro !== undefined && fechaRetiro !== "";

export const isActiveCoverage = (m = {}) => {
  if (m.activo === false) return false;
  if (hasRetiro(m.fecha_retiro)) return false;

  const list = Array.isArray(m.coberturas)
    ? m.coberturas
    : [{ estado_cobertura: m.estado_cobertura, fecha_retiro: m.fecha_retiro }];

  return list.some((c) => {
    if (hasRetiro(c.fecha_retiro ?? m.fecha_retiro)) return false;
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
    const notRetired = !hasRetiro(m.fecha_retiro);
    const inTaxes = isInTaxes(m);
    return isActive && notRetired && inTaxes;
  }).length;

export const countCoverageMembers = (members = []) =>
  members.filter(isActiveCoverage).length;

export const deriveCounts = (members = []) => ({
  taxes: countTaxesMembers(members),
  cobertura: countCoverageMembers(members),
});
