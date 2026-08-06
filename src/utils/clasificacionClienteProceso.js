/**
 * Clasificación comercial según etapa del proceso del grupo familiar.
 * Prospecto → Inscripción Inicial inclusive = Prospecto;
 * etapas posteriores (p. ej. Grupo Familiar) = Cliente.
 */

const norm = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const ETAPAS_PROSPECTO = new Set([
  "prospecto",
  "cotizacion",
  "seguimiento",
  "toma de datos",
  "inscripcion inicial",
]);

/**
 * @param {string} estado - Nombre del estado del proceso (catálogo GF)
 * @returns {"Prospecto"|"Cliente"|"Descartado"|null}
 */
export function clasificacionDesdeEstadoProceso(estado) {
  const n = norm(estado);
  if (!n || n === "sin estado" || n === "sin proceso") return null;
  if (n === "descartado") return "Descartado";
  if (ETAPAS_PROSPECTO.has(n)) return "Prospecto";
  return "Cliente";
}

/**
 * @param {"Prospecto"|"Cliente"|"Descartado"|string|null} clasificacion
 * @returns {string} Variante Badge Bootstrap
 */
export function clasificacionProcesoToVariant(clasificacion) {
  switch (clasificacion) {
    case "Prospecto":
      return "warning";
    case "Cliente":
      return "primary";
    case "Descartado":
      return "danger";
    default:
      return "secondary";
  }
}

/**
 * estado_cliente al crear persona desde un grupo familiar según etapa del proceso.
 * Estados 1–5 (hasta Inscripción/Confirmación) → contacto
 * Estado 6 (GRUPO_FAMILIAR / Terminado) → cliente
 *
 * @param {string|null|undefined} codigoEstadoProceso
 * @returns {"cliente"|"contacto"}
 */
export function estadoClienteDesdeProcesoGrupo(codigoEstadoProceso) {
  const codigo = String(codigoEstadoProceso || "")
    .trim()
    .toUpperCase();
  return codigo === "GRUPO_FAMILIAR" ? "cliente" : "contacto";
}
