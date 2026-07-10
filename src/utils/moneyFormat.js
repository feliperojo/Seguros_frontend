// src/utils/moneyFormat.js

// ⚙️ Configuración centralizada
// Si algún día cambias de formato, lo haces AQUÍ.
export const MONEY_CONFIG = {
    locale: "es-CO",       // Locale para Intl.NumberFormat
    currency: "COP",       // Moneda por defecto (puedes cambiarla o ignorarla)
    decimals: 2,           // Número de decimales
    useCurrencySymbol: false, // true => muestra símbolo de moneda con Intl
  
    // Separadores usados en el texto que ve/escribe el usuario
    thousandSeparator: ".", // 1.234.567
    decimalSeparator: ",",  // 1.234,56
  };
  
  /**
   * Normaliza un valor numérico a un número con N decimales.
   * Útil antes de guardar/enviar al backend.
   *
   * @param {number|string|null|undefined} value
   * @param {object} options
   * @returns {number|null}
   */
  export function normalizeMoney(value, options = {}) {
    const cfg = { ...MONEY_CONFIG, ...options };
  
    if (value === null || value === undefined || value === "") {
      return null;
    }
  
    const num = typeof value === "number" ? value : Number(String(value));
    if (!Number.isFinite(num)) {
      return null;
    }
  
    const factor = Math.pow(10, cfg.decimals);
    return Math.round(num * factor) / factor;
  }
  
  /**
   * Formatea un número para mostrarlo en pantalla como texto,
   * aplicando locale / separadores / símbolo de moneda.
   *
   * NO uses el resultado para cálculos, es solo presentación.
   *
   * @param {number|string|null|undefined} value
   * @param {object} options
   * @returns {string}
   */
  export function formatMoney(value, options = {}) {
    const cfg = { ...MONEY_CONFIG, ...options };
  
    if (value === null || value === undefined || value === "") {
      return "";
    }
  
    let num;
    if (typeof value === "number") {
      num = value;
    } else {
      // Intento básico de convertir string a número
      num = Number(String(value).replace(",", "."));
    }
  
    if (!Number.isFinite(num)) {
      return "";
    }
  
    // Opcionalmente normalizamos a N decimales antes de formatear
    num = normalizeMoney(num, cfg);
    if (num === null) return "";
  
    const formatter = new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
      ...(cfg.useCurrencySymbol
        ? { style: "currency", currency: cfg.currency }
        : { style: "decimal" }),
    });
  
    return formatter.format(num);
  }
  
  /**
   * Convierte un texto introducido por el usuario (con puntos, comas, símbolo, etc.)
   * a un número crudo (ej: "1.200.000,50" => 1200000.5).
   *
   * Ideal para usar en onChange de inputs ANTES de guardar en el estado.
   *
   * @param {string|null|undefined} input
   * @param {object} options
   * @returns {number|null}
   */
  export function parseMoney(input, options = {}) {
    const cfg = { ...MONEY_CONFIG, ...options };
  
    if (input === null || input === undefined) {
      return null;
    }
  
    let text = String(input).trim();
    if (text === "") {
      return null;
    }
  
    // 1) Eliminar todo lo que no sea dígito, separador decimal/miles o signo -
    const allowedChars = new RegExp(
      `[^0-9\\${cfg.decimalSeparator}\\${cfg.thousandSeparator}-]`,
      "g"
    );
    text = text.replace(allowedChars, "");
  
    if (text === "") {
      return null;
    }
  
    // 2) Eliminar separadores de miles
    if (cfg.thousandSeparator) {
      const ts = cfg.thousandSeparator;
      const reTs = new RegExp(`\\${ts}`, "g");
      text = text.replace(reTs, "");
    }
  
    // 3) Reemplazar separador decimal por punto para que JS lo entienda
    if (cfg.decimalSeparator && cfg.decimalSeparator !== ".") {
      const ds = cfg.decimalSeparator;
      const reDs = new RegExp(`\\${ds}`, "g");
      // Por si el usuario escribe más de un separador decimal,
      // nos quedamos con el ÚLTIMO como separador real.
      const parts = text.split(reDs);
      if (parts.length > 1) {
        const decimals = parts.pop(); // lo que va después del último separador
        text = parts.join("") + "." + decimals;
      }
    }
  
    const num = Number(text);
    if (!Number.isFinite(num)) {
      return null;
    }
  
    return num;
  }
  
  /**
   * Helper combinado: parsea texto de entrada y lo normaliza a N decimales.
   * Útil si quieres algo listo para guardar.
   *
   * @param {string|null|undefined} input
   * @param {object} options
   * @returns {number|null}
   */
  export function parseAndNormalizeMoney(input, options = {}) {
    const parsed = parseMoney(input, options);
    if (parsed === null) return null;
    return normalizeMoney(parsed, options);
  }
  
  // Export por defecto para poder usar:
  // import moneyFormat from "../utils/moneyFormat";
  export default {
    MONEY_CONFIG,
    formatMoney,
    parseMoney,
    normalizeMoney,
    parseAndNormalizeMoney,
  };
  