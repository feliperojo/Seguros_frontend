/**
 * Diff legible para el detalle de actividad de usuarios.
 * Compara estado anterior vs posterior y expone solo cambios útiles.
 */

const CAMPOS_IGNORAR = new Set([
  "id",
  "user_id",
  "cliente_id",
  "grupo_familiar_id",
  "cobertura_id",
  "created_at",
  "updated_at",
  "deleted_at",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "fecha_actualizacion",
  "password",
  "remember_token",
  "email_verified_at",
]);

const FIELD_LABELS = {
  // Grupo familiar
  ingreso_familiar_anual: "Ingreso familiar anual",
  personas_cobertura: "Personas en cobertura",
  personas_taxes: "Personas en Taxes",
  zip_code: "ZIP Code",
  fecha_autorizacion: "Fecha de autorización",
  nombre_autorizado: "Nombre autorizado",
  nota: "Nota",
  activo: "Activo",
  relacion: "Relación",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  texto_sms: "SMS",
  cod_tel_1: "Código teléfono 1",
  cod_tel_2: "Código teléfono 2",
  drive_url: "URL de Drive",
  cual: "Cuál",
  tags: "Etiquetas",
  coberturas: "Coberturas",
  clientes: "Personas",
  forma_pago: "Forma de pago",

  // Cliente / persona
  nombre_completo: "Nombre completo",
  primer_nombre: "Primer nombre",
  segundo_nombre: "Segundo nombre",
  apellidos: "Apellidos",
  fecha_nacimiento: "Fecha de nacimiento",
  genero: "Género",
  pais_origen: "País de origen",
  peso: "Peso",
  altura: "Altura",
  pulgadas: "Pulgadas",
  social: "Social / SSN",
  ssn: "SSN",
  status: "Status migratorio",
  auscis: "USCIS",
  tarjeta_numero: "Número de tarjeta",
  categoria: "Categoría",
  fecha_emision: "Fecha de emisión",
  fecha_expiracion: "Fecha de expiración",
  direccion: "Dirección",
  dir_correspondencia: "Dirección de correspondencia",
  calle: "Calle",
  apto: "Apto",
  ciudad: "Ciudad",
  condado: "Condado",
  estado: "Estado",
  codigo_postal: "Código postal",
  telefono: "Teléfono",
  email: "Email",
  whatsapp_num: "Número de WhatsApp",
  secundario: "Teléfono secundario",
  idioma: "Idioma",
  telefonos: "Teléfonos",
  tipo_ingreso: "Tipo de ingreso",
  actividad_economica: "Actividad económica",
  empleador: "Empleador",
  telefono_empleador: "Teléfono del empleador",
  periodo_ingreso: "Periodo de ingreso",
  ingreso_por_periodo: "Ingreso por periodo",
  ingreso_anual: "Ingreso anual",
  empresa: "Empresa",

  // Cobertura
  plan: "Plan",
  metal: "Metal",
  red: "Red",
  grupo: "Grupo",
  estado_cobertura: "Estado de cobertura",
  cobertura_tipo: "Tipo de cobertura",
  codigo_poliza: "Código de póliza",
  precio: "Precio",
  ano_cobertura: "Año de cobertura",
  fecha_activacion: "Fecha de activación",
  fecha_cancelacion: "Fecha de expiración",
  fecha_retiro: "Fecha de retiro",
  fecha_anulacion: "Fecha de anulación",
  motivo_anulacion: "Motivo de anulación",
  nota_anulacion: "Nota de anulación",
  elegibilidad: "Elegibilidad",
  nombre: "Nombre",
  compania: "Compañía",
  parentesco: "Parentesco",
  tipo_pago: "Tipo de pago",

  // Medio de pago
  tipo_tarjeta: "Tipo de tarjeta",
  titular: "Titular",
  numero_tarjeta: "Número de tarjeta",
  cvv: "CVV",
  banco: "Banco",
  es_principal: "Es principal",

  // Usuario / roles
  name: "Nombre",
  slug: "Identificador",
  description: "Descripción",
  module: "Módulo",
  is_active: "Activo",
  roles: "Roles",
  permissions: "Permisos",
  note: "Nota",
  concept: "Concepto",
};

const isEmptyValue = (value) => {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
};

const shouldIgnoreKey = (key) => {
  if (!key) return true;
  if (CAMPOS_IGNORAR.has(key)) return true;
  const lower = String(key).toLowerCase();
  if (
    lower.includes("updated_at") ||
    lower.includes("updatedat") ||
    lower.includes("fecha_actualizacion")
  ) {
    return true;
  }
  // IDs técnicos / llaves foráneas (excepto si el label ya es útil vía FIELD_LABELS)
  if (lower.endsWith("_id") && !FIELD_LABELS[key]) return true;
  return false;
};

