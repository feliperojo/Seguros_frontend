import { useEffect, useMemo, useState } from "react";
import { Badge, Button, OverlayTrigger, Table, Tooltip } from "react-bootstrap";
import {
  HISTORIAL_PLAN_PAGE_SIZE,
  formatFechaHistorialPlan,
  formatPrecioHistorialPlan,
} from "../../utils/historialPlanCobertura";
import "../../styles/HistorialPlanCoberturaModal.css";

/**
 * Tabla del historial de plan (historial_plan_cobertura).
 * La usa el informe independiente y la consulta embebida en retiros/cancelaciones.
 */
const HistorialPlanCoberturaTabla = ({
  items = [],
  esDental = false,
  paginar = false,
  pageSize = HISTORIAL_PLAN_PAGE_SIZE,
}) => {
  const [page, setPage] = useState(1);
  const total = items.length;
  const usarPaginacion = Boolean(paginar) && pageSize > 0 && total > pageSize;
  const paginas = usarPaginacion ? Math.ceil(total / pageSize) : 1;

  useEffect(() => {
    setPage(1);
  }, [items]);

  const paginaSegura = Math.min(page, paginas);
  const visibles = useMemo(() => {
    if (!usarPaginacion) return items;
    const inicio = (paginaSegura - 1) * pageSize;
    return items.slice(inicio, inicio + pageSize);
  }, [items, usarPaginacion, paginaSegura, pageSize]);

  const desde = total === 0 ? 0 : (paginaSegura - 1) * pageSize + 1;
  const hasta = usarPaginacion
    ? Math.min(paginaSegura * pageSize, total)
    : total;

  return (
    <>
      <div className="hp-table-wrap table-responsive">
        <Table hover size="sm" className="hp-table">
          <thead>
            <tr>
              <th style={{ width: "1%" }}>Origen</th>
              <th>Compañía</th>
              <th>Plan</th>
              {!esDental && <th>Metal</th>}
              {!esDental && <th>Red</th>}
              <th>Número ID</th>
              {!esDental && <th>Código ID</th>}
              <th>Agente</th>
              <th>Precio ($)</th>
              <th>Activación</th>
              <th>Expiración</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((item) => (
              <tr key={item.id}>
                <td className="text-center align-middle">
                  {item.es_anulacion ? (
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip id={`anulacion-${item.id}`}>
                          Archivado por anulación · sin fecha de expiración
                        </Tooltip>
                      }
                    >
                      <Badge bg="danger" pill className="user-select-none">
                        Anulado
                      </Badge>
                    </OverlayTrigger>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{item.compania?.nombre || "—"}</td>
                <td>{item.plan || "—"}</td>
                {!esDental && <td>{item.metal || "—"}</td>}
                {!esDental && <td>{item.red || "—"}</td>}
                <td>
                  {esDental
                    ? item.policy_number || "—"
                    : item.policy_number || item.codigo_poliza || "—"}
                </td>
                {!esDental && <td>{item.codigo_poliza || "—"}</td>}
                <td>{item.agente || "—"}</td>
                <td>{formatPrecioHistorialPlan(item.precio)}</td>
                <td>{formatFechaHistorialPlan(item.fecha_activacion)}</td>
                <td>
                  {item.es_anulacion
                    ? "No aplica"
                    : formatFechaHistorialPlan(item.fecha_expiracion)}
                </td>
                <td>{item.nota || "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {usarPaginacion && (
        <div className="hp-pagination">
          <span>
            {desde}–{hasta} de {total}
          </span>
          <div className="hp-pagination__actions">
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              disabled={paginaSegura <= 1}
              onClick={() => setPage((actual) => Math.max(1, actual - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              disabled={paginaSegura >= paginas}
              onClick={() =>
                setPage((actual) => Math.min(paginas, actual + 1))
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default HistorialPlanCoberturaTabla;
