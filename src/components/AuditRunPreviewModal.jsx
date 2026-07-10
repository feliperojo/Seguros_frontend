// src/components/AuditRunPreviewModal.jsx
import React, { useMemo } from "react";
import { Modal, Button, Alert, Badge, Table, Spinner, Accordion } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const MATCH_SOURCE_LABELS = {
  cobertura_table: "Universo según filtros en tabla cobertura",
  view_intersect: "Intersección entre filtros del tipo y el listado base",
  view_only: "Recorte por listado base",
};

/** Texto legible para estado de cobertura en UI (valor API medicai → Medicaid). */
const formatEstadoCoberturaDisplay = (v) => {
  if (v == null || v === "") return "—";
  const s = String(v).trim();
  if (/^medicai$/i.test(s)) return "Medicaid";
  return s;
};

const formatFiltroValue = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    return v.map((x) => formatEstadoCoberturaDisplay(x)).join(", ");
  }
  return formatEstadoCoberturaDisplay(v);
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

  const sampleCoberturas = useMemo(() => {
    const rows = data?.sample_coberturas;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.slice(0, 50);
    }
    const ids = data?.sample_cobertura_ids;
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.slice(0, 50).map((id) => ({ cobertura_id: id }));
    }
    return [];
  }, [data]);

  const coberturasLegacyIdsOnly = useMemo(() => {
    if (sampleCoberturas.length === 0) return false;
    return sampleCoberturas.every((r) => {
      if (!r || typeof r !== "object") return true;
      const keysWithValue = Object.keys(r).filter((k) => r[k] != null && r[k] !== "");
      return keysWithValue.length === 1 && keysWithValue[0] === "cobertura_id";
    });
  }, [sampleCoberturas]);

  const sampleClientes = useMemo(() => {
    const rows = data?.sample_clientes;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.slice(0, 50);
    }
    const ids = data?.sample_cliente_ids;
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.slice(0, 50).map((id) => ({ cliente_id: id }));
    }
    return [];
  }, [data]);

  const clientesLegacyIdsOnly = useMemo(() => {
    if (sampleClientes.length === 0) return false;
    return sampleClientes.every((r) => {
      if (!r || typeof r !== "object") return true;
      const keysWithValue = Object.keys(r).filter((k) => r[k] != null && r[k] !== "");
      return keysWithValue.length === 1 && keysWithValue[0] === "cliente_id";
    });
  }, [sampleClientes]);

  const matchSourceLabel =
    data?.match_source != null && String(data.match_source).trim() !== ""
      ? MATCH_SOURCE_LABELS[data.match_source] ?? String(data.match_source)
      : null;

  const showPagosBackendWarning =
    includePagosRequested && data?.include_pagos_disponible === false;

  const isClientes = data?.target_type === "clientes";

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable backdrop="static">
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
                <strong>Ya existe una auditoría</strong> para esta combinación en este periodo.
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
                      Ir a la auditoría #{existingId}
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
                Se crearán <span className="text-primary">{data.items_total ?? "—"}</span> ítems de auditoría
              </div>
              {data.target_type === "coberturas" && data.candidates_from_view != null && (
                <div className="text-muted small">
                  Candidatos desde listado base: <strong>{data.candidates_from_view}</strong>
                </div>
              )}
              {matchSourceLabel && (
                <div className="text-muted small mt-2">{matchSourceLabel}</div>
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

            {isClientes ? (
              sampleClientes.length === 0 ? (
                <p className="text-muted small mb-0">Sin muestra de clientes en la respuesta.</p>
              ) : (
                <div className="table-responsive border rounded">
                  <Table size="sm" className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th className="text-nowrap">Cliente ID</th>
                        {!clientesLegacyIdsOnly && (
                          <>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>C. postal</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleClientes.map((row, idx) => (
                        <tr key={`${row?.cliente_id ?? idx}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td className="font-monospace text-nowrap">
                            {row?.cliente_id != null ? String(row.cliente_id) : "—"}
                          </td>
                          {!clientesLegacyIdsOnly && (
                            <>
                              <td className="text-break">{row?.nombre_completo ?? "—"}</td>
                              <td className="text-break">{row?.email ?? "—"}</td>
                              <td className="text-nowrap">{row?.telefono ?? "—"}</td>
                              <td className="text-nowrap">{row?.codigo_postal ?? "—"}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )
            ) : sampleCoberturas.length === 0 ? (
              <p className="text-muted small mb-0">Sin muestra de coberturas en la respuesta.</p>
            ) : coberturasLegacyIdsOnly ? (
              <div className="table-responsive border rounded">
                <Table size="sm" className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Cobertura ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleCoberturas.map((row, idx) => (
                      <tr key={`${row?.cobertura_id}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td className="font-monospace">{String(row?.cobertura_id ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="table-responsive border rounded">
                <Table size="sm" className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th className="text-nowrap">Cob.</th>
                      <th>Cliente</th>
                      <th>Póliza</th>
                      <th className="text-nowrap">GF</th>
                      <th>Compañía</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleCoberturas.map((row, idx) => (
                      <tr key={`${row?.cobertura_id ?? idx}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td className="font-monospace text-nowrap">{row?.cobertura_id != null ? String(row.cobertura_id) : "—"}</td>
                        <td className="text-break">
                          {row?.cliente_nombre ?? (row?.cliente_id != null ? `#${row.cliente_id}` : "—")}
                        </td>
                        <td className="text-break">{row?.codigo_poliza ?? "—"}</td>
                        <td className="text-nowrap">{row?.grupo_familiar_id != null ? String(row.grupo_familiar_id) : "—"}</td>
                        <td className="text-break">{row?.compania_nombre ?? "—"}</td>
                        <td className="text-nowrap">{formatEstadoCoberturaDisplay(row?.estado_cobertura)}</td>
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
