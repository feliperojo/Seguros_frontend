// services/ingresos.js

export const parseMoney = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;

  let s = String(v).trim();
  if (!s) return 0;

  s = s.replace(/[^\d.,-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
 const commaCount = (s.match(/,/g) || []).length;
 const dotCount   = (s.match(/\./g) || []).length;

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.replace(new RegExp("\\" + thouSep, "g"), "");
    s = s.replace(decSep, ".");

 } else if (hasComma) {
   if (commaCount > 1) {
     // último como decimal, anteriores como miles
     const last = s.lastIndexOf(",");
     s = s.slice(0, last).replace(/,/g, "") + "." + s.slice(last + 1).replace(/,/g, "");
   } else {
     s = s.replace(/\./g, "").replace(",", ".");
   }
 } else if (hasDot) {
   if (dotCount > 1) {
     // último como decimal, anteriores como miles
     const last = s.lastIndexOf(".");
     s = s.slice(0, last).replace(/\./g, "") + "." + s.slice(last + 1).replace(/\./g, "");
   } else {
     s = s.replace(/,/g, "");
   }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

  
  const nfES = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  // Para mostrar en pantalla (labels, readOnly, totales)
  export const formatMoneyDisplay = (value) => {
    const n = parseMoney(value);
    return nfES.format(n);
  };
  
  // Sanitiza mientras se escribe: permite punto o coma (un solo separador)
  export const sanitizeMoneyInput = (raw) => {
    if (raw == null) return "";
    let s = String(raw).replace(/[^\d.,]/g, "");
  
  
   const commaCount = (s.match(/,/g) || []).length;
   const dotCount   = (s.match(/\./g) || []).length;
   // Si solo hay comas y son varias: deja la ÚLTIMA como decimal, borra las anteriores
   if (commaCount > 1 && dotCount === 0) {
     const last = s.lastIndexOf(",");
     s = s.slice(0, last).replace(/,/g, "") + "," + s.slice(last + 1).replace(/,/g, "");
   }
   // Si solo hay puntos y son varios: deja el ÚLTIMO como decimal, borra los anteriores
   if (dotCount > 1 && commaCount === 0) {
     const last = s.lastIndexOf(".");
     s = s.slice(0, last).replace(/\./g, "") + "." + s.slice(last + 1).replace(/\./g, "");
   }
   // Si hay de ambos tipos, no tocamos: lo resuelve parseMoney
  
    s = s.replace(/^0+(?=\d)/, "0");
    return s;
  };
  
  

  // 👉 NUEVO: factor anual según período
export const PERIOD_FACTOR = {
    "": 0,
    HOUR: 52 * 40,         // 40h/sem * 52 sem = 2080
    "WEEKLY P.TIME": 52,   // semanal (part-time/no) → es semanal igual
    WEEKLY: 52,
    BIWEEKLY: 26,
    MONTHLY: 12,
    ANNUAL: 1,
  };
  
  // 👉 NUEVO: permite sobreescribir horas/semana si algún día lo necesitas
  export const factorForPeriod = (periodo, { hoursPerWeek = 40 } = {}) => {
    if (!periodo) return 0;
    const p = String(periodo).trim().toUpperCase();
    if (p === "HOUR") return 52 * hoursPerWeek;
    return PERIOD_FACTOR[p] ?? 0;
  };
  
  // 👉 NUEVO: cálculo redondeado a 2 decimales
  export const computeAnnual = (periodo, ingresoPorPeriodo, opts) => {
    const per = parseMoney(ingresoPorPeriodo);
    const factor = factorForPeriod(periodo, opts);
    const annual = per * factor;
    return Number.isFinite(annual) ? Math.round(annual * 100) / 100 : 0;
  };
  
  // ¿Retirada para ingreso familiar? → solo si tiene fecha_retiro
  const isCoberturaRetirada = (c = {}, fallback = {}) => {
    const fr = c?.fecha_retiro ?? fallback?.fecha_retiro;
    if (fr === null || fr === undefined) return false;
    const s = String(fr).trim();
    return s !== "" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined";
  };

  // Contabilizable = al menos una cobertura sin fecha de retiro
  export const isMemberContabilizable = (m = {}) => {
    const lista = Array.isArray(m.coberturas)
      ? m.coberturas
      : [{ fecha_retiro: m.fecha_retiro }];

    return lista.some((c) => !isCoberturaRetirada(c, m));
  };
  

  
  export const calcIngresoFamiliar = (members = []) =>
    (Array.isArray(members) ? members : [])
      .filter(isMemberContabilizable)
      .reduce((acc, m) => acc + getIngresoAnual(m) + getIngresoOcasional(m), 0);
  
  


  
  // Formatea al salir del input: 2 decimales, sin símbolo
  export const formatMoney2 = (raw) => {
    const n = parseMoney(raw);
    if (!Number.isFinite(n)) return "";
    return nfES.format(n);
  };
  
  // Lee ingreso ocasional anual (campo persistido o cálculo desde período + monto)
export const getIngresoOcasional = (m = {}) => {
    const anualGuardado =
      parseMoney(
        m.ingreso_ocasional_anual ??
          m.ingresoOcasionalAnual ??
          m?.cliente?.ingreso_ocasional_anual ??
          m?.cliente?.ingresoOcasionalAnual ??
          ""
      ) || 0;
    if (anualGuardado) return anualGuardado;

    const v =
      m.ingreso_ocasional ??
      m.ingresoOcasional ??
      m.incomeOccasional ??
      m?.cliente?.ingreso_ocasional ??
      m?.cliente?.ingresoOcasional ??
      m?.cliente?.incomeOccasional ??
      null;

    const directo = parseMoney(v);
    if (directo) return directo;

    const periodo =
      m.periodo_ingreso_ocasional ?? m?.cliente?.periodo_ingreso_ocasional;
    const porPeriodo =
      m.ingreso_por_periodo_ocasional ??
      m.ingresoPorPeriodoOcasional ??
      m?.cliente?.ingreso_por_periodo_ocasional ??
      m?.cliente?.ingresoPorPeriodoOcasional ??
      "";

    return computeAnnual(periodo, porPeriodo) || 0;
  };
  
  // Si no hay anual explícito pero sí periodo + monto por periodo, lo calculamos.
  export const getIngresoAnual = (m = {}) => {
    let v =
      m.ingreso_anual ??
      m.ingresoAnual ??
      m.ingreso ??
      m.incomeAnnual ??
      m?.cliente?.ingreso_anual ??
      0;
  
    let n = parseMoney(v);
  
    // Fallback: calcular a partir de periodo + ingreso_por_periodo
    if (!n || n === 0) {
      const periodo =
        m.periodo_ingreso ?? m.periodo ?? m.incomePeriod ?? m?.cliente?.periodo_ingreso;
      const porPeriodo =
        m.ingreso_por_periodo ??
        m.ingresoPorPeriodo ??
        m.incomePerPeriod ??
        m?.cliente?.ingreso_por_periodo;
      if (periodo && porPeriodo != null) {
        n = computeAnnual(periodo, porPeriodo);
      }
    }
    return n;
  };
  