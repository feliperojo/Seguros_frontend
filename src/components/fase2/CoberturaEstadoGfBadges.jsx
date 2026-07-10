import React from "react";
import { Badge } from "react-bootstrap";
import {
  derivarEstadoPoliza,
  estadoPolizaBadgeVariant,
} from "../../utils/estadoPoliza";

/**
 * Muestra el estado de la póliza del cliente y el ID del grupo familiar (GF).
 */
export default function CoberturaEstadoGfBadges({
  cobertura,
  gfId,
  loading = false,
}) {
  const { estado } = derivarEstadoPoliza(cobertura);
  const variant = estadoPolizaBadgeVariant(estado);

  return (
    <span className="d-flex align-items-center gap-1 flex-shrink-0">
      <Badge
        bg={variant}
        className="text-uppercase"
        style={{ fontSize: "0.65rem", fontWeight: 600 }}
      >
        {estado}
      </Badge>
      <span className="badge bg-white border text-secondary rounded-pill">
        {loading ? "…" : `GF ${gfId ?? "—"}`}
      </span>
    </span>
  );
}
