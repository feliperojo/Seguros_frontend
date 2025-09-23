// adapters/prospecto.mapper.js
export const buildPersonaContacto = (nombre = "", apellidos = "") =>
  [nombre?.trim(), apellidos?.trim()].filter(Boolean).join(" ");

const boolFromSiNo = (v) => {
  if (typeof v === "boolean") return v;
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === "si" || s === "sí" || s === "true" || s === "1";
};

export const toNullIfEmpty = (v) => (v === "" || v === undefined ? null : v);

export const toNumberOrZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const stripNulls = (obj = {}) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));

export const mapGrupoFromForm = (f = {}) => {
  const persona_contacto = buildPersonaContacto(f.nombre, f.apellidos);

  return {
    // columnas numéricas
    personas_taxes: toNumberOrZero(f.personasTaxes),
    personas_cobertura: toNumberOrZero(f.personasCobertura),
    ingreso_familiar_anual: toNumberOrZero(f.ingresoFamiliar),

    // texto
    persona_contacto: toNullIfEmpty((f.nombre ?? "").trim()),
    apellido_persona_contacto: toNullIfEmpty((f.apellidos ?? "").trim()),
    captado_por: toNullIfEmpty(f.captadoPor),
    cual: toNullIfEmpty(f.cual),
    responsable: toNullIfEmpty(f.asesor),
    relacion: toNullIfEmpty(f.relacion),
    nota: toNullIfEmpty(f.nota),
    zip_code: toNullIfEmpty(f.zipCode),

    // booleans
    pertenece_grupo_familiar: boolFromSiNo(f.perteneceFamilia),
    whatsapp: !!f.whatsapp,
    telegram: !!f.telegram,
    mensaje_sms: !!f.sms,

    // teléfonos: el back los quiere planos
    telefono_1: toNullIfEmpty(f.telefono1),
    telefono_2: toNullIfEmpty(f.telefono2),
  };
};

// Si ya tienes esta función, usa la tuya. Si no, aquí una base sólida.
export const mapClienteFromMember = (m = {}) => {
  const primer_nombre  = (m.primer_nombre ?? "").toString().trim();           // del modal/carta
  const segundo_nombre = toNullIfEmpty((m.segundo_nombre ?? "").toString().trim());
  const apellidos      = (m.apellidos ?? "").toString().trim();
  const nombre_completo = [primer_nombre, segundo_nombre, apellidos].filter(Boolean).join(" ");

  // Normaliza fecha (YYYY-MM-DD) si viene Date
  const fecha_nacimiento =
    m.fechaNacimiento instanceof Date
      ? m.fechaNacimiento.toISOString().slice(0, 10)
      : m.fechaNacimiento ?? null;

  return {
    id: m.cliente_id ?? m.id ?? null, // necesario para UPDATE
    primer_nombre,
    segundo_nombre,
    apellidos,
    nombre_completo,
    genero: m.genero ?? null,
    fecha_nacimiento,
    ingreso_anual: m.ingresoAnual ?? null,
    nota: m.nota ?? null,
  };
};
export const mapCoberturaFromMember = (m = {}, grupoId) => ({
  id: m.cobertura_id ?? null,             
  grupo_familiar_id: Number(grupoId),
  cliente_id: m.cliente_id ?? null,
  parentesco: m.parentesco || m.tipo || "Tomador",
  estado_cobertura: m.estado_cobertura || "Si/No",
  ano_cobertura: m.ano_cobertura || new Date().getFullYear().toString(),
  activo: m.activo ?? true,
  grupo: m.grupo || null, 
  plan: m.plan || "",
  metal: m.metal || null,
  red: m.red || null,
  codigo_poliza: m.codigo_poliza || "",
  elegibilidad: m.elegibilidad || "",
  precio: m.precio || null,
  tipo_pago: m.tipo_pago || null,
  compania_id:m.compania_id || null,
  pagador_id: m.pagador_id || null,
  
});