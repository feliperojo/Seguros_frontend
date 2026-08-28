import {
  FaProjectDiagram,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaClock,
  FaUserCheck,
  FaClipboardList,
} from "react-icons/fa";
import {
  isProductoPrivadoIndependiente,
} from "./coberturaTipos";

export const ESTADOS_GRUPO_CONFIG = {
  cotizacion: {
    icon: FaFileInvoiceDollar,
    color: "#1a73e8",
    label: "Cotización",
  },
  prospecto: {
    icon: FaUserCheck,
    color: "#34a853",
    label: "Prospecto",
  },
  seguimiento: {
    icon: FaClock,
    color: "#fbbc04",
    label: "Seguimiento",
  },
  toma_datos: {
    icon: FaClipboardList,
    color: "#ea4335",
    label: "Toma de Datos",
  },
  inscripcion_ini: {
    icon: FaCheckCircle,
    color: "#4285f4",
    label: "Inscripción / Confirmación",
  },
  grupo_familiar: {
    icon: FaProjectDiagram,
    color: "#9334e6",
    label: "Grupo Familiar",
  },
  grupo_familiar_activo: {
    icon: FaProjectDiagram,
    color: "#9334e6",
    label: "GF activos",
  },
  grupo_familiar_inactivo: {
    icon: FaProjectDiagram,
    color: "#6c757d",
    label: "GF inactivos",
  },
  descartado: {
    icon: FaProjectDiagram,
    color: "#6c757d",
    label: "Descartado",
  },
};

export const ORDEN_ESTADOS_GRUPO = [
  "prospecto",
  "cotizacion",
  "seguimiento",
  "toma_datos",
  "inscripcion_ini",
  "grupo_familiar_activo",
  "grupo_familiar_inactivo",
  "grupo_familiar",
  "descartado",
];

export function getEstadoGrupoConfig(estado) {
  const estadoLower = (estado || "").toLowerCase();
  return ESTADOS_GRUPO_CONFIG[estadoLower] || {
    icon: FaProjectDiagram,
    color: "#6c757d",
    label: estado || "Sin estado",
  };
}

/**
 * Label de display para un estado de GF (por código o nombre de catálogo).
 * No cambia códigos internos; solo el texto visible.
 */
export function labelEstadoGrupoParaDisplay(codigoOrNombre) {
  if (!codigoOrNombre) return "Sin estado";
  const raw = String(codigoOrNombre).trim();
  const asCode = raw.toLowerCase().replace(/\s+/g, "_");
  if (ESTADOS_GRUPO_CONFIG[asCode]) {
    return ESTADOS_GRUPO_CONFIG[asCode].label;
  }

  const norm = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (norm === "inscripcion inicial" || norm === "inscripcion / confirmacion") {
    return ESTADOS_GRUPO_CONFIG.inscripcion_ini.label;
  }

  return raw;
}

/**
 * Estados 1–5: se puede cambiar parentesco/tipo y eliminar cobertura.
 * Estado 5 = INSCRIPCION_INI (Inscripción / Confirmación).
 * Desde estado 6 (GRUPO_FAMILIAR / Terminado) o Descartado queda bloqueado.
 */
export const ESTADOS_GRUPO_CODIGOS_PERMITEN_PARENTESCO_COBERTURA = [
  "PROSPECTO",
  "COTIZACION",
  "SEGUIMIENTO",
  "TOMA_DATOS",
  "INSCRIPCION_INI",
];

export const ESTADOS_GRUPO_IDS_PERMITEN_PARENTESCO_COBERTURA = [1, 2, 3, 4, 5];

/** Estados 1–3: cotización / proceso inicial (aún no hay póliza real). */
export const ESTADOS_GRUPO_CODIGOS_PROCESO_INICIAL = [
  "PROSPECTO",
  "COTIZACION",
  "SEGUIMIENTO",
];

/**
 * Estados 1–4: flujo de cotización del panel (Prospecto → Toma de Datos).
 * Las coberturas de estos grupos no cuentan como “activas reales”.
 */
export const ESTADOS_GRUPO_CODIGOS_FLUJO_COTIZACION = [
  "PROSPECTO",
  "COTIZACION",
  "SEGUIMIENTO",
  "TOMA_DATOS",
];

export const ESTADOS_GRUPO_IDS_FLUJO_COTIZACION = [1, 2, 3, 4];

/** True en Prospecto, Cotización o Seguimiento. */
export function esProcesoInicialGrupoFamiliar(estadoCodigoOrNombre) {
  const code = normalizeEstadoGrupoCodigo(estadoCodigoOrNombre);
  return ESTADOS_GRUPO_CODIGOS_PROCESO_INICIAL.includes(code);
}

