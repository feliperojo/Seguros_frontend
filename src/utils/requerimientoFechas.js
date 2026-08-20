/** Fecha de cierre de requerimientos: ISO interno, visible solo en Completado. */

export const esEstadoCompletado = (estado) =>
  String(estado || "").trim().toLowerCase() === "completado";

export const isoDateOnly = (valor) => {
  if (!valor) return "";
  const s = String(valor).trim().split("T")[0].split(" ")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

export const hoyIsoLocal = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

/**
 * Fecha almacenada de cierre, con fallback para registros anteriores a fecha_cierre.
 */
export const fechaCierreRequerimiento = (req) =>
  isoDateOnly(req?.fecha_cierre)
  || isoDateOnly(req?.fecha_envio)
  || isoDateOnly(req?.updated_at)
  || isoDateOnly(req?.updatedAt);

/** Al pasar a Completado: usa la fecha ya guardada o hoy. */
export const fechaCierreAlCompletar = (req) =>
  fechaCierreRequerimiento(req) || hoyIsoLocal();
