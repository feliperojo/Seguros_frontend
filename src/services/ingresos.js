// services/ingresos.js

// --- helpers numéricos ---
export const parseMoney = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (v == null) return 0;
  
    let s = String(v).trim();
    if (!s) return 0;
  
    // Quita símbolos y espacios, conserva solo dígitos, coma, punto y signo
    s = s.replace(/[^\d.,-]/g, "");
  
    // Si hay coma y punto, el separador decimal es el ÚLTIMO que aparezca
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      const decSep = lastComma > lastDot ? "," : ".";
      const thouSep = decSep === "," ? "." : ",";
  
      // quita miles y normaliza decimal a punto JS
      s = s.replace(new RegExp("\\" + thouSep, "g"), "");
      s = s.replace(decSep, ".");
    } else if (hasComma) {
      // solo comas => coma decimal (es-CO)
      s = s.replace(/\./g, ""); // por si viniesen puntos "decorativos"
      s = s.replace(",", ".");
    } else {
      // solo puntos => punto decimal (en-US)
      s = s.replace(/,/g, "");
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
  
    // si hay más de un separador decimal, conserva solo el primero
    const commaCount = (s.match(/,/g) || []).length;
    const dotCount = (s.match(/\./g) || []).length;
    if (commaCount + dotCount > 1) {
      // prioriza el primer separador que aparezca
      const i = Math.min(
        ...[s.indexOf(","), s.indexOf(".")].filter((x) => x >= 0)
      );
      const head = s.slice(0, i + 1);
      const tail = s.slice(i + 1).replace(/[.,]/g, "");
      s = head + tail;
    }
  
    // evita ceros a la izquierda tipo "0003"
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
  
  // Lee ingreso ocasional en distintas claves
export const getIngresoOcasional = (m = {}) => {
    const v =
      m.ingreso_ocasional ??
      m.ingresoOcasional ??
      m.incomeOccasional ??
      m?.cliente?.ingreso_ocasional ??
    m?.cliente?.ingresoOcasional ??
    m?.cliente?.incomeOccasional ??
    null;
    return parseMoney(v);
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
  