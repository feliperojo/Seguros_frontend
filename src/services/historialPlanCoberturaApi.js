import apiRequest from "./api";

export const fetchHistorialPlan = (coberturaId) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan`, "GET");

export const crearHistorialPlan = (coberturaId, payload) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan`, "POST", payload);

export const archivarPlanActual = (coberturaId, payload) =>
  apiRequest(`coberturas/${coberturaId}/historial-plan/archivar`, "POST", payload);

export const anularYRecuperarPlanes = (payload) =>
  apiRequest("coberturas/historial-plan/anular-recuperar", "POST", payload);
