import { parseApiDateToLocalDate } from "./formatters";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const toBoolFlag = (v, dflt = false) => {
  if (v === undefined || v === null) return dflt;
  return v === true || v === "true" || v === 1;
};

const toTime = (s) => {
  if (!s || String(s).trim() === "" || String(s) === "null") return null;
  const t = new Date(String(s)).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Selecciona la cobertura del cliente dentro de un grupo (misma lógica que el resumen de ficha).
 */
export function resolverCoberturaClienteEnGrupo(coberturas, grupoId, clienteId) {
  const selectedId = toValidId(grupoId);
  const list = Array.isArray(coberturas) ? coberturas : [];
  if (!selectedId || list.length === 0) return null;

  const delGrupo = list.filter(
    (c) => toValidId(c?.grupo_familiar_id ?? c?.grupo_familiar?.id) === selectedId
  );
  if (delGrupo.length === 0) return null;

  const clienteIdLocal = toValidId(clienteId);
  const delCliente = clienteIdLocal
    ? delGrupo.filter((c) => toValidId(c?.cliente?.id ?? c?.cliente_id) === clienteIdLocal)
    : [];

  const pool = delCliente.length > 0 ? delCliente : delGrupo;

  const vigente = pool.find((c) => toBoolFlag(c?.vigente, false));
  if (vigente) return vigente;

  const conCancel = pool
    .map((c) => ({ c, t: toTime(c?.fecha_cancelacion) }))
    .filter((x) => x.t != null)
    .sort((a, b) => b.t - a.t)[0]?.c;
  if (conCancel) return conCancel;

  const conRetiro = pool
    .map((c) => ({ c, t: toTime(c?.fecha_retiro) }))
    .filter((x) => x.t != null)
    .sort((a, b) => b.t - a.t)[0]?.c;
  if (conRetiro) return conRetiro;

  return pool[0];
}

export function getCoberturasFromGrupoFull(grupoFull) {
  if (Array.isArray(grupoFull?.coberturas)) return grupoFull.coberturas;
  if (Array.isArray(grupoFull?.data?.coberturas)) return grupoFull.data.coberturas;
  return [];
}

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

    const coberturaDefinida =
      c?.cobertura_definida != null ? String(c.cobertura_definida).trim() : "";
    if (coberturaDefinida) {
      return {
        estado: coberturaDefinida,
        fecha:
          coberturaDefinida === "Cancelado"
            ? fechaCancelacionValida
            : fechaRetiroValida,
        tipoFecha:
          coberturaDefinida === "Cancelado"
            ? "cancelacion"
            : coberturaDefinida === "Retirado" || coberturaDefinida === "Terminado"
              ? "retiro"
              : null,
      };
    }

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

export function vigenteDesdeEstadoCobertura(estado) {
  const s = (estado ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["yes", "sí", "si"].includes(s)) return true;
  if (["no", "medicare", "medicaid", "medicai"].includes(s)) return false;
  return null;
}

const hasFechaCobertura = (v) => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== "" && s.toLowerCase() !== "null";
};

/**
 * Quién puede participar en "Copiar datos entre miembros".
 * Solo coberturas activas en el grupo: activo=true, sin retiro ni cancelación.
 * No / Medicare / Medicaid sin esas fechas sí entran (dirección + elegibilidad).
 * Retiradas (activo=false o fecha_retiro) y canceladas (fecha_cancelacion) no.
 */
export function esElegibleParaCopiarEntreMiembros(m = {}) {
  if (!toBoolFlag(m.activo, true)) return false;
  if (hasFechaCobertura(m.fecha_retiro)) return false;
  if (hasFechaCobertura(m.fecha_cancelacion)) return false;
  return true;
}

/**
 * No / Medicare / Medicaid: al copiar entre miembros no reciben el resto de
 * datos de cobertura. Sí pueden recibir dirección y elegibilidad.
 * Solo aplica a coberturas aún elegibles para copiar (no retiradas/canceladas).
 */
export function soloPermiteCopiarDireccion(estado) {
  return vigenteDesdeEstadoCobertura(estado) === false;
}

/** Campos de cobertura que sí se copian aunque el destino sea No/Medicare/Medicaid. */
export const CAMPOS_COPIABLES_COBERTURA_RESTRINGIDA = ["elegibilidad"];

export function isMedicareOrMedicaidEstado(estado) {
  const s = (estado ?? "").trim().toLowerCase();
  return s === "medicare" || s === "medicaid";
}

/**
 * Campos de cobertura que no aplican en Medicare/Medicaid.
 * Se conservan: estado_cobertura, elegibilidad, grupo y campos de retiro/cancelación.
 */
export function clearedCoverageFieldsForMedicareMedicaid() {
  return {
    codigo_poliza: "",
    policy_number: "",
    vigencia: "",
    fecha_activacion: "",
    ano_cobertura: "",
    compania_id: null,
    agente: "",
    plan: "",
    metal: "",
    red: "",
    pagador_id: null,
    tipo_pago: "",
    dia_pago: null,
    precio: null,
  };
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

/**
 * Indica si la fecha de activación es posterior a hoy (plan aún no iniciado).
 * Sin fecha válida devuelve false.
 */
export function isFechaActivacionPendiente(fechaActivacion, now = new Date()) {
  const fecha = parseApiDateToLocalDate(fechaActivacion);
  if (!fecha) return false;

  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return fecha.getTime() > hoy.getTime();
}