/**
 * True si el GF está en flujo de cotización (estados 1–4).
 * Acepta código, nombre o id numérico del catálogo.
 */
export function esGrupoEnFlujoCotizacion(estadoCodigoOrNombreOrId) {
  if (
    typeof estadoCodigoOrNombreOrId === "number" ||
    (typeof estadoCodigoOrNombreOrId === "string" &&
      /^\d+$/.test(estadoCodigoOrNombreOrId.trim()))
  ) {
    return ESTADOS_GRUPO_IDS_FLUJO_COTIZACION.includes(
      Number(estadoCodigoOrNombreOrId)
    );
  }

  const code = normalizeEstadoGrupoCodigo(estadoCodigoOrNombreOrId);
  return ESTADOS_GRUPO_CODIGOS_FLUJO_COTIZACION.includes(code);
}

/**
 * True cuando el GF ya está en Terminado (GRUPO_FAMILIAR).
 * Ahí sí aplica mostrar datos de póliza en ficha.
 */
export function esGrupoFamiliarTerminado(estadoCodigoOrNombre) {
  return normalizeEstadoGrupoCodigo(estadoCodigoOrNombre) === "GRUPO_FAMILIAR";
}

/**
 * Etapas 1–5: hay grupo en proceso, pero aún no es póliza/producto terminado.
 */
export function esProcesoAntesDeTerminado(estadoCodigoOrNombre) {
  const code = normalizeEstadoGrupoCodigo(estadoCodigoOrNombre);
  return ESTADOS_GRUPO_CODIGOS_PERMITEN_PARENTESCO_COBERTURA.includes(code);
}

/** Opciones básicas de estado_cobertura (estados 1–4). */
export const ESTADOS_COBERTURA_OPCIONES_BASICAS = [
  { value: "Sí", label: "Sí" },
  { value: "No", label: "No" },
];

/** Opciones completas desde Inscripción / Confirmación (estado 5). */
export const ESTADOS_COBERTURA_OPCIONES_COMPLETAS = [
  ...ESTADOS_COBERTURA_OPCIONES_BASICAS,
  { value: "Medicare", label: "Medicare" },
  { value: "Medicaid", label: "Medicaid" },
];

/**
 * Medicare/Medicaid solo desde estado 5 (INSCRIPCION_INI) en adelante.
 * Estados 1–4: únicamente Sí / No.
 */
export function permiteMedicareMedicaidEnCobertura(estadoCodigoOrNombre) {
  const code = normalizeEstadoGrupoCodigo(estadoCodigoOrNombre);
  return code === "INSCRIPCION_INI" || code === "GRUPO_FAMILIAR";
}

/**
 * Lista de opciones para el select de estado_cobertura según etapa del GF.
 * Si el valor actual es Medicare/Medicaid y aún no aplica la etapa, se conserva
 * en la lista para no romper el valor guardado.
 */
export function opcionesEstadoCoberturaPorProceso(
  estadoCodigoOrNombre,
  valorActual = null
) {
  const base = permiteMedicareMedicaidEnCobertura(estadoCodigoOrNombre)
    ? ESTADOS_COBERTURA_OPCIONES_COMPLETAS
    : ESTADOS_COBERTURA_OPCIONES_BASICAS;

  const actual = String(valorActual || "").trim();
  if (!actual) return base;

  const yaIncluida = base.some(
    (o) => o.value.toLowerCase() === actual.toLowerCase()
  );
  if (yaIncluida) return base;

  return [...base, { value: actual, label: actual }];
}

/** @deprecated usar ESTADOS_GRUPO_CODIGOS_PERMITEN_PARENTESCO_COBERTURA */
export const ESTADOS_GRUPO_CODIGOS_BLOQUEAN_PARENTESCO_COBERTURA = [
  "GRUPO_FAMILIAR",
  "TERMINADO",
  "DESCARTADO",
];

/** Normaliza códigos/nombres de estado a código de catálogo. */
export function normalizeEstadoGrupoCodigo(raw) {
  if (raw == null) return "";
  if (typeof raw === "object") {
    return normalizeEstadoGrupoCodigo(
      raw.codigo || raw.code || raw.cod || raw.nombre || ""
    );
  }

  const norm = String(raw)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (!norm) return "";
  if (norm === "TERMINADO" || norm === "GRUPO_FAMILIAR") return "GRUPO_FAMILIAR";
  if (norm.includes("INSCRIPCION")) return "INSCRIPCION_INI";
  if (norm.includes("TOMA_DATOS") || norm === "TOMA_DE_DATOS") return "TOMA_DATOS";
  if (norm.includes("COTIZACION")) return "COTIZACION";
  if (norm.includes("SEGUIMIENTO")) return "SEGUIMIENTO";
  if (norm.includes("PROSPECTO")) return "PROSPECTO";
  if (norm.includes("DESCARTADO")) return "DESCARTADO";
  return norm;
}

