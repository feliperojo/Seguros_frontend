
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

  // Procesar tags (etiquetas): validar formato y enviar como array al backend
  let tagsArray = null;
  if (f.etiquetas) {
    try {
      let etiquetasArray = null;
      
      // Si es array, validar y usar directamente
      if (Array.isArray(f.etiquetas)) {
        // Validar que cada etiqueta tenga key, label y color
        const validas = f.etiquetas.filter(tag => 
          tag && 
          typeof tag === "object" && 
          tag.key && 
          tag.label && 
          tag.color &&
          typeof tag.key === "string" &&
          typeof tag.label === "string" &&
          typeof tag.color === "string"
        );
        etiquetasArray = validas.length > 0 ? validas : null;
      } 
      // Si es string, intentar parsear (por si viene del backend como JSON string)
      else if (typeof f.etiquetas === "string" && f.etiquetas.trim()) {
        const parsed = JSON.parse(f.etiquetas);
        if (Array.isArray(parsed)) {
          // Validar formato de cada etiqueta
          const validas = parsed.filter(tag => 
            tag && 
            typeof tag === "object" && 
            tag.key && 
            tag.label && 
            tag.color
          );
          etiquetasArray = validas.length > 0 ? validas : null;
        }
      }
      
      // Enviar como array directamente (no como JSON string)
      if (etiquetasArray && etiquetasArray.length > 0) {
        tagsArray = etiquetasArray;
        console.log("🏷️ [mapGrupoFromForm] Tags procesadas para enviar al backend:", {
          cantidad: tagsArray.length,
          tags: tagsArray
        });
      } else {
        console.log("🏷️ [mapGrupoFromForm] No hay tags válidas para enviar");
      }
    } catch (error) {
      console.error("❌ Error al procesar tags:", error);
      // Si hay error, no enviar tags (null)
      tagsArray = null;
    }
  }

  const payload = {
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
    
    // Tags: enviar como array directamente (el backend espera "tags" como array)
    tags: tagsArray,
  };

  // Log del payload completo (sin datos sensibles)
  console.log("📤 [mapGrupoFromForm] Payload completo para backend:", {
    ...payload,
    tags: tagsArray ? `[Array con ${tagsArray.length} tags]` : null
  });

  return payload;
};

// --- Fecha helpers ---
// A ISO 'YYYY-MM-DD' desde string (ISO, Date, timestamp o 'MM/DD/YYYY')
export const toISODate = (v) => {
  if (!v) return null;
  if (typeof v === 'string') {
    // Acepta 'YYYY-MM-DD' (input type=date) ó 'MM/DD/YYYY'
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    
    // Si es un string ISO con T (ej: "2024-01-15T00:00:00.000Z"), extraer solo la parte de la fecha
    if (v.includes("T")) {
      const datePart = v.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    }
    
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, M, D, Y] = m;
      const yyyy = (Y.length === 2 ? (Number(Y) + 2000) : Number(Y)).toString().padStart(4,'0');
      return `${yyyy}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`;
    }
    // Último recurso: intentar parsear como Date
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      // Usar métodos locales para evitar problemas de zona horaria
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  // Si es un objeto Date, usar métodos locales
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const year = v.getFullYear();
    const month = String(v.getMonth() + 1).padStart(2, "0");
    const day = String(v.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
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
