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

  // ✅ Estados simplificados para edición - usando solo el ID del comentario como clave
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({}); 
  const [comentariosHistorialEnEdicion, setComentariosHistorialEnEdicion] = useState({});

  const [comentariosActualizados, setComentariosActualizados] = useState({});
  const [comentariosHistorialActualizados, setComentariosHistorialActualizados] = useState({});

  // ✅ Historial del cliente
  const [historial, setHistorial] = useState([]);
  const comentariosDeEstaTarea = historial
  .filter(h => h.tipo === 'tarea' && h.id === tarea.id)
  .flatMap(h => h.comentarios || []);

  
  const comentariosTareaActual = historial
  .filter(h => h.tipo === 'tarea' && h.concepto === tarea?.log?.concept?.name)
  .flatMap(h => h.comentarios || []);

  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  useEffect(() => {
    if (show && tarea?.id) {
      // ✅ Cargar comentarios
      

      // ✅ Cargar historial del cliente
      if (tarea.log?.cliente?.id) {
        setLoadingHistorial(true);
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            console.log('📜 Historial original:', historialData);
            // ✅ Deduplicar historial y sus comentarios, asegurar IDs
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
            
            console.log('📜 Historial original:', historialData.length);
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

    // ✅ Limpiar estados de edición al cambiar de tarea
    setComentariosEnEdicion({});
    setComentariosHistorialEnEdicion({});
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

      await apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
      .then((data) => {
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
      console.error("❌ Error al completar la tarea:", error);
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función simplificada para guardar comentarios de la tarea
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

    console.log("🔄 Actualizando comentario tarea:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // ✅ Actualizar estado local - comentarios de tarea
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
        )
      );

      // ✅ También actualizar en historial si existe
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // ✅ Limpiar edición
      setComentariosEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // ✅ Mostrar feedback visual
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
      console.error("❌ Error al actualizar el comentario:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };

  // ✅ Función simplificada para guardar comentarios del historial
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

    console.log("🔄 Actualizando comentario historial:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // ✅ Actualizar historial
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // ✅ También actualizar comentarios de tarea si existe
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
        )
      );

      // ✅ Limpiar edición
      setComentariosHistorialEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // ✅ Mostrar feedback visual
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
        <Row>
          {/* ✅ Columna izquierda: Tarea */}
          <h6 className="mb-3">Detalles de la Tarea agosto</h6>
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
                  Ver Detalles del Cliente
                </Button>

                <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        const nombreCliente = encodeURIComponent(tarea.log.cliente.nombre_completo);
                        window.open(`/Grupofamiliar/lista?search=${nombreCliente}`, "_blank");
                      }}
                    >
                      Ver Grupos Familiares
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
            <h6>Comentarios de esta tarea:</h6>
            {comentariosDeEstaTarea.length === 0 ? (
  <p>No hay comentarios previos.</p>
) : (
  comentariosDeEstaTarea.map((c) => {
    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
    const fueActualizado = comentariosActualizados[c.id];

    return (
      <ListGroup.Item key={c.id} className={fueActualizado ? 'border-success' : ''}>
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
          </>
        )}
      </ListGroup.Item>
    );
  })
)}

           
            <hr />
            

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
                    <p className="mb-1" style={{ whiteSpace: "pre-wrap" }}>
                          {h.nota || "Sin detalles"}
                        </p>

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
                        {h.comentarios.map((c) => {
                          if (!c.id) {
                            console.warn("⚠️ Comentario historial sin ID, saltando:", c);
                            return null;
                          }

                          const estaEnEdicion = comentariosHistorialEnEdicion.hasOwnProperty(c.id);
                          const fueActualizado = comentariosHistorialActualizados[c.id];

                          console.log('🔍 Renderizando comentario historial:', { 
                            id: c.id, 
                            comment: c.comment, 
                            estaEnEdicion,
                            fueActualizado
                          });

                          return (
                            <div 
                              key={c.id} 
                              style={{ 
                                borderBottom: "1px solid #e9ecef", 
                                padding: "4px 0",
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
                                  <span>
                                    <strong>{c.user}</strong>: {c.comment}
                                  </span>
                                  <br />
                                  <small className="text-muted">
                                    {c.fecha ? new Date(c.fecha).toLocaleString() : "Fecha inválida"}
                                  </small>
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