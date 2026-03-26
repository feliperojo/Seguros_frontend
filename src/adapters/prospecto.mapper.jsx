
import { parseMoney } from "../services/ingresos"; // 👈 importa el normalizador
import { splitFullName } from "../utils/names";

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

// Capitaliza la primera letra de cada palabra (para países)
export const capitalizeWords = (s = "") => {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());
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

  const parsedId = Number(f.id);
  const hasValidId = Number.isInteger(parsedId) && parsedId > 0;

  const payload = {
    personas_taxes: toNumberOrZero(f.personasTaxes),
    personas_cobertura: toNumberOrZero(f.personasCobertura),
    ingreso_familiar_anual: toNumberOrZero(f.ingresoFamiliar),
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

  if (hasValidId) {
    payload.id = parsedId;
  }

  // Log del payload completo (sin datos sensibles)
  console.log("📤 [mapGrupoFromForm] Payload completo para backend:", {
    ...payload,
    tags: tagsArray ? `[Array con ${tagsArray.length} tags]` : null
  });

  return stripNulls(payload);
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
  let primer_nombre  = (pick("primer_nombre") || "").toString().trim();
  let segundo_nombre = toNullIfEmpty((pick("segundo_nombre") || "").toString().trim());
  let apellidos      = (pick("apellidos") || "").toString().trim();

  // 🔹 Fallback seguro: si no hay partes de nombre pero sí viene nombre_completo,
  // úsalo para derivar nombres/apellidos (útil para importaciones CSV).
  if (!primer_nombre && !segundo_nombre && !apellidos) {
    const fullFromSource = (
      m.nombre_completo ??
      c.nombre_completo ??
      ""
    ).toString();

    if (fullFromSource.trim()) {
      const { nombres, apellidos: ap } = splitFullName(fullFromSource);
      primer_nombre = nombres || primer_nombre;
      apellidos = ap || apellidos;
    }
  }

  const nombre_completo =
    (pick("nombre_completo") ||
      [primer_nombre, segundo_nombre, apellidos].filter(Boolean).join(" ")
    ).toString().trim();

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
    pais_origen: capitalizeWords(pick("pais_origen") || ""),
    fecha_nacimiento,
    ingreso_anual: Number.isFinite(ingreso_num) ? ingreso_num : 0,
    nota: pick("nota"),
    telefono: pick("telefono"),
    secundario: pick("secundario"),
    whatsapp_num: pick("whatsapp_num"),
    email: pick("email"),
    whatsapp: !!pick("whatsapp"),
    telegram: !!pick("telegram"),
    texto_sms: !!pick("texto_sms"),
    direccion: pick("direccion"),
    calle: pick("calle"),
    apto: pick("apto"),
    ciudad: pick("ciudad"),
    estado: pick("estado"),
    codigo_postal: pick("codigo_postal"),
    condado: pick("condado"),
    dir_correspondencia: pick("dir_correspondencia"),
    social: pick("social"),
    status: pick("status"),
    auscis: pick("auscis"),
    tarjeta_numero: pick("tarjeta_numero"),
    fecha_emision: cleanDate(pick("fecha_emision")),
    fecha_expiracion: cleanDate(pick("fecha_expiracion")),
    categoria: pick("categoria"),
    // 🔹 Arreglo de teléfonos (si viene del import o de TomaDeDatos/ProspectoDatos)
    telefonos: pick("telefonos"),
  };

  // 📞 Si no hay `telefono` plano pero sí arreglo de `telefonos`, derivar uno principal
  if (!payload.telefono) {
    const tels = Array.isArray(payload.telefonos) ? payload.telefonos : [];
    if (tels.length > 0) {
      const principal = tels.find((t) => t.principal) || tels[0];
      if (principal?.numero) {
        payload.telefono = String(principal.numero);
      }
    }
  }

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

