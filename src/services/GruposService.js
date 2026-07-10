// services/GrupoFamiliarService.js
import apiRequest from './api';

const GrupoFamiliarService = {
  deleteCobertura: async (coberturaId) => {
    if (!coberturaId) throw new Error("Cobertura ID es requerido para eliminar.");
    return await apiRequest(`cobertura/${coberturaId}`, "DELETE");
  },

  create: async (grupoFamiliarData) => {
    return await apiRequest("grupo_familiar/create", "POST", grupoFamiliarData);
  },

  fullUpdate: async (id, payload) => {
    return await apiRequest(`grupo_familiar/grupos-familiares-full-update/${id}`, "PUT", payload);
  },

  getFullGrupoById: async (id, onlyActive = false) => {
    const url = onlyActive
      ? `grupo_familiar/grupos-familiares-full/${id}?onlyActive=true`
      : `grupo_familiar/grupos-familiares-full/${id}`;
    const response = await apiRequest(url, "GET");
    return response.data;
  },

  getBasicGrupoById: async (id) => {
    return await apiRequest(`grupos-familiares-full/show/${id}`, "GET");
  },

  // Útil para el primer guardado (relación grupo-cliente básica)
  createCoberturaSimple: async ({ grupo_familiar_id, cliente_id, cobertura = "Si/No", tipo = "Tomador", parentesco = "Tomador",}) => {
    console.log("Creando cobertura simple", grupo_familiar_id, cliente_id, cobertura, tipo);
    const payload = {
      grupo_familiar_id,
      cliente_id,
      estado_cobertura: cobertura,
      tipo,
      parentesco,
      // deja los demás campos nulos/vacíos si no cotizas aún
      ano_cobertura: new Date().getFullYear().toString(),
      activo: true
    };
    return await apiRequest("cobertura/create", "POST", payload);
  },
};

export default GrupoFamiliarService;