const stableStringify = (value) => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
};

const valuesEqual = (a, b) => stableStringify(a) === stableStringify(b);

const humanizeKey = (key) => {
  if (!key) return "Campo";
  const raw = String(key);

  if (FIELD_LABELS[raw]) return FIELD_LABELS[raw];

  const coberturaMatch = raw.match(/^cobertura_(\d+)(?:\.(.+))?$/);
  if (coberturaMatch) {
    const id = coberturaMatch[1];
    const rest = coberturaMatch[2];
    if (!rest) return `Cobertura #${id}`;
    if (rest.startsWith("cliente.")) {
      const clienteField = rest.replace(/^cliente\./, "");
      return `Cobertura #${id} · ${FIELD_LABELS[clienteField] || humanizeLeaf(clienteField)}`;
    }
    return `Cobertura #${id} · ${FIELD_LABELS[rest] || humanizeLeaf(rest)}`;
  }

  const leaf = raw.split(".").pop();
  if (FIELD_LABELS[leaf]) return FIELD_LABELS[leaf];
  return humanizeLeaf(leaf);
};

const humanizeLeaf = (leaf) =>
  String(leaf)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());


const summarizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return formatActivityValue(obj);
  const name =
    obj.nombre_completo ||
    obj.nombre ||
    [obj.primer_nombre, obj.apellidos].filter(Boolean).join(" ") ||
    obj.name ||
    obj.plan ||
    obj.codigo_poliza ||
    null;
  if (name) {
    const extra = obj.parentesco || obj.estado_cobertura || obj.compania || null;
    return extra ? `${name} (${extra})` : String(name);
  }
  if (obj.id != null) return `Registro #${obj.id}`;
  return "Detalle";
};

/**
 * Formatea un valor para mostrarlo al usuario final.
 */
export const formatActivityValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return value.map((item) => formatActivityValue(item)).join(", ");
    }
    return value.map((item) => summarizeObject(item)).join("; ");
  }

  if (typeof value === "object") {
    return summarizeObject(value);
  }

  const str = String(value);
  // Fechas ISO simples
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("es-ES");
    }
  }
  return str;
};

const pushChange = (changes, path, before, after, type = "changed") => {
  changes.push({
    path,
    label: humanizeKey(path),
    before,
    after,
    type,
  });
};

const diffObjects = (before, after, prefix = "", changes = []) => {
  const beforeObj = before && typeof before === "object" && !Array.isArray(before) ? before : {};
  const afterObj = after && typeof after === "object" && !Array.isArray(after) ? after : {};
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  keys.forEach((key) => {
    if (shouldIgnoreKey(key)) return;

    const path = prefix ? `${prefix}.${key}` : key;
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];

    if (valuesEqual(beforeVal, afterVal)) return;

    // Arrays de objetos con id (p. ej. coberturas)
    if (
      Array.isArray(beforeVal) ||
      Array.isArray(afterVal)
    ) {
      diffArrays(beforeVal || [], afterVal || [], path, changes);
      return;
    }

    // Objetos anidados: aplanar si ambos son objetos planos
    if (
      beforeVal &&
      afterVal &&
      typeof beforeVal === "object" &&
      typeof afterVal === "object" &&
      !Array.isArray(beforeVal) &&
      !Array.isArray(afterVal)
    ) {
      diffObjects(beforeVal, afterVal, path, changes);
      return;
    }

    // Alta de objeto anidado
    if (isEmptyValue(beforeVal) && afterVal && typeof afterVal === "object" && !Array.isArray(afterVal)) {
      Object.entries(afterVal).forEach(([childKey, childVal]) => {
        if (shouldIgnoreKey(childKey) || isEmptyValue(childVal)) return;
        pushChange(changes, `${path}.${childKey}`, null, childVal, "added");
      });
      return;
    }

    // Baja de objeto anidado
    if (beforeVal && typeof beforeVal === "object" && !Array.isArray(beforeVal) && isEmptyValue(afterVal)) {
      Object.entries(beforeVal).forEach(([childKey, childVal]) => {
        if (shouldIgnoreKey(childKey) || isEmptyValue(childVal)) return;
        pushChange(changes, `${path}.${childKey}`, childVal, null, "removed");
      });
      return;
    }

    pushChange(
      changes,
      path,
      beforeVal,
      afterVal,
      isEmptyValue(beforeVal) ? "added" : isEmptyValue(afterVal) ? "removed" : "changed"
    );
  });

  return changes;
};

