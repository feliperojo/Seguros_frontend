// src/services/MediosPagoService.js
import apiRequest from "./api";

export const MediosPagoService = {
  async getByCliente(clienteId, signal) {
    if (!clienteId) throw new Error("ClienteId requerido");
    // usa tu apiRequest: base = VITE_API_BASE_URL (o /api)
    // endpoint del backend que compartiste:
    const endpoint = `/mediopago/cliente/${clienteId}`;
    // apiRequest no acepta AbortSignal, así que solo lo pasamos a fetch si quisieras
    return apiRequest(endpoint, "GET");
  },
};
