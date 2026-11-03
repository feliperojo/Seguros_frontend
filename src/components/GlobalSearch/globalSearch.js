import { matchPath } from "react-router-dom";
import { getListFromApi } from "../../utils/apiResponse.js";

/**
 * Búsqueda global aislada de los listados y formularios.
 *
 * Clientes: GET cliente/buscar-con-grupos?q=
 *   El servidor compara nombre_completo (todas las palabras), exige 3 caracteres
 *   y devuelve como máximo 20. No busca por id, teléfono ni correo.
 *   No usamos GET cliente/buscar: esa respuesta incluye teléfono, correo y fecha de nacimiento.
 *
 * Grupos: GET grupo_familiar/grupos-familiares-listado
 *   Misma búsqueda del listado, limitada con page y per_page.
 *   Sin anio el servidor devuelve una fila por grupo y anio_plan llega null.
 *   No pedimos anio=all: esa vista solo incluye grupos con cobertura y
 *   dejaría fuera coincidencias que el listado normal sí muestra.
 *   El año se conserva únicamente cuando la respuesta lo trae.
 */

export const MIN_QUERY_LENGTH = 3;
export const SEARCH_DEBOUNCE_MS = 380;
export const MAX_RESULTS = 8;

export function shouldSearch(term) {
  return String(term ?? "").trim().length >= MIN_QUERY_LENGTH;
}

export function isLatestRequest(requestId, currentId) {
  return requestId === currentId;
}

export function clienteSearchPath(term) {
  return `cliente/buscar-con-grupos?q=${encodeURIComponent(String(term).trim())}`;
}

export function grupoSearchPath(term) {
  const params = new URLSearchParams();
  params.set("search", String(term).trim());
  params.set("page", "1");
  params.set("per_page", String(MAX_RESULTS));
  return `grupo_familiar/grupos-familiares-listado?${params.toString()}`;
}

export function messageForSearchFailure(error) {
  const status = error?.response?.status;
  if (status === 401) return null;
  if (status === 403) return "No tienes permiso para esta búsqueda.";
  return "No se pudo completar la búsqueda.";
}

export function sectionFromSettled(result, mapItems) {
  if (result.status === "fulfilled") {
    return { items: mapItems(result.value), message: null, showEmpty: true };
  }

  const message = messageForSearchFailure(result.reason);
  if (message == null) {
    return { items: [], message: null, showEmpty: false };
  }

  return { items: [], message, showEmpty: false };
}

export function mapClientesBusqueda(body) {
  const seen = new Set();
  const mapped = [];

  for (const row of getListFromApi(body)) {
    if (mapped.length >= MAX_RESULTS) break;
    const id = Number(row?.cliente_id ?? row?.id);
    const nombre = String(row?.nombre_completo ?? "").trim();
    if (!Number.isInteger(id) || id <= 0 || !nombre || seen.has(id)) continue;
    seen.add(id);
    mapped.push({ id, nombre });
  }

  return mapped;
}

export function mapGruposBusqueda(body) {
  const seen = new Set();
  const mapped = [];

  for (const row of getListFromApi(body)) {
    if (mapped.length >= MAX_RESULTS) break;
    const id = Number(row?.id);
    if (!Number.isInteger(id) || id <= 0) continue;

    const anio = Number(row?.anio_plan);
    const anioPlan = Number.isInteger(anio) && anio > 1900 && anio < 2100 ? anio : null;
    const key = `${id}:${anioPlan ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tomador = String(row?.tomador_nombre ?? "").trim();
    const contacto = String(row?.persona_contacto ?? "").trim();
    const nombre =
      tomador && tomador.toLowerCase() !== "sin asignar"
        ? tomador
        : contacto || "Sin nombre";

    mapped.push({ id, nombre, anioPlan });
  }

  return mapped;
}

export function buildClienteFichaPath(clienteId) {
  const id = Number(clienteId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return `/clientes/${id}/ficha`;
}

export function buildGrupoFamiliarPath(grupoId, anioPlan, anioOperativo) {
  const id = Number(grupoId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const anio = Number(anioPlan);
  const operativo = Number(anioOperativo);
  if (!Number.isInteger(anio) || anio <= 1900 || anio === operativo) {
    return `/grupo_familiar/${id}`;
  }

  return `/grupo_familiar/${id}?anio=${anio}`;
}

const RUTAS_CREACION = ["/clientes/crear", "/grupofamiliar/crear"];

/**
 * Solo el pathname decide si el resultado abre otra pestaña.
 * matchPath no distingue mayúsculas y acepta la barra final, como las rutas de App.
 * La query (por ejemplo cliente_id) no forma parte de la comparación.
 */
export function esRutaCreacion(pathname) {
  const path = String(pathname ?? "").split(/[?#]/)[0];
  if (!path) return false;
  return RUTAS_CREACION.some(
    (ruta) => matchPath({ path: ruta, end: true, caseSensitive: false }, path) != null
  );
}

export function destinoResultado(opcion, anioOperativo) {
  if (!opcion) return null;
  if (opcion.type === "cliente") return buildClienteFichaPath(opcion.id);
  if (opcion.type === "grupo") {
    return buildGrupoFamiliarPath(opcion.id, opcion.anioPlan, anioOperativo);
  }
  return null;
}

export function atributosNuevaPestana(destino) {
  if (!destino) return null;
  return {
    href: destino,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

/** Activa el enlace real. No navega la pestaña actual si el elemento no cumple. */
export function activarEnlaceNuevaPestana(elemento) {
  if (!elemento || String(elemento.tagName || "").toUpperCase() !== "A") return false;
  const href = elemento.getAttribute?.("href") || "";
  if (!href || href.startsWith("javascript:")) return false;
  if (elemento.getAttribute?.("target") !== "_blank") return false;
  if (elemento.getAttribute?.("rel") !== "noopener noreferrer") return false;
  if (typeof elemento.click !== "function") return false;
  elemento.click();
  return true;
}
