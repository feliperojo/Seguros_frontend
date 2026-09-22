export const ESTADOS_GESTION_OPTIONS = [
  { value: "sin_gestion", label: "Sin gestión", bg: "secondary" },
  { value: "pre_renovacion", label: "Pre-renovación", bg: "info" },
  { value: "listo_para_renovar", label: "Listo para renovar", bg: "warning" },
  // Legacy: ya no se usa en el flujo; se mantiene solo para badge de lotes antiguos.
  { value: "pendiente_consolidar", label: "Pendiente consolidar", bg: "primary" },
  { value: "renovado", label: "Renovado", bg: "success" },
  { value: "renovado_automatico", label: "Renovado Aut.", bg: "success" },
  { value: "anulado", label: "Anulado", bg: "danger" },
  { value: "no_renovara", label: "No renovará", bg: "dark" },
  { value: "terminado", label: "Terminado", bg: "secondary" },
  { value: "consolidado", label: "Consolidado", bg: "success" },
];

/** No generan año destino: solo cierran el año fiscal de origen. */
export const ESTADOS_GESTION_CIERRE_SIN_DESTINO = ["no_renovara", "terminado"];

export const esEstadoGestionCierreSinDestino = (estado) =>
  ESTADOS_GESTION_CIERRE_SIN_DESTINO.includes(estado);

/**
 * Opciones elegibles a mano.
 * "consolidado" y "pendiente_consolidar" son legacy (ya no se asignan en el flujo).
 */
export const ESTADOS_GESTION_EDITABLES = ESTADOS_GESTION_OPTIONS.filter(
  (o) => o.value !== "consolidado" && o.value !== "pendiente_consolidar"
);

/** Filtros del informe de renovaciones (sin estados fuera del flujo actual). */
export const ESTADOS_GESTION_FILTRO = ESTADOS_GESTION_OPTIONS.filter(
  (o) => o.value !== "pendiente_consolidar"
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
