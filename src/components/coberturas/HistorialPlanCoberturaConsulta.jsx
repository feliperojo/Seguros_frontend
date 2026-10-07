import { useMemo } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import HistorialPlanCoberturaTabla from "./HistorialPlanCoberturaTabla";
import { filtrarHistorialPlanPorCoberturaYAnio } from "../../utils/historialPlanCobertura";
import "../../styles/HistorialPlanCoberturaModal.css";

const MENSAJE_SIN_REFERENCIA =
  "No se puede identificar el historial del plan: falta el ID de cobertura original o el año de cobertura de este registro.";

/**
 * Consulta de solo lectura del historial de plan de una cobertura y un año.
 * No abre otro modal. El estado de carga lo controla quien la incrusta.
 */
const HistorialPlanCoberturaConsulta = ({
  productoLabel = "—",
  esDental = false,
  coberturaId = null,
  anio = null,
  valida = false,
  status = "idle",
  error = "",
  registros = [],
  onRetry,
}) => {
  const visibles = useMemo(() => {
    if (!valida || status !== "success") return [];
    return filtrarHistorialPlanPorCoberturaYAnio(registros, coberturaId, anio);
  }, [valida, status, registros, coberturaId, anio]);

  return (
    <section className="hcc-plan-section" aria-label="Historial del plan">
      <div className="hcc-plan-section__bar">
        <div className="hcc-plan-section__title">
          <i className="fas fa-history" aria-hidden="true" />
          Historial del plan
        </div>
      </div>

      <div className="hp-filter-bar hcc-plan-meta">
        <span className="hp-chip">Producto: {productoLabel}</span>
        <span className="hp-chip">Año: {anio ?? "—"}</span>
        <span className="hp-chip">ID cobertura: {coberturaId ?? "—"}</span>
      </div>

      {!valida ? (
        <Alert variant="warning" className="hp-alert mb-0">
          {MENSAJE_SIN_REFERENCIA}
        </Alert>
      ) : status === "loading" || status === "idle" ? (
        <div className="hp-loading">
          <Spinner animation="border" size="sm" className="me-2" />
          Cargando historial de plan…
        </div>
      ) : status === "error" ? (
        <Alert variant="danger" className="hp-alert mb-0">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>{error || "No se pudo cargar el historial de plan."}</span>
            {onRetry && (
              <Button
                type="button"
                variant="outline-danger"
                size="sm"
                onClick={onRetry}
              >
                Reintentar
              </Button>
            )}
          </div>
        </Alert>
      ) : visibles.length === 0 ? (
        <div className="hp-empty">
          No hay historial de plan para el año {anio}.
        </div>
      ) : (
        <HistorialPlanCoberturaTabla items={visibles} esDental={esDental} paginar />
      )}
    </section>
  );
};

export default HistorialPlanCoberturaConsulta;
