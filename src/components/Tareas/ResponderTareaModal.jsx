import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner, ListGroup } from "react-bootstrap";
import apiRequest from "../../services/api";

const ResponderTareaModal = ({ show, onHide, tarea }) => {
  const [responseNote, setResponseNote] = useState(tarea?.response_note || "");
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);

  // Cargar comentarios al abrir modal o cambiar tarea
  useEffect(() => {
    if (show && tarea?.id) {
      setCargandoComentarios(true);
      apiRequest(`tareas_operativas/${tarea.id}/comentarios`, "GET")
        .then((data) => {
          setComentarios(data || []);
          // Aseguramos que el textarea tenga el último comentario
          if (data && data.length > 0) {
            setResponseNote(data[data.length - 1].comment);
          } else {
            setResponseNote("");
          }
        })
        .finally(() => setCargandoComentarios(false));
    }
  }, [show, tarea]);

  // Agregar nuevo comentario
  const handleAgregarComentario = async () => {
    if (!responseNote.trim()) {
      alert("La respuesta no puede estar vacía.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest(`tareas_operativas/${tarea.id}/comentarios`, "POST", {
        comment: responseNote,
      });
      // Actualizar lista local con nuevo comentario
      setComentarios((prev) => [...prev, data.comment]);
      setResponseNote(""); // <--- Limpiar campo después de agregar
    } catch {
      alert("❌ Error al agregar el comentario");
    } finally {
      setLoading(false);
    }
  };
  

  // Completar tarea guardando comentario si hay cambios
  const handleCompletar = async () => {
    setLoading(true);
    try {
      // Guardar comentario si es diferente del último
      if (comentarios.length === 0 || comentarios[comentarios.length - 1].comment !== responseNote) {
        await apiRequest(`tareas_operativas/${tarea.id}/comentarios`, "POST", {
          comment: responseNote,
        });
      }
      // Marcar como completada
      await apiRequest(`tareas_operativas/${tarea.id}/completar`, "PUT");
      onHide(true);
    } catch {
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={() => onHide(false)} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Responder Tarea</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p><strong>Concepto:</strong> {tarea?.log?.concept?.name}</p>
        <p><strong>Cliente:</strong> {tarea?.log?.cliente?.nombre_completo || "N/A"}</p>
        <p><strong>Nota del creador:</strong><br />{tarea?.log?.note}</p>

        <hr />

        <h6>Historial de comentarios:</h6>
        {cargandoComentarios ? (
          <Spinner animation="border" />
        ) : comentarios.length === 0 ? (
          <p>No hay comentarios previos.</p>
        ) : (
          <ListGroup style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "1rem" }}>
            {comentarios.map((c) => (
              <ListGroup.Item key={c.id}>
                <strong>{c.user?.name || "Usuario"}:</strong> {c.comment}
                <br />
                <small className="text-muted">{new Date(c.created_at).toLocaleString()}</small>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}

        <Form.Group>
          <Form.Label>Mi respuesta:</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={responseNote}
            onChange={(e) => setResponseNote(e.target.value)}
            disabled={tarea.status === "completed"}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onHide(false)} disabled={loading}>
          Cerrar
        </Button>
        {tarea.status !== "completed" && (
          <>
            <Button variant="info" onClick={handleAgregarComentario} disabled={loading}>
              {loading ? <Spinner size="sm" animation="border" /> : "Agregar Comentario"}
            </Button>
            <Button variant="success" onClick={handleCompletar} disabled={loading}>
              {loading ? <Spinner size="sm" animation="border" /> : "Marcar tarea completada"}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ResponderTareaModal;
