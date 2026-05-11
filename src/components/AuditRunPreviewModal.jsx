// src/components/AuditRunPreviewModal.jsx
import React, { useMemo } from "react";
import { Modal, Button, Alert, Badge, Table, Spinner, Accordion } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const formatFiltroValue = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
};

/**
 * Modal de solo lectura: resumen del POST /auditorias/runs/preview antes de crear el run.
 */
const AuditRunPreviewModal = ({
  show,
  onHide,
  loading,
  confirming,
  data,
  /** 'sin_pagos' si el usuario pidió incluir pagos pero no hay pagos generados (payload sin include_pagos) */
  pagosNote,
  /** Si el formulario tenía "Incluir pagos" activo */
  includePagosRequested,
  onConfirm,
}) => {
  const navigate = useNavigate();

  const duplicate = data?.duplicate_run === true;
  const existingRun = data?.existing_run;
  const existingId =
    existingRun && typeof existingRun === "object"
      ? existingRun.id
      : existingRun != null
        ? Number(existingRun)
        : null;

  const auditType = data?.audit_type;
  const auditTitle =
    auditType && typeof auditType === "object"
      ? [auditType.nombre, auditType.codigo].filter(Boolean).join(" · ")
      : auditType || "—";

  const filtrosEntries = useMemo(() => {
    const f = data?.filtros_cobertura;
    if (!f || typeof f !== "object") return [];
    return Object.entries(f);
  }, [data]);

  const sampleIds = useMemo(() => {
    const tt = data?.target_type;
    if (tt === "clientes") {
      const arr = data?.sample_cliente_ids;
      return Array.isArray(arr) ? arr : [];
    }
    const arr = data?.sample_cobertura_ids;
    return Array.isArray(arr) ? arr : [];
  }, [data]);

  const sampleLabel = data?.target_type === "clientes" ? "Cliente ID" : "Cobertura ID";

  const pagosDisponible = data?.include_pagos_disponible;
  const showPagosBackendWarning =
    includePagosRequested && pagosDisponible === false;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Resumen antes de crear</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" className="me-2" />
            <span className="text-muted">Generando vista preliminar…</span>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="mb-3">
              <div className="text-muted small text-uppercase fw-semibold mb-1">Tipo de auditoría</div>
              <div className="fw-semibold">{auditTitle}</div>
              <div className="small text-muted mt-1">
                Periodo: <strong>{data.periodo ?? "—"}</strong> · Objetivo:{" "}
                <strong>{data.target_type ?? "—"}</strong>
                {data.include_pagos === true && (
                  <>
                    {" "}
                    · <strong>Incluye pagos</strong>
                  </>
                )}
              </div>
            </div>

            {duplicate && (
              <Alert variant="warning" className="py-2">
                <strong>Ya existe un run</strong> para esta combinación en este periodo.
                {existingId != null && (
                  <>
                    {" "}
                    <Button
                      variant="outline-warning"
                      size="sm"
                      className="ms-2"
                      onClick={() => {
                        onHide();
                        navigate(`/auditorias/${existingId}`);
                      }}
                    >
                      Ir al run #{existingId}
                    </Button>
                  </>
                )}
              </Alert>
            )}

            {pagosNote === "sin_pagos" && (
              <Alert variant="info" className="py-2 small">
                Marcaste incluir pagos, pero <strong>no hay pagos generados</strong> para este periodo. Esta
                previsualización y la creación usarán el mismo cuerpo <strong>sin</strong>{" "}
                <code>include_pagos</code> (equivalente a &quot;continuar sin pagos&quot;).
              </Alert>
            )}

            {showPagosBackendWarning && (
              <Alert variant="warning" className="py-2 small">
                El servidor indica que <strong>no está disponible incluir pagos</strong> en este contexto (
                <code>include_pagos_disponible: false</code>). Revisa antes de confirmar.
              </Alert>
            )}

            <div className="border rounded-3 p-3 mb-3 bg-light bg-opacity-50">
              <div className="fs-5 fw-semibold mb-1">
                Se crearán{" "}
                <span className="text-primary">{data.items_total ?? "—"}</span> ítems de auditoría
              </div>
              {data.target_type === "coberturas" && data.candidates_from_view != null && (
                <div className="text-muted small">
                  Candidatos desde listado base: <strong>{data.candidates_from_view}</strong>
                </div>
              )}
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <span className="small text-muted">Filtros del tipo aplicados:</span>
              {data.filtros_cobertura_applied === true ? (
                <Badge bg="success">Sí</Badge>
              ) : data.filtros_cobertura_applied === false ? (
                <Badge bg="secondary">No</Badge>
              ) : (
                <Badge bg="light" text="dark">
                  —
                </Badge>
              )}
            </div>

            {filtrosEntries.length > 0 && (
              <Accordion className="mb-3">
                <Accordion.Item eventKey="0">
                  <Accordion.Header>Condiciones de filtros (solo lectura)</Accordion.Header>
                  <Accordion.Body className="pt-2 pb-2">
                    <Table size="sm" bordered className="mb-0 small">
                      <tbody>
                        {filtrosEntries.map(([k, v]) => (
                          <tr key={k}>
                            <td className="text-muted text-break" style={{ width: "40%" }}>
                              {k}
                            </td>
                            <td className="text-break">{formatFiltroValue(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            )}

            <div className="mb-1">
              <span className="small fw-semibold text-muted text-uppercase">
                Ejemplos (máx. 50 en muestra)
              </span>
            </div>
            {sampleIds.length === 0 ? (
              <p className="text-muted small mb-0">Sin IDs de muestra en la respuesta.</p>
            ) : (
              <div className="table-responsive border rounded">
                <Table size="sm" className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>{sampleLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleIds.slice(0, 50).map((id, idx) => (
                      <tr key={`${id}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td className="font-monospace">{String(id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={confirming}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={confirming || duplicate || loading}>
          {confirming ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Creando…
            </>
          ) : (
            "Confirmar y crear"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AuditRunPreviewModal;
