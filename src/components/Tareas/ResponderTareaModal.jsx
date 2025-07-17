import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  ListGroup,
  Row,
  Col,
  Badge,
} from "react-bootstrap";
import apiRequest from "../../services/api";

const ResponderTareaModal = ({ show, onHide, tarea, onUpdated }) => {
  const [responseNote, setResponseNote] = useState(tarea?.response_note || "");
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);

  // ✅ Estados para editar fechas
  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  useEffect(() => {
    if (show && tarea?.id) {
      setCargandoComentarios(true);
      apiRequest(`tareas_operativas/${tarea.id}/comentarios`, "GET")
        .then((data) => {
          setComentarios(data || []);
          if (data && data.length > 0) {
            setResponseNote(data[data.length - 1].comment);
          } else {
            setResponseNote("");
          }
        })
        .finally(() => setCargandoComentarios(false));
    }
    // Resetear fechas cuando cambia la tarea
    if (tarea) {
      setScheduledDate(tarea.scheduled_date || "");
      setDueDate(tarea.due_date || "");
    }
  }, [show, tarea]);

  const handleAgregarComentario = async () => {
    if (!responseNote.trim()) {
      return; // Evitamos alert, simplemente no hace nada
    }
    setLoading(true);
    try {
      const data = await apiRequest(
        `tareas_operativas/${tarea.id}/comentarios`,
        "POST",
        { comment: responseNote }
      );
  
      // ✅ Actualizamos la tarea localmente a in_progress
      const tareaActualizada = {
        ...tarea,
        response_note: responseNote,
        status: tarea.status === "pending" ? "in_progress" : tarea.status,
      };
  
      if (onUpdated) onUpdated(tareaActualizada);
  
      setComentarios((prev) => [...prev, data.comment]);
      setResponseNote("");
  
      // ✅ Cerramos modal automáticamente
      onHide(true);
    } catch {
      console.error("❌ Error al agregar el comentario");
    } finally {
      setLoading(false);
    }
  };
  
  
  const handleCompletar = async () => {
    setLoading(true);
    try {
      if (
        responseNote.trim() !== "" &&
        (comentarios.length === 0 ||
          comentarios[comentarios.length - 1].comment !== responseNote)
      ) {
        await apiRequest(
          `tareas_operativas/${tarea.id}/comentarios`,
          "POST",
          { comment: responseNote }
        );
      }
  
      await apiRequest(`tareas_operativas/${tarea.id}/completar`, "PUT");
  
      const tareaActualizada = {
        ...tarea,
        status: "completed", // ✅ Cambiamos estado local
      };
  
      if (onUpdated) onUpdated(tareaActualizada); // ✅ Actualizamos en el calendario
  
      
      onHide(true);
    } catch {
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };
  

  // ✅ Actualizar fechas desde el modal
  const handleActualizarFechas = async () => {
    if (!scheduledDate || !dueDate) {
      alert("Las fechas no pueden estar vacías.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest(`tareas_operativas/${tarea.id}/reprogramar`, "PUT", {
        scheduled_date: scheduledDate,
        due_date: dueDate,
      });
  
      // Construimos tarea actualizada
      const tareaActualizada = {
        ...tarea,
        scheduled_date: scheduledDate,
        due_date: dueDate,
      };
  
      if (onUpdated) onUpdated(tareaActualizada);
     
    } catch (error) {
      console.error(error);
      alert("❌ Error al actualizar fechas");
    } finally {
      setLoading(false);
    }
  };
  

  const setToastMessage = (message, variant) => {
    alert(`${variant === "success" ? "✅" : "❌"} ${message}`);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "N/A";
    return new Date(fecha).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getBadgeColor = (fecha) => {
    if (!fecha) return "secondary";
    const hoy = new Date();
    const date = new Date(fecha);
    const diffDias = Math.ceil((date - hoy) / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return "danger"; // Vencida
    if (diffDias <= 3) return "warning"; // Próxima a vencer
    return "success"; // OK
  };

  return (
    <Modal show={show} onHide={() => onHide(false)} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {tarea.status === "completed" ? "Detalle de Tarea" : "Responder Tarea"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* ✅ Información general organizada */}
        <div
          className="mb-3 p-3 rounded"
          style={{ background: "#f8f9fa", border: "1px solid #dee2e6" }}
        >
          <Row>
            <Col md={6}>
              <p className="mb-2">
                <strong>Concepto:</strong> {tarea?.log?.concept?.name || "N/A"}
              </p>
              <p className="mb-2">
                <strong>Cliente:</strong>{" "}
                {tarea?.log?.cliente?.nombre_completo || "N/A"}
              </p>
              <p className="mb-2">
                <strong>Quien asigno la tarea:</strong>{" "}
                {tarea?.log?.user.name || "N/A"}
              </p>
            </Col>
            <Col md={6}>
              {/* ✅ Campos editables si la tarea no está completada */}
              {tarea.status !== "completed" ? (
                <>
                  <Form.Group className="mb-2">
                    <Form.Label>📅 Programada:</Form.Label>
                    <Form.Control
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>⏳ Vencimiento:</Form.Label>
                    <Form.Control
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </Form.Group>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    <span role="img" aria-label="calendar">
                      📅
                    </span>{" "}
                    <strong>Programada:</strong>{" "}
                    <Badge bg="info">{formatFecha(tarea?.scheduled_date)}</Badge>
                  </p>
                  <p className="mb-0">
                    <span role="img" aria-label="hourglass">
                      ⏳
                    </span>{" "}
                    <strong>Vencimiento:</strong>{" "}
                    <Badge bg={getBadgeColor(tarea?.due_date)}>
                      {formatFecha(tarea?.due_date)}
                    </Badge>
                  </p>
                </>
              )}
            </Col>
          </Row>
          <p className="mt-3">
            <strong>Nota de la tarea:</strong> {tarea?.log?.note || "Sin nota"}
          </p>
        </div>

        <hr />

        <h6>Historial de comentarios:</h6>
        {cargandoComentarios ? (
          <Spinner animation="border" />
        ) : comentarios.length === 0 ? (
          <p>No hay comentarios previos.</p>
        ) : (
          <ListGroup
            style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "1rem" }}
          >
            {comentarios.map((c) => (
              <ListGroup.Item key={c.id}>
                <strong>{c.user?.name || "Usuario"}:</strong> {c.comment}
                <br />
                <small className="text-muted">
                  {new Date(c.created_at).toLocaleString()}
                </small>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}

        {tarea.status !== "completed" && (
          <Form.Group>
            <Form.Label>Mi respuesta:</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
            />
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={() => onHide(false)}
          disabled={loading}
        >
          Cerrar
        </Button>
        {tarea.status !== "completed" && (
          <>
            <Button
              variant="primary"
              onClick={handleActualizarFechas}
              disabled={loading}
            >
              {loading ? (
                <Spinner size="sm" animation="border" />
              ) : (
                "Actualizar Fechas"
              )}
            </Button>
            <Button
              variant="info"
              onClick={handleAgregarComentario}
              disabled={loading}
            >
              {loading ? (
                <Spinner size="sm" animation="border" />
              ) : (
                "Agregar Comentario"
              )}
            </Button>
            <Button
              variant="success"
              onClick={handleCompletar}
              disabled={loading}
            >
              {loading ? (
                <Spinner size="sm" animation="border" />
              ) : (
                "Marcar tarea completada"
              )}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ResponderTareaModal;
