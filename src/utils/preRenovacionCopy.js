import {
  CAMPOS_COPIABLES_COBERTURA_RESTRINGIDA,
  soloPermiteCopiarDireccion,
} from "./estadoPoliza";

/** Misma lista que CopiarDatosModal (dirección en cliente). */
const ADDRESS_FIELDS = [
  "direccion",
  "calle",
  "apto",
  "ciudad",
  "estado",
  "codigo_postal",
  "condado",
  "dir_correspondencia",
];

const hasOwn = (obj, key) =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/** Parentesco del ítem de borrador (renovación o miembro nuevo). */
export const parentescoOfItem = (item) => {
  if (item?.tipo_item === "miembro_nuevo") {
    return item?.datos_borrador?.parentesco || "";
  }
  return item?.cobertura?.parentesco || item?.datos_borrador?.parentesco || "";
};

export const isTomadorItem = (item) =>
  String(parentescoOfItem(item) || "").toLowerCase() === "tomador";

/** Cliente efectivo: overrides del borrador + referencia en vivo. */
export const clienteEfectivoOfItem = (item) => {
  const datosCli =
    item?.datos_borrador?.cliente &&
    typeof item.datos_borrador.cliente === "object"
      ? item.datos_borrador.cliente
      : {};
  const base =
    item?.tipo_item === "miembro_nuevo"
      ? item?.cliente_existente || {}
      : item?.cobertura?.cliente || {};
  return { ...base, ...datosCli };
};

/**
 * Valor de cobertura en el borrador: primero datos_borrador, luego cobertura.
 * @returns {{ has: boolean, value: unknown }}
 */
export const pickCoberturaField = (item, key) => {
  const datos = item?.datos_borrador || {};
  if (hasOwn(datos, key)) {
    return { has: true, value: datos[key] };
  }
  const cob = item?.cobertura || {};
  if (hasOwn(cob, key)) {
    return { has: true, value: cob[key] };
  }
  return { has: false, value: undefined };
};

/**
 * Ítems que pueden participar en “Copiar” dentro del borrador:
 * renovar=true (o miembro nuevo). No incluye omitidos del año destino.
 */
export const itemElegibleParaCopiarEnBorrador = (item) => {
  if (!item) return false;
  if (item.tipo_item === "miembro_nuevo") return true;
  return Boolean(item.renovar);
};

/** Shape compatible con CopiarDatosModal / TomaDeDatos. */
export const itemToCopyMember = (item) => {
  const cliente = clienteEfectivoOfItem(item);
  const parentesco = parentescoOfItem(item);
  const nombre =
    cliente.nombre_completo ||
    [cliente.primer_nombre, cliente.segundo_nombre, cliente.apellidos]
      .filter(Boolean)
      .join(" ") ||
    `Ítem #${item.id}`;

  const estado = pickCoberturaField(item, "estado_cobertura");

  const member = {
    id: item.id,
    tipo: parentesco,
    nombreCompleto: nombre,
    cliente,
    estado_cobertura: estado.has ? estado.value : "",
  };

  // Campos de cobertura aplanados (para que el apply del modal vea `k in src`)
  [
    "elegibilidad",
    "compania_id",
    "agente",
    "plan",
    "metal",
    "red",
    "pagador_id",
    "tipo_pago",
    "dia_pago",
    "estado_cobertura",
    "fecha_activacion",
    "precio",
    "grupo",
  ].forEach((key) => {
    const picked = pickCoberturaField(item, key);
    if (picked.has) member[key] = picked.value;
  });

  return member;
};

/**
 * Arma el patch de datos_borrador para un destino a partir del origen.
 * No toca codigo_poliza ni datos personales fuera de dirección.
 */
export const buildCopyPatchForItem = (
  sourceItem,
  targetItem,
  { fieldKeys = [], copyAddress = false } = {}
) => {
  const patch = {};
  const soloDireccion = soloPermiteCopiarDireccion(
    pickCoberturaField(targetItem, "estado_cobertura").value
  );

  fieldKeys.forEach((key) => {
    if (
      soloDireccion &&
      !CAMPOS_COPIABLES_COBERTURA_RESTRINGIDA.includes(key)
    ) {
      return;
    }
    const picked = pickCoberturaField(sourceItem, key);
    if (!picked.has) return;
    patch[key] = picked.value;
  });

  if (copyAddress) {
    const srcCli = clienteEfectivoOfItem(sourceItem);
    const clientePatch = {};
    ADDRESS_FIELDS.forEach((key) => {
      if (hasOwn(srcCli, key)) {
        clientePatch[key] = srcCli[key];
      }
    });
    if (Object.keys(clientePatch).length > 0) {
      patch.cliente = clientePatch;
    }
  }

  return patch;
};