const diffArrays = (beforeArr, afterArr, path, changes) => {
  const beforeList = Array.isArray(beforeArr) ? beforeArr : [];
  const afterList = Array.isArray(afterArr) ? afterArr : [];

  const beforeHasIds = beforeList.some((item) => item && typeof item === "object" && item.id != null);
  const afterHasIds = afterList.some((item) => item && typeof item === "object" && item.id != null);

  if (!beforeHasIds && !afterHasIds) {
    if (!valuesEqual(beforeList, afterList)) {
      pushChange(changes, path, beforeList, afterList);
    }
    return;
  }

  const beforeMap = new Map();
  const afterMap = new Map();
  beforeList.forEach((item, idx) => {
    const key = item && item.id != null ? String(item.id) : `idx-${idx}`;
    beforeMap.set(key, item);
  });
  afterList.forEach((item, idx) => {
    const key = item && item.id != null ? String(item.id) : `idx-${idx}`;
    afterMap.set(key, item);
  });

  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  allKeys.forEach((key) => {
    const beforeItem = beforeMap.get(key);
    const afterItem = afterMap.get(key);
    const itemPath =
      path === "coberturas" && !String(key).startsWith("idx-")
        ? `cobertura_${key}`
        : `${path}[${key}]`;

    if (beforeItem && !afterItem) {
      pushChange(changes, itemPath, beforeItem, null, "removed");
      return;
    }
    if (!beforeItem && afterItem) {
      pushChange(changes, itemPath, null, afterItem, "added");
      return;
    }
    if (beforeItem && afterItem && !valuesEqual(beforeItem, afterItem)) {
      if (
        typeof beforeItem === "object" &&
        typeof afterItem === "object" &&
        !Array.isArray(beforeItem) &&
        !Array.isArray(afterItem)
      ) {
        diffObjects(beforeItem, afterItem, itemPath, changes);
      } else {
        pushChange(changes, itemPath, beforeItem, afterItem);
      }
    }
  });
};

/**
 * Lista campos con valor útil de un objeto (creación / eliminación).
 */
export const extractMeaningfulFields = (data, prefix = "") => {
  if (!data || typeof data !== "object") return [];
  const rows = [];

  const walk = (obj, pathPrefix) => {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      if (obj.length === 0) return;
      const labelPath = pathPrefix || "lista";
      rows.push({
        path: labelPath,
        label: humanizeKey(labelPath),
        before: null,
        after: obj,
        type: "info",
      });
      return;
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (shouldIgnoreKey(key)) return;
      if (isEmptyValue(value)) return;
      if (value === false) return; // evita ruido de flags en false

      const path = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (Array.isArray(value)) {
        if (value.length === 0) return;
        rows.push({
          path,
          label: humanizeKey(path),
          before: null,
          after: value,
          type: "info",
        });
        return;
      }

      if (typeof value === "object") {
        walk(value, path);
        return;
      }

      rows.push({
        path,
        label: humanizeKey(path),
        before: null,
        after: value,
        type: "info",
      });
    });
  };

  walk(data, prefix);
  return rows;
};

/**
 * Parsea before/after (string JSON u objeto) y calcula cambios visibles.
 */
export const buildActivityChanges = (beforeRaw, afterRaw, actionKey = "update") => {
  const parse = (raw) => {
    if (raw == null) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  };

  const before = parse(beforeRaw);
  const after = parse(afterRaw);
  const action = String(actionKey || "").toLowerCase();

  if (before && after && typeof before === "object" && typeof after === "object") {
    return {
      mode: "diff",
      changes: diffObjects(before, after),
    };
  }

  if ((!before || action === "create" || action === "login") && after) {
    if (typeof after === "object") {
      return { mode: "created", changes: extractMeaningfulFields(after) };
    }
    return {
      mode: "created",
      changes: [{ path: "valor", label: "Valor", before: null, after, type: "added" }],
    };
  }

  if (before && (!after || action === "delete")) {
    if (typeof before === "object") {
      return {
        mode: "deleted",
        changes: extractMeaningfulFields(before).map((row) => ({
          ...row,
          before: row.after,
          after: null,
          type: "removed",
        })),
      };
    }
    return {
      mode: "deleted",
      changes: [{ path: "valor", label: "Valor", before, after: null, type: "removed" }],
    };
  }

  return { mode: "empty", changes: [] };
};
