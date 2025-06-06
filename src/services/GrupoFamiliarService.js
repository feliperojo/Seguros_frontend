// services/GrupoFamiliarService.js
import apiRequest from './api';

const GrupoFamiliarService = {

  deleteCobertura: async (coberturaId) => {
    console.log("entramos a liminar cobertura",coberturaId)
    if (!coberturaId) throw new Error("Cobertura ID es requerido para eliminar.");
    return await apiRequest(`cobertura/${coberturaId}`, "DELETE");
  },

  create: async (grupoFamiliarData) => {
    console.log("antes de enviar a create",grupoFamiliarData)
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
    return await apiRequest(`grupo_familiar/show/${id}`, "GET");
  },
  
  
  
  
  

  getBasicGrupoById: async (id) => {
    return await apiRequest(`grupo_familiar/show/${id}`, "GET");
  },

  saveCoberturas: async (grupoFamiliarId, coverageGroups) => {
    console.log("entramos a la funcion de savecoberuta", grupoFamiliarId);
  
    const allMemberPromises = [];
  
    coverageGroups.forEach(group => {
      group.members.forEach(member => {
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
            pagador_id: member.pagador_id || "",
            cliente_id: member.id,
            grupo_familiar_id: grupoFamiliarId,
            cobertura_tipo: group.tipoProducto || "SEGURO MEDICO OBAMA"
          };
          
          allMemberPromises.push(apiRequest("cobertura/create", "POST", coberturaData));
        }
      });
    });
  
    return Promise.all(allMemberPromises);
  }
  
  

};

export default GrupoFamiliarService;
