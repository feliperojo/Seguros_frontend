/** Tamaño de página del listado embebido. El informe independiente no pagina. */
export const HISTORIAL_PLAN_PAGE_SIZE = 10;

const primeraFechaInformada = (item, campos) => {
  for (const campo of campos) {
    const valor = item?.[campo];
    if (valor) return valor;
  }
  return "";
};

/**
 * Año calendario de un valor de fecha (YYYY-MM-DD o ISO).
 * Si el valor existe pero no trae un año válido, no se intenta otra fecha.
 */
export const anioDesdeValorFecha = (value) => {
  if (!value) return null;
  const year = Number(String(value).slice(0, 10).slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
};

/**
 * Año que usa el informe independiente de historial de plan.
 * Conserva el fallback a created_at de ese informe.
 */
export const getAnioHistorialPlan = (item) =>
  anioDesdeValorFecha(
    primeraFechaInformada(item, [
      "fecha_activacion",
      "fecha_expiracion",
      "created_at",
    ])
  );

/**
 * Año de cobertura del registro según fechas efectivas del plan.
 * No usa created_at: una modificación puede guardarse en otro año calendario
 * y seguir perteneciendo al año de activación o expiración del plan.
 */
export const getAnioEfectivoRegistroPlan = (item) =>
  anioDesdeValorFecha(
    primeraFechaInformada(item, ["fecha_activacion", "fecha_expiracion"])
  );

/**
 * Plan archivado que se puede volver a cargar en su misma cobertura.
 * El id del registro no sustituye al id de la cobertura.
 * No usa created_at ni registros marcados como anulación.
 */
export const esPlanRecuperable = (item, { coberturaId, anio } = {}) => {
  const idCobertura = Number(coberturaId);
  const year = Number(anio);
  if (!Number.isInteger(idCobertura) || idCobertura <= 0) return false;
  if (!Number.isInteger(year) || year <= 1900) return false;
  if (item?.es_anulacion) return false;

  const registroId = Number(item?.id);
  if (!Number.isInteger(registroId) || registroId <= 0) return false;

  if (item?.cobertura_id == null || Number(item.cobertura_id) !== idCobertura) {
    return false;
  }

  return getAnioEfectivoRegistroPlan(item) === year;
};

export const formatFechaHistorialPlan = (value) => {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${m}/${d}/${y}`;
};

export const formatPrecioHistorialPlan = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
};

/**
 * Vínculo explícito del registro de retiro/cancelación con su cobertura.
 * No infiere el ID por cliente, compañía, plan ni por el id del registro.
 */
export const referenciaHistorialPlanCancelacion = (item = {}) => {
  const rawId = item?.cobertura_id_original;
  const idNum = Number(rawId);
  const coberturaId =
    rawId !== null &&
    rawId !== undefined &&
    String(rawId).trim() !== "" &&
    Number.isInteger(idNum) &&
    idNum > 0
      ? idNum
      : null;

  const rawAnio = item?.ano_cobertura;
  const anioTexto = String(rawAnio ?? "").trim();
  const anioNum = Number(anioTexto);
  const anio =
    anioTexto !== "" &&
    Number.isInteger(anioNum) &&
    anioNum > 1900 &&
    anioNum < 2100
      ? anioNum
      : null;

  return {
    coberturaId,
    anio,
    valida: coberturaId != null && anio != null,
  };
};

/**
 * Historial de plan de una sola cobertura y de un solo año de cobertura.
 * Descarta registros de otra cobertura aunque compartan plan o cliente.
 */
export const filtrarHistorialPlanPorCoberturaYAnio = (
  registros,
  coberturaId,
  anio
) => {
  const id = Number(coberturaId);
  const year = Number(anio);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(year)) return [];

  return (Array.isArray(registros) ? registros : []).filter((item) => {
    const itemId = item?.cobertura_id;
    if (
      itemId != null &&
      String(itemId).trim() !== "" &&
      Number(itemId) !== id
    ) {
      return false;
    }
    return getAnioEfectivoRegistroPlan(item) === year;
  });
};
