// services/GrupoFamiliarService.js
import apiRequest from './api';

const GrupoFamiliarService = {
  create: async (grupoFamiliarData) => {
    return await apiRequest("grupo_familiar/create", "POST", grupoFamiliarData);
  },

  fullUpdate: async (id, payload) => {
    return await apiRequest(`grupo_familiar/grupos-familiares-full-update/${id}`, "PUT", payload);
  },
  
  

  getFullGrupoById: async (id) => {
    // 🔁 Coincide con: Route::get('/grupos-familiares-full/{id}')
    return await apiRequest(`grupo_familiar/grupos-familiares-full/${id}`, "GET");
  },

  getBasicGrupoById: async (id) => {
    return await apiRequest(`grupo_familiar/show/${id}`, "GET");
  },

  saveCoberturas: async (grupoFamiliarId, coverageGroups) => {
    const promises = coverageGroups.map(async (group) => {
      const memberPromises = group.members.map(async (member) => {
        if (!member.id) return null;

        const coberturaData = {
          codigo_poliza: member.codigo_poliza || "",
          parentesco: member.parentesco || null,
          fecha_activacion: member.fecha_activacion || null,
          fecha_cancelacion: member.fecha_cancelacion || null,
          ano_cobertura: member.ano_cobertura || new Date().getFullYear().toString(),
          compania_id: member.compania_id || null,
          plan: member.plan || "",
          metal: member.metal || "",
          elegibilidad: member.elegibilidad || "",
          estado_cobertura: member.estado_cobertura || "",
          red: member.red || "",
          pagador_id: member.pagador_id || "",
          precio: member.precio || 0,
          cliente_id: member.id,
          grupo_familiar_id: grupoFamiliarId,
          cobertura_tipo: group.cobertura_tipo
        };

        const endpoint = member.cobertura_id
          ? `cobertura/${member.cobertura_id}`
          : "cobertura/create";

        const method = member.cobertura_id ? "PUT" : "POST";

        return await apiRequest(endpoint, method, coberturaData);
      });

      return Promise.all(memberPromises.filter(Boolean));
    });

    return Promise.all(promises);
  }
};

export default GrupoFamiliarService;
