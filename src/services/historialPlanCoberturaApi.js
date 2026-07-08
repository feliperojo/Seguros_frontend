import apiRequest from "./api";

export const fetchHistorialPlan = (coberturaId) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan`, "GET");

export const crearHistorialPlan = (coberturaId, payload) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan`, "POST", payload);

export const archivarPlanActual = (coberturaId, payload) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan/archivar`, "POST", payload);
