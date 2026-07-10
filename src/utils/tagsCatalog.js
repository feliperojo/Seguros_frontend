// Catálogo de etiquetas sugeridas para grupos familiares
// Cada etiqueta tiene: key (único), label (texto visible), color (hex)

export const SUGGESTED_TAGS = [
  {
    key: "pendientes_documentos",
    label: "PENDIENTES DOCUMENTOS",
    color: "#FF9800" // Naranja
  },
  {
    key: "falta_debito_automatico",
    label: "FALTA DEBITO AUTOMATICO SALUD",
    color: "#4CAF50" // Verde claro
  },
  {
    key: "tiene_debito_automatico",
    label: "TIENE DEBITO AUTOMATICO SALUD",
    color: "#2196F3" // Azul
  },
  {
    key: "no_pidieron_nada_ms",
    label: "NO PIDIERON NADA EN MS",
    color: "#9C27B0" // Morado
  },
  {
    key: "llamada_autorizacion_ms",
    label: "LLAMADA DE AUTORIZACIÓN MS",
    color: "#00BCD4" // Cian
  },
  {
    key: "subida_carta_autorizacion_ms",
    label: "SUBIDA CARTA AUTORIZACIÓN MS",
    color: "#009688" // Verde azulado
  },
  {
    key: "ambetter",
    label: "AMBETTER",
    color: "#E91E63" // Rosa
  },
  {
    key: "tiene_carta_autorizacion_agente",
    label: "TIENE CARTA AUTORIZACION AGENTE",
    color: "#C2185B" // Rosa oscuro
  }
];

// Colores predefinidos para nuevas etiquetas (paleta Trello-like)
export const AVAILABLE_COLORS = [
  "#FF6B6B", // Rojo
  "#4ECDC4", // Turquesa
  "#45B7D1", // Azul claro
  "#FFA07A", // Salmón
  "#98D8C8", // Verde menta
  "#F7DC6F", // Amarillo
  "#BB8FCE", // Lavanda
  "#85C1E2", // Azul cielo
  "#F8B739", // Naranja
  "#52BE80", // Verde esmeralda
  "#AF7AC5", // Púrpura
  "#5DADE2", // Azul
  "#F1948A", // Rosa salmón
  "#7FB3D3", // Azul acero
  "#82E0AA", // Verde claro
  "#F4D03F"  // Amarillo dorado
];

// Generar key único para nueva etiqueta
export const generateTagKey = (label) => {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^a-z0-9]/g, "_") // Reemplazar caracteres especiales con guión bajo
    .replace(/_+/g, "_") // Reemplazar múltiples guiones bajos con uno solo
    .replace(/^_|_$/g, ""); // Eliminar guiones bajos al inicio y final
};

// Validar que una etiqueta tenga la estructura correcta
export const validateTag = (tag) => {
  if (!tag || typeof tag !== "object") return false;
  if (!tag.key || typeof tag.key !== "string") return false;
  if (!tag.label || typeof tag.label !== "string") return false;
  if (!tag.color || typeof tag.color !== "string") return false;
  // Validar formato de color hex
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(tag.color)) return false;
  return true;
};

// Claves usadas en system-config para gestionar el catálogo global de etiquetas
export const GROUP_TAGS_CONFIG_KEY = "group_tags_custom";
export const GROUP_TAGS_DELETED_CONFIG_KEY = "group_tags_deleted";




