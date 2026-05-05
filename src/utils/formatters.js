// src/utils/formatters.js

/** Keep only digits */
export const onlyDigits = (s = "") => (s || "").toString().replace(/\D+/g, "");

/** Join a digit string into hyphenated groups, e.g. [3,2,4] -> 123-45-6789 */
export const chunkJoin = (digits, groups) => {
  let out = [];
  let idx = 0;
  for (const g of groups) {
    if (idx >= digits.length) break;
    out.push(digits.slice(idx, idx + g));
    idx += g;
  }
  return out.filter(Boolean).join("-");
};

/** SSN => 3-2-4 (e.g., 123-45-6789) */
export const formatSSN = (val = "") => {
  const d = onlyDigits(val).slice(0, 9);
  return chunkJoin(d, [3, 2, 4]);
};

/** USCIS A-Number => A123-456-789 (3-3-3 with 'A' prefix) */
export const formatUSCIS = (val = "") => {
  const d = onlyDigits(val).slice(0, 9);   // body is 9 digits
  const body = chunkJoin(d, [3, 3, 3]);
  return body ? `A${body.replace(/^/, "")}` : "A";
};

// --- Optional “unformat” helpers for API mapping ---
export const unformatSSN = (val = "") => onlyDigits(val).slice(0, 9);
export const unformatUSCIS = (val = "") => onlyDigits(val).slice(0, 9);

// ...lo que ya tienes arriba (onlyDigits, chunkJoin, formatSSN, formatUSCIS, etc.)

