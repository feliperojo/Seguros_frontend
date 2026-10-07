/**
 * Detalle de historial de una cobertura: combina eventos individuales
 * (GET /historial/Cobertura/{id}) con campos de esa cobertura en eventos
 * de GrupoFamiliar (claves cobertura_{id}.campo).
 *
 * Deduplicación: solo cuando operacion_id es no nulo en ambas filas y
 * coincide el campo. No se vincula por fecha, usuario ni valores.
 */

const CAMPOS_IGNORAR = new Set([
  "updated_at",
  "updatedAt",
  "fecha_actualizacion",
  "fechaActualizacion",
  "updated_at_cliente",
  "updatedAtCliente",
  "cliente.updated_at",
  "cliente.updatedAt",
  "cobertura_updated_at",
  "cobertura.updated_at",
]);

const CAMPOS_TECNICOS = new Set([
  "id",
  "created_at",
  "deleted_at",
  "edad",
  "cliente_id",
  "grupo_familiar_id",
  "compania_id",
]);

const RELACIONES = new Set([
  "cliente",
  "grupo_familiar",
  "medio_pago",
  "medios_pago",
  "responsable",
]);

/** Prefijo exacto cobertura_{id}. o cobertura_{id} (alta). */
export const prefijoCoberturaExacta = (coberturaId) => {
  const id = Number(coberturaId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `cobertura_${id}`;
};

export const esCampoDeCoberturaExacta = (campo, coberturaId) => {
  const id = Number(coberturaId);
  if (!Number.isFinite(id) || id <= 0 || campo == null) return false;
  const key = String(campo);
  // Ancla numérica exacta: evita que cobertura_1241 coincida con cobertura_12410.
  const match = key.match(new RegExp(`^cobertura_${id}\\.(.+)$`));
  if (!match) return false;
  const resto = match[1];
  if (!resto || resto.startsWith("cliente.")) return false;
  return true;
};

export const claveCampoCobertura = (campo = "") => {
  const raw = String(campo || "");
  const ultimo = raw.lastIndexOf(".");
  return ultimo >= 0 ? raw.slice(ultimo + 1) : raw;
};

export const esValorCambioPresentable = (info) => {
  if (!info || typeof info !== "object") return false;
  const { anterior, nuevo } = info;
  if ([anterior, nuevo].some((v) => v !== null && typeof v === "object")) {
    return false;
  }
  return JSON.stringify(anterior ?? null) !== JSON.stringify(nuevo ?? null);
};

export const esCampoCoberturaDetallePresentable = (campo, info) => {
  const key = claveCampoCobertura(campo);
  if (CAMPOS_IGNORAR.has(campo) || CAMPOS_IGNORAR.has(key)) return false;
  if (/updated|fecha_actualizacion/i.test(String(campo))) return false;
  if (CAMPOS_TECNICOS.has(key)) return false;
  if (RELACIONES.has(key)) return false;
  if (String(campo).startsWith("cliente.") || String(campo).includes(".cliente.")) {
    return false;
  }
  return esValorCambioPresentable(info);
};

/**
 * Extrae solo los cambios de cobertura_{id}.* de un evento de GrupoFamiliar.
 * Devuelve un mapa campoPlano -> { anterior, nuevo }.
 */
export const extraerCambiosCoberturaDesdeEventoGrupo = (evento, coberturaId) => {
  const cambios = evento?.cambios && typeof evento.cambios === "object" ? evento.cambios : {};
  const out = {};
  Object.keys(cambios).forEach((campo) => {
    if (!esCampoDeCoberturaExacta(campo, coberturaId)) return;
    const info = cambios[campo];
    if (!esCampoCoberturaDetallePresentable(campo, info)) return;
    out[claveCampoCobertura(campo)] = {
      anterior: info?.anterior,
      nuevo: info?.nuevo,
      campoOriginal: campo,
    };
  });
  return out;
};

const filaDesdeEvento = ({
  evento,
  campo,
  info,
  fuente,
  campoOriginal = campo,
}) => ({
  key: `${fuente}-${evento?.id ?? "sin-id"}-${campo}-${evento?.operacion_id ?? "sin-op"}`,
  fecha: evento?.created_at || evento?.fecha || null,
  usuario: evento?.usuario || "—",
  campo,
  campoOriginal,
  esCobertura: true,
  anterior: info?.anterior,
  nuevo: info?.nuevo,
  fuente, // "cobertura" | "grupo"
  eventoId: evento?.id ?? null,
  operacionId: evento?.operacion_id ?? null,
  modeloAfectado: evento?.modelo_afectado ?? null,
  modeloId: evento?.modelo_id ?? null,
  origen: evento?.origen ?? null,
  grupoFamiliarOrigenId: evento?.grupo_familiar_origen_id ?? null,
  coberturaOrigenId: evento?.cobertura_origen_id ?? null,
});

export const filasDesdeEventosCobertura = (eventos = []) => {
  const filas = [];
  (Array.isArray(eventos) ? eventos : []).forEach((evento) => {
    if (evento?.modelo_afectado && evento.modelo_afectado !== "Cobertura") return;
    const cambios = evento?.cambios && typeof evento.cambios === "object" ? evento.cambios : {};
    Object.keys(cambios).forEach((campo) => {
      const info = cambios[campo];
      if (!esCampoCoberturaDetallePresentable(campo, info)) return;
      filas.push(
        filaDesdeEvento({
          evento,
          campo: claveCampoCobertura(campo),
          info,
          fuente: "cobertura",
          campoOriginal: campo,
        })
      );
    });
  });
  return filas;
};

export const filasDesdeEventosGrupoParaCobertura = (eventos = [], coberturaId) => {
  const filas = [];
  (Array.isArray(eventos) ? eventos : []).forEach((evento) => {
    if (evento?.modelo_afectado && evento.modelo_afectado !== "GrupoFamiliar") return;
    const extraidos = extraerCambiosCoberturaDesdeEventoGrupo(evento, coberturaId);
    Object.entries(extraidos).forEach(([campo, info]) => {
      filas.push(
        filaDesdeEvento({
          evento,
          campo,
          info,
          fuente: "grupo",
          campoOriginal: info.campoOriginal || `cobertura_${coberturaId}.${campo}`,
        })
      );
    });
  });
  return filas;
};

const ordenFechaDesc = (a, b) =>
  String(b.fecha || "").localeCompare(String(a.fecha || ""));

/**
 * Combina filas de ambas fuentes.
 * Dedup seguro: mismo operacion_id (no nulo) + mismo campo → se conserva la fila de cobertura.
 * Sin operacion_id compartido no se deduplica; el caller puede marcar fuentes mixtas.
 */
export const combinarFilasHistorialCobertura = (filasCobertura = [], filasGrupo = []) => {
  const individuales = Array.isArray(filasCobertura) ? filasCobertura : [];
  const deGrupo = Array.isArray(filasGrupo) ? filasGrupo : [];

  const indiceIndividual = new Map();
  individuales.forEach((fila) => {
    if (!fila?.operacionId) return;
    indiceIndividual.set(`${fila.operacionId}|${fila.campo}`, fila);
  });

  const grupoConservadas = [];
  let deduplicadas = 0;
  deGrupo.forEach((fila) => {
    if (fila?.operacionId) {
      const clave = `${fila.operacionId}|${fila.campo}`;
      if (indiceIndividual.has(clave)) {
        deduplicadas += 1;
        return;
      }
    }
    grupoConservadas.push(fila);
  });

  const filas = [...individuales, ...grupoConservadas].sort(ordenFechaDesc);
  const fuentes = new Set(filas.map((f) => f.fuente));
  const hayFuentesMixtas = fuentes.has("cobertura") && fuentes.has("grupo");
  const haySinVinculoOperacion = filas.some((f) => !f.operacionId);

  return {
    filas,
    deduplicadas,
    hayFuentesMixtas,
    /** Si hay ambas fuentes y filas sin operacion_id, conviene distinguir visualmente. */
    distinguirFuentes: hayFuentesMixtas && haySinVinculoOperacion,
  };
};

/**
 * Orquesta extracción + combinación a partir de respuestas crudas del API.
 */
export const construirDetalleHistorialCobertura = ({
  coberturaId,
  eventosCobertura = [],
  eventosGrupo = [],
  errorCobertura = null,
  errorGrupo = null,
  sinGrupoId = false,
} = {}) => {
  const id = Number(coberturaId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      filas: [],
      warning: "No se pudo identificar la cobertura para consultar su historial.",
      error: null,
      distinguirFuentes: false,
      vacio: true,
    };
  }

  const filasCob = errorCobertura ? [] : filasDesdeEventosCobertura(eventosCobertura);
  const filasGf = errorGrupo || sinGrupoId
    ? []
    : filasDesdeEventosGrupoParaCobertura(eventosGrupo, id);

  const combinado = combinarFilasHistorialCobertura(filasCob, filasGf);

  const warnings = [];
  if (errorCobertura && errorGrupo) {
    return {
      filas: [],
      warning: null,
      error: "No se pudo cargar el historial de cambios de la cobertura ni del grupo.",
      distinguirFuentes: false,
      vacio: true,
    };
  }
  if (errorCobertura) {
    warnings.push(
      "No se pudo cargar el historial individual de la cobertura. Se muestran solo los cambios encontrados en el historial del grupo."
    );
  }
  if (errorGrupo) {
    warnings.push(
      "No se pudo cargar el historial del grupo. Se muestran solo los eventos individuales de la cobertura."
    );
  } else if (sinGrupoId) {
    warnings.push(
      "No hay ID de grupo familiar asociado a esta cobertura: no se pudieron incluir cambios registrados solo en el historial del grupo."
    );
  }

  return {
    filas: combinado.filas,
    warning: warnings.length ? warnings.join(" ") : null,
    error: null,
    distinguirFuentes: combinado.distinguirFuentes || combinado.hayFuentesMixtas,
    vacio: combinado.filas.length === 0,
    meta: {
      deduplicadas: combinado.deduplicadas,
      totalIndividual: filasCob.length,
      totalGrupo: filasGf.length,
    },
  };
};

export const etiquetaFuenteHistorialCobertura = (fuente) => {
  if (fuente === "grupo") return "Desde grupo";
  if (fuente === "cobertura") return "Cobertura";
  return null;
};
