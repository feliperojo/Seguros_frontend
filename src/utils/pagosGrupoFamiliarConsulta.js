export const ESTADOS_COBRO_EDITABLES = ["pendiente", "pagado", "procesando"];

function textoSnapshot(valor) {
  if (valor == null) return "";
  const texto = String(valor).trim();
  return texto;
}

/**
 * Datos del snapshot de este cobro. No completa campos con la cobertura actual.
 */
export function detalleSnapshotCobro(cobro) {
  const snap = cobro?.cobertura_snapshot;
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) {
    return {
      disponible: false,
      titulo: "Snapshot no disponible",
      nota: "",
      campos: [],
    };
  }

  const campos = [];
  const agregar = (etiqueta, valor) => {
    const texto = textoSnapshot(valor);
    if (!texto) return;
    campos.push({ etiqueta, valor: texto });
  };

  agregar("Compañía", snap.compania_nombre);
  agregar("Plan", snap.plan);
  agregar("Pagador", snap.pagador_nombre);
  agregar("Número de póliza", snap.codigo_poliza || snap.policy_number);
  if (Object.prototype.hasOwnProperty.call(snap, "fecha_activacion")) {
    agregar("Fecha de activación", snap.fecha_activacion);
  }
  agregar("Tipo de pago", snap.tipo_pago);
  if (Object.prototype.hasOwnProperty.call(snap, "dia_pago")) {
    agregar("Día de pago", snap.dia_pago);
  }

  return {
    disponible: true,
    titulo: `Snapshot del cobro ${cobro?.id ?? ""}`.trim(),
    nota: campos.length
      ? ""
      : "Este snapshot no incluye compañía, plan, póliza, fecha de activación, tipo de pago ni día de pago.",
    campos,
  };
}

export function detalleProyeccion(proyectado) {
  const campos = [];
  const agregar = (etiqueta, valor) => {
    const texto = textoSnapshot(valor);
    if (!texto) return;
    campos.push({ etiqueta, valor: texto });
  };

  agregar("Compañía", proyectado?.compania_nombre);
  agregar("Plan", proyectado?.plan);
  agregar("Número de póliza", proyectado?.codigo_poliza);
  agregar("Importe", proyectado?.monto != null ? Number(proyectado.monto).toFixed(2) : "");
  agregar("Origen", proyectado?.origen);

  return {
    titulo: "Proyección",
    nota: "No es el snapshot de un cobro generado.",
    campos,
  };
}

export function cobrosDelMes(mes) {
  if (Array.isArray(mes?.cobros)) return mes.cobros.filter(Boolean);
  if (mes?.cobro) return [mes.cobro];
  return [];
}

/**
 * Una fila por cobertura_id. El cobro generado de un mes tiene prioridad
 * sobre la proyección, sin descartar cobros adicionales de ese mes.
 */
export function filasPagosGrupo(coberturas) {
  return (coberturas || []).map((cob) => {
    const porNumero = new Map();
    (Array.isArray(cob?.meses) ? cob.meses : []).forEach((mes) => {
      const numero = parseInt(mes?.mes, 10);
      if (numero >= 1 && numero <= 12) porNumero.set(numero, mes);
    });

    const meses = Array.from({ length: 12 }, (_, idx) => {
      const mes = porNumero.get(idx + 1);
      const cobros = cobrosDelMes(mes);
      if (cobros.length > 0) {
        return { tipo: "cobro", cobros };
      }
      if (mes?.proyectado) {
        return {
          tipo: "proyectado",
          proyectado: mes.proyectado,
          monto: mes.proyectado.monto,
          origen: mes.proyectado.origen,
        };
      }
      return null;
    });

    return {
      id: cob?.cobertura_id,
      miembro: cob?.miembro || "—",
      cobertura: cob?.cobertura || "—",
      codigo: cob?.codigo_poliza || "",
      compania: cob?.compania || "—",
      fechaActivacion: textoSnapshot(cob?.fecha_activacion),
      meses,
    };
  });
}

