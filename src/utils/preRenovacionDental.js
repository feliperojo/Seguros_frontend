import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalMsCoberturaTipo,
} from "../constants/coberturaTipos";

export const getItemCoberturaTipo = (item = {}) =>
  item?.datos_borrador?.cobertura_tipo ??
  item?.cobertura?.cobertura_tipo ??
  null;

/** Reglas de renovación/cascada solo para Dental MS (no Plan Dental privado). */
export const isItemDental = (item = {}) =>
  isDentalMsCoberturaTipo(getItemCoberturaTipo(item));

export const etiquetaProductoItem = (item = {}) => {
  if (isItemDental(item)) return COBERTURA_TIPO_DENTAL_MS;
  const tipo = String(getItemCoberturaTipo(item) || "").trim();
  return tipo || "Salud MS";
};

export const getItemClienteId = (item = {}) => {
  if (item?.tipo_item === "miembro_nuevo") {
    const id =
      item?.datos_borrador?.cliente_id_existente ??
      item?.datos_borrador?.cliente_id ??
      item?.cliente_existente?.id;
    return id != null && id !== "" ? Number(id) : null;
  }
  const id =
    item?.cobertura?.cliente_id ??
    item?.datos_borrador?.cliente_id ??
    item?.cobertura?.cliente?.id;
  return id != null && id !== "" ? Number(id) : null;
};

/**
 * Dental marcado para renovar cuando la salud del mismo miembro
 * está marcada para no renovar (o no hay salud en el lote).
 * @returns {Array<{ dental: object, salud: object|null, nombre: string }>}
 */
export const findConflictosDentalSinSalud = (items = [], nombreFn) => {
  const list = Array.isArray(items) ? items : [];
  const porCliente = new Map();

  list.forEach((item) => {
    if (item?.tipo_item === "miembro_nuevo") return;
    const clienteId = getItemClienteId(item);
    if (clienteId == null) return;
    if (!porCliente.has(clienteId)) {
      porCliente.set(clienteId, { salud: [], dental: [] });
    }
    const bucket = porCliente.get(clienteId);
    if (isItemDental(item)) bucket.dental.push(item);
    else bucket.salud.push(item);
  });

  const conflictos = [];
  porCliente.forEach(({ salud, dental }) => {
    dental.forEach((d) => {
      if (!d?.renovar) return;
      // Sin salud en el lote: no bloquear aquí (salud pudo renovarse antes;
      // la elegibilidad la valida el backend).
      if (salud.length === 0) return;
      const saludRenovando = salud.some((s) => Boolean(s?.renovar));
      if (saludRenovando) return;
      const saludOmitida = salud.find((s) => !s?.renovar) || null;
      conflictos.push({
        dental: d,
        salud: saludOmitida,
        nombre: typeof nombreFn === "function" ? nombreFn(d) : `Item #${d.id}`,
      });
    });
  });

  return conflictos;
};

/** Salud omitida con dental activo en el lote → cascada al consolidar. */
export const findCascadasSaludNoRenovar = (items = [], nombreFn) => {
  const list = Array.isArray(items) ? items : [];
  const porCliente = new Map();

  list.forEach((item) => {
    if (item?.tipo_item === "miembro_nuevo") return;
    const clienteId = getItemClienteId(item);
    if (clienteId == null) return;
    if (!porCliente.has(clienteId)) {
      porCliente.set(clienteId, { salud: [], dental: [] });
    }
    const bucket = porCliente.get(clienteId);
    if (isItemDental(item)) bucket.dental.push(item);
    else bucket.salud.push(item);
  });

  const avisos = [];
  porCliente.forEach(({ salud, dental }) => {
    const saludOmitida = salud.find(
      (s) => !s?.renovar && Boolean(s?.cobertura?.activo)
    );
    if (!saludOmitida) return;
    const dentalesActivos = dental.filter((d) => Boolean(d?.cobertura?.activo));
    if (dentalesActivos.length === 0) return;
    avisos.push({
      salud: saludOmitida,
      dentales: dentalesActivos,
      nombre: typeof nombreFn === "function" ? nombreFn(saludOmitida) : "—",
    });
  });

  return avisos;
};

/** Orden estable: nombre → salud antes que dental → id. */
export const sortItemsPreRenovacion = (items = [], nombreFn) => {
  const list = [...(Array.isArray(items) ? items : [])];
  list.sort((a, b) => {
    const na = String(
      typeof nombreFn === "function" ? nombreFn(a) : a?.id || ""
    ).toLowerCase();
    const nb = String(
      typeof nombreFn === "function" ? nombreFn(b) : b?.id || ""
    ).toLowerCase();
    if (na !== nb) return na.localeCompare(nb, "es");

    const da = isItemDental(a) ? 1 : 0;
    const db = isItemDental(b) ? 1 : 0;
    if (da !== db) return da - db;

    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  });
  return list;
};

/** Opciones de pagador desde clientes visibles en el lote. */
export const buildPagadorOptionsFromItems = (items = []) => {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = getItemClienteId(item);
    if (id == null) return;
    const nombre =
      item?.cobertura?.cliente?.nombre_completo ||
      item?.cliente_existente?.nombre_completo ||
      item?.datos_borrador?.cliente?.nombre_completo ||
      `Cliente #${id}`;
    if (!map.has(id)) map.set(id, { id, nombre });
  });
  return Array.from(map.values()).sort((a, b) =>
    String(a.nombre).localeCompare(String(b.nombre), "es")
  );
};
