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
  createCoberturaSimple: async ({
    grupo_familiar_id,
    cliente_id,
    estado_cobertura = "Si/No",
    parentesco = "Tomador",
    cobertura_tipo,
  }, headers = {}) => {
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
            parentesco: member.parentesco || "",
            fecha_activacion: member.fecha_activacion || null,
            fecha_cancelacion: member.fecha_cancelacion || null,
            fecha_retiro: member.fecha_retiro || null,
            ano_cobertura: member.ano_cobertura || new Date().getFullYear().toString(),
            compania_id: member.compania_id || null,
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
