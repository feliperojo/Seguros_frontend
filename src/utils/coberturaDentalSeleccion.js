import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalMsCoberturaTipo,
  isSaludCoberturaTipo,
} from "../constants/coberturaTipos.js";

export const getClienteIdFromCobertura = (c = {}) => c?.cliente?.id ?? c?.cliente_id ?? null;

export const getEtiquetaProducto = (c = {}) => {
  if (isDentalMsCoberturaTipo(c?.cobertura_tipo)) return COBERTURA_TIPO_DENTAL_MS;
  const tipo = String(c?.cobertura_tipo || "").trim();
  return tipo || "Salud MS";
};

export const findDentalCoberturaForCliente = (clienteId, coberturas = []) => {
  if (!clienteId) return null;
  return (
    coberturas.find(
      (c) =>
        getClienteIdFromCobertura(c) === clienteId &&
        isDentalMsCoberturaTipo(c?.cobertura_tipo)
    ) || null
  );
};

export const findSaludCoberturaForCliente = (clienteId, coberturas = []) => {
  if (!clienteId) return null;
  return (
    coberturas.find(
      (c) =>
        getClienteIdFromCobertura(c) === clienteId &&
        isSaludCoberturaTipo(c?.cobertura_tipo)
    ) || null
  );
};

/** IDs dental MS que deben incluirse al seleccionar coberturas de salud. */
export const idsDentalVinculadosASalud = (saludIds = [], coberturas = []) => {
  const extras = new Set();
  saludIds.forEach((id) => {
    const salud = coberturas.find((c) => c.id === id);
    if (!salud || !isSaludCoberturaTipo(salud.cobertura_tipo)) return;
    const dental = findDentalCoberturaForCliente(getClienteIdFromCobertura(salud), coberturas);
    if (dental?.id) extras.add(dental.id);
  });
  return extras;
};

/** Al seleccionar salud, agregar dental MS; al deseleccionar salud, quitar dental vinculado. */
export const resolverToggleSeleccion = ({
  coberturaId,
  coberturas = [],
  seleccionados = new Set(),
}) => {
  const cobertura = coberturas.find((c) => c.id === coberturaId);
  if (!cobertura) {
    return { ok: false, error: "Cobertura no encontrada.", seleccionados };
  }

  if (seleccionados.has(coberturaId)) {
    if (isDentalMsCoberturaTipo(cobertura.cobertura_tipo)) {
      const salud = findSaludCoberturaForCliente(getClienteIdFromCobertura(cobertura), coberturas);
      if (salud?.id && seleccionados.has(salud.id)) {
        return {
          ok: false,
          error:
            "Al cancelar o retirar la cobertura de salud, Dental MS del mismo miembro se incluye obligatoriamente.",
          seleccionados,
        };
      }
    }

    const next = new Set(seleccionados);
    next.delete(coberturaId);
    if (isSaludCoberturaTipo(cobertura.cobertura_tipo)) {
      const dental = findDentalCoberturaForCliente(getClienteIdFromCobertura(cobertura), coberturas);
      if (dental?.id) next.delete(dental.id);
    }
    return { ok: true, seleccionados: next };
  }

  const next = new Set(seleccionados);
  next.add(coberturaId);
  if (isSaludCoberturaTipo(cobertura.cobertura_tipo)) {
    const dental = findDentalCoberturaForCliente(getClienteIdFromCobertura(cobertura), coberturas);
    if (dental?.id) next.add(dental.id);
  }
  return { ok: true, seleccionados: next };
};

export const esDentalVinculadaASaludSeleccionada = (
  dentalId,
  coberturas = [],
  seleccionados = new Set()
) => {
  const dental = coberturas.find((c) => c.id === dentalId);
  if (!dental || !isDentalMsCoberturaTipo(dental.cobertura_tipo)) return false;
  const salud = findSaludCoberturaForCliente(getClienteIdFromCobertura(dental), coberturas);
  return Boolean(salud?.id && seleccionados.has(salud.id));
};