export const mapCoberturaFromMember = (m = {}, grupoId) => {
  // Campos protegidos: solo se incluyen si YA tienen valores establecidos (preservar valores de renovación)
  // NO se pueden establecer/modificar desde actualizaciones normales (solo desde modales especializados)
  
  const payload = {
    id: m.cobertura_id ?? null,
    grupo_familiar_id: Number(grupoId),
    cliente_id: m.cliente_id ?? null,
    parentesco: m.parentesco || m.tipo || "Tomador",
    estado_cobertura: normSiNo(m.estado_cobertura || "Si/No"),
    ano_cobertura: (m.ano_cobertura || new Date().getFullYear()).toString(),
    cobertura_tipo: m.cobertura_tipo || null,
    fecha_activacion: cleanDate(
      m.fecha_activacion ?? m?.cobertura?.fecha_activacion ?? null
    ),
    grupo: m.grupo || null,
    plan: m.plan || "",
    metal: m.metal || null,
    red: m.red || null,
    codigo_poliza: m.codigo_poliza || "",
    policy_number: m.policy_number || "",
    elegibilidad: m.elegibilidad || "",
    precio: m.precio ?? null,
    tipo_pago: m.tipo_pago || null,
    compania_id: m.compania_id || null,
    agente: m.agente || "",
    pagador_id: m.pagador_id || null,
    dia_pago: m.dia_pago ?? null,
  };
  
  // ✅ PRESERVAR campos protegidos (de renovación/reactivación/retiro)
  // IMPORTANTE: Estos campos pueden venir del miembro directamente o del objeto cobertura
  // Se incluyen siempre que estén presentes (incluso si son null para permitir limpiarlos)
  const fechaCancelacion = cleanDate(
    m.fecha_cancelacion ?? m?.cobertura?.fecha_cancelacion ?? null
  );
  const fechaRetiro = cleanDate(
    m.fecha_retiro ?? m?.cobertura?.fecha_retiro ?? null
  );
  const notaCancel = (m.nota_cancel ?? m?.cobertura?.nota_cancel ?? "").trim();
  const notaRetiro = (m.nota_retiro ?? m?.cobertura?.nota_retiro ?? "").trim();
  const motivoCancelacion = (m.motivo_cancelacion ?? m?.cobertura?.motivo_cancelacion ?? "").trim();
  
  // Incluir fecha_cancelacion si está presente (incluso si es null para permitir limpiarla)
  if (m.fecha_cancelacion !== undefined || m?.cobertura?.fecha_cancelacion !== undefined) {
    payload.fecha_cancelacion = fechaCancelacion;
  }
  
  // Incluir fecha_retiro si está presente (incluso si es null para permitir limpiarla)
  if (m.fecha_retiro !== undefined || m?.cobertura?.fecha_retiro !== undefined) {
    payload.fecha_retiro = fechaRetiro;
  }
  
  // ✅ IMPORTANTE: Incluir notas y motivo_cancelacion cuando hay fechas de retiro/cancelación
  // Esto es necesario para que el backend pueda crear el registro retiro_cancelacion
  // Incluir incluso si están vacíos cuando hay fechas relacionadas
  if (m.fecha_cancelacion !== undefined || m?.cobertura?.fecha_cancelacion !== undefined || fechaCancelacion) {
    payload.nota_cancel = notaCancel || null;
  }
  if (m.fecha_retiro !== undefined || m?.cobertura?.fecha_retiro !== undefined || fechaRetiro) {
    payload.nota_retiro = notaRetiro || null;
  }
  
  // motivo_cancelacion: incluir cuando hay fecha_cancelacion (necesario para retiro_cancelacion)
  if (m.fecha_cancelacion !== undefined || m?.cobertura?.fecha_cancelacion !== undefined || fechaCancelacion) {
    payload.motivo_cancelacion = motivoCancelacion || null;
  }
  
  // activo: SIEMPRE incluir (valores definidos por CambioVidaCancelacionModal)
  // Si está definido, usar ese valor; si no, usar true por defecto
  if (m.activo !== undefined && m.activo !== null) {
    // Normalizar a booleano: acepta true, "true", 1, false, "false", 0
    const activoValue = typeof m.activo === 'boolean' 
      ? m.activo 
      : (m.activo === true || m.activo === "true" || m.activo === 1 || m.activo === "1");
    payload.activo = activoValue;
  } else {
    // Valor por defecto: true (activo)
    payload.activo = true;
  }
  
  // vigente: SIEMPRE incluir (valores definidos por CambioVidaCancelacionModal)
  // Si está definido, usar ese valor; si no, calcular basado en fecha_cancelacion
  if (m.vigente !== undefined && m.vigente !== null) {
    // Normalizar a booleano: acepta true, "true", 1, false, "false", 0
    const vigenteValue = typeof m.vigente === 'boolean' 
      ? m.vigente 
      : (m.vigente === true || m.vigente === "true" || m.vigente === 1 || m.vigente === "1");
    payload.vigente = vigenteValue;
  } else {
    // Valor por defecto: false si hay fecha_cancelacion, true si no
    const tieneFechaCancelacion = m.fecha_cancelacion || m?.cobertura?.fecha_cancelacion;
    payload.vigente = !tieneFechaCancelacion;
  }
  
  return stripNulls(payload);
};
