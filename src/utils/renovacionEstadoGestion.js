export const ESTADOS_GESTION_OPTIONS = [
  { value: "sin_gestion", label: "Sin gestión", bg: "secondary" },
  { value: "pre_renovacion", label: "Pre-renovación", bg: "info" },
  { value: "listo_para_renovar", label: "Listo para renovar", bg: "warning" },
  { value: "renovado", label: "Renovado", bg: "success" },
  { value: "renovado_automatico", label: "Renovado Aut.", bg: "success" },
  { value: "anulado", label: "Anulado", bg: "danger" },
  { value: "no_renovara", label: "No renovará", bg: "dark" },
  { value: "consolidado", label: "Consolidado", bg: "success" },
];

/** Opciones elegibles a mano; "consolidado" lo pone solo el proceso de consolidación. */
export const ESTADOS_GESTION_EDITABLES = ESTADOS_GESTION_OPTIONS.filter(
  (o) => o.value !== "consolidado"
);

export const estadoGestionBadge = (estado) => {
  const found = ESTADOS_GESTION_OPTIONS.find((o) => o.value === estado);
  return found || { value: estado, label: estado || "—", bg: "secondary" };
};

export const etiquetaEstadoGestion = (estado) => {
  if (!estado) return "—";
  return estadoGestionBadge(estado).label;
};
