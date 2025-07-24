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

  // ✅ Historial del cliente
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  useEffect(() => {
    if (show && tarea?.id) {
      // ✅ Cargar comentarios
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

      // ✅ Cargar historial del cliente

      if (tarea.log?.cliente?.id) {
        setLoadingHistorial(true);
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            setHistorial(historialData);
          })
          .finally(() => setLoadingHistorial(false));
      }
    }

    // Resetear fechas cuando cambia la tarea
    if (tarea) {
      setScheduledDate(tarea?.scheduled_date || "");
      setDueDate(tarea?.due_date || "");
    }
  }, [show, tarea]);

  const handleAgregarComentario = async () => {
    if (!responseNote.trim()) return;
    setLoading(true);
    try {
      const data = await apiRequest(
        `tareas_operativas/${tarea.id}/comentarios`,
        "POST",
        { comment: responseNote }
      );

      const tareaActualizada = {
        ...tarea,
        response_note: responseNote,
        status: tarea.status === "pending" ? "in_progress" : tarea.status,
      };

      if (onUpdated) onUpdated(tareaActualizada);

      setComentarios((prev) => [...prev, data.comment]);
      setResponseNote("");
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

      const tareaActualizada = { ...tarea, status: "completed" };
      if (onUpdated) onUpdated(tareaActualizada);
      onHide(true);
    } catch {
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

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
    if (diffDias < 0) return "danger";
    if (diffDias <= 3) return "warning";
    return "success";
  };

  return (
    <Modal show={show} onHide={() => onHide(false)} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {tarea.status === "completed" ? "Detalle de Tarea" : "Responder Tarea"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          {/* ✅ Columna izquierda: Tarea */}
          <h6 className="mb-3">Detalles de la Tarea</h6>
          <Col md={6} style={{ borderRight: "1px solid #e9ecef" }}>
            <div
              className="mb-3 p-3 rounded shadow-sm"
              style={{ background: "#fff", border: "1px solid #dee2e6" }}
            >
              {/* ✅ Cabecera con estado y nombre */}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  {tarea.log.cliente.estado_cliente === "prospecto" && (
                    <Badge bg="warning" text="dark" className="me-2">Prospecto</Badge>
                  )}
                  {tarea.log.cliente.estado_cliente === "cliente" && (
                    <Badge bg="primary" className="me-2">Cliente</Badge>
                  )}
                  {tarea.log.cliente.estado_cliente === "descartado" && (
                    <Badge bg="secondary" className="me-2">Descartado</Badge>
                  )}
                  <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    {tarea.log.cliente.nombre_completo}
                  </span>
                </div>
                <div>
                  <small className="text-muted">
                    <i className="fa fa-phone me-1"></i>{tarea.log.cliente.telefono || "N/A"}
                  </small>
                </div>
                <div>
                  <small className="text-muted">
                    <i className="fa fa-phone me-1"></i>{tarea.log.cliente.telefono || "N/A"}
                  </small>
                </div>
              </div>

              {/* ✅ Botones de acción */}
              <div className="d-flex gap-2 mb-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() =>
                    window.open(`/clientes/${tarea.log.cliente.id}/detalle`, "_blank")
                  }
                >
                  Ver Detalles
                </Button>
              </div>

              {/* ✅ Info Primer Contacto SOLO si es prospecto */}
              {tarea.log.cliente.estado_cliente?.toLowerCase() === "prospecto" &&
                tarea.log.cliente.primer_contacto_info && (
                  <div
                    className="p-2 rounded"
                    style={{
                      background: "#f8f9fa",
                      border: "1px solid #dee2e6",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>📌 Info Primer Contacto</strong>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/grupofamiliar/crear?cliente_id=${tarea.log.cliente.id}`,
                            "_blank"
                          )
                        }
                      >
                        Crear Grupo Familiar
                      </Button>
                    </div>

                    {/* ✅ Info organizada */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {tarea.log.cliente.primer_contacto_info
                        .split("\n")
                        .filter((line) => line.trim() !== "")
                        .map((line, index) => (
                          <span
                            key={index}
                            style={{
                              background: "#fff",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              border: "1px solid #e0e0e0",
                            }}
                          >
                            {line.trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
            </div>

            <div
              className="mb-3 p-3 rounded shadow-sm"
              style={{ background: "#fff", border: "1px solid #dee2e6" }}
            >
              <p><strong>Concepto:</strong> {tarea?.log?.concept?.name || "N/A"}</p>
              {tarea.status !== "completed" ? (
                <>
                  <Row className="mb-2">
                    <Col>
                      <Form.Group>
                        <Form.Label>📅 Programada:</Form.Label>
                        <Form.Control
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group>
                        <Form.Label>⏳ Vencimiento:</Form.Label>
                        <Form.Control
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <p><strong>Asignada por:</strong> {tarea?.log?.user?.name || "N/A"}</p>
                  <p className="mt-3"><strong>Nota:</strong> {tarea?.log?.note || "Sin nota"}</p>

                </>
              ) : (
                <>
                  <Badge bg="info" className="me-2">{formatFecha(tarea?.scheduled_date)}</Badge>
                  <Badge bg={getBadgeColor(tarea?.due_date)}>
                    {formatFecha(tarea?.due_date)}
                  </Badge>
                </>
              )}
            </div>

            <hr />
            <h6>Comentarios:</h6>
            {cargandoComentarios ? (
              <Spinner animation="border" />
            ) : comentarios.length === 0 ? (
              <p>No hay comentarios previos.</p>
            ) : (
              <ListGroup style={{ maxHeight: "150px", overflowY: "auto" }}>
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
              <Form.Group className="mt-3">
                <Form.Label>Mi respuesta:</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                />
              </Form.Group>
            )}
          </Col>

          {/* ✅ Columna derecha: Historial */}
          <Col md={6} style={{ overflowY: "auto", maxHeight: "calc(100vh - 250px)" }}>
            <h6 className="mb-3">📜 Historial del Cliente</h6>
            {loadingHistorial ? (
              <Spinner animation="border" />
            ) : historial.length === 0 ? (
              <p>No hay historial disponible.</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                {historial.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded"
                    style={{
                      background: "#fff",
                      border: "1px solid #dee2e6",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                    }}
                  >
                    <div className="d-flex justify-content-between">
                      <strong>
                        {h.tipo === "bitacora" ? "📝 Acción" : "📌 Tarea"}:{" "}
                        <span style={{ color: h.tipo === "bitacora" ? "#0d6efd" : "#dc3545" }}>
                          {h.concepto}
                        </span>
                      </strong>
                      {h.estado && (
                        <Badge
                          bg={
                            h.estado === "completed"
                              ? "success"
                              : h.estado === "pending"
                                ? "warning"
                                : "info"
                          }
                        >
                          {h.estado === "completed" ? "Completada" : h.estado === "pending" ? "Pendiente" : "En progreso"}
                        </Badge>
                      )}
                    </div>
                    <p className="mb-1">{h.nota || "Sin detalles"}</p>
                    <small className="text-muted">
                      {new Date(h.fecha).toLocaleString()} | {h.usuario}
                      {h.asignado_a && ` | Asignado a: ${h.asignado_a}`}
                    </small>

                    {/* ✅ Mostrar comentarios si existen */}
                    {h.comentarios && h.comentarios.length > 0 && (
                      <div
                        className="mt-2 p-2 rounded"
                        style={{
                          background: "#f8f9fa",
                          border: "1px solid #dee2e6",
                          fontSize: "0.85rem"
                        }}
                      >
                        <strong>💬 Comentarios:</strong>
                        {h.comentarios.map((c, i) => (
                          <div key={i} style={{ borderBottom: "1px solid #e9ecef", padding: "4px 0" }}>
                            <span>
                              <strong>{c.user}</strong>: {c.comment}
                            </span>
                            <br />
                            <small className="text-muted">
                              {new Date(c.fecha).toLocaleString()}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onHide(false)}>
          Cerrar
        </Button>
        {tarea.status !== "completed" && (
          <>
            <Button variant="primary" onClick={handleActualizarFechas}>
              Actualizar Fechas
            </Button>
            <Button variant="info" onClick={handleAgregarComentario}>
              Agregar Comentario
            </Button>
            <Button variant="success" onClick={handleCompletar}>
              Marcar completada
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ResponderTareaModal;
