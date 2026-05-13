import apiRequest from "../services/api";
import { splitFullName } from "../utils/names";



export const searchClientes = async (nombre) => {
  const body = await apiRequest(
    `/cliente/buscar?nombre=${encodeURIComponent(nombre)}`,
    "GET"
  );
  return Array.isArray(body?.data) ? body.data : [];
};
/** ----------------------------------------------------------------
 *  LISTAR VÍNCULOS (cliente ↔ contacto) POR CLIENTE/GRUPO
 *  GET /cliente-contacto?cliente_id=&grupo_familiar_id=
 *  ---------------------------------------------------------------- */
export async function fetchClienteContacto({ clienteId, grupoFamiliarId }) {
  const qs = new URLSearchParams();
  if (clienteId) qs.append("cliente_id", clienteId);
  if (grupoFamiliarId) qs.append("grupo_familiar_id", grupoFamiliarId);
  return apiRequest(`/cliente-contacto?${qs.toString()}`, "GET");
}


/**
 * Crea un CLIENTE que actuará como “contacto” usando POST /cliente/create
 * Enviamos SOLO nombre (sin telefono/telefonos) para evitar errores.
 */

// contactosService.js

/**
 * Crea un CLIENTE que actuará como “contacto” usando POST /cliente/create
 * Enviamos telefonos como ARRAY (no string).
 */
export async function upsertClienteComoContacto(payload) {
  // Si vienen campos separados, usarlos directamente; si no, dividir nombre_completo
  let primer_nombre, segundo_nombre, apellidos, nombre_completo;

  if (payload.primer_nombre || payload.apellidos) {
    // Usar campos separados si están disponibles
    primer_nombre = payload.primer_nombre?.trim() || null;
    segundo_nombre = payload.segundo_nombre?.trim() || null;
    apellidos = payload.apellidos?.trim() || null;
    nombre_completo = [primer_nombre, segundo_nombre, apellidos].filter(Boolean).join(" ").trim() || payload.nombre_completo?.trim() || "";
  } else {
    // Fallback: dividir nombre_completo si no vienen campos separados
    const { nombres, apellidos: apellidosSplit } = splitFullName(payload.nombre_completo || "");
    const partes = (nombres || "").trim().split(/\s+/);
    primer_nombre = partes[0] || null;
    segundo_nombre = partes.length > 1 ? partes.slice(1).join(" ") : null;
    apellidos = apellidosSplit || null;
    nombre_completo = `${[nombres, apellidosSplit].filter(Boolean).join(" ")}`.trim();
  }

  const body = {
    clientes: [
      {
        nombre_completo: nombre_completo,
        primer_nombre,
        segundo_nombre,
        apellidos: apellidos || null,

        // opcionales seguros
        idioma: payload.idioma || null,

        // 👇 ENVIAR COMO ARRAY (cumple con 'nullable|array')
        telefonos: Array.isArray(payload.telefonos) ? payload.telefonos : [],

        // otros campos opcionales
        // telefono es un varchar simple, no afecta al validador
        telefono: Array.isArray(payload.telefonos) && payload.telefonos[0]?.numero
          ? payload.telefonos[0].numero
          : null,

        activo: true,
        es_prospecto: false,
        estado_cliente: "contacto",
      },
    ],
  };

  const res = await apiRequest("/cliente/create", "POST", body);
  const creado = res?.clientes?.[0] || null;

  if (!creado?.id) {
    throw new Error("No se recibió el id del contacto creado.");
  }

  return {
    contacto: {
      id: creado.id,
      nombre_completo: creado.nombre_completo ?? body.clientes[0].nombre_completo,
      idioma: body.clientes[0].idioma,
      // devolvemos el array original para la UI
      telefonos: body.clientes[0].telefonos,
      email: null,
    },
  };
}
/** ----------------------------------------------------------------
 *  CREAR VÍNCULO (cliente/grupo ↔ contacto)
 *  POST /cliente-contacto
 *  ---------------------------------------------------------------- */
export async function linkClienteContacto({
  clienteId,
  grupoFamiliarId,
  contactoId,
  relacion,
  perteneceAlGrupo = false,
  esPersonaContacto = false,
  prioridad = 0,
  nota = "",
}) {
  return apiRequest("/cliente-contacto", "POST", {
    cliente_id: clienteId ?? null,
    grupo_familiar_id: grupoFamiliarId ?? null,
    contacto_id: contactoId, // ahora es otro cliente.id
    relacion,
    pertenece_al_grupo: !!perteneceAlGrupo,
    es_persona_contacto: !!esPersonaContacto,
    prioridad,
    nota,
  });
}

/** ----------------------------------------------------------------
 *  ACTUALIZAR VÍNCULO
 *  PUT /cliente-contacto/:id
 *  ---------------------------------------------------------------- */
export async function updateLinkClienteContacto(linkId, patch) {
  return apiRequest(`/cliente-contacto/${linkId}`, "PUT", patch);
}
// ...exports existentes (fetchClienteContacto, upsertClienteComoContacto, etc.)

export async function deleteLinkClienteContacto(linkId) {
  // DELETE solo del vínculo cliente-contacto
  return await apiRequest(`/cliente-contacto/${linkId}`, "DELETE");
}
