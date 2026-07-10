// services/OperationalConceptsService.js
import apiRequest from "./api";

const OperationalConceptsService = {
  // Obtener todos los conceptos (con filtros opcionales)
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.only_parents) queryParams.append("only_parents", params.only_parents);
    if (params.with_children) queryParams.append("with_children", params.with_children);
    if (params.category) queryParams.append("category", params.category);

    const query = queryParams.toString();
    return apiRequest(`operational_concepts${query ? `?${query}` : ""}`, "GET");
  },

  // Obtener un concepto por ID
  get: async (id) => {
    return apiRequest(`operational_concepts/${id}`, "GET");
  },

  // Obtener los subconceptos (hijos) de un concepto padre
  getSubconcepts: async (id) => {
    return apiRequest(`operational_concepts/${id}/subconcepts`, "GET");
  },

  // Crear un nuevo concepto
  create: async (data) => {
    return apiRequest("operational_concepts", "POST", data);
  },

  // Actualizar un concepto existente
  update: async (id, data) => {
    return apiRequest(`operational_concepts/${id}`, "PUT", data);
  },

  // Eliminar un concepto
  delete: async (id) => {
    return apiRequest(`operational_concepts/${id}`, "DELETE");
  },
};

export default OperationalConceptsService;

