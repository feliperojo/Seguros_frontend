import React from "react";
import { Modal, Badge, Alert } from "react-bootstrap";
import { FaUser, FaCalendarAlt, FaInfoCircle } from "react-icons/fa";

const AuditLogDetailModal = ({ show, onHide, log }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? dateString : date.toLocaleString("es-ES");
  };

  const getActionVariant = (actionKey) => {
    switch (actionKey?.toLowerCase()) {
      case "create":
        return "success";
      case "update":
        return "warning";
      case "delete":
        return "danger";
      default:
        return "secondary";
    }
  };

  const renderJson = (data) => {
    if (!data) return <span className="text-muted">N/A</span>;
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return (
        <pre className="bg-light p-3 rounded" style={{ maxHeight: "300px", overflow: "auto" }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <span>{String(data)}</span>;
    }
  };

  const actionKey = log.action?.key ?? log.action;
  const actionLabel = log.action?.label ?? log.action;
  const entityLabel = log.entity?.label ?? log.model;
  const entityId = log.entity?.id ?? log.model_id;
  const user = log.user;
  const details = log.details ?? {};
  const occurredAt =
    log.occurred_at_formatted || log.occurred_at || log.created_at;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaInfoCircle className="me-2" />
          Detalle de Actividad
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row mb-3">
          <div className="col-md-6">
            <strong>ID:</strong> {log.id}
          </div>
          <div className="col-md-6">
            <strong>Acción:</strong>{" "}
            <Badge bg={getActionVariant(actionKey)}>{actionLabel}</Badge>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-6">
            <strong>Entidad:</strong> <Badge bg="info">{entityLabel}</Badge>
          </div>
          <div className="col-md-6">
            <strong>ID Entidad:</strong> {entityId || "—"}
          </div>
        </div>

        <div className="mb-3">
          <strong>
            <FaUser className="me-2" />
            Usuario:
          </strong>
          {user ? (
            <div className="mt-2">
              <div>
                <strong>Nombre:</strong> {user.name}
              </div>
              {user.email && (
                <div>
                  <strong>Email:</strong> {user.email}
                </div>
              )}
              {user.id && (
                <div>
                  <strong>ID:</strong> {user.id}
                </div>
              )}
            </div>
          ) : (
            <span className="text-muted ms-2">Sistema</span>
          )}
        </div>

        <div className="mb-3">
          <strong>
            <FaCalendarAlt className="me-2" />
            Fecha:
          </strong>
          <div className="mt-2">{formatDate(occurredAt)}</div>
        </div>

        {log.description && (
          <div className="mb-3">
            <strong>Descripción:</strong>
            <div className="mt-2">{log.description}</div>
          </div>
        )}

        {details.before && (
          <div className="mb-3">
            <strong>Estado Anterior:</strong>
            <div className="mt-2">{renderJson(details.before)}</div>
          </div>
        )}

        {details.after && (
          <div className="mb-3">
            <strong>Estado Posterior:</strong>
            <div className="mt-2">{renderJson(details.after)}</div>
          </div>
        )}

        {details.ip && (
          <div className="mb-3">
            <strong>IP:</strong> {details.ip}
          </div>
        )}

        {details.user_agent && (
          <div className="mb-3">
            <strong>User Agent:</strong>
            <div className="mt-2">
              <small className="text-muted">{details.user_agent}</small>
            </div>
          </div>
        )}

        {!details.before && !details.after && (
          <Alert variant="info">
            No hay información adicional disponible para este registro.
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onHide}>
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AuditLogDetailModal;
