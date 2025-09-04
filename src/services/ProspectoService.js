// services/ProspectoService.js
import { apiRequest, genUUID } from "./api";
import GrupoFamiliarService from "./GrupoFamiliarService";

const ProspectoService = {
  createProspecto: async (payload) => {
    // Si tu backend soporta este header, lo pasamos; si no, lo ignora.
    const headers = { "Idempotency-Key": genUUID() };

    // Opción A (recomendada): delegar al servicio existente, evitando adivinar rutas
    // Asegúrate de que GrupoFamiliarService.create acepte headers (si no, ver Opción B abajo).
    return GrupoFamiliarService.create(payload, headers);

    // Opción B (si no puedes tocar GrupoFamiliarService):
    // Usa EXACTAMENTE el mismo path que usa GrupoFamiliarService por dentro.
    // return apiRequest("<el-mismo-path-que-usa-tu-create>", "POST", payload, headers);
  },
};

export default ProspectoService;
