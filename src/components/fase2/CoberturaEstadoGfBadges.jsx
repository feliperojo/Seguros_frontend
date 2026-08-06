import React from "react";
import { Badge, OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  derivarEstadoPoliza,
  estadoPolizaBadgeVariant,
} from "../../utils/estadoPoliza";
import {
  clasificacionDesdeEstadoProceso,
  clasificacionProcesoToVariant,
} from "../../utils/clasificacionClienteProceso";

const badgeStyle = { fontSize: "0.65rem", fontWeight: 600 };

/**
 * Badges de estado + GF en cards de Productos / Cotizaciones.
 *
 * Regla de clasificación por estado del grupo familiar:
 * - Prospecto → Inscripción Inicial: tag Prospecto + No activado
 * - Grupo Familiar (producto): estado de póliza + tag Cliente
 */
export default function CoberturaEstadoGfBadges({
  cobertura,
  gfId,
  loading = false,
  estadoGrupoFamiliar = null,
}) {
  const { estado: estadoPoliza } = derivarEstadoPoliza(cobertura);
  const clasificacion = clasificacionDesdeEstadoProceso(estadoGrupoFamiliar);
  const esProspecto = clasificacion === "Prospecto";
  const esCliente = clasificacion === "Cliente";

  const prospectoTooltip =
    "Prospecto: el grupo familiar está entre Prospecto e Inscripción Inicial. El producto aún no se ha activado.";

  return (
    <span className="d-flex align-items-center gap-1 flex-shrink-0 flex-wrap justify-content-end">
      {esProspecto ? (
        <>
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip id={`tip-prospecto-${gfId}`}>{prospectoTooltip}</Tooltip>}
          >
            <Badge
              bg={clasificacionProcesoToVariant("Prospecto")}
              text="dark"
              className="text-uppercase"
              style={badgeStyle}
            >
              Prospecto
            </Badge>
          </OverlayTrigger>
          <Badge
            bg="light"
            text="dark"
            className="text-uppercase border"
            style={badgeStyle}
            title="Producto no activado"
          >
            No activado
          </Badge>
        </>
      ) : (
        <Badge
          bg={estadoPolizaBadgeVariant(estadoPoliza)}
          className="text-uppercase"
          style={badgeStyle}
        >
          {estadoPoliza}
        </Badge>
      )}

      {esCliente && (
        <Badge
          bg={clasificacionProcesoToVariant("Cliente")}
          className="text-uppercase"
          style={badgeStyle}
          title="Cliente por estado Grupo Familiar del proceso"
        >
          Cliente
        </Badge>
      )}

      <span className="badge bg-white border text-secondary rounded-pill">
        {loading ? "…" : `GF ${gfId ?? "—"}`}
      </span>
    </span>
  );
}
