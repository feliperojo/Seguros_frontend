import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Alert,
  Table,
  Badge,
  Card,
} from "react-bootstrap";
import { FaChevronDown, FaChevronUp, FaComments } from "react-icons/fa";
import apiRequest from "../services/api";
import { usersService } from "../services/adminApi";
import { listTasks as listAuditoriaTasks, getTaskComments as getAuditoriaTaskComments } from "../services/auditoriasTasksService";

const InformeTareasUsuario = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState("");
  const [tipoOrigen, setTipoOrigen] = useState("normales"); // "normales" | "auditoria" | "unificada"
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [error, setError] = useState("");
  const [ejecutado, setEjecutado] = useState(false);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTareas, setTotalTareas] = useState(0);
  const perPage = 20;

  // Estados para comentarios expandibles
  const [comentariosTareas, setComentariosTareas] = useState({}); // { taskId: [comentarios] }
  const [loadingComentarios, setLoadingComentarios] = useState({}); // { taskId: boolean }
  const [tareasExpandidas, setTareasExpandidas] = useState({}); // { taskId: boolean }

  // Cargar lista de usuarios al montar el componente
  useEffect(() => {
    const cargarUsuarios = async () => {
      setLoadingUsuarios(true);
      setError("");
      
      try {
        let response = null;
        let usuariosData = [];

        // Intentar múltiples endpoints como fallback
        try {
          // Opción 1: Endpoint de usuarios operativos (más común)
          response = await apiRequest("usuarios-operativos", "GET");
          if (response && Array.isArray(response)) {
            usuariosData = response;
          }
        } catch (e1) {
          console.warn("Error con usuarios-operativos, intentando otros endpoints:", e1);
          
          try {
            // Opción 2: Endpoint users simple
            response = await apiRequest("users?per_page=1000", "GET");
            if (response) {
              if (Array.isArray(response)) {
                usuariosData = response;
              } else if (response?.data && Array.isArray(response.data)) {
                usuariosData = response.data;
              } else if (response?.data?.data && Array.isArray(response.data.data)) {
                usuariosData = response.data.data;
              }
            }
          } catch (e2) {
            console.warn("Error con users, intentando /v1/users:", e2);
            
            try {
              // Opción 3: Endpoint /v1/users (requiere permisos admin)
              response = await usersService.list({ per_page: 1000 });
              if (response) {
                if (Array.isArray(response)) {
                  usuariosData = response;
                } else if (response?.data && Array.isArray(response.data)) {
                  usuariosData = response.data;
                } else if (response?.data?.data && Array.isArray(response.data.data)) {
                  usuariosData = response.data.data;
                }
              }
            } catch (e3) {
              console.error("Error al cargar usuarios desde todos los endpoints:", e3);
              throw e3;
            }
          }
        }

        // Normalizar estructura de usuarios
        const usuariosNormalizados = usuariosData
          .map(u => ({
            id: u.id,
            name: u.name || u.nombre || u.username || u.email || `Usuario ${u.id}`,
            nombre: u.nombre || u.name || u.username || u.email || `Usuario ${u.id}`,
            email: u.email || '',
            status: u.status || (u.is_active !== undefined ? (u.is_active ? 'active' : 'inactive') : 'active'),
          }))
          .filter(u => u.id && u.name); // Solo usuarios válidos

        // Filtrar solo usuarios activos si tienen el campo status
        const usuariosActivos = usuariosNormalizados.filter(u => 
          u.status !== 'inactive' && u.status !== 'inactivo'
        );

        setUsuarios(usuariosActivos.length > 0 ? usuariosActivos : usuariosNormalizados);
        
        if (usuariosActivos.length === 0 && usuariosNormalizados.length === 0) {
          setError("No se pudieron cargar los usuarios. Por favor recargue la página.");
        }
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
        setError("Error al cargar la lista de usuarios. Por favor intente nuevamente.");
        setUsuarios([]);
      } finally {
        setLoadingUsuarios(false);
      }
    };

    cargarUsuarios();
  }, []);

  // Normalizar tarea de auditoría al mismo formato que tarea operativa para la tabla
  const normalizarTareaAuditoria = (t) => {
    const cliente = t?.cliente || t?.client || {};
    const item = t?.item || {};
    return {
      id: t.id,
      task_id: t.id,
      tipo: "auditoria",
      status: t.status,
      response_note: t.response_note,
      created_at: t.created_at,
      updated_at: t.updated_at,
      completed_at: t.completed_at,
      scheduled_date: t.scheduled_date,
      due_date: t.due_date,
      assigned_user_id: t.assigned_user_id,
      cliente_nombre: cliente?.nombre_completo || cliente?.nombre || cliente?.name || "—",
      cliente: cliente,
      concept_name: item?.name || item?.description || t.item_name || "Auditoría",
      note: t.description || item?.name || item?.description || "",
      log: { cliente, user: t.created_by || t.user },
      ...t,
    };
  };

  // Función para ejecutar el informe
  const ejecutarInforme = async () => {
    if (!usuarioSeleccionado) {
      setError("Por favor seleccione un usuario.");
      return;
    }

    setLoading(true);
    setError("");
    setEjecutado(true);
    setCurrentPage(1);
    setComentariosTareas({});
    setTareasExpandidas({});

    try {
      let tareasData = [];
      let total = 0;
      let pages = 1;

      if (tipoOrigen === "normales") {
        const params = new URLSearchParams();
        params.append("assigned_user_id", usuarioSeleccionado);
        params.append("per_page", perPage.toString());
        params.append("page", "1");
        if (fechaInicio) params.append("fecha_inicio", fechaInicio);
        if (fechaFin) params.append("fecha_fin", fechaFin);
        if (estado) params.append("estado", estado);

        const response = await apiRequest(`tareas_operativas?${params.toString()}`, "GET");
        if (response?.data) {
          tareasData = Array.isArray(response.data) ? response.data : response.data.data || [];
          total = response.total || response.data.total || tareasData.length;
          pages = response.last_page || response.data.last_page || 1;
        } else if (Array.isArray(response)) {
          tareasData = response;
          total = response.length;
          pages = 1;
        }
      } else if (tipoOrigen === "auditoria") {
        const params = {
          assigned_user_id: usuarioSeleccionado,
          per_page: perPage,
          page: 1,
        };
        if (fechaInicio) params.fecha_inicio = fechaInicio;
        if (fechaFin) params.fecha_fin = fechaFin;
        if (estado) params.status = estado;

        const response = await listAuditoriaTasks(params);
        const raw = response?.data || (Array.isArray(response) ? response : []);
        tareasData = raw.map(normalizarTareaAuditoria);
        const meta = response?.meta || {};
        total = meta.total ?? tareasData.length;
        pages = meta.last_page ?? Math.max(1, Math.ceil(total / perPage));
      } else {
        // unificada: traer ambas y fusionar
        const [resOperativas, resAuditoria] = await Promise.all([
          apiRequest(
            `tareas_operativas?assigned_user_id=${usuarioSeleccionado}&per_page=${perPage * 2}&page=1${fechaInicio ? `&fecha_inicio=${fechaInicio}` : ""}${fechaFin ? `&fecha_fin=${fechaFin}` : ""}${estado ? `&estado=${estado}` : ""}`,
            "GET"
          ),
          listAuditoriaTasks({
            assigned_user_id: usuarioSeleccionado,
            per_page: perPage * 2,
            page: 1,
            ...(fechaInicio && { fecha_inicio: fechaInicio }),
            ...(fechaFin && { fecha_fin: fechaFin }),
            ...(estado && { status: estado }),
          }),
        ]);

        let operativas = [];
        if (resOperativas?.data) {
          operativas = Array.isArray(resOperativas.data) ? resOperativas.data : resOperativas.data.data || [];
        } else if (Array.isArray(resOperativas)) {
          operativas = resOperativas;
        }
        operativas = operativas.map((t) => ({ ...t, tipo: "operativa" }));

        const rawAudit = resAuditoria?.data || (Array.isArray(resAuditoria) ? resAuditoria : []);
        const auditoria = rawAudit.map(normalizarTareaAuditoria);

        tareasData = [...operativas, ...auditoria].sort((a, b) => {
          const dateA = new Date(a.created_at || a.updated_at || 0).getTime();
          const dateB = new Date(b.created_at || b.updated_at || 0).getTime();
          return dateB - dateA;
        });
        total = tareasData.length;
        pages = Math.max(1, Math.ceil(total / perPage));
      }

      setTareas(tareasData);
      setTotalTareas(total);
      setTotalPages(pages);
    } catch (err) {
      console.error("Error al obtener tareas:", err);
      setError("Error al obtener las tareas. Por favor intente nuevamente.");
      setTareas([]);
      setTotalTareas(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Función para cambiar de página
  const cambiarPagina = async (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPages) return;
    if (tipoOrigen === "unificada") {
      setCurrentPage(nuevaPagina);
      return;
    }
    setLoading(true);
    setCurrentPage(nuevaPagina);
    try {
      if (tipoOrigen === "normales") {
        const params = new URLSearchParams();
        params.append("assigned_user_id", usuarioSeleccionado);
        params.append("per_page", perPage.toString());
        params.append("page", nuevaPagina.toString());
        if (fechaInicio) params.append("fecha_inicio", fechaInicio);
        if (fechaFin) params.append("fecha_fin", fechaFin);
        if (estado) params.append("estado", estado);
        const response = await apiRequest(`tareas_operativas?${params.toString()}`, "GET");
        let tareasData = [];
        if (response?.data) {
          tareasData = Array.isArray(response.data) ? response.data : response.data.data || [];
        } else if (Array.isArray(response)) {
          tareasData = response;
        }
        setTareas(tareasData);
      } else {
        const response = await listAuditoriaTasks({
          assigned_user_id: usuarioSeleccionado,
          per_page: perPage,
          page: nuevaPagina,
          ...(fechaInicio && { fecha_inicio: fechaInicio }),
          ...(fechaFin && { fecha_fin: fechaFin }),
          ...(estado && { status: estado }),
        });
        const raw = response?.data || (Array.isArray(response) ? response : []);
        setTareas(raw.map(normalizarTareaAuditoria));
      }
    } catch (err) {
      console.error("Error al cambiar de página:", err);
      setError("Error al cargar la página.");
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener el nombre del usuario asignado
  const obtenerNombreUsuario = (tarea) => {
    const raw = tarea?.__raw ?? tarea;
    return (
      raw?.assigned_user?.name ||
      raw?.assign_to_user?.name ||
      raw?.assigned_to_user?.name ||
      raw?.assignedUser?.name ||
      raw?.task?.assigned_user?.name ||
      raw?.task?.assign_to_user?.name ||
      raw?.task?.assigned_to_user?.name ||
      raw?.assign_to_user_name ||
      raw?.assigned_to_name ||
      raw?.responsable ||
      "Sin asignar"
    );
  };

  // Función para formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      return d.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return fecha;
    }
  };

  // Función para formatear fecha con hora
  const formatearFechaHora = (fecha) => {
    if (!fecha) return "—";
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      return d.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fecha;
    }
  };

  // Función para limpiar HTML y obtener texto plano
  const limpiarHtml = (html) => {
    if (!html) return "";
    try {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      const texto = tmp.textContent || tmp.innerText || "";
      return texto.trim();
    } catch {
      return String(html).replace(/<[^>]*>/g, "").trim();
    }
  };

  // Clave única por fila (incluye tipo cuando hay auditoría para no colisionar IDs)
  const getRowKey = (tarea) => {
    const id = tarea.id || tarea.task_id;
    return tarea.tipo ? `${tarea.tipo}-${id}` : id;
  };

  // Cargar comentarios de una tarea (operativa o auditoría)
  const cargarComentariosTarea = useCallback(async (rowKey, tipo) => {
    if (!rowKey) return;
    setLoadingComentarios((prev) => ({ ...prev, [rowKey]: true }));
    try {
      const tareaId = typeof rowKey === "string" && rowKey.includes("-") ? rowKey.split("-")[1] : rowKey;
      let comentarios = [];
      if (tipo === "auditoria") {
        const data = await getAuditoriaTaskComments(tareaId);
        comentarios = Array.isArray(data) ? data : data?.data || [];
      } else {
        const data = await apiRequest(`tareas_operativas/${tareaId}/comentarios`, "GET");
        comentarios = Array.isArray(data) ? data : data?.data || [];
      }
      setComentariosTareas((prev) => ({ ...prev, [rowKey]: comentarios }));
    } catch (err) {
      console.error(`Error al cargar comentarios (${tipo}) ${rowKey}:`, err);
      setComentariosTareas((prev) => ({ ...prev, [rowKey]: [] }));
    } finally {
      setLoadingComentarios((prev) => ({ ...prev, [rowKey]: false }));
    }
  }, []);

  // Toggle para expandir/colapsar comentarios
  const toggleComentariosTarea = useCallback((rowKey, tipo) => {
    const yaExpandida = tareasExpandidas[rowKey];
    const yaTieneComentarios = comentariosTareas[rowKey] !== undefined;
    setTareasExpandidas((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
    if (!yaExpandida && !yaTieneComentarios) {
      cargarComentariosTarea(rowKey, tipo || "operativa");
    }
  }, [tareasExpandidas, comentariosTareas, cargarComentariosTarea]);

  // Función para obtener el badge de estado
  const obtenerBadgeEstado = (estadoTarea) => {
    const estadoLower = (estadoTarea || "").toLowerCase();
    if (estadoLower === "completed" || estadoLower === "completada") {
      return <Badge bg="success">Completada</Badge>;
    }
    if (estadoLower === "pending" || estadoLower === "pendiente") {
      return <Badge bg="warning">Pendiente</Badge>;
    }
    if (estadoLower === "in_progress" || estadoLower === "en_progreso") {
      return <Badge bg="info">En Progreso</Badge>;
    }
    if (estadoLower === "cancelled" || estadoLower === "cancelada") {
      return <Badge bg="danger">Cancelada</Badge>;
    }
    return <Badge bg="secondary">{estadoTarea || "Sin estado"}</Badge>;
  };

  // Obtener nombre del usuario seleccionado
  const nombreUsuarioSeleccionado = usuarios.find(u => u.id.toString() === usuarioSeleccionado)?.name || "";

  // Para unificada paginamos en memoria
  const tareasParaMostrar =
    tipoOrigen === "unificada"
      ? tareas.slice((currentPage - 1) * perPage, currentPage * perPage)
      : tareas;

  return (
    <Container className="py-4">
      <h3 className="mb-4">Informe de Tareas Asignadas a Usuario</h3>

      {/* Card de Filtros */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filtros de Búsqueda</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={12} lg={3} className="mb-3">
              <Form.Label>
                Usuario <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={usuarioSeleccionado}
                onChange={(e) => {
                  setUsuarioSeleccionado(e.target.value);
                  setEjecutado(false);
                  setTareas([]);
                }}
                disabled={loadingUsuarios}
                isInvalid={ejecutado && !usuarioSeleccionado}
              >
                <option value="">
                  {loadingUsuarios 
                    ? "Cargando usuarios..." 
                    : usuarios.length === 0 
                      ? "No hay usuarios disponibles" 
                      : "Seleccionar usuario"}
                </option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.name || usuario.nombre || usuario.email || `Usuario ${usuario.id}`}
                  </option>
                ))}
              </Form.Select>
              {loadingUsuarios && (
                <Form.Text className="text-muted d-flex align-items-center">
                  <Spinner size="sm" animation="border" className="me-2" />
                  Cargando usuarios...
                </Form.Text>
              )}
              {!loadingUsuarios && usuarios.length > 0 && (
                <Form.Text className="text-muted">
                  {usuarios.length} {usuarios.length === 1 ? "usuario disponible" : "usuarios disponibles"}
                </Form.Text>
              )}
              {!loadingUsuarios && usuarios.length === 0 && (
                <Form.Text className="text-danger">
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  No se pudieron cargar los usuarios. Por favor recargue la página.
                </Form.Text>
              )}
            </Col>

            <Col md={6} lg={3} className="mb-3">
              <Form.Label>Fecha Inicio</Form.Label>
              <Form.Control
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setEjecutado(false);
                }}
              />
              <Form.Text className="text-muted">Opcional</Form.Text>
            </Col>

            <Col md={6} lg={3} className="mb-3">
              <Form.Label>Fecha Fin</Form.Label>
              <Form.Control
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setEjecutado(false);
                }}
                min={fechaInicio || undefined}
              />
              <Form.Text className="text-muted">Opcional</Form.Text>
            </Col>

            <Col md={6} lg={3} className="mb-3">
              <Form.Label>Estado</Form.Label>
              <Form.Select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setEjecutado(false);
                }}
              >
                <option value="">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </Form.Select>
            </Col>

            <Col xs={12} className="mb-3">
              <Form.Label className="d-block">Buscar en</Form.Label>
              <div className="d-flex flex-wrap gap-4">
                <Form.Check
                  type="radio"
                  id="origen-normales"
                  name="tipoOrigen"
                  label="Tareas operativas"
                  value="normales"
                  checked={tipoOrigen === "normales"}
                  onChange={(e) => {
                    setTipoOrigen(e.target.value);
                    setEjecutado(false);
                    setTareas([]);
                  }}
                />
                <Form.Check
                  type="radio"
                  id="origen-auditoria"
                  name="tipoOrigen"
                  label="Tareas de auditoría"
                  value="auditoria"
                  checked={tipoOrigen === "auditoria"}
                  onChange={(e) => {
                    setTipoOrigen(e.target.value);
                    setEjecutado(false);
                    setTareas([]);
                  }}
                />
                <Form.Check
                  type="radio"
                  id="origen-unificada"
                  name="tipoOrigen"
                  label="Unificada (normales + auditoría)"
                  value="unificada"
                  checked={tipoOrigen === "unificada"}
                  onChange={(e) => {
                    setTipoOrigen(e.target.value);
                    setEjecutado(false);
                    setTareas([]);
                  }}
                />
              </div>
              <Form.Text className="text-muted">
                Define si el informe busca en tareas operativas, en tareas de auditoría o en ambas.
              </Form.Text>
            </Col>
          </Row>

          <Row>
            <Col>
              <Button
                variant="primary"
                onClick={ejecutarInforme}
                disabled={loading || !usuarioSeleccionado || loadingUsuarios}
                className="mt-2"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-search me-2"></i>
                    Ejecutar Informe
                  </>
                )}
              </Button>
              {ejecutado && tareas.length > 0 && (
                <span className="ms-3 text-muted">
                  {totalTareas} {totalTareas === 1 ? "tarea encontrada" : "tareas encontradas"}
                </span>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Mensajes de error */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Resultados */}
      {ejecutado && (
        <>
          {loading && tareas.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Cargando tareas...</p>
            </div>
          ) : tareas.length > 0 ? (
            <>
              {nombreUsuarioSeleccionado && (
                <Alert variant="info" className="mb-3">
                  <strong>Usuario:</strong> {nombreUsuarioSeleccionado}
                  {fechaInicio && (
                    <>
                      {" | "}
                      <strong>Desde:</strong> {formatearFecha(fechaInicio)}
                    </>
                  )}
                  {fechaFin && (
                    <>
                      {" | "}
                      <strong>Hasta:</strong> {formatearFecha(fechaFin)}
                    </>
                  )}
                  {estado && (
                    <>
                      {" | "}
                      <strong>Estado:</strong> {estado}
                    </>
                  )}
                </Alert>
              )}

              <Card>
                <Card.Header>
                  <h5 className="mb-0">Resultados</h5>
                </Card.Header>
                <Card.Body className="p-0">
                  <div className="table-responsive">
                    <Table striped bordered hover responsive>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "40px" }}></th>
                          {tipoOrigen === "unificada" && (
                            <th style={{ width: "100px" }}>Origen</th>
                          )}
                          <th style={{ width: "60px" }}>ID</th>
                          <th style={{ width: "150px" }}>Concepto</th>
                          <th style={{ width: "200px" }}>Cliente</th>
                          <th style={{ width: "100px" }}>Estado</th>
                          <th style={{ width: "120px" }}>Nota Inicial</th>
                          <th style={{ width: "120px" }}>Respuesta</th>
                          <th style={{ width: "120px" }}>Creado Por</th>
                          <th style={{ width: "120px" }}>Fecha Programada</th>
                          <th style={{ width: "120px" }}>Fecha Vencimiento</th>
                          <th style={{ width: "120px" }}>Fecha Completado</th>
                          <th style={{ width: "120px" }}>Fecha Creación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareasParaMostrar.map((tarea) => {
                          const raw = tarea?.__raw ?? tarea;
                          const log = raw?.log || {};
                          const cliente = log?.cliente || raw?.cliente || tarea.cliente || {};
                          const concept = log?.concept || {};
                          const user = log?.user || raw?.created_by || {};
                          const tipo = tarea.tipo || "operativa";

                          const notaInicial = limpiarHtml(log?.note || raw?.note || tarea.note || "");
                          const respuesta = limpiarHtml(raw?.response_note || tarea.response_note || "");
                          const tareaId = tarea.id || tarea.task_id;
                          const rowKey = getRowKey(tarea);
                          const isExpanded = tareasExpandidas[rowKey] || false;
                          const comentarios = comentariosTareas[rowKey] || [];
                          const isLoadingComentarios = loadingComentarios[rowKey] || false;
                          
                          return (
                            <React.Fragment key={`task-row-${rowKey}`}>
                              <tr>
                                <td style={{ textAlign: "center", cursor: "pointer" }}>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => toggleComentariosTarea(rowKey, tipo)}
                                    className="p-0"
                                    title={isExpanded ? "Ocultar comentarios" : "Ver comentarios"}
                                  >
                                    {isLoadingComentarios ? (
                                      <Spinner size="sm" animation="border" />
                                    ) : isExpanded ? (
                                      <FaChevronUp />
                                    ) : (
                                      <FaChevronDown />
                                    )}
                                  </Button>
                                </td>
                                {tipoOrigen === "unificada" && (
                                  <td>
                                    <Badge bg={tipo === "auditoria" ? "info" : "secondary"}>
                                      {tipo === "auditoria" ? "Auditoría" : "Operativa"}
                                    </Badge>
                                  </td>
                                )}
                                <td>
                                  <strong>{tareaId || "—"}</strong>
                                </td>
                              <td>
                                <Badge bg="secondary">
                                  {concept?.name || raw?.concept_name || tarea.concept_name || "Sin concepto"}
                                </Badge>
                                {concept?.category && (
                                  <div className="small text-muted mt-1">
                                    {concept.category}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div>
                                  <strong className="text-primary">
                                    {cliente?.nombre_completo || raw?.cliente_nombre || tarea.cliente_nombre || "—"}
                                  </strong>
                                  {cliente?.id && (
                                    <div className="small text-muted">
                                      ID: {cliente.id}
                                    </div>
                                  )}
                                  {cliente?.email && (
                                    <div className="small text-muted">
                                      ✉️ {cliente.email}
                                    </div>
                                  )}
                                  {cliente?.telefono && Array.isArray(cliente.telefono) && cliente.telefono.length > 0 && (
                                    <div className="small text-muted">
                                      📞 {cliente.telefono[0]?.numero || cliente.telefono[0]}
                                    </div>
                                  )}
                                  {cliente?.telefono && !Array.isArray(cliente.telefono) && (
                                    <div className="small text-muted">
                                      📞 {cliente.telefono}
                                    </div>
                                  )}
                                  {log?.grupo_familiar_id && (
                                    <div className="small text-muted">
                                      Grupo: {log.grupo_familiar_id}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>{obtenerBadgeEstado(raw?.status || raw?.estado || tarea.status || tarea.estado)}</td>
                              <td>
                                {notaInicial ? (
                                  <div
                                    style={{
                                      maxWidth: "200px",
                                      maxHeight: "80px",
                                      overflow: "auto",
                                      fontSize: "0.875rem",
                                      lineHeight: "1.4",
                                    }}
                                    title={notaInicial.length > 100 ? notaInicial : ""}
                                  >
                                    {notaInicial.length > 100 ? `${notaInicial.substring(0, 100)}...` : notaInicial}
                                  </div>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                {respuesta ? (
                                  <div
                                    style={{
                                      maxWidth: "200px",
                                      maxHeight: "80px",
                                      overflow: "auto",
                                      fontSize: "0.875rem",
                                      lineHeight: "1.4",
                                      color: "#198754",
                                      fontWeight: "500",
                                    }}
                                    title={respuesta.length > 100 ? respuesta : ""}
                                  >
                                    {respuesta.length > 100 ? `${respuesta.substring(0, 100)}...` : respuesta}
                                  </div>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                <div>
                                  {user?.name || raw?.created_by_name || "—"}
                                  {user?.email && (
                                    <div className="small text-muted">
                                      {user.email}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>{formatearFecha(raw?.scheduled_date || raw?.fecha_programada || tarea.scheduled_date || tarea.fecha_programada)}</td>
                              <td>{formatearFecha(raw?.due_date || raw?.fecha_vencimiento || tarea.due_date || tarea.fecha_vencimiento)}</td>
                              <td>{formatearFechaHora(raw?.completed_at || raw?.fecha_completado || tarea.completed_at || tarea.fecha_completado)}</td>
                              <td>{formatearFechaHora(raw?.created_at || raw?.fecha_creacion || tarea.created_at || tarea.fecha_creacion)}</td>
                              </tr>
                              {/* Fila expandible para comentarios - renderizado directo sin Collapse para evitar problemas de visualización */}
                              {isExpanded && (
                                <tr style={{ backgroundColor: "#f8f9fa" }}>
                                  <td colSpan={tipoOrigen === "unificada" ? 13 : 12} style={{ padding: "16px", verticalAlign: "top" }}>
                                    <div style={{ width: "100%" }}>
                                      <div className="d-flex align-items-center mb-3">
                                        <FaComments className="me-2 text-primary" />
                                        <strong>Comentarios de la Tarea</strong>
                                        {comentarios.length > 0 && (
                                          <Badge bg="secondary" className="ms-2">
                                            {comentarios.length}
                                          </Badge>
                                        )}
                                      </div>
                                      {isLoadingComentarios ? (
                                        <div className="text-center py-4">
                                          <Spinner size="sm" animation="border" />
                                          <span className="ms-2 text-muted">Cargando comentarios...</span>
                                        </div>
                                      ) : comentarios.length > 0 ? (
                                        <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "8px" }}>
                                          {comentarios.map((comentario, idx) => {
                                            const comentarioUser = comentario?.user || comentario?.user_id || {};
                                            const comentarioTexto = limpiarHtml(comentario?.note || comentario?.comment || comentario?.texto || comentario?.body || "");
                                            return (
                                              <div
                                                key={comentario?.id || idx}
                                                className="mb-3 p-3 border rounded"
                                                style={{ backgroundColor: "#ffffff", width: "100%", boxSizing: "border-box" }}
                                              >
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                  <div>
                                                    <strong className="text-primary">
                                                      {comentarioUser?.name || comentario?.user_name || "Usuario"}
                                                    </strong>
                                                    {comentarioUser?.email && (
                                                      <div className="small text-muted">
                                                        {comentarioUser.email}
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div className="text-muted small" style={{ whiteSpace: "nowrap", marginLeft: "12px" }}>
                                                    {formatearFechaHora(comentario?.created_at || comentario?.fecha_creacion || "")}
                                                  </div>
                                                </div>
                                                <div className="mt-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.5" }}>
                                                  {comentarioTexto || "Sin comentario"}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-center py-4 text-muted">
                                          <FaComments className="me-2" />
                                          No hay comentarios adicionales para esta tarea.
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    <span className="text-muted">
                      Página {currentPage} de {totalPages}
                    </span>
                  </div>
                  <div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => cambiarPagina(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                      className="me-2"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => cambiarPagina(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Alert variant="info" className="mt-3">
              <i className="fas fa-info-circle me-2"></i>
              No se encontraron tareas con los filtros seleccionados.
            </Alert>
          )}
        </>
      )}

      {/* Mensaje inicial */}
      {!ejecutado && (
        <Alert variant="secondary" className="mt-3">
          <i className="fas fa-info-circle me-2"></i>
          Complete los filtros y haga clic en "Ejecutar Informe" para ver las tareas asignadas al usuario seleccionado.
        </Alert>
      )}
    </Container>
  );
};

export default InformeTareasUsuario;
