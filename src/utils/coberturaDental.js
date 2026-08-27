import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalCoberturaTipo,
  isDentalMsCoberturaTipo,
  isProductoSaludMs,
  isSaludCoberturaTipo,
} from "../constants/coberturaTipos";

const date10 = (v) => (v ? String(v).slice(0, 10) : "");

/** Campos de cobertura (salud o dental) desde API */
export const mapCoberturaApiToFields = (cov = {}) => ({
  cobertura_id: cov.id ?? null,
  estado_cobertura: cov.estado_cobertura || "Sí",
  cobertura_tipo: cov.cobertura_tipo || "Plan de salud",
  ano_cobertura: cov.ano_cobertura || new Date().getFullYear(),
  fecha_activacion: date10(cov.fecha_activacion ?? cov.fechaActivacion ?? null),
  fecha_creacion_cobertura: date10(cov.created_at ?? cov.fecha_creacion ?? null),
  plan: cov.plan ?? null,
  metal: cov.metal ?? null,
  red: cov.red ?? null,
  codigo_poliza: cov.codigo_poliza ?? cov.id_poliza ?? "",
  policy_number: cov.policy_number ?? "",
  elegibilidad: cov.elegibilidad ?? "",
  precio: cov.precio ?? "",
  tipo_pago: cov.tipo_pago ?? null,
  dia_pago: cov.dia_pago ?? "",
  nota_cancel: cov.nota_cancel ?? "",
  grupo: cov.grupo ?? "",
  compania_id: cov.compania_id ?? null,
  agente: cov.agente ?? "",
  pagador_id: cov.pagador_id ?? null,
  fecha_cancelacion: date10(cov.fecha_cancelacion ?? cov.fechaCancelacion ?? null),
  fecha_retiro: date10(cov.fecha_retiro ?? cov.fechaRetiro ?? null),
  fecha_anulacion: date10(cov.fecha_anulacion ?? cov.fechaAnulacion ?? null),
  motivo_anulacion: cov.motivo_anulacion ?? "",
  nota_anulacion: cov.nota_anulacion ?? "",
  nota_retiro: cov.nota_retiro ?? "",
  motivo_cancelacion: cov.motivo_cancelacion ?? "",
  motivo_retiro: cov.motivo_retiro ?? "",
  fue_renovado: !!cov.fue_renovado,
  cobertura_definida: cov.cobertura_definida ?? "",
  activo: cov.activo !== undefined && cov.activo !== null ? cov.activo : true,
  vigente: cov.vigente !== undefined && cov.vigente !== null ? cov.vigente : true,
});

export const emptyCoberturaDental = (saludMember = {}) => ({
  cobertura_id: null,
  cobertura_tipo: COBERTURA_TIPO_DENTAL_MS,
  estado_cobertura: "Sí",
  ano_cobertura: saludMember.ano_cobertura || new Date().getFullYear(),
  elegibilidad: saludMember.elegibilidad || "",
  agente: saludMember.agente || "",
  tipo_pago: saludMember.tipo_pago || "",
  dia_pago: saludMember.dia_pago ?? "",
  pagador_id: saludMember.pagador_id ?? null,
  activo: true,
  vigente: true,
});

/** Campos de agente/pago a heredar de salud al crear Dental MS (editables después). */
export const pickPagoFieldsFromSalud = (saludMember = {}) => ({
  agente: saludMember.agente || "",
  tipo_pago: saludMember.tipo_pago || "",
  dia_pago:
    saludMember.dia_pago === undefined || saludMember.dia_pago === null
      ? ""
      : String(saludMember.dia_pago),
  pagador_id:
    saludMember.pagador_id === undefined || saludMember.pagador_id === ""
      ? null
      : saludMember.pagador_id,
});

export {
  isDentalCoberturaTipo,
  isDentalMsCoberturaTipo,
  isProductoSaludMs,
  isSaludCoberturaTipo,
  COBERTURA_TIPO_DENTAL_MS,
};
