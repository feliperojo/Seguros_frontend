// services/GrupoFamiliarService.js
import apiRequest from "./api";

// Base paths (evita typos y facilita mantenimiento)
const BASE_GF = "grupo_familiar";
const BASE_GR = "grupos";
const BASE_COB = "cobertura";

const GrupoFamiliarService = {
  // ---- Grupo Familiar ----
  // Acepta headers opcional (ej. Idempotency-Key)
  create: async (grupoFamiliarData, headers = {}) => {
    return await apiRequest(`${BASE_GF}/create`, "POST", grupoFamiliarData, headers);
  },

  fullUpdate: async (id, payload, headers = {}) => {
    return await apiRequest(
      `${BASE_GF}/grupos-familiares-full-update/${id}`,
      "PUT",
      payload,
      headers
    );
  },

// POST /grupos/{grupoId}/miembros
appendMiembro: async (grupoId, payload, headers = {}) => {
  // payload: { request_id, grupo_version, cliente_nuevo | cliente_id, parentesco, cobertura:{...} }
  return await apiRequest(`${BASE_GR}/${grupoId}/miembros`, "POST", payload, headers);
},



  // ✅ trae todo el grupo con sus componentes (miembros, coberturas, etc)
  getFullById: async (id) => {
    const res = await apiRequest(`${BASE_GF}/grupos-familiares-full/${id}`, "GET");
    // tu API devuelve { status: "success", data: {...} }
    return res?.data ?? res;
  },

  // (Mantengo esta variante para compatibilidad; usa la misma ruta)
  getFullGrupoById: async (id, onlyActive = false) => {
    const url = onlyActive
      ? `${BASE_GF}/grupos-familiares-full/${id}?onlyActive=true`
      : `${BASE_GF}/grupos-familiares-full/${id}`;
    const response = await apiRequest(url, "GET");
    return response?.data ?? response;
  },

  getBasicGrupoById: async (id) => {
    return await apiRequest(`${BASE_GF}/show/${id}`, "GET");
  },

  // ---- Estados de grupo ----
  getEstadoActual: async (grupoId) => {
    return await apiRequest(`${BASE_GR}/${grupoId}/estado-actual`, "GET");
  },

  // headers opcional por si quieres auditar/etiquetar la transición
  setEstado: async (grupoId, codigo, motivo = null, metadata = null, headers = {}) => {
    return await apiRequest(`${BASE_GR}/${grupoId}/estado`, "POST", {
      codigo,
      motivo,
      metadata,
    }, headers);
  },

  // ---- Coberturas ----
  createCoberturaSimple: async (
    {
      grupo_familiar_id,
      cliente_id,
      estado_cobertura = "Si/No",
      parentesco = "Tomador",
      cobertura_tipo,
    },
    headers = {}
  ) => {
    const payload = {
      grupo_familiar_id,
      cliente_id,
      estado_cobertura,
      parentesco,
      cobertura_tipo,
      ano_cobertura: new Date().getFullYear().toString(),
      activo: true,
    };
    return await apiRequest(`${BASE_COB}/create`, "POST", payload, headers);
  },

  /**
   * Busca si un cliente ya tiene una cobertura activa/vigente
   * para el mismo tipo de producto en OTRO grupo familiar.
   *
   * Devuelve:
   *   - el objeto cobertura en conflicto, o
   *   - null si no hay conflicto.
   */
  findActiveCoverageConflict: async (clienteId, coberturaTipo, currentGrupoFamiliarId = null) => {
    if (!clienteId || !coberturaTipo) return null;

    const activasRaw = await apiRequest(`${BASE_COB}/activas`, "GET");
    // La API puede devolver array directo o envuelto (ej. { data: [...] }).
    const activas = Array.isArray(activasRaw)
      ? activasRaw
      : Array.isArray(activasRaw?.data)
      ? activasRaw.data
      : Array.isArray(activasRaw?.data?.data)
      ? activasRaw.data.data
      : [];
    const tipoActual = coberturaTipo.toString().trim().toUpperCase();
    const targetClienteId = Number(clienteId);

    if (!Array.isArray(activas) || !activas.length) return null;

    const toBool = (v) => v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";
    const isBlank = (v) => v === null || v === undefined || v === "";

    if (import.meta?.env?.DEV) {
      console.log("[GF] Validando conflicto de cobertura activa", {
        clienteId: targetClienteId,
        tipoActual,
        currentGrupoFamiliarId,
        totalActivas: activas.length,
        activasRawShape: Array.isArray(activasRaw) ? "array" : typeof activasRaw,
      });
    }

    const conflicto = activas.find((c) => {
      const cClienteId = c?.cliente?.id ?? c.cliente_id;
      const tipoCob = (c?.cobertura_tipo || "").toString().trim().toUpperCase();

      const estaVigente =
        toBool(c.activo) &&
        isBlank(c.fecha_cancelacion) &&
        isBlank(c.fecha_retiro) &&
        (c.vigente === undefined || c.vigente === null || toBool(c.vigente));

      if (!estaVigente) return false;

      const mismoCliente = Number(cClienteId) === targetClienteId;
      const mismoTipo = tipoCob === tipoActual;

      if (import.meta?.env?.DEV) {
        console.log("[GF] Cobertura activa revisada", {
          coberturaId: c.id,
          clienteId: cClienteId,
          grupoFamiliarId: c.grupo_familiar_id,
          tipoCobOriginal: c?.cobertura_tipo,
          tipoCobNormalizado: tipoCob,
          estaVigente,
          mismoCliente,
          mismoTipo,
          activoOriginal: c.activo,
          vigenteOriginal: c.vigente,
          fecha_cancelacion: c.fecha_cancelacion,
          fecha_retiro: c.fecha_retiro,
        });
      }

      if (!mismoCliente || !mismoTipo) return false;

      if (!c.grupo_familiar_id || currentGrupoFamiliarId == null) return true;

      return Number(c.grupo_familiar_id) !== Number(currentGrupoFamiliarId);
    });

    if (import.meta?.env?.DEV) {
      console.log("[GF] Resultado conflicto de cobertura activa", {
        hayConflicto: Boolean(conflicto),
        conflicto,
      });
    }

    return conflicto || null;
  },

  /**
   * Variante de conflicto para reactivación:
   * - Conflicto si existe cobertura con:
   *   - cliente igual
   *   - activo == true
   *   - mismo cobertura_tipo (producto)
   *   - y en otro grupo_familiar
   *
   * Este flujo ignora validaciones adicionales por fechas para alinearse
   * con la regla de negocio que usa el modal de reactivación.
   */
  findActiveCoverageConflictByActivoAndTipo: async (clienteId, coberturaTipo, currentGrupoFamiliarId = null) => {
    if (!clienteId || !coberturaTipo) return null;

    // Endpoint nuevo: devuelve SOLO coberturas con activo=true para ese cliente
    // Si retorna [] => no hay coberturas activas y, por tanto, no hay conflicto.
    const estadoRaw = await apiRequest(
      `${BASE_COB}/estado?cliente_id=${encodeURIComponent(clienteId)}`,
      "GET"
    );
    const activas = Array.isArray(estadoRaw)
      ? estadoRaw
      : Array.isArray(estadoRaw?.data)
        ? estadoRaw.data
        : Array.isArray(estadoRaw?.data?.data)
          ? estadoRaw.data.data
          : [];

    const tipoActual = String(coberturaTipo).trim().toUpperCase();

    const conflicto = activas.find((c) => {
      const tipoCob = (c?.cobertura_tipo || "").toString().trim().toUpperCase();
      const grupoFamiliarId = c?.grupo_familiar_id ?? c?.grupo?.id ?? c?.grupo?.grupo_familiar_id;

      const mismoTipo = tipoCob === tipoActual;
      if (!mismoTipo) return false;

      if (grupoFamiliarId == null || currentGrupoFamiliarId == null) return true;
      return Number(grupoFamiliarId) !== Number(currentGrupoFamiliarId);
    });

    return conflicto || null;
  },

  deleteCobertura: async (coberturaId, headers = {}) => {
    if (!coberturaId) throw new Error("Cobertura ID es requerido para eliminar.");
    return await apiRequest(`${BASE_COB}/${coberturaId}`, "DELETE", null, headers);
  },

  // Guarda múltiples coberturas (cada una es un create)
  saveCoberturas: async (grupoFamiliarId, coverageGroups, headers = {}) => {
    const requests = [];

    coverageGroups.forEach((group) => {
      group.members.forEach((member) => {
        if (member && member.id) {
          const coberturaData = {
            codigo_poliza: member.codigo_poliza || "",
            policy_number: member.policy_number || "",
            parentesco: member.parentesco || "",
            fecha_activacion: member.fecha_activacion || null,
            fecha_cancelacion: member.fecha_cancelacion || null,
            fecha_retiro: member.fecha_retiro || null,
            ano_cobertura: member.ano_cobertura || new Date().getFullYear().toString(),
            compania_id: member.compania_id || null,
            agente: member.agente || "",
            plan: member.plan || "",
            metal: member.metal || "",
            red: member.red || "",
            precio: parseFloat(member.precio) || 0,
            elegibilidad: member.elegibilidad || "",
            estado_cobertura: member.estado_cobertura || "",
            cliente_id:
              typeof member.cliente_id === "number"
                ? member.cliente_id
                : /^\d+$/.test(member.cliente_id)
                ? parseInt(member.cliente_id)
                : null,
            pagador_id:
              typeof member.pagador_id === "number"
                ? member.pagador_id
                : /^\d+$/.test(member.pagador_id)
                ? parseInt(member.pagador_id)
                : null,
            grupo_familiar_id: grupoFamiliarId,
            cobertura_tipo: group.tipoProducto || "SEGURO MEDICO OBAMA",
            vigencia: member.vigencia,
            activo: member.activo ?? true,
            dia_pago: member.dia_pago || 1,
            tipo_pago: member.tipo_pago || "",
            grupo: member.grupo || "G1",
            nota_cancel: member.nota_cancel || "",
          };

          requests.push(apiRequest(`${BASE_COB}/create`, "POST", coberturaData, headers));
        }
      });
    });

    return Promise.all(requests);
  },
};

export default GrupoFamiliarService;
