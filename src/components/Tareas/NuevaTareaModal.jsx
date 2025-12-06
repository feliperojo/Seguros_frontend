import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";

const NuevaTareaModal = ({ show, onHide, onCreated, categoria = "tarea_manual", grupoFamiliarId, clienteId }) => {
  const hoy = new Date().toISOString().split("T")[0];
  const toInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));

  // Estado para el tipo de acción: "comentario" o "tarea"
  const [tipoAccion, setTipoAccion] = useState("comentario"); // "comentario" | "tarea"

  const [formData, setFormData] = useState({
    concept_id: "",
    note: "",
    cliente_id: "",
    grupo_familiar_id: "",
    assign_to_user_id: "",
    scheduled_date: hoy,
    due_date: hoy,
  });

  const sinGrupoEnPath = !toInt(grupoFamiliarId);
  const tieneGrupoContexto = toInt(grupoFamiliarId) !== null;

  const [conceptos, setConceptos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [conceptosPadres, setConceptosPadres] = useState([]);
  const [subconceptos, setSubconceptos] = useState([]);
  const [conceptoPadreId, setConceptoPadreId] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteFicha, setClienteFicha] = useState(null); // Cliente de la ficha actual
  const [loadingCliente, setLoadingCliente] = useState(false);

  const normalize = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const handleClienteSeleccion = (cli, grupoElegido) => {
    const ctxId = toInt(grupoFamiliarId ?? formData.grupo_familiar_id);
    const pickId = toInt(grupoElegido?.grupo_familiar_id);
    const cliId = toInt(cli?.cliente_id ?? cli?.id);

    // Validar coincidencia de grupo
    if (tieneGrupoContexto && ctxId && pickId && ctxId !== pickId) {
      alert("⚠️ El cliente pertenece a otro grupo familiar. Por favor seleccione un miembro del grupo actual.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      cliente_id: cliId || "",
      grupo_familiar_id: pickId || ctxId || "",
    }));

    // Actualizar clienteFicha si es diferente del de la ficha
    if (cliId !== toInt(clienteId)) {
      setClienteFicha({
        id: cliId,
        nombre_completo: cli.nombre_completo || cli.nombre || "Cliente seleccionado",
        email: cli.email || null,
        telefono: cli.telefono || null,
      });
    }

    // Mostrar nombre completo con información adicional si está disponible
    const nombreDisplay = cli.nombre_completo || cli.nombre || "Cliente seleccionado";
    const infoExtra = [];
    if (cliId) infoExtra.push(`ID: ${cliId}`);
    if (grupoElegido?.grupo_familiar_id) infoExtra.push(`GF #${grupoElegido.grupo_familiar_id}`);
    
    setClienteQuery(nombreDisplay + (infoExtra.length > 0 ? ` (${infoExtra.join(", ")})` : ""));
    setClientes([]);
  };

  useEffect(() => {
    if (show) {
      Promise.all([
        apiRequest(`operational_concepts?only_parents=true`, "GET"),
        apiRequest("cliente", "GET"),
        apiRequest("grupo_familiar", "GET"),
        apiRequest("users", "GET"),
      ]).then(([conceptos, , grupos, usuarios]) => {
        setConceptosPadres(conceptos);
        setConceptos([]);
        setClientes([]);
        setGrupos(grupos);
        setUsuarios(usuarios);
      });

      // Cargar información del cliente de la ficha si hay clienteId
      if (clienteId) {
        setLoadingCliente(true);
        apiRequest(`cliente/${clienteId}`, "GET")
          .then((cliente) => {
            if (cliente) {
              setClienteFicha({
                id: cliente.id || clienteId,
                nombre_completo: cliente.nombre_completo || cliente.nombre || "Cliente",
                email: cliente.email || null,
                telefono: cliente.telefono || null,
              });
              setClienteQuery(cliente.nombre_completo || cliente.nombre || "Cliente de la ficha");
            }
          })
          .catch((err) => {
            console.error("Error al cargar cliente:", err);
            setClienteFicha({
              id: clienteId,
              nombre_completo: "Cliente de la ficha",
            });
            setClienteQuery("Cliente de la ficha");
          })
          .finally(() => {
            setLoadingCliente(false);
          });
      } else {
        setClienteFicha(null);
        setClienteQuery("");
      }

      // Reset y prefill
      setFormData({
        concept_id: "",
        note: "",
        cliente_id: clienteId ?? "",
        grupo_familiar_id: grupoFamiliarId ?? "",
        assign_to_user_id: "",
        scheduled_date: hoy,
        due_date: hoy,
      });
      // Reset tipo de acción a comentario por defecto
      setTipoAccion("comentario");
      setErrors({});
    }
  }, [show, categoria, grupoFamiliarId, clienteId]);

  useEffect(() => {
    if (show && grupoFamiliarId && !formData.grupo_familiar_id) {
      setFormData((prev) => ({
        ...prev,
        grupo_familiar_id: String(grupoFamiliarId),
      }));
    }
    
    // Si hay clienteId pero no está en formData, establecerlo
    if (show && clienteId && !formData.cliente_id) {
      setFormData((prev) => ({
        ...prev,
        cliente_id: String(clienteId),
      }));
    }
  }, [grupoFamiliarId, clienteId, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePadreChange = async (e) => {
    const selectedId = e.target.value;
    setConceptoPadreId(selectedId);
    setFormData((prev) => ({ ...prev, concept_id: "" }));

    if (selectedId) {
      const hijos = await apiRequest(`operational_concepts/${selectedId}/subconcepts`, "GET");
      setSubconceptos(hijos);
      setConceptos(hijos);
    } else {
      setConceptos([]);
    }
  };

  const validarCampos = () => {
    const nuevosErrores = {};
    if (!formData.concept_id) nuevosErrores.concept_id = "El concepto es obligatorio";
    if (!formData.note.trim()) nuevosErrores.note = "La nota es obligatoria";
    if (!formData.cliente_id) nuevosErrores.cliente_id = "El cliente es obligatorio";
    
    // Solo validar asignación y fechas si es una tarea
    if (tipoAccion === "tarea") {
      if (!formData.assign_to_user_id) nuevosErrores.assign_to_user_id = "Debes asignar la tarea a un usuario";
      if (!formData.scheduled_date) nuevosErrores.scheduled_date = "La fecha programada es obligatoria";
      if (!formData.due_date) nuevosErrores.due_date = "La fecha de vencimiento es obligatoria";
    }
    
    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async () => {
    if (!validarCampos()) return;
    setLoading(true);
    try {
      // Preparar payload según el tipo de acción
      const payload = {
        ...formData,
        action_type: "manual",
      };

      // Si es comentario, no enviar asignación ni fechas
      if (tipoAccion === "comentario") {
        delete payload.assign_to_user_id;
        delete payload.scheduled_date;
        delete payload.due_date;
      }

      const response = await apiRequest("bitacora_operativa/create", "POST", payload);

      const conceptoSeleccionado = conceptos.find((c) => c.id === parseInt(formData.concept_id));

      // Obtener nombre del cliente seleccionado
      let nombreCliente = "Cliente";
      if (clienteFicha && String(formData.cliente_id) === String(clienteFicha.id)) {
        nombreCliente = clienteFicha.nombre_completo;
      } else {
        // Buscar en los resultados de búsqueda o en el array de clientes cargados
        const clienteEncontrado = clientes.find((c) => 
          String(c.cliente_id ?? c.id) === String(formData.cliente_id)
        );
        if (clienteEncontrado) {
          nombreCliente = clienteEncontrado.nombre_completo;
        }
      }

      const nuevaTarea = {
        id: response?.task?.id || Date.now(),
        tipo: tipoAccion,
        scheduled_date: tipoAccion === "tarea" ? formData.scheduled_date : null,
        due_date: tipoAccion === "tarea" ? formData.due_date : null,
        status: tipoAccion === "tarea" ? "pending" : "comment",
        log: {
          concept: { name: conceptoSeleccionado?.name || "Concepto" },
          note: formData.note,
          cliente: {
            nombre_completo: nombreCliente,
          },
        },
      };

      if (onCreated) onCreated(nuevaTarea);
      onHide();
    } catch (error) {
      alert(`❌ Error al guardar el ${tipoAccion === "comentario" ? "comentario" : "tarea"}`);
    } finally {
      setLoading(false);
    }
  };

  const getCategoriaSeleccionada = () => {
    const concepto = conceptos.find((c) => c.id === parseInt(formData.concept_id));
    return concepto?.category || null;
  };

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
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="border-bottom-0 pb-0">
        <Modal.Title className="d-flex align-items-center gap-3 w-100">
          <div className="flex-grow-1">
            <h5 className="mb-1 fw-bold">Nueva Acción</h5>
            <p className="text-muted small mb-0">Agregar comentario o crear tarea</p>
          </div>
          {getCategoriaSeleccionada() && tipoAccion === "tarea" && (
            <span
              className={`badge bg-${getCategoriaColor(getCategoriaSeleccionada())}`}
              style={{ fontSize: "0.85rem" }}
            >
              Prioridad: {getCategoriaSeleccionada()}
            </span>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="pt-3">
        {/* Selector de tipo de acción - Diseño elegante */}
        <div className="mb-4">
          <div className="d-flex gap-2 p-1 bg-light rounded-3" style={{ borderRadius: "12px" }}>
            <button
              type="button"
              className={`btn flex-grow-1 ${
                tipoAccion === "comentario"
                  ? "btn-primary shadow-sm"
                  : "btn-light"
              }`}
              onClick={() => {
                setTipoAccion("comentario");
                setFormData(prev => ({
                  ...prev,
                  assign_to_user_id: "",
                  scheduled_date: hoy,
                  due_date: hoy,
                }));
                setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.assign_to_user_id;
                  delete newErrors.scheduled_date;
                  delete newErrors.due_date;
                  return newErrors;
                });
              }}
              style={{
                borderRadius: "10px",
                transition: "all 0.3s ease",
                fontWeight: tipoAccion === "comentario" ? "600" : "400",
              }}
            >
              <i className="fas fa-comment me-2"></i>
              Comentario
            </button>
            <button
              type="button"
              className={`btn flex-grow-1 ${
                tipoAccion === "tarea"
                  ? "btn-primary shadow-sm"
                  : "btn-light"
              }`}
              onClick={() => setTipoAccion("tarea")}
              style={{
                borderRadius: "10px",
                transition: "all 0.3s ease",
                fontWeight: tipoAccion === "tarea" ? "600" : "400",
              }}
            >
              <i className="fas fa-tasks me-2"></i>
              Tarea
            </button>
          </div>
          <small className="text-muted d-block mt-2 ms-2">
            {tipoAccion === "comentario"
              ? "Agregar un comentario sin fechas ni asignación"
              : "Crear una tarea con fechas y asignación"}
          </small>
        </div>

        <Form>
          {(toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId)) && (
            <div className="mb-2">
              <span className="badge bg-info">
                Grupo #{toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId)}
              </span>
            </div>
          )}

          {/* Selector de grupo (solo si no viene desde el padre) */}
          {!formData.grupo_familiar_id && (
            <Form.Group className="mt-3">
              <Form.Label>Grupo Familiar</Form.Label>
              <Form.Select
                name="grupo_familiar_id"
                value={formData.grupo_familiar_id}
                onChange={handleChange}
                isInvalid={!!errors.grupo_familiar_id}
              >
                <option value="">Seleccionar grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre || `Grupo #${g.id}`}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.grupo_familiar_id}
              </Form.Control.Feedback>
            </Form.Group>
          )}

          <Form.Group>
            <Form.Label>
              <i className="fas fa-tag me-2 text-primary"></i>
              Concepto Principal
            </Form.Label>
            <Form.Select 
              value={conceptoPadreId} 
              onChange={handlePadreChange}
              className="shadow-sm"
            >
              <option value="">Seleccionar</option>
              {conceptosPadres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {conceptos.length > 0 && (
            <Form.Group className="mt-3">
              <Form.Label>
                <i className="fas fa-list me-2 text-info"></i>
                Subconcepto
              </Form.Label>
              <Form.Select
                name="concept_id"
                value={formData.concept_id}
                onChange={handleChange}
                isInvalid={!!errors.concept_id}
                className="shadow-sm"
              >
                <option value="">Seleccionar</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.concept_id}
              </Form.Control.Feedback>
            </Form.Group>
          )}

          <Form.Group className="mt-3">
            <Form.Label>
              <i className={`fas ${tipoAccion === "comentario" ? "fa-comment-dots" : "fa-sticky-note"} me-2 text-warning`}></i>
              {tipoAccion === "comentario" ? "Comentario" : "Nota"}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder={tipoAccion === "comentario" 
                ? "Escribe tu comentario sobre el cliente..." 
                : "Escribe una justificación o detalle de la tarea..."}
              isInvalid={!!errors.note}
              className="shadow-sm"
              style={{ resize: "vertical" }}
            />
            <Form.Control.Feedback type="invalid">
              {errors.note}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              {tipoAccion === "comentario" 
                ? "Este comentario será visible en el historial del cliente"
                : "Describe los detalles y objetivos de esta tarea"}
            </Form.Text>
          </Form.Group>

          <Form.Group className="mt-3">
            <Form.Label>
              <i className="fas fa-user-circle me-2 text-success"></i>
              Cliente
            </Form.Label>
            {/* Cliente seleccionado - Mejorado */}
            {formData.cliente_id && (
              <div 
                className="border rounded p-3 mb-3"
                style={{
                  backgroundColor: "#f0f9ff",
                  borderColor: "#0ea5e9",
                  borderWidth: "2px"
                }}
              >
                <div className="d-flex align-items-start justify-content-between mb-2">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center mb-2">
                      <i className="fas fa-check-circle text-success me-2" style={{ fontSize: "1.1rem" }}></i>
                      <div>
                        <h6 className="mb-0 fw-bold text-dark">
                          {clienteQuery || clienteFicha?.nombre_completo || "Cliente seleccionado"}
                        </h6>
                        {clienteFicha && String(formData.cliente_id) === String(clienteFicha.id) && (
                          <small className="text-muted d-block mt-1">
                            <i className="fas fa-info-circle me-1"></i>
                            Cliente de la ficha actual (por defecto)
                          </small>
                        )}
                      </div>
                    </div>
                    
                    {/* Información adicional del cliente */}
                    {(clienteFicha?.email || clienteFicha?.telefono) && clienteFicha && String(formData.cliente_id) === String(clienteFicha.id) && (
                      <div className="ms-4 mt-2">
                        {clienteFicha.email && (
                          <small className="text-muted d-block">
                            <i className="fas fa-envelope me-1"></i>
                            {clienteFicha.email}
                          </small>
                        )}
                        {clienteFicha.telefono && (
                          <small className="text-muted d-block">
                            <i className="fas fa-phone me-1"></i>
                            {clienteFicha.telefono}
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, cliente_id: "", grupo_familiar_id: "" }));
                      // Si hay clienteId, restaurar el cliente de la ficha
                      if (clienteId) {
                        setClienteQuery(clienteFicha?.nombre_completo || "");
                        setFormData(prev => ({ ...prev, cliente_id: String(clienteId) }));
                      } else {
                        setClienteQuery("");
                      }
                      setClientes([]);
                    }}
                    title="Cambiar cliente"
                  >
                    <i className="fas fa-exchange-alt me-1"></i>
                    Cambiar
                  </button>
                </div>
                
                <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: "0.85rem" }}>
                  <i className="fas fa-lightbulb me-2"></i>
                  <strong>Puedes cambiar el cliente:</strong> Haz clic en "Cambiar" o busca otro cliente en el campo de abajo para asociar este {tipoAccion === "comentario" ? "comentario" : "tarea"} a un cliente diferente.
                </div>
              </div>
            )}

            {/* Campo de búsqueda */}
            <div className="position-relative">
              {loadingCliente && (
                <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 10 }}>
                  <Spinner size="sm" animation="border" variant="primary" />
                </div>
              )}
              <Form.Control
                type="text"
                placeholder={
                  formData.cliente_id 
                    ? "Buscar otro cliente para cambiar..." 
                    : clienteId 
                      ? "Buscar otro cliente (actualmente: cliente de la ficha)..." 
                      : "Buscar cliente por nombre..."
                }
                value={clienteQuery}
                className="shadow-sm mb-2"
                disabled={loadingCliente}
                onChange={async (e) => {
                  const value = e.target.value;
                  setClienteQuery(value);

                  // Si el campo está vacío y hay clienteId, restaurar el cliente de la ficha
                  if (!value.trim() && clienteId && !formData.cliente_id) {
                    setClienteQuery(clienteFicha?.nombre_completo || "");
                    setClientes([]);
                    return;
                  }

                  if (value.length >= 3) {
                    try {
                      const result = await apiRequest(
                        `cliente/buscar-con-grupos?q=${encodeURIComponent(value)}`,
                        "GET"
                      );

                      const list = Array.isArray(result?.data)
                        ? result.data
                        : Array.isArray(result)
                        ? result
                        : [];

                      const normalized = list.map((c) => ({
                        cliente_id: c.cliente_id ?? c.id ?? null,
                        id: c.id ?? c.cliente_id ?? null,
                        nombre_completo: c.nombre_completo ?? c.nombre ?? "",
                        email: c.email ?? null,
                        telefono: c.telefono ?? null,
                        grupos: Array.isArray(c.grupos) ? c.grupos : [],
                      }));

                      setClientes(normalized);
                    } catch (err) {
                      console.error("Error al buscar clientes:", err);
                      setClientes([]);
                    }
                  } else {
                    setClientes([]);
                  }
                }}
              />
              {!formData.cliente_id && clienteId && (
                <Form.Text className="text-muted d-block mt-1">
                  <i className="fas fa-info-circle me-1"></i>
                  Por defecto se usará el cliente de la ficha actual. Busca otro cliente si deseas cambiarlo.
                </Form.Text>
              )}
            </div>

            {clientes.length > 0 && (
              <div 
                className="border rounded shadow-sm mt-2"
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  backgroundColor: "#fff"
                }}
              >
                <div className="p-2 bg-light border-bottom">
                  <small className="text-muted fw-semibold">
                    <i className="fas fa-users me-1"></i>
                    {clientes.length} {clientes.length === 1 ? "resultado encontrado" : "resultados encontrados"}
                  </small>
                </div>
                {clientes.map((cli, idx) => {
                  const cliId = cli.cliente_id ?? cli.id;
                  const nombreCompleto = cli.nombre_completo || "Sin nombre";
                  
                  return (
                    <div
                      key={`${cliId}-${idx}`}
                      className="border-bottom"
                      style={{
                        transition: "all 0.2s ease",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8f9fa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                    >
                      <div className="p-3">
                        {/* Header del cliente */}
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <h6 className="mb-1 fw-semibold text-dark" style={{ fontSize: "0.95rem" }}>
                              <i className="fas fa-user-circle me-2 text-primary"></i>
                              {nombreCompleto}
                            </h6>
                            <div className="d-flex gap-3 flex-wrap mt-1">
                              {cliId && (
                                <small className="text-muted">
                                  <i className="fas fa-hashtag me-1"></i>
                                  ID: {cliId}
                                </small>
                              )}
                              {cli.email && (
                                <small className="text-muted">
                                  <i className="fas fa-envelope me-1"></i>
                                  {cli.email}
                                </small>
                              )}
                              {cli.telefono && (
                                <small className="text-muted">
                                  <i className="fas fa-phone me-1"></i>
                                  {cli.telefono}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Grupos familiares */}
                        {(cli.grupos ?? []).length > 0 ? (
                          <div className="mt-2">
                            <small className="text-muted d-block mb-2">
                              <i className="fas fa-users me-1"></i>
                              Grupos familiares:
                            </small>
                            <div className="d-flex flex-wrap gap-2">
                              {(cli.grupos ?? []).map((g, i) => (
                                <button
                                  key={`${cliId}-${g.grupo_familiar_id}-${g.parentesco || "NA"}-${i}`}
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleClienteSeleccion(cli, g)}
                                  style={{
                                    borderRadius: "6px",
                                    fontSize: "0.8rem",
                                    transition: "all 0.2s ease",
                                    borderWidth: "1.5px"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(13, 110, 253, 0.25)";
                                    e.currentTarget.style.borderColor = "#0d6efd";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                  }}
                                >
                                  <i className="fas fa-users me-1"></i>
                                  Grupo #{g.grupo_familiar_id}
                                  {g.parentesco && (
                                    <span className="badge bg-primary ms-2" style={{ fontSize: "0.7rem", padding: "0.25em 0.5em" }}>
                                      {g.parentesco}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleClienteSeleccion(cli, null)}
                              style={{
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                transition: "all 0.2s ease"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 2px 6px rgba(13, 110, 253, 0.3)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                              }}
                            >
                              <i className="fas fa-check me-1"></i>
                              Seleccionar cliente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {clienteQuery.length >= 3 && clientes.length === 0 && (
              <small className="text-muted">Sin resultados para “{clienteQuery}”.</small>
            )}

            <Form.Control.Feedback type="invalid">
              {errors.cliente_id}
            </Form.Control.Feedback>
          </Form.Group>

          {/* Campos de tarea - Solo visibles cuando tipoAccion === "tarea" */}
          {tipoAccion === "tarea" && (
            <>
              <div className="border-top pt-3 mt-3">
                <h6 className="text-muted mb-3">
                  <i className="fas fa-calendar-alt me-2"></i>
                  Información de la Tarea
                </h6>
              </div>

              <Form.Group className="mt-3">
                <Form.Label>
                  <i className="fas fa-user me-2 text-primary"></i>
                  Asignar a
                </Form.Label>
                <Form.Select
                  name="assign_to_user_id"
                  value={formData.assign_to_user_id}
                  onChange={handleChange}
                  isInvalid={!!errors.assign_to_user_id}
                  className="shadow-sm"
                >
                  <option value="">Seleccionar usuario</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.assign_to_user_id}
                </Form.Control.Feedback>
              </Form.Group>

              <div className="row mt-3">
                <Form.Group className="col-md-6">
                  <Form.Label>
                    <i className="fas fa-calendar-check me-2 text-success"></i>
                    Fecha programada
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="scheduled_date"
                    value={formData.scheduled_date}
                    onChange={handleChange}
                    isInvalid={!!errors.scheduled_date}
                    className="shadow-sm"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.scheduled_date}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="col-md-6">
                  <Form.Label>
                    <i className="fas fa-calendar-times me-2 text-danger"></i>
                    Fecha de vencimiento
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleChange}
                    isInvalid={!!errors.due_date}
                    className="shadow-sm"
                    min={formData.scheduled_date}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.due_date}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
            </>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer className="border-top-0 pt-3">
        <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          variant={tipoAccion === "comentario" ? "info" : "primary"} 
          onClick={handleSubmit} 
          disabled={loading}
          className="shadow-sm"
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Guardando...
            </>
          ) : (
            <>
              <i className={`fas ${tipoAccion === "comentario" ? "fa-comment" : "fa-save"} me-2`}></i>
              {tipoAccion === "comentario" ? "Agregar Comentario" : "Crear Tarea"}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NuevaTareaModal;
