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

const ResponderOportunidadModal = ({ show, onHide, tarea, onUpdated }) => {
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Estados para edición de comentarios
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({});
  const [comentariosHistorialEnEdicion, setComentariosHistorialEnEdicion] = useState({});
  const [comentariosActualizados, setComentariosActualizados] = useState({});
  const [comentariosHistorialActualizados, setComentariosHistorialActualizados] = useState({});

  // Historial del cliente
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Fechas de seguimiento
  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  // Comentarios de esta tarea desde el historial
  const comentariosDeEstaTarea = historial
    .filter(h => h.tipo === 'tarea' && h.id === tarea?.id)
    .flatMap(h => h.comentarios || []);

  useEffect(() => {
    if (show && tarea?.id) {
      // Log para depuración
      console.log('🔍 Tarea completa recibida:', tarea);
      console.log('📋 Concepto:', tarea?.log?.titulo || tarea?.concepto);
      console.log('📝 Nota:', tarea?.log?.nota || tarea?.nota);
      console.log('👤 Asignado por (responsable):', tarea?.log?.responsable);
      console.log('👤 Asignado por (creado_por):', tarea?.creado_por);
      console.log('👤 Asignado a (asignado_a):', tarea?.asignado_a);
      console.log('📅 Fecha programada:', tarea?.scheduled_date);
      console.log('⏰ Fecha vencimiento:', tarea?.due_date);

      // Cargar historial del cliente
      if (tarea.log?.cliente?.id) {
        setLoadingHistorial(true);
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            
            // Deduplicar historial y sus comentarios, asegurar IDs
            const historialUnico = historialData.map(h => {
              if (h.comentarios && h.comentarios.length > 0) {
                const comentariosUnicos = h.comentarios.filter((comentario, index, arr) => {
                  if (!comentario.id) {
                    console.warn("⚠️ Comentario de historial sin ID:", comentario);
                    return false;
                  }
                  return arr.findIndex(c => c.id === comentario.id) === index;
                });
                return { ...h, comentarios: comentariosUnicos };
              }
              return h;
            });
            
            console.log('📜 Historial procesado:', historialUnico.length);
            setHistorial(historialUnico);
          })
          .catch(error => {
            console.error("❌ Error al cargar historial:", error);
            setHistorial([]);
          })
          .finally(() => setLoadingHistorial(false));
      }
    }

    // Resetear fechas cuando cambia la tarea
    if (tarea) {
      setScheduledDate(tarea?.scheduled_date || "");
      setDueDate(tarea?.due_date || "");
    }

    // Limpiar estados de edición al cambiar de tarea
    setComentariosEnEdicion({});
    setComentariosHistorialEnEdicion({});
    setResponseNote("");
  }, [show, tarea]);

  const handleAgregarComentario = async () => {
    if (!responseNote.trim()) return;
    setLoading(true);
    try {
      await apiRequest(
        `tareas_operativas/${tarea.id}/comentarios`,
        "POST",
        { comment: responseNote }
      );

      const tareaActualizada = {
        ...tarea,
        status: tarea.status === "pending" ? "in_progress" : tarea.status,
      };

      if (onUpdated) onUpdated(tareaActualizada);

      // Recargar historial
      await apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
        .then((data) => {
          const historialData = Array.isArray(data.data) ? data.data : [];
          setHistorial(historialData);
        });
    
      setResponseNote("");
      onHide(true);
    } catch (error) {
      console.error("❌ Error al agregar el comentario:", error);
      alert("Error al agregar el comentario");
    } finally {
      setLoading(false);
    }
  };

  const handleCompletar = async () => {
    setLoading(true);
    try {
      if (
        responseNote.trim() !== "" &&
        (comentariosDeEstaTarea.length === 0 ||
          comentariosDeEstaTarea[comentariosDeEstaTarea.length - 1]?.comment !== responseNote)
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
    } catch (error) {
      console.error("❌ Error al completar:", error);
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarComentarioTarea = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido");
      return;
    }

    const nuevoTexto = comentariosEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto vacío");
      return;
    }

    console.log("🔄 Actualizando comentario:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // Actualizar estado local - comentarios de tarea
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // Limpiar edición
      setComentariosEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // Mostrar feedback
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

      console.log("✅ Comentario actualizado exitosamente");

    } catch (error) {
      console.error("❌ Error al actualizar:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };

  const handleGuardarComentarioHistorial = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido");
      return;
    }

    const nuevoTexto = comentariosHistorialEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto vacío");
      return;
    }

    console.log("🔄 Actualizando comentario historial:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // Actualizar historial
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // Limpiar edición
      setComentariosHistorialEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // Mostrar feedback
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

      console.log("✅ Comentario historial actualizado exitosamente");

    } catch (error) {
      console.error("❌ Error al actualizar:", error);
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
      alert("✅ Fechas actualizadas");
    } catch (error) {
      console.error(error);
      alert("❌ Error al actualizar las fechas");
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

  const esCerrada = tarea?.status === "completed";

  // Extraer datos de manera más robusta
  const conceptoTarea = tarea?.log?.titulo || tarea?.log?.concept?.name || tarea?.concepto || tarea?.titulo || "Sin concepto";
  const notaTarea = tarea?.log?.nota || tarea?.log?.note || tarea?.nota || tarea?.note || "Sin nota";
  const asignadoPor = tarea?.log?.responsable || tarea?.responsable || tarea?.log?.user?.name || tarea?.creado_por || tarea?.asignado_a || "N/A";

  return (
    <Modal show={show} onHide={() => onHide(false)} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {esCerrada ? "Detalle de Tarea" : "Responder Tarea"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          {/* Columna izquierda: Tarea */}
          <Col md={6} style={{ borderRight: "1px solid #e9ecef" }}>
            {/* Banner destacado de la tarea actual */}
            <div
              className="mb-3 p-3 rounded shadow"
              style={{ 
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "2px solid #5568d3"
              }}
            >
              <div className="d-flex align-items-center mb-2">
                <span style={{ fontSize: "1.5rem", marginRight: "10px" }}>📌</span>
                <div>
                  <h5 className="mb-0 text-white">Tarea Actual</h5>
                  <small className="text-white" style={{ opacity: 0.9 }}>
                    Respondiendo esta tarea
                  </small>
                </div>
              </div>
              <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.95)" }}>
                <h6 className="mb-2" style={{ color: "#667eea", fontWeight: "bold" }}>
                  {conceptoTarea}
                </h6>
                <div className="small">
                  <strong>Nota:</strong> {notaTarea}
                </div>
              </div>
            </div>

            <h6 className="mb-3 text-muted">Detalles de la Tarea</h6>
            
            {/* Detalles de la Tarea */}
            <div
              className="mb-3 p-3 rounded shadow-sm"
              style={{ background: "#fff", border: "1px solid #dee2e6" }}
            >
              {!esCerrada ? (
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
                  <p><strong>Asignada por:</strong> {asignadoPor}</p>
                </>
              ) : (
                <>
                  <Badge bg="info" className="me-2">{formatFecha(tarea?.scheduled_date)}</Badge>
                  <Badge bg={getBadgeColor(tarea?.due_date)}>
                    {formatFecha(tarea?.due_date)}
                  </Badge>
                  <p className="mt-3"><strong>Asignada por:</strong> {asignadoPor}</p>
                </>
              )}
            </div>

            <hr />
            
            {/* Comentarios de esta tarea */}
            <div className="mb-3">
              <div className="d-flex align-items-center mb-2">
                <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>💬</span>
                <h6 className="mb-0">Comentarios de esta tarea</h6>
              </div>
              {comentariosDeEstaTarea.length === 0 ? (
                <p className="text-muted small">No hay comentarios previos.</p>
              ) : (
                <ListGroup className="mb-3">
                  {comentariosDeEstaTarea.map((c) => {
                    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
                    const fueActualizado = comentariosActualizados[c.id];

                    return (
                      <ListGroup.Item 
                        key={c.id} 
                        className={fueActualizado ? 'border-success' : ''}
                        style={{ background: "#f8f9fa" }}
                      >
                        <strong>{c.user || "Usuario"}:</strong>
                        {fueActualizado && (
                          <Badge bg="success" className="ms-2">Actualizado ✓</Badge>
                        )}

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
                              className="mb-2 mt-2"
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
                            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{c.comment}</div>
                            <small className="text-muted">
                              {new Date(c.fecha).toLocaleString()}
                            </small>
                            {!esCerrada && (
                              <div className="mt-1">
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
                            )}
                          </>
                        )}
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              )}
            </div>

            <hr />

            {/* Campo para nuevo comentario */}
            {!esCerrada && (
              <div className="mt-3">
                <div className="d-flex align-items-center mb-2">
                  <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>✍️</span>
                  <Form.Label className="mb-0 fw-bold">Mi respuesta:</Form.Label>
                </div>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  style={{ border: "2px solid #667eea" }}
                />
              </div>
            )}
          </Col>

          {/* Columna derecha: Historial */}
          <Col md={6} style={{ overflowY: "auto", maxHeight: "calc(100vh - 250px)" }}>
            <h6 className="mb-3">📜 Historial del Cliente</h6>
            {loadingHistorial ? (
              <div className="text-center">
                <Spinner animation="border" />
              </div>
            ) : historial.length === 0 ? (
              <p className="text-muted">No hay historial disponible.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                    <div className="d-flex justify-content-between align-items-start">
                      <strong>
                        {h.tipo === "bitacora" && "📝 Acción"}
                        {h.tipo === "tarea" && "📌 Tarea"}:{" "}
                        <span style={{ 
                          color: h.tipo === "bitacora" ? "#0d6efd" : "#dc3545"
                        }}>
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
                    
                    <p className="mb-1 mt-2" style={{ whiteSpace: "pre-wrap" }}>
                      {h.nota || "Sin detalles"}
                    </p>

                    <small className="text-muted">
                      {new Date(h.fecha).toLocaleString()} | {h.usuario}
                      {h.asignado_a && ` | Asignado a: ${h.asignado_a}`}
                    </small>

                    {/* Comentarios del historial */}
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
                        {h.comentarios.map((c) => {
                          if (!c.id) return null;

                          const estaEnEdicion = comentariosHistorialEnEdicion.hasOwnProperty(c.id);
                          const fueActualizado = comentariosHistorialActualizados[c.id];

                          return (
                            <div 
                              key={c.id} 
                              style={{ 
                                borderBottom: "1px solid #e9ecef", 
                                padding: "6px 0",
                                backgroundColor: fueActualizado ? '#d4edda' : 'transparent'
                              }}
                            >
                              {fueActualizado && (
                                <Badge bg="success" size="sm" className="mb-1">Actualizado ✓</Badge>
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
                                      onClick={() => handleGuardarComentarioHistorial(c.id)}
                                      disabled={!comentariosHistorialEnEdicion[c.id]?.trim()}
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
                                    <strong>{c.user}</strong>: {c.comment}
                                  </div>
                                  <small className="text-muted">
                                    {c.fecha ? new Date(c.fecha).toLocaleString() : "Fecha inválida"}
                                  </small>
                                  {!esCerrada && (
                                    <div className="mt-1">
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
                                  )}
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
          </Col>
        </Row>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onHide(false)}>
          Cerrar
        </Button>
        {!esCerrada && (
          <>
            <Button 
              variant="primary" 
              onClick={handleActualizarFechas}
              disabled={loading}
            >
              Actualizar Fechas
            </Button>
            <Button 
              variant="info" 
              onClick={handleAgregarComentario}
              disabled={loading}
            >
              Agregar Comentario
            </Button>
            <Button 
              variant="success" 
              onClick={handleCompletar}
              disabled={loading}
            >
              Marcar completada
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ResponderOportunidadModal;