/**
 * True si aún se puede editar parentesco/tipo o eliminar cobertura (estados 1–5).
 * Incluye explícitamente INSCRIPCION_INI (estado 5).
 */
export function puedeEditarParentescoOEliminarCobertura(
  estadoCodigo,
  { readOnly = false, estadoId = null } = {}
) {
  if (readOnly) return false;

  const code = normalizeEstadoGrupoCodigo(estadoCodigo);
  if (code) {
    return ESTADOS_GRUPO_CODIGOS_PERMITEN_PARENTESCO_COBERTURA.includes(code);
  }

  const id = Number(estadoId);
  if (Number.isFinite(id) && id > 0) {
    return ESTADOS_GRUPO_IDS_PERMITEN_PARENTESCO_COBERTURA.includes(id);
  }

  // Sin estado conocido: no bloquear en modo edición
  return true;
}

/** IDs de catálogo que exigen clave de super admin para eliminar (Terminado / Descartado). */
export const ESTADOS_GRUPO_IDS_DELETE_REQUIERE_ADMIN = [6, 7];

/** Códigos equivalentes (más robustos si los IDs difieren entre ambientes). */
export const ESTADOS_GRUPO_CODIGOS_DELETE_REQUIERE_ADMIN = [
  "GRUPO_FAMILIAR",
  "DESCARTADO",
];

/**
 * True si eliminar el grupo requiere clave del super administrador.
 * Estados 1–5: libre. Estados 6–7 (Terminado / Descartado): protegidos.
 */
export function grupoFamiliarDeleteRequiereAdmin(grupo) {
  if (!grupo) return false;

  const estadoId = Number(grupo.estado_id);
  if (ESTADOS_GRUPO_IDS_DELETE_REQUIERE_ADMIN.includes(estadoId)) {
    return true;
  }

  const codigo = String(grupo.estado_codigo || "")
    .trim()
    .toUpperCase();
  return ESTADOS_GRUPO_CODIGOS_DELETE_REQUIERE_ADMIN.includes(codigo);
}

/**
 * En el listado, estados 1–5 (Prospecto … Inscripción) no muestran personas en cobertura
 * (solo efecto visual; no altera datos).
 */
export const ESTADOS_GRUPO_IDS_OCULTAR_COBERTURA_LISTADO = [1, 2, 3, 4, 5];

export const ESTADOS_GRUPO_CODIGOS_OCULTAR_COBERTURA_LISTADO = [
  "PROSPECTO",
  "COTIZACION",
  "SEGUIMIENTO",
  "TOMA_DATOS",
  "INSCRIPCION_INI",
];

export function ocultarPersonasCoberturaEnListado(grupo) {
  if (!grupo) return false;

  const estadoId = Number(grupo.estado_id);
  if (ESTADOS_GRUPO_IDS_OCULTAR_COBERTURA_LISTADO.includes(estadoId)) {
    return true;
  }

  const codigo = String(grupo.estado_codigo || "")
    .trim()
    .toUpperCase();
  return ESTADOS_GRUPO_CODIGOS_OCULTAR_COBERTURA_LISTADO.includes(codigo);
}

function parseProductoTiposGrupo(grupo) {
  const producto = String(grupo?.producto || "").trim();
  if (!producto || producto === "-") return [];
  return producto.split(",").map((t) => t.trim()).filter(Boolean);
}

function tiposProductoGrupo(grupo) {
  const fromProducto = parseProductoTiposGrupo(grupo);
  if (fromProducto.length > 0) return fromProducto;

  if (Array.isArray(grupo?.coberturaTipos) && grupo.coberturaTipos.length > 0) {
    return grupo.coberturaTipos;
  }

  return [
    ...new Set(
      (grupo?.coberturas || [])
        .map((c) => String(c?.cobertura_tipo || "").trim())
        .filter(Boolean)
    ),
  ];
}

