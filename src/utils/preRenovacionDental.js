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

export const TIPO_ITEM_MIEMBRO_NUEVO = "miembro_nuevo";
export const TIPO_ITEM_PRODUCTO_NUEVO = "producto_nuevo";

export const isItemAltaEnLote = (item = {}) =>
  item?.tipo_item === TIPO_ITEM_MIEMBRO_NUEVO ||
  item?.tipo_item === TIPO_ITEM_PRODUCTO_NUEVO;

export const isItemProductoNuevo = (item = {}) =>
  item?.tipo_item === TIPO_ITEM_PRODUCTO_NUEVO;

export const isItemMiembroNuevo = (item = {}) =>
  item?.tipo_item === TIPO_ITEM_MIEMBRO_NUEVO;

export const getItemClienteId = (item = {}) => {
  if (isItemAltaEnLote(item)) {
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

  const sinCliente = [];

  list.forEach((item) => {
    const clienteId = getItemClienteId(item);
    if (clienteId == null) {
      if (isItemProductoNuevo(item) && (item?.renovar ?? true)) {
        sinCliente.push(item);
      }
      return;
    }
    if (!porCliente.has(clienteId)) {
      porCliente.set(clienteId, { salud: [], dental: [] });
    }
    const bucket = porCliente.get(clienteId);
    if (isItemDental(item)) bucket.dental.push(item);
    else bucket.salud.push(item);
  });

  const conflictos = [];
  const pushConflicto = (d, saludOmitida) => {
    conflictos.push({
      dental: d,
      salud: saludOmitida,
      nombre: typeof nombreFn === "function" ? nombreFn(d) : `Item #${d.id}`,
    });
  };

  porCliente.forEach(({ salud, dental }) => {
    dental.forEach((d) => {
      const dentalActivo = isItemProductoNuevo(d) || Boolean(d?.renovar);
      if (!dentalActivo) return;
      if (salud.length === 0) {
        if (isItemProductoNuevo(d)) pushConflicto(d, null);
        return;
      }
      const saludRenovando = salud.some(
        (s) => isItemMiembroNuevo(s) || Boolean(s?.renovar)
      );
      if (saludRenovando) return;
      const saludOmitida = salud.find((s) => !s?.renovar) || null;
      pushConflicto(d, saludOmitida);
    });
  });

  sinCliente.forEach((d) => {
    const origenId = Number(d?.datos_borrador?.miembro_origen_item_id || 0);
    const origen = list.find((item) => Number(item?.id) === origenId);
    const origenRenueva =
      origen &&
      (isItemMiembroNuevo(origen) || Boolean(origen?.renovar));
    if (!origenRenueva) pushConflicto(d, origen || null);
  });

  return conflictos;
};

/** Salud omitida con dental activo en el lote → cascada al consolidar. */
export const findCascadasSaludNoRenovar = (items = [], nombreFn) => {
  const list = Array.isArray(items) ? items : [];
  const porCliente = new Map();

  list.forEach((item) => {
    if (isItemAltaEnLote(item)) return;
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

const nombreDesdeItem = (item = {}) =>
  item?.cobertura?.cliente?.nombre_completo ||
  item?.cliente_existente?.nombre_completo ||
  item?.datos_borrador?.cliente?.nombre_completo ||
  null;

/** Salud renovando (o miembro nuevo) que aún no tiene Dental MS en el lote. */
export const itemsSaludElegiblesParaDental = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  const dentalClienteIds = new Set();
  const dentalOrigenIds = new Set();

  list.forEach((item) => {
    if (!isItemDental(item)) return;
    const cid = getItemClienteId(item);
    if (cid != null) dentalClienteIds.add(cid);
    const origen = Number(item?.datos_borrador?.miembro_origen_item_id || 0);
    if (origen > 0) dentalOrigenIds.add(origen);
  });

  return list.filter((item) => {
    if (isItemDental(item) || isItemProductoNuevo(item)) return false;
    const renovando = isItemMiembroNuevo(item) || Boolean(item?.renovar);
    if (!renovando) return false;
    const cid = getItemClienteId(item);
    if (cid != null && dentalClienteIds.has(cid)) return false;
    if (dentalOrigenIds.has(Number(item?.id))) return false;
    return true;
  });
};

/** Shape compatible con AgregarDentalModal. */
export const itemSaludToDentalMember = (item = {}, anioDestino) => {
  const datos = item?.datos_borrador || {};
  const cob = item?.cobertura || {};
  const cliente =
    item?.cliente_existente ||
    cob?.cliente ||
    datos?.cliente ||
    {};
  const clienteId = getItemClienteId(item);
  const parentesco =
    datos?.parentesco || cob?.parentesco || item?.cobertura?.parentesco || "";

  return {
    id: item?.id,
    item_id: item?.id,
    cliente_id: clienteId,
    nombreCompleto:
      cliente.nombre_completo ||
      [cliente.primer_nombre, cliente.segundo_nombre, cliente.apellidos]
        .filter(Boolean)
        .join(" ") ||
      nombreDesdeItem(item) ||
      `Ítem #${item?.id}`,
    parentesco,
    tipo: parentesco,
    ano_cobertura: anioDestino || datos.ano_cobertura || cob.ano_cobertura,
    elegibilidad: datos.elegibilidad || cob.elegibilidad || "",
    estado_cobertura: "Sí",
    activo: true,
    vigente: true,
    agente: datos.agente || cob.agente || "",
    tipo_pago: datos.tipo_pago || cob.tipo_pago || "",
    dia_pago: datos.dia_pago ?? cob.dia_pago ?? "",
    pagador_id: datos.pagador_id ?? cob.pagador_id ?? null,
    coberturaDental: null,
  };
};
