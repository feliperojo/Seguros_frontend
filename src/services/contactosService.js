import apiRequest from "../services/api"; // tu helper existente
import { splitFullName } from "../utils/names";



// Busca el vínculo si ya existe (cliente y/o grupo)
export async function fetchClienteContacto({ clienteId, grupoFamiliarId }) {
  const qs = new URLSearchParams();
  if (clienteId) qs.append("cliente_id", clienteId);
  if (grupoFamiliarId) qs.append("grupo_familiar_id", grupoFamiliarId);
  return apiRequest(`/cliente-contacto?${qs.toString()}`, "GET");
}

// Crea/actualiza contacto en el directorio
export async function upsertContacto(payload) {
    const { nombres, apellidos } = splitFullName(payload.nombre_completo || "");
    const body = {
      ...payload,
      nombres,
      apellidos,
      nombre_completo: `${nombres} ${apellidos}`.trim(),
    };
    return apiRequest("/contactos", "POST", body);
  }
// Crea vínculo cliente/grupo ↔ contacto
export async function linkClienteContacto({
  clienteId,
  grupoFamiliarId,
  contactoId,
  relacion,
  perteneceAlGrupo = false,
  esPersonaContacto = false,
  prioridad = 0,
  nota = ""
}) {
  return apiRequest("/cliente-contacto", "POST", {
    cliente_id: clienteId ?? null,
    grupo_familiar_id: grupoFamiliarId ?? null,
    contacto_id: contactoId,
    relacion,
    pertenece_al_grupo: !!perteneceAlGrupo,
    es_persona_contacto: !!esPersonaContacto,
    prioridad,
    nota
  });
}

// Actualiza el vínculo (si ya existe)
export async function updateLinkClienteContacto(linkId, patch) {
  return apiRequest(`/cliente-contacto/${linkId}`, "PUT", patch);
}
