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
  
  // Si es un string ISO (ej: "2024-01-15T00:00:00.000Z"), extraer solo la parte de la fecha
  if (typeof fecha === "string" && fecha.includes("T")) {
    const datePart = fecha.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }
  
  // Si es un objeto Date, usar métodos que no dependen de zona horaria
  if (fecha instanceof Date) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // Intentar parsear como string y extraer la parte de la fecha
  if (typeof fecha === "string") {
    // Intentar extraer YYYY-MM-DD del string
    const match = fecha.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
    
    // Si no, intentar crear Date y usar métodos locales (último recurso)
    const d = new Date(fecha);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  
  return "";
};
