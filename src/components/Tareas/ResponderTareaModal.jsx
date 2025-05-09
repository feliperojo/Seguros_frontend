import React, { useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";

const ResponderTareaModal = ({ show, onHide, tarea }) => {
  const [responseNote, setResponseNote] = useState(tarea?.response_note || "");
  const [loading, setLoading] = useState(false);

  const handleResponder = async () => {
    setLoading(true);
    try {
      await apiRequest(`tareas_operativas/${tarea.id}/responder`, "PUT", {
        response_note: responseNote,
      });
      onHide(true); // true = indica que se actualizó
    } catch {
      alert("❌ Error al responder la tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleCompletar = async () => {
    setLoading(true);
    try {
      await apiRequest(`tareas_operativas/${tarea.id}/completar`, "PUT");
      onHide(true);
    } catch {
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={() => onHide(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Responder Tarea</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p><strong>Concepto:</strong> {tarea?.log?.concept?.name}</p>
        <p><strong>Entidad:</strong> {tarea?.log?.entity_type} #{tarea?.log?.entity_id}</p>
        <p><strong>Nota del creador:</strong><br />{tarea?.log?.note}</p>
        <Form.Group className="mt-3">
          <Form.Label>Mi respuesta:</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={responseNote}
            onChange={(e) => setResponseNote(e.target.value)}
            disabled={tarea.status === "completed"}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onHide(false)}>Cerrar</Button>
        {tarea.status !== "completed" && (
          <>
            <Button variant="info" onClick={handleResponder} disabled={loading}>
              {loading ? <Spinner size="sm" animation="border" /> : "Guardar respuesta"}
            </Button>
            <Button variant="success" onClick={handleCompletar} disabled={loading}>
              {loading ? <Spinner size="sm" animation="border" /> : "Marcar como completada"}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ResponderTareaModal;
