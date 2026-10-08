export const ESTADOS_INFORME_PAGO = [
  { value: "pendiente", label: "Pendiente" },
  { value: "procesando", label: "Procesando" },
  { value: "pagado", label: "Pagado" },
];

const ESTADOS_PERMITIDOS = ESTADOS_INFORME_PAGO.map((estado) => estado.value);

export function normalizarEstadoPago(estado) {
  return String(estado ?? "").trim().toLowerCase();
}

/**
 * El informe no tiene un permiso propio de edición.
 * Reutiliza el acceso de Actualización de Pagos: el módulo visible,
 * o quien ya puede abrir ese módulo aunque esté oculto en el menú.
 */
export function puedeEditarEstadoInforme({
  moduloActualizacionVisible = false,
  puedeAbrirModuloOculto = false,
} = {}) {
  return Boolean(moduloActualizacionVisible || puedeAbrirModuloOculto);
}

/**
 * Prepara el PUT existente. Solo envía el estado del pago indicado.
 * Sin cambio, id inválido o estado no admitido, no hay solicitud.
 */
export function prepararActualizacionEstadoInforme({ pagoId, estadoActual, estadoNuevo }) {
  const id = Number(pagoId);
  const actual = normalizarEstadoPago(estadoActual);
  const nuevo = normalizarEstadoPago(estadoNuevo);

  if (!Number.isInteger(id) || id <= 0) {
    return { enviar: false, motivo: "id" };
  }
  if (!ESTADOS_PERMITIDOS.includes(nuevo)) {
    return { enviar: false, motivo: "estado" };
  }
  if (nuevo === actual) {
    return { enviar: false, motivo: "sin_cambio" };
  }

  return {
    enviar: true,
    motivo: null,
    path: `cobertura/pagos/${id}`,
    body: { estado: nuevo },
  };
}

export function reflejarEstadoGuardado(pagos, pagoId, estado) {
  return (pagos || []).map((pago) =>
    pago?.id === pagoId ? { ...pago, estado } : pago
  );
}

export function paginaTrasConsulta(paginaActual, totalFilas, filasPorPagina) {
  const porPagina = Math.max(1, Number(filasPorPagina) || 1);
  const paginas = Math.max(1, Math.ceil(Math.max(0, Number(totalFilas) || 0) / porPagina));
  const actual = Number(paginaActual);
  const pagina = Number.isFinite(actual) && actual >= 1 ? Math.trunc(actual) : 1;
  return Math.min(pagina, paginas);
}
