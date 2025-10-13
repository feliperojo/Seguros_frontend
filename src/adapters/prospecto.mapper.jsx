
import { parseMoney } from "../services/ingresos"; // 👈 importa el normalizador

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
    personas_taxes: toNumberOrZero(f.personasTaxes),
    personas_cobertura: toNumberOrZero(f.personasCobertura),
    ingreso_familiar_anual: toNumberOrZero(f.ingresoFamiliar),
    id: !!f.id,
    persona_contacto: toNullIfEmpty((f.nombre ?? "").trim()),
    apellido_persona_contacto: toNullIfEmpty((f.apellidos ?? "").trim()),
    captado_por: toNullIfEmpty(f.captadoPor),
    cual: toNullIfEmpty(f.cual),
    responsable: toNullIfEmpty(f.asesor),
    relacion: toNullIfEmpty(f.relacion),
    nota: toNullIfEmpty(f.nota),
    zip_code: toNullIfEmpty(f.zipCode),

    pertenece_grupo_familiar: boolFromSiNo(f.perteneceFamilia),
    whatsapp: !!f.whatsapp,
    telegram: !!f.telegram,
    mensaje_sms: !!f.sms,


    telefono_1: toNullIfEmpty(f.telefono1),
    telefono_2: toNullIfEmpty(f.telefono2),
  };
};

// --- Fecha helpers ---
// A ISO 'YYYY-MM-DD' desde string (ISO, Date, timestamp o 'MM/DD/YYYY')
export const toISODate = (v) => {
  if (!v) return null;
  if (typeof v === 'string') {
    // Acepta 'YYYY-MM-DD' (input type=date) ó 'MM/DD/YYYY'
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, M, D, Y] = m;
      const yyyy = (Y.length === 2 ? (Number(Y) + 2000) : Number(Y)).toString().padStart(4,'0');
      return `${yyyy}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`;
    }
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString().slice(0,10);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0,10);
};

// Convierte "" → null y normaliza a ISO
export const cleanDate = (v) => {
  if (v === "") return null;
  return toISODate(v);
};


/* ======================= AJUSTE CLAVE =======================
 * Toma lo que viene del acordeón/Modal *y* del objeto m.cliente,
 * normaliza fecha a YYYY-MM-DD, ingreso a número y añade idioma.
 */
export const mapClienteFromMember = (m = {}) => {
  const c = m?.cliente || {};
  const pick = (k) => (m[k] ?? c[k] ?? null);
  const date10 = (v) => (v ? String(v).slice(0, 10) : null);

  // nombres
  const primer_nombre  = (pick("primer_nombre") || "").toString().trim();
  const segundo_nombre = toNullIfEmpty((pick("segundo_nombre") || "").toString().trim());
  const apellidos      = (pick("apellidos") || "").toString().trim();
  const nombre_completo = [primer_nombre, segundo_nombre, apellidos].filter(Boolean).join(" ");

  // fecha: acepta snake_case o camelCase
  const fecha_nacimiento =
     cleanDate(pick("fecha_nacimiento")) || cleanDate(m.fechaNacimiento);


  // ingreso: acepta número o string formateado (“12.345,67”)
  const ingreso_raw =
    m.ingreso_anual ?? c.ingreso_anual ?? m.ingresoAnual ?? c.ingresoAnual ?? "";
  const ingreso_num =
    typeof ingreso_raw === "number" ? ingreso_raw : parseMoney(String(ingreso_raw));

    const clienteIdReal = m.cliente_id ?? c.id ?? null;
    const esClienteReal = clienteIdReal && Number(clienteIdReal) > 50;

const payload = {
    primer_nombre,
    segundo_nombre,
    apellidos,
    nombre_completo,
    genero: pick("genero"),
    idioma: pick("idioma"),
    fecha_nacimiento,
    ingreso_anual: Number.isFinite(ingreso_num) ? ingreso_num : 0,
    nota: pick("nota"),
    telefono: pick("telefono"),
    secundario: pick("secundario"),
    whatsapp_num: pick("whatsapp_num"),
    email: pick("email"),
  };

  // 👇 SOLO agregar 'id' si es un cliente REAL de la BD
  if (esClienteReal) {
    payload.id = clienteIdReal;
  }

  return stripNulls(payload);
};

// (opcional) normaliza "Sí"/"Si"
const normSiNo = (v) => {
  if (!v) return "Si/No";
  const s = String(v).toLowerCase();
  if (s === "si" || s === "sí") return "Sí";
  if (s === "no") return "No";
  return v;
};

export const mapCoberturaFromMember = (m = {}, grupoId) =>
  stripNulls({
    id: m.cobertura_id ?? null,
    grupo_familiar_id: Number(grupoId),
    cliente_id: m.cliente_id ?? null,
    parentesco: m.parentesco || m.tipo || "Tomador",
    estado_cobertura: normSiNo(m.estado_cobertura || "Si/No"),
    ano_cobertura: (m.ano_cobertura || new Date().getFullYear()).toString(),
    cobertura_tipo: m.cobertura_tipo || null, // 👈 por si ya lo traes en el miembro
    fecha_activacion: cleanDate(m.fecha_activacion ?? m?.cobertura?.fecha_activacion ?? null),
    fecha_cancelacion: cleanDate(m.fecha_cancelacion),
    fecha_retiro: cleanDate(m.fecha_retiro),
    activo: m.activo ?? true,
    grupo: m.grupo || null,
    plan: m.plan || "",
    metal: m.metal || null,
    red: m.red || null,
    codigo_poliza: m.codigo_poliza || "",
    elegibilidad: m.elegibilidad || "",
    precio: m.precio ?? null,
    tipo_pago: m.tipo_pago || null,
    compania_id: m.compania_id || null,
    pagador_id: m.pagador_id || null,
    dia_pago: m.dia_pago ?? null,
  });
