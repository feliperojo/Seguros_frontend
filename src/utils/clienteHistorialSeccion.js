import {
  CLIENTE_FIELDS_PRINCIPALES,
  CLIENTE_FIELDS_MIGRATORIO,
  CLIENTE_FIELDS_DIRECCION,
  CLIENTE_FIELDS_CONTACTO,
  CLIENTE_FIELDS_EMPLEO,
} from "./clienteFieldGroups";
import {
  formatDateForDisplay,
  formatPhone334,
  formatSSN,
} from "./formatters";

const CAMPOS_DERIVADOS = new Set(["edad"]);

const CAMPOS_FECHA = new Set([
  "fecha_nacimiento",
  "fecha_emision",
  "fecha_expiracion",
]);

const CAMPOS_TELEFONO = new Set([
  "telefono",
  "whatsapp_num",
  "secundario",
  "telefono_empleador",
]);

const CAMPOS_BOOLEANOS = new Set(["whatsapp", "telegram", "texto_sms"]);

const EXTRAS_POR_SECCION = {
  migratorio: ["ssn"],
  direccion: ["direccion_completa", "estado_direccion", "zip_code"],
  contacto: ["telefonos"],
};

const BASES_POR_SECCION = {
  principales: CLIENTE_FIELDS_PRINCIPALES,
  migratorio: CLIENTE_FIELDS_MIGRATORIO,
  contacto: CLIENTE_FIELDS_CONTACTO,
  direccion: CLIENTE_FIELDS_DIRECCION,
  empleo: CLIENTE_FIELDS_EMPLEO,
};

/** Títulos de la ficha. El historial general del grupo conserva sus propias etiquetas. */
export const ETIQUETAS_SECCION_FICHA = {
  principales: "Datos Principales",
  migratorio: "Estatus migratorio",
  contacto: "Datos de Contacto",
  direccion: "Dirección",
  empleo: "Datos de Empleo e Ingreso",
};

const ordenarClaves = (campos) => [
  ...campos.map(([key]) => key),
];

export const claveCampoCliente = (fieldKey = "") => {
  const raw = String(fieldKey || "");
  const sinPrefijo = raw.replace(/^cliente\./, "");
  const ultimoPunto = sinPrefijo.lastIndexOf(".");
  return ultimoPunto >= 0 ? sinPrefijo.slice(ultimoPunto + 1) : sinPrefijo;
};

export const definicionSeccionCliente = (seccionId) => {
  const base = BASES_POR_SECCION[seccionId];
  if (!base) return null;
  const order = [...ordenarClaves(base), ...(EXTRAS_POR_SECCION[seccionId] || [])];
  return {
    id: seccionId,
    label: ETIQUETAS_SECCION_FICHA[seccionId] || seccionId,
    order,
    fields: new Set(order),
  };
};

export const esCampoIgnoradoEnSeccion = (fieldKey = "") => {
  const plain = claveCampoCliente(fieldKey);
  if (CAMPOS_DERIVADOS.has(plain)) return true;

  const lower = plain.toLowerCase();
  return (
    lower.includes("updated_at") ||
    lower.includes("updatedat") ||
    lower.includes("fecha_actualizacion") ||
    lower.includes("fechaactualizacion") ||
    lower === "created_at" ||
    lower === "createdat" ||
    lower === "deleted_at"
  );
};

const valoresEquivalentes = (anterior, nuevo) => {
  if (Object.is(anterior, nuevo)) return true;
  try {
    return JSON.stringify(anterior ?? null) === JSON.stringify(nuevo ?? null);
  } catch {
    return false;
  }
};

const fechaRegistro = (row) =>
  new Date(row?.created_at || row?.fecha || 0).getTime();

/**
 * Deja solo eventos con cambios de la sección, del más reciente al más antiguo.
 * Los campos de otras secciones, técnicos o derivados no se incluyen.
 */
export const filtrarHistorialPorSeccion = (rows, seccionId) => {
  const definicion = definicionSeccionCliente(seccionId);
  if (!definicion) return [];

  const filtrados = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const cambios = row?.cambios && typeof row.cambios === "object" ? row.cambios : {};
    const cambiosSeccion = {};

    Object.keys(cambios).forEach((campo) => {
      if (esCampoIgnoradoEnSeccion(campo)) return;
      const clave = claveCampoCliente(campo);
      if (!definicion.fields.has(clave)) return;

      const info = cambios[campo];
      if (!info || typeof info !== "object") return;
      if (valoresEquivalentes(info.anterior, info.nuevo)) return;

      cambiosSeccion[campo] = {
        anterior: info.anterior,
        nuevo: info.nuevo,
      };
    });

    const total = Object.keys(cambiosSeccion).length;
    if (total === 0) return;

    filtrados.push({
      ...row,
      cambios: cambiosSeccion,
      total_cambios: total,
    });
  });

  filtrados.sort((a, b) => fechaRegistro(b) - fechaRegistro(a));
  return filtrados;
};

