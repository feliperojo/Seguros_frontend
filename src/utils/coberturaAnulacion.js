import { isFechaActivacionPendiente } from "./estadoPoliza";
import { esGrupoFamiliarTerminado } from "../constants/estadosGrupoFamiliar";
import { getCoberturaId } from "./coberturas";

const hasFecha = (v) => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && s.toLowerCase() !== "null";
};

export function tieneFechaAnulacion(m = {}) {
  return hasFecha(m.fecha_anulacion ?? m?.cobertura?.fecha_anulacion);
}

const isTomador = (m = {}) => {
  const v1 = String(m.tipo || "").toLowerCase();
  const v2 = String(m.parentesco || "").toLowerCase();
  return v1 === "tomador" || v2 === "tomador";
};

const esActivoFalse = (v) => v === false || v === "false" || v === 0 || v === "0";

/**
 * True si la cobertura está pendiente de activación y puede anularse
 * (GF terminado, fecha futura, sin retiro ni anulación previa).
 */
export function puedeAnularInscripcion(
  member = {},
  { estadoActual = null, readOnly = false } = {}
) {
  if (readOnly) return false;
  if (isTomador(member)) return false;
  if (!esGrupoFamiliarTerminado(estadoActual)) return false;
  if (esActivoFalse(member.activo)) return false;
  if (tieneFechaAnulacion(member)) return false;
  if (hasFecha(member.fecha_retiro)) return false;
  if (!getCoberturaId(member)) return false;

  return isFechaActivacionPendiente(
    member.fecha_activacion ?? member?.cobertura?.fecha_activacion
  );
}

/** Pendiente de activación (aún no es retiro ni anulación). */
export function esInscripcionPendienteDeActivacion(c = {}) {
  if (esActivoFalse(c.activo)) return false;
  if (tieneFechaAnulacion(c)) return false;
  if (hasFecha(c.fecha_retiro)) return false;
  return isFechaActivacionPendiente(c.fecha_activacion);
}
