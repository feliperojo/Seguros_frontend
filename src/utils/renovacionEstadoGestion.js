export const ESTADOS_GESTION_OPTIONS = [
  { value: "sin_gestion", label: "Sin gestión", bg: "secondary" },
  { value: "pre_renovacion", label: "Pre-renovación", bg: "info" },
  { value: "listo_para_renovar", label: "Listo para renovar", bg: "warning" },
  { value: "pendiente_consolidar", label: "Pendiente consolidar", bg: "primary" },
  { value: "renovado", label: "Renovado", bg: "success" },
  { value: "renovado_automatico", label: "Renovado Aut.", bg: "success" },
  { value: "anulado", label: "Anulado", bg: "danger" },
  { value: "no_renovara", label: "No renovará", bg: "dark" },
  { value: "consolidado", label: "Consolidado", bg: "success" },
];

/** Opciones elegibles a mano. "consolidado" en gestión es legacy (ya no se asigna al consolidar). */
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

/** Badge de ESTADO del lote (pendiente / borrador / consolidado), igual que /admin/renovaciones. */
export const estadoRenovacionBadge = (estado) => {
  switch (estado) {
    case "pendiente":
      return { label: "Pendiente", bg: "secondary" };
    case "borrador":
      return { label: "En pre-renovación", bg: "primary" };
    case "consolidado":
      return { label: "Consolidado", bg: "success" };
    default:
      return { label: estado || "—", bg: "secondary" };
  }
};
