/**
 * Deriva el estado de la póliza de una cobertura (misma lógica que FichaClienteGeneral).
 * @param {object|null} c - Registro de cobertura
 * @returns {{ estado: string, fecha: string|null, tipoFecha: string|null }}
 */
export function derivarEstadoPoliza(c) {
  try {
    if (!c || typeof c !== "object") {
      return { estado: "Vigente", fecha: null, tipoFecha: null };
    }

    const estadoCoberturaRaw =
      c?.estado_cobertura != null ? String(c.estado_cobertura).trim() : "";
    const estadoCoberturaNormalizado = estadoCoberturaRaw.toLowerCase();
    const estadoCoberturaMostrar =
      estadoCoberturaNormalizado === "no" ? "Sin cobertura" : estadoCoberturaRaw;
    const mostrarEstadoCoberturaDirecto =
      estadoCoberturaNormalizado === "no" ||
      estadoCoberturaNormalizado === "medicare" ||
      estadoCoberturaNormalizado === "medicaid" ||
      estadoCoberturaNormalizado === "medicai";

    const activo =
      c?.activo !== undefined && c?.activo !== null
        ? c.activo === true || c.activo === "true" || c.activo === 1
        : true;
    const vigente =
      c?.vigente !== undefined && c?.vigente !== null
        ? c.vigente === true || c.vigente === "true" || c.vigente === 1
        : true;

    const fechaRetiroValida =
      c?.fecha_retiro &&
      String(c.fecha_retiro).trim() &&
      String(c.fecha_retiro) !== "null"
        ? String(c.fecha_retiro)
        : null;

    const fechaCancelacionValida =
      c?.fecha_cancelacion &&
      String(c.fecha_cancelacion).trim() &&
      String(c.fecha_cancelacion) !== "null"
        ? String(c.fecha_cancelacion)
        : null;

    if (fechaRetiroValida || !activo) {
      return {
        estado: "Retirada",
        fecha: fechaRetiroValida,
        tipoFecha: fechaRetiroValida ? "retiro" : null,
      };
    }

    if (fechaCancelacionValida) {
      return {
        estado: "Póliza Cancelada",
        fecha: fechaCancelacionValida,
        tipoFecha: "cancelacion",
      };
    }

    if (mostrarEstadoCoberturaDirecto) {
      return {
        estado: estadoCoberturaMostrar,
        fecha: null,
        tipoFecha: null,
      };
    }

    if (vigente) {
      return { estado: "Vigente", fecha: null, tipoFecha: null };
    }

    return {
      estado: "Póliza Cancelada",
      fecha: null,
      tipoFecha: null,
    };
  } catch (_) {
    return { estado: "Vigente", fecha: null, tipoFecha: null };
  }
}

/** Variante de Badge de Bootstrap alineada con la ficha del cliente */
export function estadoPolizaBadgeVariant(estado) {
  if (estado === "Vigente") return "success";
  if (estado === "Póliza Cancelada") return "warning";
  if (
    estado === "Sin cobertura" ||
    estado === "No" ||
    estado === "Medicare" ||
    estado === "Medicaid" ||
    estado === "Medicai"
  ) {
    return "danger";
  }
  return "secondary";
}