/**
 * Un mes cuenta para la situación solo si tiene cobro generado.
 * Si hay varios y alguno no está pagado, el mes no se trata como pagado.
 */
export function mesesParaSituacion(meses) {
  return (meses || []).map((celda) => {
    if (celda?.tipo !== "cobro" || !Array.isArray(celda.cobros) || celda.cobros.length === 0) {
      return null;
    }
    const impago = celda.cobros.find(
      (cobro) => String(cobro?.estado ?? "").trim().toLowerCase() !== "pagado"
    );
    const ref = impago || celda.cobros[0];
    return { estado: ref.estado, monto: ref.monto };
  });
}

export function prepararGuardadoCobro({ cobro, estado, monto, motivo }) {
  const errores = [];
  const acciones = [];
  if (!cobro?.id) {
    return { ok: false, errores: ["No hay un cobro seleccionado."], acciones };
  }

  const montoNorm = Number(monto);
  const montoActual = Number(cobro.monto || 0);
  const montoTexto = Number.isFinite(montoNorm) ? montoNorm.toFixed(2) : "";
  const montoCambio = montoTexto !== montoActual.toFixed(2);

  if (!Number.isFinite(montoNorm) || montoNorm <= 0 || montoNorm >= 100000000) {
    errores.push("El importe del cobro debe ser mayor que cero y menor que 100000000.");
  }

  if (montoCambio && String(motivo || "").trim().length < 5) {
    errores.push("Indique el motivo de la corrección (mínimo 5 caracteres).");
  }

  const estadoCambio = estado !== cobro.estado;
  if (estadoCambio && !ESTADOS_COBRO_EDITABLES.includes(estado)) {
    errores.push("Ese estado no está permitido.");
  }

  if (errores.length > 0) {
    return { ok: false, errores, acciones };
  }

  if (montoCambio) {
    acciones.push({
      method: "POST",
      path: `cobertura/pagos/${cobro.id}/corregir`,
      body: {
        motivo: String(motivo).trim(),
        monto: Number(montoTexto),
        confirmar_importe_registrado: true,
      },
    });
  }

  if (estadoCambio) {
    acciones.push({
      method: "PUT",
      path: `cobertura/pagos/${cobro.id}`,
      body: { estado },
    });
  }

  return { ok: true, errores, acciones };
}

/**
 * Un mes proyectado no tiene cobro. Confirmar registra solo ese mes.
 */
export function prepararGuardadoProyeccion({
  grupoFamiliarId,
  coberturaId,
  anio,
  mes,
  estado,
  monto,
  motivo,
}) {
  const errores = [];
  const acciones = [];
  const montoNorm = Number(monto);
  const montoTexto = Number.isFinite(montoNorm) ? montoNorm.toFixed(2) : "";

  if (!grupoFamiliarId || !coberturaId || !anio || !mes) {
    return { ok: false, errores: ["No hay un mes seleccionado."], acciones };
  }

  if (!Number.isFinite(montoNorm) || montoNorm <= 0 || montoNorm >= 100000000) {
    errores.push("El importe del cobro debe ser mayor que cero y menor que 100000000.");
  }

  if (String(motivo || "").trim().length < 5) {
    errores.push("Indique el motivo de la corrección (mínimo 5 caracteres).");
  }

  if (!ESTADOS_COBRO_EDITABLES.includes(estado)) {
    errores.push("Ese estado no está permitido.");
  }

  if (errores.length > 0) {
    return { ok: false, errores, acciones };
  }

  acciones.push({
    method: "POST",
    path: `cobertura/pagos/grupo-familiar/${grupoFamiliarId}/ajuste`,
    body: {
      cobertura_id: coberturaId,
      anio,
      mes,
      estado,
      motivo: String(motivo).trim(),
      monto: Number(montoTexto),
    },
  });

  return { ok: true, errores, acciones };
}
