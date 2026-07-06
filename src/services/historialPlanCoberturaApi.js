import apiRequest from "./api";

export const fetchHistorialPlan = (coberturaId) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan`, "GET");

export const archivarPlanActual = (coberturaId, payload) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan/archivar`, "POST", payload);
