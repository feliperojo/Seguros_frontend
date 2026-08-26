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

export const isDentalCoberturaTipo = (tipo = "") => {
  const norm = normalizeCoberturaTipo(tipo).toLowerCase();
  if (!norm) return false;
  return (
    norm === COBERTURA_TIPO_DENTAL_MS.toLowerCase() ||
    norm === "plan dental" ||
    norm === "seguro dental" ||
    norm === "dental" ||
    norm.includes("dental")
  );
};

export const isSaludCoberturaTipo = (tipo = "") =>
  !isDentalCoberturaTipo(tipo);

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
