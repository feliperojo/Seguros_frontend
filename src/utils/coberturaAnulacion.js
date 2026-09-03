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

export function esCoberturaAnulada(c = {}) {
  if (tieneFechaAnulacion(c)) return true;
  return String(c.cobertura_definida || "").trim().toLowerCase() === "anulado";
}

const isTomador = (m = {}) => {
  const v1 = String(m.tipo || "").toLowerCase();
  const v2 = String(m.parentesco || "").toLowerCase();
  return v1 === "tomador" || v2 === "tomador";
};

const esActivoFalse = (v) => v === false || v === "false" || v === 0 || v === "0";

/**
 * True si una cobertura (salud en raíz o dental anidada) puede anularse
 * (GF terminado, fecha futura, sin retiro ni anulación previa).
 * `permitirTomador`: true para Dental MS (el tomador sí puede anular dental).
 */
export function puedeAnularInscripcionCobertura(
  coverage = {},
  {
    estadoActual = null,
    readOnly = false,
    member = null,
    permitirTomador = false,
  } = {}
) {
  if (readOnly) return false;
  if (!permitirTomador && isTomador(member ?? coverage)) return false;
  if (!esGrupoFamiliarTerminado(estadoActual)) return false;
  if (esActivoFalse(coverage.activo)) return false;
  if (tieneFechaAnulacion(coverage)) return false;
  if (hasFecha(coverage.fecha_retiro)) return false;

  const covId = coverage.cobertura_id ?? getCoberturaId(coverage);
  if (!covId) return false;

  return isFechaActivacionPendiente(
    coverage.fecha_activacion ?? coverage?.cobertura?.fecha_activacion
  );
}

/** Salud MS u otro producto con campos en la raíz del miembro. */
export function puedeAnularInscripcion(
  member = {},
  { estadoActual = null, readOnly = false } = {}
) {
  return puedeAnularInscripcionCobertura(member, {
    estadoActual,
    readOnly,
    member,
  });
}

/** Cobertura Dental MS anidada en `member.coberturaDental`. */
export function puedeAnularInscripcionDental(
  member = {},
  { estadoActual = null, readOnly = false } = {}
) {
  const dental = member?.coberturaDental;
  if (!dental?.cobertura_id) return false;
  return puedeAnularInscripcionCobertura(dental, {
    estadoActual,
    readOnly,
    member,
    permitirTomador: true,
  });
}

/** Pendiente de activación (aún no es retiro ni anulación). */
export function esInscripcionPendienteDeActivacion(c = {}) {
  if (esActivoFalse(c.activo)) return false;
  if (tieneFechaAnulacion(c)) return false;
  if (hasFecha(c.fecha_retiro)) return false;
  return isFechaActivacionPendiente(c.fecha_activacion);
}