/** Teléfono US 3-3-4: 123-456-7890  */
export const formatPhone334 = (raw = "") => {
  const d = onlyDigits(raw).slice(0, 10);       // hasta 10 dígitos
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,10)}`;
};

/** Variante flexible 3-3-(ilimitado) (la que usabas en otro componente) */
export const formatPhoneFlexible = (raw = "") => {
  const d = onlyDigits(raw);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
};

/** Quitar guiones para enviar al backend */
export const unformatPhone = (raw = "") => onlyDigits(raw).slice(0, 15);

const isValidCalendarYmd = (year, month, day) => {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return false;
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
};

/**
 * Extrae año, mes y día (calendario local) de valores que vienen del API.
 * Soporta YYYY-MM-DD, ISO con T, MM-DD-YYYY y MM/DD/YYYY (respuesta nueva del backend).
 *
 * @param {string|Date|null|undefined} dateString
 * @returns {{ year: number, month: number, day: number }|null}
 */
const extractDateParts = (dateString) => {
  if (!dateString) return null;

  try {
    if (dateString instanceof Date) {
      if (isNaN(dateString.getTime())) return null;
      return {
        year: dateString.getFullYear(),
        month: dateString.getMonth() + 1,
        day: dateString.getDate(),
      };
    }

    if (typeof dateString !== "string") return null;

    const s = dateString.trim();
    if (!s) return null;

    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?!\d)/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (!isValidCalendarYmd(year, month, day)) return null;
      return { year, month, day };
    }

    // DD-MM-YYYY vs MM-DD-YYYY: si un grupo es > 12, es día o mes según el formato regional.
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = Number(m[3]);
      let month;
      let day;
      if (a > 12) {
        day = a;
        month = b;
      } else if (b > 12) {
        month = a;
        day = b;
      } else {
        month = a;
        day = b;
      }
      if (!isValidCalendarYmd(year, month, day)) return null;
      return { year, month, day };
    }

    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = Number(m[3]);
      let month;
      let day;
      if (a > 12) {
        day = a;
        month = b;
      } else if (b > 12) {
        month = a;
        day = b;
      } else {
        month = a;
        day = b;
      }
      if (!isValidCalendarYmd(year, month, day)) return null;
      return { year, month, day };
    }

    const date = new Date(s);
    if (isNaN(date.getTime())) return null;
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  } catch {
    return null;
  }
};

/**
 * Normaliza una fecha a YYYY-MM-DD para inputs type="date" y payloads al API.
 *
 * @param {string|Date|null|undefined} fecha
 * @returns {string} YYYY-MM-DD o cadena vacía
 */
export const normalizeDateForInput = (fecha) => {
  if (!fecha) return "";
  const parts = extractDateParts(fecha);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

/**
 * Convierte un valor de fecha del API en un Date a medianoche en hora local (sin hora).
 * Fechas con componente horario (T o "YYYY-MM-DD HH:mm") usan el instante y luego el día local.
 *
 * @param {string|Date|null|undefined} input
 * @returns {Date|null}
 */
export const parseApiDateToLocalDate = (input) => {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  // Auditorías / Laravel: "2026-05-01T00:00:00.000000Z" es un día civil, no un instante a colocar en local.
  // new Date(...Z) en medianoche UTC cambia el día en US/LATAM; usamos Y-M-D literal del prefijo ISO.
  const isoCivil = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)\d{2}:\d{2}/);
  if (isoCivil) {
    const year = Number(isoCivil[1]);
    const month = Number(isoCivil[2]);
    const day = Number(isoCivil[3]);
    if (isValidCalendarYmd(year, month, day)) {
      return new Date(year, month - 1, day);
    }
  }

  const looksLikeDateTime =
    s.includes("T") || /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s);
  if (looksLikeDateTime) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const parts = extractDateParts(s);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
};

/**
 * Formatea un objeto Date local a YYYY-MM-DD (p. ej. tras drag en calendario).
 *
 * @param {Date|null|undefined} date
 * @returns {string|null}
 */
export const formatDateToYmd = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Formatea una fecha para mostrar en la interfaz en formato mm-dd-yyyy
 * Maneja correctamente fechas ISO (YYYY-MM-DD) para evitar problemas de zona horaria
 * que pueden causar que se muestre un día menos
 * 
 * @param {string|Date|null|undefined} dateString - Fecha en cualquier formato
 * @param {string} locale - Locale para formatear (no usado, siempre retorna mm-dd-yyyy)
 * @returns {string} Fecha formateada en formato mm-dd-yyyy o "-" si no es válida
 */
export const formatDateForDisplay = (dateString, locale = "es-ES") => {
  const parts = extractDateParts(dateString);
  if (!parts) return "-";
  
  const monthStr = String(parts.month).padStart(2, "0");
  const dayStr = String(parts.day).padStart(2, "0");
  return `${monthStr}-${dayStr}-${parts.year}`;
};

/**
 * Formatea una fecha con hora para mostrar en formato mm-dd-yyyy hh:mm AM/PM
 * 
 * @param {string|Date|null|undefined} dateString - Fecha en cualquier formato
 * @returns {string} Fecha y hora formateada o "-" si no es válida
 */
export const formatDateTimeForDisplay = (dateString) => {
  if (!dateString) return "-";
  
  try {
    // Si el backend envía timestamps sin zona horaria (ej: "2026-04-01 13:55:00" o "2026-04-01T13:55:00"),
    // normalmente representan UTC. El parser nativo los interpreta como hora local y "corre" la hora.
    // Normalizamos esos casos a ISO UTC agregando "Z".
    const normalizeToUtcIsoIfNoTz = (raw) => {
      if (typeof raw !== "string") return raw;
      const s = raw.trim();
      // Ya tiene TZ explícita (Z o ±HH:MM) => no tocar
      if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return raw;
      // "YYYY-MM-DD HH:mm(:ss)?" o "YYYY-MM-DDTHH:mm(:ss)?"
      if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
        const iso = s.replace(" ", "T");
        return `${iso}Z`;
      }
      return raw;
    };

    const normalized = normalizeToUtcIsoIfNoTz(dateString);
    const parts = extractDateParts(dateString);
    if (!parts) {
      // Intentar parsear como fecha con hora
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return "-";
      
      const monthStr = String(date.getMonth() + 1).padStart(2, "0");
      const dayStr = String(date.getDate()).padStart(2, "0");
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 debería ser 12
      const hoursStr = String(hours).padStart(2, "0");
      
      return `${monthStr}-${dayStr}-${year} ${hoursStr}:${minutes} ${ampm}`;
    }
    
    // Si solo tenemos fecha, intentar obtener la hora del objeto Date original
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      const monthStr = String(parts.month).padStart(2, "0");
      const dayStr = String(parts.day).padStart(2, "0");
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, "0");
      
      return `${monthStr}-${dayStr}-${parts.year} ${hoursStr}:${minutes} ${ampm}`;
    }
    
    // Solo fecha sin hora
    const monthStr = String(parts.month).padStart(2, "0");
    const dayStr = String(parts.day).padStart(2, "0");
    return `${monthStr}-${dayStr}-${parts.year}`;
  } catch {
    return typeof dateString === 'string' ? dateString : "-";
  }
};

/**
 * Calcula la duración entre dos fechas y la formatea en días, horas y minutos.
 * Pensado para tareas terminadas: desde fecha inicio (creación/programada) hasta fecha fin.
 *
 * @param {string|Date|null|undefined} fechaInicio - Fecha de inicio
 * @param {string|Date|null|undefined} fechaFin - Fecha de fin
 * @returns {string} Ej: "2 días 3 h 45 min", "5 h 30 min", "45 min" o "—" si faltan fechas o son inválidas
 */
export const formatDurationBetweenDates = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) return "—";
  const start = typeof fechaInicio === "string" || typeof fechaInicio === "number" ? new Date(fechaInicio) : fechaInicio;
  const end = typeof fechaFin === "string" || typeof fechaFin === "number" ? new Date(fechaFin) : fechaFin;
  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }
  let ms = end.getTime() - start.getTime();
  if (ms < 0) return "—";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`);
  return parts.join(" ");
};

