// services/ingresos.js

// --- helpers numéricos ---
export const parseMoney = (v) => {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return isFinite(n) ? n : 0;
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
    const p = String(periodo).toUpperCase();
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
  
  // ¿Retirada?  -> vigente === false  OR  fecha_retiro != null/''/"null"/"undefined"
  const isCoberturaRetirada = (c = {}, fallback = {}) => {
    const vigente = c?.vigente ?? fallback?.vigente;
    const fr = c?.fecha_retiro ?? fallback?.fecha_retiro;
    const hayFechaRetiro =
      fr !== null && fr !== undefined && String(fr).trim() !== "" && String(fr).toLowerCase() !== "null";
    return vigente === false || hayFechaRetiro;
  };
  
  // Contabilizable = existe al menos UNA cobertura NO retirada
  export const isMemberContabilizable = (m = {}) => {
    const lista = Array.isArray(m.coberturas)
      ? m.coberturas
      : [{ vigente: m.vigente, fecha_retiro: m.fecha_retiro }];
  
    return lista.some((c) => !isCoberturaRetirada(c, m));
  };
  
  // ingreso anual: acepta varios nombres y también en m.cliente
  export const getIngresoAnual = (m = {}) => {
    const v =
      m.ingreso_anual ??
      m.ingresoAnual ??
      m.ingreso ??
      m.incomeAnnual ??
      m?.cliente?.ingreso_anual ??
      0;
    return parseMoney(v);
  };
  
  // Suma de ingresos de miembros NO retirados
  export const calcIngresoFamiliar = (members = []) =>
    (Array.isArray(members) ? members : [])
      .filter(isMemberContabilizable)
      .reduce((acc, m) => acc + getIngresoAnual(m), 0);
  // services/ingresos.js

// Sanitiza mientras se escribe: solo dígitos y UN punto decimal
export const sanitizeMoneyInput = (raw) => {
    if (raw == null) return "";
    let s = String(raw).replace(/[^\d.]/g, "");
    const parts = s.split(".");
    if (parts.length > 2) {
      s = parts.shift() + "." + parts.join(""); // deja solo el primer punto
    }
    // evita ceros a la izquierda tipo "0003"
    s = s.replace(/^0+(?=\d)/, "0");
    return s;
  };
  
  // Formatea al salir del input: 2 decimales, sin símbolo
  export const formatMoney2 = (raw) => {
    const n = Number(String(raw).replace(/[^\d.-]/g, ""));
    if (!isFinite(n)) return "";
    return n.toFixed(2);
  };
  