// services/EstadosService.js
import apiRequest from "./api";

const EstadosService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`estados${qs ? `?${qs}` : ""}`, "GET");
  },
};

export default EstadosService;
