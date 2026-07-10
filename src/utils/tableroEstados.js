/**
 * Normaliza estados del tablero entre API (variantes) y columnas del Kanban.
 */
const FROM_API_MAP = {
  pendiente: "pendiente",
  pending: "pendiente",
  todo: "pendiente",
  en_progreso: "en_progreso",
  "en progreso": "en_progreso",
  in_progress: "en_progreso",
  "in progress": "en_progreso",
  completado: "completado",
  completed: "completado",
  done: "completado",
  hecho: "completado",
  archivado: "archivado",
  archived: "archivado",
};

/** Valores a probar en PATCH /mover si el backend no acepta snake_case español */
export const ESTADO_API_CANDIDATES = {
  pendiente: ["pendiente", "pending"],
  en_progreso: ["en_progreso", "in_progress"],
  completado: ["completado", "completed", "done"],
  archivado: ["archivado", "archived"],
};

export const normalizeEstadoFromApi = (estado) => {
  if (estado == null || estado === "") return "pendiente";
  const key = String(estado).toLowerCase().trim().replace(/-/g, "_");
  return FROM_API_MAP[key] ?? FROM_API_MAP[key.replace(/_/g, " ")] ?? key;
};

export const normalizeTableroItem = (item) => {
  if (!item || typeof item !== "object") return item;
  return { ...item, estado: normalizeEstadoFromApi(item.estado) };
};

export const formatValidationErrors = (errors) => {
  if (!errors || typeof errors !== "object") return null;
  return Object.entries(errors)
    .flatMap(([field, msgs]) => {
      const list = Array.isArray(msgs) ? msgs : [msgs];
      return list.map((m) => `${field}: ${m}`);
    })
    .join(" · ");
};
