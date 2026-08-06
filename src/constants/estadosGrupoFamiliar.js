import {
  FaProjectDiagram,
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaClock,
  FaUserCheck,
  FaClipboardList,
} from "react-icons/fa";

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