/** GF cuyo producto principal es privado (Vision, Plan Dental, etc.), no Salud MS. */
export function esGrupoPlanPrivado(grupo) {
  const privadas = Number(grupo?.personas_privadas);
  if (privadas > 0) return true;

  const salud = Number(grupo?.personas_salud);
  const dental = Number(grupo?.personas_dental);
  if (salud > 0 || dental > 0) return false;

  const tipos = tiposProductoGrupo(grupo);
  if (tipos.length === 0) return false;

  return tipos.every((t) => isProductoPrivadoIndependiente(t));
}

/** Conteos de coberturas privadas activas para la columna C.Privado del listado. */
export function personasPrivadasParaListado(grupo) {
  if (ocultarPersonasCoberturaEnListado(grupo)) {
    return { privadas: 0, label: "—" };
  }

  const privadas =
    grupo?.personas_privadas != null && grupo.personas_privadas !== ""
      ? Number(grupo.personas_privadas) || 0
      : 0;

  return {
    privadas,
    label: privadas > 0 ? String(privadas) : "—",
  };
}

/** Conteos Salud/Dental MS activos para la columna Salud/Dental Ms del listado. */
export function personasSaludDentalParaListado(grupo) {
  if (ocultarPersonasCoberturaEnListado(grupo)) {
    return { salud: 0, dental: 0, label: "—" };
  }

  let salud =
    grupo?.personas_salud != null && grupo.personas_salud !== ""
      ? Number(grupo.personas_salud) || 0
      : null;
  let dental =
    grupo?.personas_dental != null && grupo.personas_dental !== ""
      ? Number(grupo.personas_dental) || 0
      : null;

  if (salud === null || dental === null) {
    const resumen = Array.isArray(grupo?.productos_resumen) ? grupo.productos_resumen : [];
    const filaDental = resumen.find((p) =>
      String(p?.producto || "")
        .toLowerCase()
        .includes("dental ms")
    );
    const filaSalud = resumen.find(
      (p) =>
        String(p?.producto || "")
          .toLowerCase()
          .includes("salud")
    );

    if (dental === null) {
      dental = filaDental?.cobertura != null ? Number(filaDental.cobertura) || 0 : 0;
    }
    if (salud === null) {
      salud =
        filaSalud?.cobertura != null
          ? Number(filaSalud.cobertura) || 0
          : Number(grupo?.personas_cobertura) || 0;
    }
  }

  if (salud === 0 && dental === 0) {
    return { salud: 0, dental: 0, label: "—" };
  }

  return {
    salud,
    dental,
    label: `${salud}/${dental}`,
  };
}

/** Personas en taxes: los planes privados no aplican; mostrar — en el listado. */
export function personasTaxesParaListado(grupo) {
  if (esGrupoPlanPrivado(grupo)) {
    return { taxes: 0, label: "—" };
  }

  const taxes = Number(grupo?.personas_taxes) || 0;
  return { taxes, label: String(taxes) };
}

/** @deprecated Preferir personasSaludDentalParaListado. */
export function personasDentalParaListado(grupo) {
  return personasSaludDentalParaListado(grupo).dental;
}

/** @deprecated Preferir personasSaludDentalParaListado en el listado de GF. */
export function personasCoberturaParaListado(grupo) {
  if (ocultarPersonasCoberturaEnListado(grupo)) return 0;
  return grupo?.personas_cobertura || 0;
}

export function ordenarResumenGrupos(resumenEstados = []) {
  const estadosProcesados = Array.isArray(resumenEstados)
    ? resumenEstados.map((item) => ({
        codigo: (item.codigo || "").toLowerCase(),
        nombre: item.nombre || "",
        total_grupos: item.total_grupos ?? 0,
      }))
    : [];

  const estadosMap = new Map();
  estadosProcesados.forEach((estado) => estadosMap.set(estado.codigo, estado));

  const estadosOrdenados = [
    ...ORDEN_ESTADOS_GRUPO.filter((codigo) => estadosMap.has(codigo)).map((codigo) =>
      estadosMap.get(codigo)
    ),
    ...estadosProcesados.filter((estado) => !ORDEN_ESTADOS_GRUPO.includes(estado.codigo)),
  ];

  return estadosOrdenados.map((estado) => {
    const config = getEstadoGrupoConfig(estado.codigo);
    // Labels de catálogo conocidos: priorizar config frontend (display only).
    const tieneLabelFijo = Object.prototype.hasOwnProperty.call(
      ESTADOS_GRUPO_CONFIG,
      estado.codigo
    );
    const label = tieneLabelFijo ? config.label : (estado.nombre || config.label);
    return {
      key: estado.codigo,
      valor: estado.total_grupos,
      nombre: label,
      config: {
        ...config,
        label,
      },
    };
  });
}
