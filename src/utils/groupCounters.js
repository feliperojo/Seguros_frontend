// utils/groupCounters.js
export const isActiveCoverage = (m = {}) => {
    const list = Array.isArray(m.coberturas)
      ? m.coberturas
      : [{ estado_cobertura: m.estado_cobertura, fecha_retiro: m.fecha_retiro }];
    return list.some(
      (c) =>
        (c.estado_cobertura ?? m.estado_cobertura) === "Sí" &&
        (c.fecha_retiro === null || c.fecha_retiro === undefined || c.fecha_retiro === "")
    );
  };
  
  // Si en tu modelo existe un flag explícito de impuestos (ej. en_taxes / incluye_en_taxes),
  // úsalo; si no existe, cuenta todos por defecto.
  export const isInTaxes = (m = {}) => {
    if (typeof m.en_taxes === "boolean") return m.en_taxes;
    if (typeof m.in_taxes === "boolean") return m.in_taxes;
    if (typeof m.incluye_en_taxes === "boolean") return m.incluye_en_taxes;
    return true; // fallback: cuenta a todos si no hay flag
  };
  
  export const countTaxesMembers = (members = []) =>
    members.filter(isInTaxes).length;
  
  export const countCoverageMembers = (members = []) =>
    members.filter(isActiveCoverage).length;
  
  export const deriveCounts = (members = []) => ({
    taxes: countTaxesMembers(members),
    cobertura: countCoverageMembers(members),
  });
  