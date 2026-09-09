/** Claves alineadas con Configurador → coverage_fields_by_tipo */
export const COVERAGE_CONFIG_FIELD_KEYS = [
  "codigo_poliza",
  "policy_number",
  "fecha_activacion",
  "ano_cobertura",
  "elegibilidad",
  "compania_id",
  "agente",
  "plan",
  "metal",
  "red",
  "estado_cobertura",
  "pagador_id",
  "tipo_pago",
  "dia_pago",
  "precio",
  "grupo",
];

/**
 * Misma lógica que Configurador / TomaDeDatos:
 * sin config → todos visibles; con enabledFields → respetar (incluso []).
 */
export const resolveEnabledFields = (configByTipo, tipo) => {
  const entry = configByTipo?.[tipo];
  if (!entry || !Array.isArray(entry.enabledFields)) {
    return null;
  }
  return entry.enabledFields;
};

export const shouldShowConfiguredField = (enabledFields, fieldKey) => {
  if (enabledFields === null || enabledFields === undefined) return true;
  return enabledFields.includes(fieldKey);
};

/** El API puede devolver { value: { Tipo: { enabledFields } } } o el objeto por tipo. */
export const parseSystemConfigByTipo = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const byTipo = raw.value !== undefined ? raw.value : raw;
  if (!byTipo || typeof byTipo !== "object") return null;
  return byTipo;
};
