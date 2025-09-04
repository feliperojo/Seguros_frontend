// services/ClienteService.js
import apiRequest from './api';

const ClienteService = {
  // Este endpoint espera { clientes: [...] }
  createMany: (clientesArray) => apiRequest("cliente/create", "POST", { clientes: clientesArray }),
};

export default ClienteService;
