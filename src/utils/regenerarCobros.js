export const MODALIDAD_SOLO_COBERTURA = "solo_cobertura";
export const MODALIDAD_COBERTURA_Y_MONTO = "cobertura_y_monto";

export const CAMPOS_REVISION = [
  ["miembro", "Miembro"],
  ["cobertura", "Cobertura"],
  ["periodo", "Período"],
  ["compania", "Compañía"],
  ["plan", "Plan"],
  ["pagador", "Pagador"],
  ["codigo_poliza", "Código de póliza"],
  ["policy_number", "Número de póliza"],
  ["tipo_pago", "Tipo de pago"],
  ["dia_pago", "Día de pago"],
  ["fecha_activacion", "Fecha de activación"],
  ["estado", "Estado"],
  ["fecha_pago", "Fecha de pago"],
];

export function companiaDelCobro(pago) {
  const snap = pago?.cobertura_snapshot;
  const historica =
    snap && typeof snap === "object" && !Array.isArray(snap)
      ? String(snap.compania_nombre || "").trim()
      : "";
  if (historica) return historica;
  return String(pago?.cobertura?.compania?.nombre || "").trim();
}

export function filtrarCobrosParaRegenerar(pagos, filtros = {}) {
  const cliente = String(filtros.cliente || "").trim().toLowerCase();
  const compania = String(filtros.compania || "").trim().toLowerCase();
  const responsable = String(filtros.responsable || "").trim().toLowerCase();

  return (pagos || []).filter((pago) => {
    const nombre = String(pago?.cliente?.nombre_completo || "").toLowerCase();
    const empresa = companiaDelCobro(pago).toLowerCase();
    const grupo = pago?.grupo_familiar || pago?.grupoFamiliar || {};
    const resp = String(grupo.responsable || "").toLowerCase();
    return (
      (!cliente || nombre.includes(cliente)) &&
      (!compania || empresa.includes(compania)) &&
      (!responsable || resp.includes(responsable))
    );
  });
}

export function idsDePagos(pagos) {
  return (pagos || []).map((pago) => pago?.id).filter((id) => id != null);
}

export function seleccionarTodosFiltrados(pagosFiltrados) {
  return idsDePagos(pagosFiltrados);
}

export function seleccionarPagina(pagosPagina) {
  return idsDePagos(pagosPagina);
}

export function alternarSeleccion(seleccion, id) {
  const actual = new Set(seleccion || []);
  if (actual.has(id)) actual.delete(id);
  else actual.add(id);
  return [...actual];
}

export function conservarSeleccionEnFiltro(seleccion, pagosFiltrados) {
  const validos = new Set(idsDePagos(pagosFiltrados));
  return (seleccion || []).filter((id) => validos.has(id));
}

export function describirAlcance({ seleccion, pagosFiltrados, pagosPagina, periodo }) {
  const todos = idsDePagos(pagosFiltrados);
  const pagina = idsDePagos(pagosPagina);
  const validos = new Set(todos);
  const paginaSet = new Set(pagina);
  const elegidos = (seleccion || []).filter((id) => validos.has(id));
  const esTodos =
    todos.length > 0 &&
    elegidos.length === todos.length &&
    todos.every((id) => elegidos.includes(id));
  const esSoloLaPagina =
    !esTodos &&
    pagina.length > 0 &&
    pagina.length < todos.length &&
    elegidos.length === pagina.length &&
    elegidos.every((id) => paginaSet.has(id));
  const nombre = periodo || "el período";
  let texto = `${elegidos.length} cobros seleccionados de ${todos.length} filtrados en ${nombre}.`;
  if (esTodos) {
    texto = `${elegidos.length} cobros del período ${nombre} que coinciden con los filtros activos. Incluye todas las páginas, no solo los ${pagina.length} visibles.`;
  } else if (esSoloLaPagina) {
    texto = `${elegidos.length} cobros de la página visible. Los filtrados del período ${nombre} son ${todos.length}.`;
  }

  return {
    cantidad: elegidos.length,
    totalFiltrado: todos.length,
    totalPagina: pagina.length,
    esTodosLosFiltrados: esTodos,
    esSoloLaPagina,
    texto,
  };
}

export function prepararConfirmacionRegeneracion({
  incluidos,
  preview,
  modalidad,
  motivo,
  confirmarDatosActuales,
}) {
  const errores = [];
  const ids = (incluidos || []).filter((id) => id != null);
  const items = (preview?.items || []).filter((item) => ids.includes(item.pago_id));

  if (ids.length === 0) {
    errores.push("No hay cobros incluidos.");
  }
  if (String(motivo || "").trim().length < 5) {
    errores.push("Indique el motivo de la regeneración (mínimo 5 caracteres).");
  }
  if (![MODALIDAD_SOLO_COBERTURA, MODALIDAD_COBERTURA_Y_MONTO].includes(modalidad)) {
    errores.push("Elija una modalidad.");
  }
  if (!preview?.huella) {
    errores.push("Actualice la propuesta antes de regenerar.");
  }

  items.forEach((item) => {
    if (item.bloqueado) {
      errores.push(`El cobro ${item.pago_id} está bloqueado.`);
    }
    if (modalidad === MODALIDAD_COBERTURA_Y_MONTO && item.importe_bloqueado) {
      errores.push(
        item.motivo_importe ||
          `El cobro ${item.pago_id} no permite cambiar el importe.`
      );
    }
  });

  if (preview?.requiere_confirmacion_datos_actuales && !confirmarDatosActuales) {
    errores.push("Confirme que los datos actuales corresponden al período.");
  }

  if (errores.length > 0) {
    return { ok: false, errores, body: null };
  }

  return {
    ok: true,
    errores,
    body: {
      pago_ids: ids,
      modalidad,
      motivo: String(motivo).trim(),
      huella: preview.huella,
      confirmar_datos_actuales: Boolean(confirmarDatosActuales),
    },
  };
}

export function textoMontoRevision(item, modalidad) {
  if (!item) return [];
  if (modalidad === MODALIDAD_COBERTURA_Y_MONTO) {
    return [
      { etiqueta: "Monto actual", valor: formatearMonto(item.monto_conservado) },
      {
        etiqueta: "Monto recalculado",
        valor: formatearMonto(item.monto_recalculado),
      },
    ];
  }

  return [
    { etiqueta: "Monto del cobro (se conserva)", valor: formatearMonto(item.monto_conservado) },
    { etiqueta: "Precio de referencia", valor: formatearMonto(item.precio_referencia) },
  ];
}

function formatearMonto(valor) {
  if (valor == null || valor === "") return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? `$${numero.toFixed(2)}` : "—";
}
