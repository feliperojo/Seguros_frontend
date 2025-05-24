import React, { useEffect, useState } from "react";
import { Modal, Button, Spinner, Card, Row, Col, Badge } from "react-bootstrap";
import apiRequest from "../../services/api";

const DetalleBitacoraModal = ({ show, onHide, log }) => {
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  useEffect(() => {
    if (show && log?.task?.id) {
      setLoadingHistorial(true);
      console.log("Cargando comentarios para tarea con ID:", log.task.id);
      apiRequest(`tareas_operativas/${log.task.id}/comentarios`, "GET")
        .then((data) => {
          console.log("Historial de comentarios cargado:", data); 
          setHistorial(data || []);
        })
        .catch((err) => {
          console.error("Error cargando comentarios:", err);
          setHistorial([]);
        })
        .finally(() => setLoadingHistorial(false));
    }
  }, [show, log?.task?.id]);

  if (!log) return null;

  // Función para badge de estado
  const statusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge bg="warning" text="dark">Pendiente</Badge>;
      case "in_progress":
        return <Badge bg="info">En progreso</Badge>;
      case "completed":
        return <Badge bg="success">Completada</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const infoItem = (label, value) => (
    <Row className="mb-2">
      <Col xs={4} className="fw-semibold text-dark">
        {label}:
      </Col>
      <Col xs={8} style={{ whiteSpace: "pre-wrap" }}>
        {value || "---"}
      </Col>
    </Row>
  );

  const getCategoriaColor = (categoria) => {
    switch (categoria?.toLowerCase()) {
      case "alta":
        return "danger";
      case "media":
        return "warning";
      case "baja":
        return "success";
      default:
        return "secondary";
    }
  };
  

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable>
     <Modal.Header closeButton>
  <Modal.Title className="text-dark d-flex align-items-center gap-3">
    📋 Detalles del Registro
    {log?.concept?.category && (
      <span
        className={`badge bg-${getCategoriaColor(log.concept.category)}`}
        style={{ fontSize: "0.85rem" }}
      >
        Complejidad: {log.concept.category}
      </span>
    )}
  </Modal.Title>
</Modal.Header>


      <Modal.Body>
        <Card className="mb-4 shadow-sm p-3" style={{ borderRadius: "10px" }}>
          <h5 className="mb-3 text-dark">Información General</h5>
          {infoItem("Fecha", new Date(log.created_at).toLocaleString())}
          {infoItem("Usuario", log.user?.name)}
          {infoItem("Acción", log.action_type)}
          {infoItem("Cliente", log.cliente?.nombre_completo)}
          {infoItem("Grupo familiar", log.grupo_familiar_id)}
          {infoItem("Entidad", log.entity_type)}
          {infoItem("Concepto", log.concept?.name)}
          {infoItem("Nota", log.note)}
        </Card>

        <Card className="mb-4 shadow-sm p-3" style={{ borderRadius: "10px" }}>
          <h5 className="mb-3 text-dark">Detalles de la Tarea</h5>
          {infoItem("Asignado a", log.task?.assigned_user?.name)}
          <Row className="mb-2">
            <Col xs={4} className="fw-semibold text-dark">
              Estado:
            </Col>
            <Col xs={8}>{statusBadge(log.task?.status)}</Col>
          </Row>
          {infoItem("Respuesta", log.task?.response_note)}
          {infoItem(
            "Fecha de respuesta",
            log.task?.completed_at
              ? new Date(log.task.completed_at).toLocaleString()
              : null
          )}
        </Card>

        <h5 className="mb-3 text-dark">Historial de Comentarios</h5>

        {loadingHistorial ? (
          <div className="d-flex justify-content-center py-3">
            <Spinner animation="border" />
          </div>
        ) : historial.length > 0 ? (
          <div
            style={{
              maxHeight: "350px",
              overflowY: "auto",
              paddingRight: "10px",
              borderLeft: "4px solid #0d6efd",
              backgroundColor: "#f8f9fa",
              borderRadius: "5px",
            }}
          >
            {historial.map((comentario) => (
              <Card
                key={comentario.id}
                className="mb-3 shadow-sm"
                style={{ borderRadius: "8px" }}
              >
                <Card.Body>
                  <Card.Subtitle className="mb-2 text-muted d-flex justify-content-between">
                    <span>{comentario.user?.name || "Usuario"}</span>
                    <span>{new Date(comentario.created_at).toLocaleString()}</span>
                  </Card.Subtitle>
                  <Card.Text style={{ whiteSpace: "pre-wrap" }}>
                    {comentario.comment || comentario.response_note || comentario.note}
                  </Card.Text>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted fst-italic">
            No hay historial de comentarios para esta tarea.
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DetalleBitacoraModal;
