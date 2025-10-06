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
  Nav,
  Tab,
} from "react-bootstrap";
import apiRequest from "../../services/api";

const FichaCliente = ({ show, onHide, tarea, onUpdated }) => {
  const [responseNote, setResponseNote] = useState(tarea?.response_note || "");
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);

  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({});
  const [comentariosHistorialEnEdicion, setComentariosHistorialEnEdicion] = useState({});

  const [comentariosActualizados, setComentariosActualizados] = useState({});
  const [comentariosHistorialActualizados, setComentariosHistorialActualizados] = useState({});

  const [historial, setHistorial] = useState([]);
  const comentariosDeEstaTarea = historial
    .filter((h) => h.tipo === "tarea" && h.id === tarea.id)
    .flatMap((h) => h.comentarios || []);

  const comentariosTareaActual = historial
    .filter((h) => h.tipo === "tarea" && h.concepto === tarea?.log?.concept?.name)
    .flatMap((h) => h.comentarios || []);

  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  // Estado para el tab activo
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (show && tarea?.id) {
      if (tarea.log?.cliente?.id) {
        setLoadingHistorial(true);
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            const historialUnico = historialData.map((h) => {
              if (h.comentarios && h.comentarios.length > 0) {
                const comentariosUnicos = h.comentarios.filter((comentario, index, arr) => {
                  if (!comentario.id) {
                    console.warn("⚠️ Comentario de historial sin ID:", comentario);
                    return false;
                  }
                  return arr.findIndex((c) => c.id === comentario.id) === index;
                });
                return { ...h, comentarios: comentariosUnicos };
              }
              return h;
            });

            setHistorial(historialUnico);
          })
          .catch((error) => {
            console.error("❌ Error al cargar historial:", error);
            setHistorial([]);
          })
          .finally(() => setLoadingHistorial(false));
      }
    }

    if (tarea) {
      setScheduledDate(tarea?.scheduled_date || "");
      setDueDate(tarea?.due_date || "");
    }

    setComentariosEnEdicion({});
    setComentariosHistorialEnEdicion({});
  }, [show, tarea]);

  const handleAgregarComentario = async () => {
    if (!responseNote.trim()) return;
    setLoading(true);
    try {
      await apiRequest(`tareas_operativas/${tarea.id}/comentarios`, "POST", {
        comment: responseNote,
      });

      const tareaActualizada = {
        ...tarea,
        response_note: responseNote,
        status: tarea.status === "pending" ? "in_progress" : tarea.status,
      };

      if (onUpdated) onUpdated(tareaActualizada);

      await apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET").then((data) => {
        const historialData = Array.isArray(data.data) ? data.data : [];
        setHistorial(historialData);
      });

      setResponseNote("");
      onHide(true);
    } catch (error) {
      console.error("❌ Error al agregar el comentario:", error);
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
        await apiRequest(`tareas_operativas/${tarea.id}/comentarios`, "POST", {
          comment: responseNote,
        });
      }

      await apiRequest(`tareas_operativas/${tarea.id}/completar`, "PUT");

      const tareaActualizada = { ...tarea, status: "completed" };
      if (onUpdated) onUpdated(tareaActualizada);
      onHide(true);
    } catch (error) {
      console.error("❌ Error al completar la tarea:", error);
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarComentarioTarea = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido para actualizar");
      return;
    }

    const nuevoTexto = comentariosEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto de comentario vacío");
      return;
    }

    try {
      await apiRequest(`tareas_operativas/comentarios/${comentarioId}`, "PUT", {
        comment: nuevoTexto,
      });

      setComentarios((prev) =>
        prev.map((c) => (c.id === comentarioId ? { ...c, comment: nuevoTexto } : c))
      );

      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios:
            h.comentarios?.map((c) =>
              c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
            ) || [],
        }))
      );

      setComentariosEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      setComentariosActualizados((prev) => ({
        ...prev,
        [comentarioId]: true,
      }));

      setTimeout(() => {
        setComentariosActualizados((prev) => {
          const nuevo = { ...prev };
          delete nuevo[comentarioId];
          return nuevo;
        });
      }, 3000);
    } catch (error) {
      console.error("❌ Error al actualizar el comentario:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };

  const handleGuardarComentarioHistorial = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido para actualizar historial");
      return;
    }

    const nuevoTexto = comentariosHistorialEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto de comentario vacío");
      return;
    }

    try {
      await apiRequest(`tareas_operativas/comentarios/${comentarioId}`, "PUT", {
        comment: nuevoTexto,
      });

      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios:
            h.comentarios?.map((c) =>
              c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
            ) || [],
        }))
      );

      setComentarios((prev) =>
        prev.map((c) => (c.id === comentarioId ? { ...c, comment: nuevoTexto } : c))
      );

      setComentariosHistorialEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      setComentariosHistorialActualizados((prev) => ({
        ...prev,
        [comentarioId]: true,
      }));

      setTimeout(() => {
        setComentariosHistorialActualizados((prev) => {
          const nuevo = { ...prev };
          delete nuevo[comentarioId];
          return nuevo;
        });
      }, 3000);
    } catch (error) {
      console.error("❌ Error al actualizar el comentario del historial:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
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
        {/* Header con información del cliente */}
        <div
          className="mb-3 p-3 rounded shadow-sm"
          style={{ background: "#f8f9fa", border: "1px solid #dee2e6" }}
        >
          <Row className="align-items-center">
            <Col md={6}>
              <div className="d-flex align-items-center gap-2">
                {tarea.log.cliente.estado_cliente === "prospecto" && (
                  <Badge bg="warning" text="dark">
                    Prospecto
                  </Badge>
                )}
                {tarea.log.cliente.estado_cliente === "cliente" && (
                  <Badge bg="primary">Cliente</Badge>
                )}
                {tarea.log.cliente.estado_cliente === "descartado" && (
                  <Badge bg="secondary">Descartado</Badge>
                )}
                <h5 className="mb-0">{tarea.log.cliente.nombre_completo}</h5>
              </div>
              <div className="mt-2">
                <small className="text-muted">
                  <i className="fa fa-phone me-1"></i>
                  {tarea.log.cliente.telefono || "N/A"}
                </small>
              </div>
            </Col>
            <Col md={6} className="text-end">
              <div className="d-flex gap-2 justify-content-end">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() =>
                    window.open(`/clientes/${tarea.log.cliente.id}/detalle`, "_blank")
                  }
                >
                  <i className="fa fa-user me-1"></i>
                  Ver Cliente
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    const nombreCliente = encodeURIComponent(
                      tarea.log.cliente.nombre_completo
                    );
                    window.open(`/Grupofamiliar/lista?search=${nombreCliente}`, "_blank");
                  }}
                >
                  <i className="fa fa-users me-1"></i>
                  Grupos Familiares
                </Button>
              </div>
            </Col>
          </Row>

          {/* Info Primer Contacto SOLO si es prospecto */}
          {tarea.log.cliente.estado_cliente?.toLowerCase() === "prospecto" &&
            tarea.log.cliente.primer_contacto_info && (
              <div className="mt-3">
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
                    <i className="fa fa-plus me-1"></i>
                    Crear Grupo Familiar
                  </Button>
                </div>
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
                          fontSize: "0.85rem",
                        }}
                      >
                        {line.trim()}
                      </span>
                    ))}
                </div>
              </div>
            )}
        </div>

        {/* Tabs Navigation */}
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Nav variant="tabs" className="mb-3">
            <Nav.Item>
              <Nav.Link eventKey="general">General</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="historial">
                Historial
                {historial.length > 0 && (
                  <Badge bg="secondary" className="ms-2">
                    {historial.length}
                  </Badge>
                )}
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="comentarios">
                Comentarios
                {comentariosDeEstaTarea.length > 0 && (
                  <Badge bg="secondary" className="ms-2">
                    {comentariosDeEstaTarea.length}
                  </Badge>
                )}
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            {/* Tab General */}
            <Tab.Pane eventKey="general">
              <div
                className="p-3 rounded shadow-sm"
                style={{ background: "#fff", border: "1px solid #dee2e6" }}
              >
                <h6 className="mb-3">
                  <i className="fa fa-tasks me-2"></i>
                  Información de la Tarea
                </h6>
                <Row>
                  <Col md={6}>
                    <p>
                      <strong>Concepto:</strong> {tarea?.log?.concept?.name || "N/A"}
                    </p>
                    <p>
                      <strong>Asignada por:</strong> {tarea?.log?.user?.name || "N/A"}
                    </p>
                  </Col>
                  <Col md={6}>
                    {tarea.status !== "completed" ? (
                      <>
                        <Form.Group className="mb-2">
                          <Form.Label>
                            <i className="fa fa-calendar me-1"></i>
                            Programada:
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                          />
                        </Form.Group>
                        <Form.Group>
                          <Form.Label>
                            <i className="fa fa-clock me-1"></i>
                            Vencimiento:
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                          />
                        </Form.Group>
                      </>
                    ) : (
                      <div>
                        <Badge bg="info" className="me-2">
                          {formatFecha(tarea?.scheduled_date)}
                        </Badge>
                        <Badge bg={getBadgeColor(tarea?.due_date)}>
                          {formatFecha(tarea?.due_date)}
                        </Badge>
                      </div>
                    )}
                  </Col>
                </Row>

                <hr />

                <div>
                  <strong>
                    <i className="fa fa-sticky-note me-2"></i>
                    Nota de la tarea:
                  </strong>
                  <p
                    className="mt-2 p-2 rounded"
                    style={{ background: "#f8f9fa", whiteSpace: "pre-wrap" }}
                  >
                    {tarea?.log?.note || "Sin nota"}
                  </p>
                </div>

                {tarea.status !== "completed" && (
                  <>
                    <hr />
                    <Form.Group>
                      <Form.Label>
                        <strong>
                          <i className="fa fa-pencil me-2"></i>
                          Mi respuesta:
                        </strong>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={responseNote}
                        onChange={(e) => setResponseNote(e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                      />
                    </Form.Group>
                  </>
                )}
              </div>
            </Tab.Pane>

            {/* Tab Historial */}
            <Tab.Pane eventKey="historial">
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {loadingHistorial ? (
                  <div className="text-center p-5">
                    <Spinner animation="border" />
                  </div>
                ) : historial.length === 0 ? (
                  <div className="text-center p-5 text-muted">
                    <i className="fa fa-inbox fa-3x mb-3"></i>
                    <p>No hay historial disponible.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {historial.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded"
                        style={{
                          background: "#fff",
                          border: "1px solid #dee2e6",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <strong>
                              {h.tipo === "bitacora" ? (
                                <i className="fa fa-file-text me-2 text-primary"></i>
                              ) : (
                                <i className="fa fa-check-square me-2 text-danger"></i>
                              )}
                              {h.concepto}
                            </strong>
                          </div>
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
                              {h.estado === "completed"
                                ? "Completada"
                                : h.estado === "pending"
                                ? "Pendiente"
                                : "En progreso"}
                            </Badge>
                          )}
                        </div>

                        <p
                          className="mb-2"
                          style={{
                            whiteSpace: "pre-wrap",
                            background: "#f8f9fa",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          {h.nota || "Sin detalles"}
                        </p>

                        <small className="text-muted">
                          <i className="fa fa-calendar me-1"></i>
                          {new Date(h.fecha).toLocaleString()} |{" "}
                          <i className="fa fa-user me-1"></i>
                          {h.usuario}
                          {h.asignado_a && ` | Asignado a: ${h.asignado_a}`}
                        </small>

                        {h.comentarios && h.comentarios.length > 0 && (
                          <div
                            className="mt-3 p-2 rounded"
                            style={{
                              background: "#f8f9fa",
                              border: "1px solid #dee2e6",
                            }}
                          >
                            <strong>
                              <i className="fa fa-comments me-2"></i>
                              Comentarios:
                            </strong>
                            {h.comentarios.map((c) => {
                              if (!c.id) return null;

                              const estaEnEdicion =
                                comentariosHistorialEnEdicion.hasOwnProperty(c.id);
                              const fueActualizado = comentariosHistorialActualizados[c.id];

                              return (
                                <div
                                  key={c.id}
                                  className="mt-2 p-2 rounded"
                                  style={{
                                    background: fueActualizado ? "#d4edda" : "#fff",
                                    border: "1px solid #dee2e6",
                                  }}
                                >
                                  {fueActualizado && (
                                    <Badge bg="success" size="sm" className="mb-2">
                                      Actualizado ✓
                                    </Badge>
                                  )}

                                  {estaEnEdicion ? (
                                    <>
                                      <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={comentariosHistorialEnEdicion[c.id]}
                                        onChange={(e) =>
                                          setComentariosHistorialEnEdicion((prev) => ({
                                            ...prev,
                                            [c.id]: e.target.value,
                                          }))
                                        }
                                        className="mb-2"
                                      />
                                      <div className="d-flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="success"
                                          onClick={() =>
                                            handleGuardarComentarioHistorial(c.id)
                                          }
                                          disabled={
                                            !comentariosHistorialEnEdicion[c.id]?.trim()
                                          }
                                        >
                                          Guardar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() =>
                                            setComentariosHistorialEnEdicion((prev) => {
                                              const nuevo = { ...prev };
                                              delete nuevo[c.id];
                                              return nuevo;
                                            })
                                          }
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <strong>{c.user}:</strong> {c.comment}
                                      </div>
                                      <small className="text-muted">
                                        {c.fecha
                                          ? new Date(c.fecha).toLocaleString()
                                          : "Fecha inválida"}
                                      </small>
                                      <div className="mt-2">
                                        <Button
                                          size="sm"
                                          variant="outline-secondary"
                                          onClick={() =>
                                            setComentariosHistorialEnEdicion((prev) => ({
                                              ...prev,
                                              [c.id]: c.comment,
                                            }))
                                          }
                                        >
                                          ✏️ Editar
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tab.Pane>

            {/* Tab Comentarios */}
            <Tab.Pane eventKey="comentarios">
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {comentariosDeEstaTarea.length === 0 ? (
                  <div className="text-center p-5 text-muted">
                    <i className="fa fa-comment-o fa-3x mb-3"></i>
                    <p>No hay comentarios en esta tarea.</p>
                  </div>
                ) : (
                  <ListGroup>
                    {comentariosDeEstaTarea.map((c) => {
                      const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
                      const fueActualizado = comentariosActualizados[c.id];

                      return (
                        <ListGroup.Item
                          key={c.id}
                          className={fueActualizado ? "border-success" : ""}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <strong>
                              <i className="fa fa-user-circle me-2"></i>
                              {c.user || "Usuario"}
                            </strong>
                            {fueActualizado && (
                              <Badge bg="success">Actualizado ✓</Badge>
                            )}
                          </div>

                          {estaEnEdicion ? (
                            <>
                              <Form.Control
                                as="textarea"
                                value={comentariosEnEdicion[c.id]}
                                onChange={(e) =>
                                  setComentariosEnEdicion((prev) => ({
                                    ...prev,
                                    [c.id]: e.target.value,
                                  }))
                                }
                                rows={2}
                                className="mb-2"
                              />
                              <div className="d-flex gap-2">
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => handleGuardarComentarioTarea(c.id)}
                                  disabled={!comentariosEnEdicion[c.id]?.trim()}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setComentariosEnEdicion((prev) => {
                                      const nuevo = { ...prev };
                                      delete nuevo[c.id];
                                      return nuevo;
                                    });
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  whiteSpace: "pre-wrap",
                                  background: "#f8f9fa",
                                  padding: "8px",
                                  borderRadius: "4px",
                                  marginBottom: "8px",
                                }}
                              >
                                {c.comment}
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <small className="text-muted">
                                  <i className="fa fa-clock-o me-1"></i>
                                  {new Date(c.fecha).toLocaleString()}
                                </small>
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => {
                                    setComentariosEnEdicion((prev) => ({
                                      ...prev,
                                      [c.id]: c.comment,
                                    }));
                                  }}
                                >
                                  ✏️ Editar
                                </Button>
                              </div>
                            </>
                          )}
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                )}
              </div>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <Button variant="secondary" onClick={() => onHide(false)}>
          <i className="fa fa-times me-1"></i>
          Cerrar
        </Button>
        {tarea.status !== "completed" && (
          <div className="d-flex gap-2">
            <Button variant="primary" onClick={handleActualizarFechas} disabled={loading}>
              <i className="fa fa-calendar-check-o me-1"></i>
              Actualizar Fechas
            </Button>
            <Button
              variant="info"
              onClick={handleAgregarComentario}
              disabled={loading || !responseNote.trim()}
            >
              <i className="fa fa-comment me-1"></i>
              Agregar Comentario
            </Button>
            <Button variant="success" onClick={handleCompletar} disabled={loading}>
              <i className="fa fa-check me-1"></i>
              Marcar Completada
            </Button>
          </div>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default FichaCliente;