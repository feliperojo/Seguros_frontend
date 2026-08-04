import React, { useMemo, useState } from "react";
import { Modal, Badge, Alert, Table, Button } from "react-bootstrap";
import {
  FaUser,
  FaCalendarAlt,
  FaInfoCircle,
  FaExchangeAlt,
  FaPlus,
  FaMinus,
  FaCode,
} from "react-icons/fa";
import EntityIdLink from "./EntityIdLink";
import {
  buildActivityChanges,
  formatActivityValue,
} from "../../utils/activityLogDiff";

const AuditLogDetailModal = ({ show, onHide, log }) => {
  const [showTechnical, setShowTechnical] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? dateString : date.toLocaleString("es-ES");
  };

  const getActionVariant = (actionKey) => {
    switch (actionKey?.toLowerCase()) {
      case "create":
      case "enable":
        return "success";
      case "update":
      case "preferences_update":
        return "warning";
      case "delete":
      case "disable":
      case "inactivar":
        return "danger";
      case "login":
        return "primary";
      default:
        return "secondary";
    }
  };

  const actionKey = log?.action?.key ?? log?.action;
  const actionLabel = log?.action?.label ?? log?.action;
  const entityLabel = log?.entity?.label ?? log?.model;
  const entityId = log?.entity?.id ?? log?.model_id;
  const user = log?.user;
  const details = log?.details ?? {};
  const occurredAt =
    log?.occurred_at_formatted || log?.occurred_at || log?.created_at;

  const { mode, changes } = useMemo(
    () => buildActivityChanges(details.before, details.after, actionKey),
    [details.before, details.after, actionKey]
  );

  if (!log) return null;

  const hasBeforeAfter = Boolean(details.before || details.after);
  const titleByMode = {
    diff: "Cambios realizados",
    created: "Datos registrados",
    deleted: "Datos eliminados",
    empty: "Detalle",
  };

  const renderChangeTypeBadge = (type) => {
    if (type === "added") {
      return (
        <Badge bg="success" className="me-2" title="Agregado">
          <FaPlus size={10} />
        </Badge>
      );
    }
    if (type === "removed") {
      return (
        <Badge bg="danger" className="me-2" title="Eliminado">
          <FaMinus size={10} />
        </Badge>
      );
    }
    if (type === "changed") {
      return (
        <Badge bg="warning" text="dark" className="me-2" title="Modificado">
          <FaExchangeAlt size={10} />
        </Badge>
      );
    }
    return null;
  };

  const renderChanges = () => {
    if (!hasBeforeAfter) {
      return (
        <Alert variant="info" className="mb-0">
          No hay información adicional disponible para este registro.
        </Alert>
      );
    }

    if (!changes.length) {
      return (
        <Alert variant="light" className="border mb-0">
          No se detectaron cambios en campos relevantes para el usuario.
          {hasBeforeAfter && (
            <div className="mt-2">
              <Button
                variant="link"
                size="sm"
                className="p-0"
                onClick={() => setShowTechnical((v) => !v)}
              >
                <FaCode className="me-1" />
                {showTechnical ? "Ocultar datos técnicos" : "Ver datos técnicos"}
              </Button>
            </div>
          )}
        </Alert>
      );
    }

    const showBeforeColumn = mode === "diff" || mode === "deleted";
    const showAfterColumn = mode === "diff" || mode === "created";

    return (
      <>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <strong>{titleByMode[mode] || "Cambios"}</strong>
          <Badge bg="secondary" pill>
            {changes.length} {changes.length === 1 ? "cambio" : "cambios"}
          </Badge>
        </div>

        <div className="table-responsive border rounded">
          <Table hover size="sm" className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: showBeforeColumn && showAfterColumn ? "28%" : "40%" }}>
                  Campo
                </th>
                {showBeforeColumn && (
                  <th style={{ width: showAfterColumn ? "36%" : "60%" }}>
                    {mode === "deleted" ? "Valor" : "Antes"}
                  </th>
                )}
                {showAfterColumn && (
                  <th style={{ width: showBeforeColumn ? "36%" : "60%" }}>
                    {mode === "created" ? "Valor" : "Después"}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.path}>
                  <td className="fw-semibold text-dark" style={{ fontSize: "0.9rem" }}>
                    <div className="d-flex align-items-start">
                      {mode === "diff" && renderChangeTypeBadge(change.type)}
                      <span style={{ wordBreak: "break-word" }}>{change.label}</span>
                    </div>
                  </td>
                  {showBeforeColumn && (
                    <td>
                      <span
                        className="text-muted"
                        style={{ fontSize: "0.9rem", wordBreak: "break-word" }}
                      >
                        {formatActivityValue(change.before)}
                      </span>
                    </td>
                  )}
                  {showAfterColumn && (
                    <td>
                      <span
                        className="text-dark fw-semibold"
                        style={{ fontSize: "0.9rem", wordBreak: "break-word" }}
                      >
                        {formatActivityValue(change.after)}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="mt-2">
          <Button
            variant="link"
            size="sm"
            className="p-0 text-muted"
            onClick={() => setShowTechnical((v) => !v)}
          >
            <FaCode className="me-1" />
            {showTechnical ? "Ocultar datos técnicos" : "Ver datos técnicos (JSON)"}
          </Button>
        </div>
      </>
    );
  };

  const renderJsonBlock = (data) => {
    if (!data) return <span className="text-muted">N/A</span>;
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return (
        <pre
          className="bg-light p-3 rounded mb-0"
          style={{ maxHeight: "260px", overflow: "auto", fontSize: "0.75rem" }}
        >
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <span>{String(data)}</span>;
    }
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        setShowTechnical(false);
        onHide();
      }}
      size="lg"
      centered
      scrollable
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <FaInfoCircle className="me-2" />
          Detalle de Actividad
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="border rounded p-3 mb-3" style={{ background: "#f8f9fa" }}>
          <div className="row g-3">
            <div className="col-sm-6">
              <div className="text-muted small mb-1">Acción</div>
              <Badge bg={getActionVariant(actionKey)}>{actionLabel}</Badge>
            </div>
            <div className="col-sm-6">
              <div className="text-muted small mb-1">Entidad</div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Badge bg="info">{entityLabel}</Badge>
                {entityId ? (
                  <EntityIdLink entityType={log.entity?.type} entityId={entityId} />
                ) : null}
              </div>
            </div>
            <div className="col-sm-6">
              <div className="text-muted small mb-1">
                <FaUser className="me-1" />
                Usuario
              </div>
              {user ? (
                <div>
                  <div className="fw-semibold">{user.name || "—"}</div>
                  {user.email && (
                    <div className="text-muted small">{user.email}</div>
                  )}
                </div>
              ) : (
                <span className="text-muted">Sistema</span>
              )}
            </div>
            <div className="col-sm-6">
              <div className="text-muted small mb-1">
                <FaCalendarAlt className="me-1" />
                Fecha
              </div>
              <div className="fw-semibold">{formatDate(occurredAt)}</div>
            </div>
          </div>

          {log.description && (
            <div className="mt-3 pt-3 border-top">
              <div className="text-muted small mb-1">Descripción</div>
              <div>{log.description}</div>
            </div>
          )}
        </div>

        {renderChanges()}

        {showTechnical && hasBeforeAfter && (
          <div className="mt-3">
            {details.before && (
              <div className="mb-3">
                <div className="text-muted small mb-1">Estado anterior (técnico)</div>
                {renderJsonBlock(details.before)}
              </div>
            )}
            {details.after && (
              <div className="mb-0">
                <div className="text-muted small mb-1">Estado posterior (técnico)</div>
                {renderJsonBlock(details.after)}
              </div>
            )}
          </div>
        )}

        {(details.ip || details.user_agent) && (
          <div className="mt-3 pt-3 border-top">
            {details.ip && (
              <div className="mb-2">
                <span className="text-muted small">IP:</span>{" "}
                <span className="small">{details.ip}</span>
              </div>
            )}
            {details.user_agent && (
              <div>
                <div className="text-muted small mb-1">Navegador / dispositivo</div>
                <small className="text-muted">{details.user_agent}</small>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setShowTechnical(false);
            onHide();
          }}
        >
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AuditLogDetailModal;
