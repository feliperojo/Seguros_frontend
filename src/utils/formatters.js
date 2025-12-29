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

/**
 * Normaliza una fecha a formato YYYY-MM-DD para inputs type="date"
 * Evita problemas de zona horaria al extraer solo la parte de la fecha
 * sin convertir a objeto Date que puede alterar el día
 * 
 * @param {string|Date|null|undefined} fecha - Fecha en cualquier formato
 * @returns {string} Fecha en formato YYYY-MM-DD o cadena vacía si no es válida
 */
export const normalizeDateForInput = (fecha) => {
  if (!fecha) return "";
  
  // Si ya está en formato YYYY-MM-DD, devolverlo directamente
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  
  // Si es un string ISO (ej: "2024-01-15T00:00:00.000Z" o "2024-01-15T00:00:00")
  // extraer solo la parte de la fecha para evitar problemas de zona horaria
  if (typeof fecha === "string") {
    // Intentar extraer YYYY-MM-DD del string (incluye casos con T y sin T)
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
    if (match) {
      // Validar que la fecha sea válida
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
    
    // Si tiene T, extraer solo la parte de la fecha
    if (fecha.includes("T")) {
      const datePart = fecha.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    }
  }
  
  // Si es un objeto Date, usar métodos locales
  // Nota: Si el Date fue creado desde un string ISO, podría haber problemas de zona horaria
  // pero en ese caso debería haberse manejado antes como string
  if (fecha instanceof Date) {
    if (isNaN(fecha.getTime())) return "";
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // Último recurso: intentar parsear como string que no sea ISO
  // Solo para formatos no estándar (MM/DD/YYYY, DD/MM/YYYY, etc.)
  if (typeof fecha === "string") {
    const d = new Date(fecha);
    if (!isNaN(d.getTime())) {
      // Para formatos no ISO, usar métodos locales ya que no hay forma de saber
      // si el string original representaba una fecha local o UTC
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  
  return "";
};

/**
 * Formatea una fecha para mostrar en la interfaz
 * Maneja correctamente fechas ISO (YYYY-MM-DD) para evitar problemas de zona horaria
 * que pueden causar que se muestre un día menos
 * 
 * @param {string|Date|null|undefined} dateString - Fecha en cualquier formato
 * @param {string} locale - Locale para formatear (default: "es-ES")
 * @returns {string} Fecha formateada o "-" si no es válida
 */
export const formatDateForDisplay = (dateString, locale = "es-ES") => {
  if (!dateString) return "-";
  
  try {
    let date;
    
    // Si la fecha viene en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)
    // parsearla manualmente como fecha local para evitar problemas de zona horaria
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(dateString)) {
      // Extraer año, mes y día del string ISO
      const [datePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      
      // Validar que los valores sean válidos
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // Crear fecha como fecha local (sin conversión UTC)
        date = new Date(year, month - 1, day);
      } else {
        return dateString;
      }
    } else if (dateString instanceof Date) {
      // Si ya es un objeto Date, validar que sea válido
      if (isNaN(dateString.getTime())) {
        return "-";
      }
      date = dateString;
    } else {
      // Para otros formatos, intentar parsear con el constructor estándar
      date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
    }
    
    // Formatear usando métodos locales para evitar problemas de zona horaria
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch {
    // Si falla, devolver el string original o "-"
    return typeof dateString === 'string' ? dateString : "-";
  }
};
