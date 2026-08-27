/** Tipo canónico para Dental MS dentro de un Grupo Familiar de Salud */
export const COBERTURA_TIPO_DENTAL_MS = "Dental MS";

/** Tipos reconocidos como cobertura de salud MS */
export const COBERTURA_TIPOS_SALUD = [
  "Plan de salud",
  "SEGURO MEDICO OBAMA",
  "Seguro médico",
  "Seguro medico",
  "SALUD",
];

export const normalizeCoberturaTipo = (tipo = "") =>
  String(tipo ?? "").trim();

/**
 * Solo Dental MS (complemento de salud).
 * No incluye Plan Dental privado ni otros productos independientes.
 */
export const isDentalMsCoberturaTipo = (tipo = "") => {
  const norm = normalizeCoberturaTipo(tipo).toLowerCase();
  if (!norm) return false;
  return (
    norm === COBERTURA_TIPO_DENTAL_MS.toLowerCase() ||
    norm === "dentalms"
  );
};

/** Cualquier cobertura dental (MS o Plan Dental privado). */
export const isDentalCoberturaTipo = (tipo = "") => {
  const norm = normalizeCoberturaTipo(tipo).toLowerCase();
  if (!norm) return false;
  return (
    isDentalMsCoberturaTipo(norm) ||
    norm === "plan dental" ||
    norm === "seguro dental" ||
    norm === "dental" ||
    norm.includes("dental")
  );
};

/** No-dental (salud u otros productos privados: Vision, Vida, etc.). */
export const isSaludCoberturaTipo = (tipo = "") =>
  !isDentalCoberturaTipo(tipo);

/**
 * Producto principal del GF es Salud MS → aplica "Agregar Dental MS".
 * Plan Dental / Vision / Vida / Descuentos = productos privados independientes.
 */
export const isProductoSaludMs = (tipo = "") => {
  const norm = normalizeCoberturaTipo(tipo);
  if (!norm) return true;
  if (isDentalCoberturaTipo(norm)) return false;
  const lower = norm.toLowerCase();
  if (
    lower.includes("vision") ||
    lower.includes("visión") ||
    lower.includes("vida") ||
    lower.includes("descuento")
  ) {
    return false;
  }
  return (
    COBERTURA_TIPOS_SALUD.some((t) => t.toLowerCase() === lower) ||
    lower.includes("salud") ||
    lower.includes("medico") ||
    lower.includes("médico") ||
    lower.includes("obama")
  );
};

/** Salud MS activa en el modelo de miembro (campos raíz) */
export const memberTieneSaludMsActiva = (m = {}) => {
  if (m.activo === false) return false;
  if (m.vigente === false) return false;
  if (m.fecha_retiro) return false;
  if (m.fecha_anulacion) return false;
  const estado = String(m.estado_cobertura ?? "").toLowerCase();
  return estado === "sí" || estado === "si" || estado === "yes";
};

export const DENTAL_COVERAGE_FIELD_KEYS = [
  "codigo_poliza",
  "policy_number",
  "fecha_activacion",
  "ano_cobertura",
  "elegibilidad",
  "compania_id",
  "agente",
  "plan",
  "estado_cobertura",
  "pagador_id",
  "tipo_pago",
  "dia_pago",
  "precio",
];
