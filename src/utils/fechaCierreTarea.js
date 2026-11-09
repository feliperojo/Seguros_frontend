import { formatDateForDisplay } from "./formatters.js";

export const MENSAJE_CIERRE_NO_DISPONIBLE = "Fecha de cierre no disponible";

/**
 * Contrato de completed_at: Carbon::toIso8601String() (ATOM).
 * YYYY-MM-DDTHH:mm:ss seguido de Z o ±HH:MM. Sin fracciones de segundo.
 */
const TIMESTAMP_CIERRE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))$/;

function esBisiesto(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function diasDelMes(year, month) {
  const dias = [0, 31, esBisiesto(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[month] ?? 0;
}

function timestampDeCierreValido(valor) {
  if (typeof valor !== "string") return false;
  const partes = TIMESTAMP_CIERRE.exec(valor);
  if (!partes) return false;

  const year = Number(partes[1]);
  const month = Number(partes[2]);
  const day = Number(partes[3]);
  const hour = Number(partes[4]);
  const minute = Number(partes[5]);
  const second = Number(partes[6]);
  if (month < 1 || month > 12 || day < 1 || day > diasDelMes(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (partes[7] !== "Z") {
    const offsetHora = Number(partes[8]);
    const offsetMinuto = Number(partes[9]);
    if (offsetHora > 23 || offsetMinuto > 59) return false;
  }
  return true;
}

/**
 * Cierre almacenado en completed_at.
 * Devuelve el valor original si el timestamp completo es válido; si no, null.
 * No usa comentarios, updated_at, creación ni la hora actual.
 */
export function fechaCierreReal(tarea) {
  const valor = tarea?.completed_at;
  if (typeof valor === "string" && valor.trim() === "") return null;
  if (!timestampDeCierreValido(valor)) return null;
  return valor;
}

export function textoFechaCierre(tarea) {
  const cierre = fechaCierreReal(tarea);
  if (cierre == null) return MENSAJE_CIERRE_NO_DISPONIBLE;
  return formatDateForDisplay(cierre);
}

/**
 * El detalle solo compensa una bitácora ausente.
 * Un completed_at null ya es el dato del contrato y no justifica otra consulta.
 */
export function debeEnriquecerTareaTerminada(tarea, tieneBitacora) {
  if (tarea?.id == null) return false;
  return tieneBitacora !== true;
}
