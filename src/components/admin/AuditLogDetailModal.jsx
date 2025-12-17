import React from "react";
import { Modal, Badge, Alert } from "react-bootstrap";
import { FaUser, FaCalendarAlt, FaInfoCircle } from "react-icons/fa";

const AuditLogDetailModal = ({ show, onHide, log }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleString("es-ES");
  };

  const getActionVariant = (action) => {
    switch (action?.toLowerCase()) {
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
      return <span>{data}</span>;
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaInfoCircle className="me-2" />
          Detalle del Log de Auditoría
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row mb-3">
          <div className="col-md-6">
            <strong>ID:</strong> {log.id}
          </div>
          <div className="col-md-6">
            <strong>Acción:</strong>{" "}
            <Badge bg={getActionVariant(log.action)}>{log.action}</Badge>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-6">
            <strong>Modelo:</strong> <Badge bg="info">{log.model}</Badge>
          </div>
          <div className="col-md-6">
            <strong>ID Modelo:</strong> {log.model_id || "—"}
          </div>
        </div>

        <div className="mb-3">
          <strong>
            <FaUser className="me-2" />
            Usuario:
          </strong>
          {log.user ? (
            <div className="mt-2">
              <div>
                <strong>Nombre:</strong> {log.user.name}
              </div>
              <div>
                <strong>Email:</strong> {log.user.email}
              </div>
              {log.user.id && (
                <div>
                  <strong>ID:</strong> {log.user.id}
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
          <div className="mt-2">{formatDate(log.created_at)}</div>
        </div>

        {log.description && (
          <div className="mb-3">
            <strong>Descripción:</strong>
            <div className="mt-2">{log.description}</div>
          </div>
        )}

        {log.before && (
          <div className="mb-3">
            <strong>Estado Anterior:</strong>
            <div className="mt-2">{renderJson(log.before)}</div>
          </div>
        )}

        {log.after && (
          <div className="mb-3">
            <strong>Estado Posterior:</strong>
            <div className="mt-2">{renderJson(log.after)}</div>
          </div>
        )}

        {log.changes && (
          <div className="mb-3">
            <strong>Cambios:</strong>
            <div className="mt-2">{renderJson(log.changes)}</div>
          </div>
        )}

        {log.ip_address && (
          <div className="mb-3">
            <strong>IP:</strong> {log.ip_address}
          </div>
        )}

        {log.user_agent && (
          <div className="mb-3">
            <strong>User Agent:</strong>
            <div className="mt-2">
              <small className="text-muted">{log.user_agent}</small>
            </div>
          </div>
        )}

        {!log.before && !log.after && !log.changes && (
          <Alert variant="info">
            No hay información adicional disponible para este log.
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