export const ordenarCamposDeSeccion = (campos, seccionId) => {
  const definicion = definicionSeccionCliente(seccionId);
  const rank = new Map((definicion?.order || []).map((key, index) => [key, index]));
  return [...campos].sort((a, b) => {
    const ra = rank.get(claveCampoCliente(a)) ?? 999;
    const rb = rank.get(claveCampoCliente(b)) ?? 999;
    return ra - rb;
  });
};

const formatoBooleano = (val) => {
  if (val === true || val === 1 || val === "1" || val === "true") return "Sí";
  if (val === false || val === 0 || val === "0" || val === "false") return "No";
  return null;
};

/**
 * Texto de un valor de campo de cliente.
 * `telefonos` se representa en el modal con el formateador existente.
 */
export const formatValorCampoCliente = (val, fieldKey = "") => {
  const clave = claveCampoCliente(fieldKey);
  if (clave === "telefonos") return null;

  if (val === null || val === undefined || val === "") return "—";

  if (CAMPOS_FECHA.has(clave)) {
    const formatted = formatDateForDisplay(val);
    return formatted && formatted !== "-" ? formatted : "—";
  }

  if (CAMPOS_TELEFONO.has(clave)) {
    const formatted = formatPhone334(String(val));
    return formatted || "—";
  }

  if (clave === "social" || clave === "ssn") {
    const formatted = formatSSN(String(val));
    return formatted || "—";
  }

  if (CAMPOS_BOOLEANOS.has(clave)) {
    return formatoBooleano(val) || "—";
  }

  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return "[objeto]";
    }
  }

  return String(val);
};

const ETIQUETAS_ORIGEN = {
  ficha_cliente: "Ficha del cliente",
  identificador_llamadas: "Identificador de llamadas",
  administracion_contactos: "Administración de contactos",
  clasificacion_estado: "Clasificación de estado",
};

/** Eventos del cliente. Los de GrupoFamiliar no entran en el historial por sección. */
export const esEventoIndividualCliente = (row) => {
  const modelo = row?.modelo_afectado;
  return modelo == null || modelo === "" || modelo === "Cliente";
};

export const PAGINA_HISTORIAL_SECCION = 30;

export const paginarFilas = (filas, pagina, tamano = PAGINA_HISTORIAL_SECCION) => {
  const lista = Array.isArray(filas) ? filas : [];
  const paginas = Math.max(1, Math.ceil(lista.length / tamano));
  const actual = Math.min(Math.max(1, Number(pagina) || 1), paginas);
  const inicio = (actual - 1) * tamano;
  return {
    filas: lista.slice(inicio, inicio + tamano),
    pagina: actual,
    paginas,
    total: lista.length,
  };
};

/**
 * Etiqueta del origen guardado en el evento o de una vinculación verificable.
 * Sin ese dato no se atribuye un grupo.
 */
export const etiquetaOrigenActualizacion = (origen, grupoFamiliarOrigenId, coberturaOrigenId) => {
  const codigo = typeof origen === "string" ? origen.trim() : "";
  const grupoId = Number(grupoFamiliarOrigenId);
  const coberturaId = Number(coberturaOrigenId);
  const grupoValido = Number.isSafeInteger(grupoId) && grupoId > 0;
  const coberturaValida = Number.isSafeInteger(coberturaId) && coberturaId > 0;

  if (codigo === "ficha_cliente") return "Ficha del cliente";

  if ((codigo === "producto_privado" || codigo === "") && coberturaValida && grupoValido) {
    return `Producto privado #${coberturaId} · Grupo #${grupoId}`;
  }

  if (codigo === "producto_privado") return "No registrado";

  if (grupoValido && (codigo === "grupo_familiar" || codigo === "")) {
    return `Grupo #${grupoId}`;
  }

  if (codigo === "grupo_familiar") return "No registrado";
  if (!codigo) return "No registrado";

  return ETIQUETAS_ORIGEN[codigo] || codigo;
};