/**
 * Formatea una duración dada en minutos a texto "X días Y h Z min".
 * Útil para totales agregados en reportes.
 *
 * @param {number} totalMinutes - Duración total en minutos (>= 0)
 * @returns {string} Ej: "2 días 3 h 45 min", "5 h 30 min", "45 min"
 */
export const formatDurationFromMinutes = (totalMinutes) => {
  if (totalMinutes == null || Number.isNaN(totalMinutes) || totalMinutes < 0) return "—";
  const m = Math.floor(Number(totalMinutes));
  const minutes = m % 60;
  const totalHours = Math.floor(m / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  const parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`);
  return parts.join(" ");
};

/**
 * Formatea el tiempo dedicado de una tarea desde campos días/horas/minutos o tiempo_total_minutos.
 * Para detalle de tarea: usar tiempo_dias, tiempo_horas, tiempo_minutos (backend); fallback a tiempo_total_minutos.
 * @param {Object} tarea - Objeto con tiempo_dias?, tiempo_horas?, tiempo_minutos? o tiempo_total_minutos?
 * @returns {string} Ej: "0d 2h 45m", "1d 0h 30m", "—" si no hay datos
 */
export const formatTaskTimeDhm = (tarea) => {
  if (!tarea) return "—";
  const dias = Number(tarea.tiempo_dias);
  const horas = Number(tarea.tiempo_horas);
  const min = Number(tarea.tiempo_minutos);
  if (Number.isInteger(dias) && Number.isInteger(horas) && Number.isInteger(min) &&
      (dias > 0 || horas > 0 || min > 0)) {
    const parts = [];
    if (dias > 0) parts.push(`${dias}d`);
    if (horas > 0) parts.push(`${horas}h`);
    if (min > 0 || parts.length === 0) parts.push(`${min}m`);
    return parts.join(" ");
  }
  const totalMin = tarea.tiempo_total_minutos != null ? Number(tarea.tiempo_total_minutos) : NaN;
  if (!Number.isNaN(totalMin) && totalMin >= 0) {
    return formatDurationFromMinutes(totalMin);
  }
  return "—";
};

/**
 * Calcula la duración desde una fecha de inicio hasta ahora (o hasta una fecha fin).
 * Usado para "liquidación" de tiempo: desde inicio de la tarea hasta el momento de completar.
 * @param {string|Date} startDate - Fecha de inicio (ej. tarea.created_at, tarea.scheduled_date)
 * @param {string|Date} [endDate] - Fecha fin (por defecto: ahora)
 * @returns {{ dias: number, horas: number, minutos: number }}
 */
export const durationFromStartToEnd = (startDate, endDate = new Date()) => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return { dias: 0, horas: 0, minutos: 0 };
  }
  const totalMs = end - start;
  const totalMin = Math.floor(totalMs / (1000 * 60));
  const minutos = totalMin % 60;
  const totalHoras = Math.floor(totalMin / 60);
  const horas = totalHoras % 24;
  const dias = Math.floor(totalHoras / 24);
  return { dias, horas, minutos };
};

/**
 * Formatea dias/horas/minutos a "Xd Xh Xm" (solo lectura / liquidación).
 */
export const formatDhmString = ({ dias = 0, horas = 0, minutos = 0 }) => {
  const d = Number(dias) || 0;
  const h = Number(horas) || 0;
  const m = Number(minutos) || 0;
  if (d === 0 && h === 0 && m === 0) return "0m";
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
};
