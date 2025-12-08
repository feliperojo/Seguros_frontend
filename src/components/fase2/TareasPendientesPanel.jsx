import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaExternalLinkAlt, FaComments, FaPaperclip, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import ResponderOportunidadModal from "../Tareas/ResponderOportunidadModa";

const PENDING_STATES = new Set(["pending", "processing", "in_progress"]);

export default function TareasPendientesPanel({
  className = "",
  items,
  clienteId,      // <-- ya viene desestructurado
  grupoId,
  perPage = 20,
  onCreate = () => {},
  onOpen = () => {},
  onEdit = () => {},
  emptyMessage = "No se tienen tareas pendientes o en progreso.",
}) {
  const [autoItems, setAutoItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [showNueva, setShowNueva] = useState(false);

  // Modal responder
  const [showResponder, setShowResponder] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingResponder, setLoadingResponder] = useState(false);

  // Estados para comentarios y adjuntos
  const [comentariosTareas, setComentariosTareas] = useState({}); // { taskId: [comentarios] }
  const [loadingComentariosTareas, setLoadingComentariosTareas] = useState({}); // { taskId: boolean }
  const [tareasExpandidas, setTareasExpandidas] = useState({}); // { taskId: boolean }
  const [adjuntos, setAdjuntos] = useState({}); // { logId: [adjuntos] }
  const [loadingAdjuntos, setLoadingAdjuntos] = useState({}); // { logId: boolean }
  const [archivosExpandidos, setArchivosExpandidos] = useState({}); // { logId: boolean }

  const formatDate = (v) => {
    if (!v) return "mm/dd/aaaa";
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
      ? "mm/dd/aaaa"
      : d.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
  };

  // Formatear fecha relativa (similar a FichaClienteComentarios)
  const formatFechaRelativa = useCallback((fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      
      const ahora = new Date();
      const diffMs = ahora - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return "Hace un momento";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return "Ayer";
      if (diffDays < 7) return `Hace ${diffDays} días`;
      
      return d.toLocaleString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fecha;
    }
  }, []);

  // Detectar tipo de archivo
  const esImagen = useCallback((adj) => {
    return adj.tipo_mime?.startsWith("image/") || 
           /\.(jpg|jpeg|png|gif|webp)$/i.test(adj.nombre_original || "");
  }, []);

  const esPDF = useCallback((adj) => {
    return adj.tipo_mime === "application/pdf" || 
           /\.pdf$/i.test(adj.nombre_original || "");
  }, []);

  const esWord = useCallback((adj) => {
    return adj.tipo_mime?.includes("word") || 
           /\.(doc|docx)$/i.test(adj.nombre_original || "");
  }, []);

  const getList = (res) => {
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
  };

  const fetchTaskDetail = useCallback(async (task) => {
    const raw = task?.__raw ?? task;

    // Cliente puede venir en raw.log.cliente o raw.cliente
    const cliente = raw?.log?.cliente ?? raw?.cliente ?? null;

    // Fechas pueden venir con varios nombres
    const scheduled_date =
      raw?.scheduled_date ?? raw?.scheduled_at ?? raw?.fechaProgramada ?? null;

    const due_date =
      raw?.due_date ?? raw?.due_at ?? raw?.fechaLimite ?? null;

    return {
      ...raw,
      scheduled_date,
      due_date,
      log: {
        ...(raw.log || {}),
        cliente: cliente || {
          id: clienteId,
          nombre_completo: "Cliente", // Aquí se ajusta para tener un valor por defecto
          telefono: "",
          estado_cliente: "cliente",
        },
      },
    };
}, [clienteId]);

  
  
  const openResponder = async (taskLite) => {
    const full = await fetchTaskDetail(taskLite);
    console.log('full task details:', full);
    setSelectedTask(full);
    setShowResponder(true);
  };

  const closeResponder = (updated) => {
    setShowResponder(false);
    setSelectedTask(null);
    if (updated) fetchTasks();
  };

  const handleUpdated = async () => {
    await fetchTasks();
    // Limpiar cache de comentarios y adjuntos al actualizar
    setComentariosTareas({});
    setAdjuntos({});
  };

  // Obtener IDs de tarea y log desde el objeto raw
  const getTaskIds = useCallback((task) => {
    const raw = task?.__raw ?? task;
    const tareaId = raw?.id || raw?.task?.id || raw?.task_id || null;
    const logId = raw?.log?.id || raw?.id || null;
    return { tareaId, logId };
  }, []);

  // Cargar comentarios de una tarea
  const cargarComentariosTarea = useCallback(async (tareaId) => {
    if (!tareaId || comentariosTareas[tareaId]) return;

    setLoadingComentariosTareas((prev) => ({ ...prev, [tareaId]: true }));
    try {
      const data = await apiRequest(`tareas_operativas/${tareaId}/comentarios`, "GET");
      setComentariosTareas((prev) => ({
        ...prev,
        [tareaId]: Array.isArray(data) ? data : data?.data || [],
      }));
    } catch (err) {
      console.error(`Error al cargar comentarios de la tarea ${tareaId}:`, err);
      setComentariosTareas((prev) => ({ ...prev, [tareaId]: [] }));
    } finally {
      setLoadingComentariosTareas((prev) => ({ ...prev, [tareaId]: false }));
    }
  }, [comentariosTareas]);

  // Cargar adjuntos de un log
  const cargarAdjuntos = useCallback(async (logId) => {
    if (!logId || adjuntos[logId]) return;

    setLoadingAdjuntos((prev) => ({ ...prev, [logId]: true }));
    try {
      const data = await apiRequest(`adjuntos/bitacora/${logId}`, "GET");
      setAdjuntos((prev) => ({
        ...prev,
        [logId]: Array.isArray(data) ? data : data?.data || [],
      }));
    } catch (err) {
      console.error(`Error al cargar adjuntos del log ${logId}:`, err);
      setAdjuntos((prev) => ({ ...prev, [logId]: [] }));
    } finally {
      setLoadingAdjuntos((prev) => ({ ...prev, [logId]: false }));
    }
  }, [adjuntos]);

  // Toggle para expandir/colapsar comentarios
  const toggleComentariosTarea = useCallback((tareaId) => {
    if (!tareasExpandidas[tareaId]) {
      cargarComentariosTarea(tareaId);
    }
    setTareasExpandidas((prev) => ({
      ...prev,
      [tareaId]: !prev[tareaId],
    }));
  }, [tareasExpandidas, cargarComentariosTarea]);

  // Toggle para expandir/colapsar archivos
  const toggleArchivos = useCallback((logId) => {
    if (!archivosExpandidos[logId]) {
      cargarAdjuntos(logId);
    }
    setArchivosExpandidos((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  }, [archivosExpandidos, cargarAdjuntos]);

  const normalizeTask = (t) => {
    const rawEstado = String(t?.estado ?? t?.status ?? "pending").toLowerCase();
    const nota =
      t?.nota ?? t?.note ?? t?.descripcion ?? t?.description ?? t?.detalle ?? "";
    return {
      id: t?.id,
      titulo: t?.titulo || t?.concepto || (typeof nota === "string" ? nota : "") || "Tarea",
      responsable:
        t?.responsable ?? t?.asignado_a ?? t?.assignedUser?.name ?? t?.assigned_user?.name ?? "—",
      estado: rawEstado,
      fechaLimite: t?.fechaLimite ?? t?.due_at ?? t?.scheduled_at ?? null,
      fechaCreacion: t?.fechaCreacion ?? t?.created_at ?? t?.fecha ?? null,
      nota: (typeof nota === "string" ? nota.trim() : "") || "",
      __raw: t.__raw ?? t,
    };
  };

  const sortTasks = (a, b) => {
    const ad = a.fechaLimite ? new Date(a.fechaLimite).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.fechaLimite ? new Date(b.fechaLimite).getTime() : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    const ac = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
    const bc = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
    return bc - ac;
  };

  const estadoLabel = (estado) => {
    switch ((estado || "").toLowerCase()) {
      case "pending": return "Pendiente";
      case "processing": return "Procesando";
      case "in_progress": return "En progreso";
      default: return estado || "Pendiente";
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!clienteId || !grupoId) {
      setAutoItems([]);
      return;
    }
    setLoading(true);
    setErrMsg("");
    try {
      const qs = `include=log,log.cliente,concept,comments,assignedUser&per_page=${perPage}`;
      const res = await apiRequest(
        `tareas_operativas/cliente/${clienteId}/grupo/${grupoId}?${qs}`,
        "GET"
      );
      const merged = getList(res);
      const filtered = merged.filter((t) =>
        PENDING_STATES.has(String(t?.estado ?? t?.status ?? "").toLowerCase())
      );
      const unique = Object.values(
        filtered.reduce((acc, t) => {
          if (t && t.id != null) acc[t.id] = t;
          return acc;
        }, {})
      ).map(normalizeTask).sort(sortTasks);

      setAutoItems(unique);
    } catch {
      setErrMsg("No fue posible cargar las tareas.");
      setAutoItems([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, grupoId, perPage]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const data = useMemo(() => {
    const byApi = Array.isArray(autoItems) ? autoItems : [];
    const byProp = Array.isArray(items) ? items : [];
    if (clienteId && grupoId) return byApi.length ? byApi : byProp;
    return byProp.length ? byProp : byApi;
  }, [items, autoItems, clienteId, grupoId]);

  // Cargar adjuntos automáticamente cuando cambian las tareas
  useEffect(() => {
    data.forEach((task) => {
      const { logId } = getTaskIds(task);
      if (logId && !adjuntos[logId] && !loadingAdjuntos[logId]) {
        cargarAdjuntos(logId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, getTaskIds]);

  const openNueva = () => setShowNueva(true);
  const closeNueva = () => setShowNueva(false);

  const handleCreated = async (newTask) => {
    await fetchTasks();
    onCreate(newTask);
    closeNueva();
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <strong className="text-primary">Tareas Pendientes</strong>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={openNueva}
          disabled={!clienteId || !grupoId}
          title={!clienteId || !grupoId ? "Selecciona un cliente/grupo para crear" : ""}
        >
          + Crear Tarea
        </button>
      </div>

      <div className="card-body">
        {loading && (
          <div className="d-flex align-items-center text-muted small">
            <span className="spinner-border spinner-border-sm me-2" />
            Cargando…
          </div>
        )}

        {!loading && errMsg && <div className="text-danger small">{errMsg}</div>}

        {!loading && !errMsg && (!data || data.length === 0) && (
          <div className="text-muted small">{emptyMessage}</div>
        )}

        {/* ✅ SOLO UN map (quitamos el duplicado) */}
        {!loading && !errMsg && data?.map((t) => (
          <div key={t.id} className="card mb-3 shadow-sm border-0">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between">
                <div className="fw-semibold">{t.titulo}</div>
                <div className="small text-muted text-end">
                  <div><strong>Fecha Límite:</strong> {formatDate(t.fechaLimite)}</div>
                  <div><strong>Creada:</strong> {formatDate(t.fechaCreacion)}</div>
                </div>
              </div>

              <div className="small mt-2">
                <div><strong>Responsable:</strong> {t.responsable ?? "—"}</div>
                <div><strong>Estado:</strong> {estadoLabel(t.estado)}</div>
              </div>

              {t.nota && (
                <div className="mt-2 small">
                  <strong>Nota:</strong> <span className="text-muted">{t.nota}</span>
                </div>
              )}

              {/* Sección de archivos adjuntos */}
              {(() => {
                const { logId } = getTaskIds(t);
                if (!logId) return null;

                const adjuntosLog = adjuntos[logId] || [];
                const estaCargandoAdjuntos = loadingAdjuntos[logId];
                const estaExpandido = archivosExpandidos[logId];

                if (estaCargandoAdjuntos) {
                  return (
                    <div className="mt-3 small">
                      <div className="d-flex align-items-center text-muted">
                        <Spinner animation="border" size="sm" className="me-2" />
                        <span>Cargando archivos...</span>
                      </div>
                    </div>
                  );
                }

                if (adjuntosLog.length === 0) return null;

                const imagenesCount = adjuntosLog.filter(esImagen).length;
                const pdfsCount = adjuntosLog.filter(esPDF).length;
                const wordsCount = adjuntosLog.filter(esWord).length;
                const otrosCount = adjuntosLog.length - imagenesCount - pdfsCount - wordsCount;

                return (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleArchivos(logId)}
                      className="w-100 d-flex align-items-center justify-content-between p-2 bg-light border rounded text-start"
                      style={{ fontSize: "0.875rem" }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <FaPaperclip className="text-primary" />
                        <strong>Archivos adjuntos</strong>
                        <span className="badge bg-primary rounded-pill">
                          {adjuntosLog.length} {adjuntosLog.length === 1 ? "archivo" : "archivos"}
                        </span>
                        {(imagenesCount > 0 || pdfsCount > 0 || wordsCount > 0) && (
                          <div className="d-flex align-items-center gap-2 ms-2">
                            {imagenesCount > 0 && (
                              <span className="text-muted small">
                                <i className="fas fa-image text-primary"></i> {imagenesCount}
                              </span>
                            )}
                            {pdfsCount > 0 && (
                              <span className="text-muted small">
                                <i className="fas fa-file-pdf text-danger"></i> {pdfsCount}
                              </span>
                            )}
                            {wordsCount > 0 && (
                              <span className="text-muted small">
                                <i className="fas fa-file-word text-primary"></i> {wordsCount}
                              </span>
                            )}
                            {otrosCount > 0 && (
                              <span className="text-muted small">
                                <i className="fas fa-file text-secondary"></i> {otrosCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {estaExpandido ? <FaChevronUp /> : <FaChevronDown />}
                    </button>

                    {estaExpandido && (
                      <div className="mt-2 d-flex flex-wrap gap-2">
                        {adjuntosLog.map((adjunto) => {
                          const esImg = esImagen(adjunto);
                          const esPdf = esPDF(adjunto);
                          const esDoc = esWord(adjunto);

                          return (
                            <div
                              key={adjunto.id}
                              className="border rounded overflow-hidden bg-white"
                              style={{ width: "120px", height: "120px", cursor: "pointer" }}
                              onClick={() => window.open(adjunto.url, "_blank")}
                              title="Haz clic para abrir el archivo"
                            >
                              {esImg ? (
                                <img
                                  src={adjunto.url}
                                  alt={adjunto.nombre_original || "Imagen adjunta"}
                                  className="w-100 h-100"
                                  style={{ objectFit: "cover" }}
                                />
                              ) : esPdf ? (
                                <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-danger bg-opacity-10">
                                  <i className="fas fa-file-pdf text-danger" style={{ fontSize: "2rem" }}></i>
                                  <span className="text-center small text-truncate px-1" style={{ fontSize: "0.7rem" }}>
                                    {adjunto.nombre_original || "PDF"}
                                  </span>
                                </div>
                              ) : esDoc ? (
                                <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-primary bg-opacity-10">
                                  <i className="fas fa-file-word text-primary" style={{ fontSize: "2rem" }}></i>
                                  <span className="text-center small text-truncate px-1" style={{ fontSize: "0.7rem" }}>
                                    {adjunto.nombre_original || "Word"}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-secondary bg-opacity-10">
                                  <i className="fas fa-file text-secondary" style={{ fontSize: "2rem" }}></i>
                                  <span className="text-center small text-truncate px-1" style={{ fontSize: "0.7rem" }}>
                                    {adjunto.nombre_original || "Archivo"}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sección de comentarios de la tarea */}
              {(() => {
                const { tareaId } = getTaskIds(t);
                if (!tareaId) return null;

                const comentariosTarea = comentariosTareas[tareaId] || [];
                const estaExpandida = tareasExpandidas[tareaId];
                const estaCargando = loadingComentariosTareas[tareaId];

                return (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleComentariosTarea(tareaId)}
                      className="w-100 d-flex align-items-center justify-content-between p-2 bg-light border rounded text-start"
                      style={{ fontSize: "0.875rem" }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <FaComments className="text-primary" />
                        <strong>Comentarios de la tarea</strong>
                        {comentariosTarea.length > 0 && (
                          <span className="badge bg-primary rounded-pill">
                            {comentariosTarea.length}
                          </span>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {estaCargando && (
                          <Spinner animation="border" size="sm" />
                        )}
                        {estaExpandida ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                    </button>

                    {estaExpandida && (
                      <div className="mt-2">
                        {estaCargando ? (
                          <div className="d-flex align-items-center justify-content-center py-3">
                            <Spinner animation="border" size="sm" className="me-2" />
                            <span className="text-muted small">Cargando comentarios...</span>
                          </div>
                        ) : comentariosTarea.length > 0 ? (
                          <div>
                            {comentariosTarea.map((comentarioTarea) => (
                              <div
                                key={comentarioTarea.id}
                                className="bg-light border-start border-primary border-3 rounded p-3 mb-2"
                              >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                  <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: "24px", height: "24px" }}>
                                      <i className="fas fa-user text-primary" style={{ fontSize: "0.7rem" }}></i>
                                    </div>
                                    <span className="fw-medium small">
                                      {comentarioTarea.user?.name || comentarioTarea.user || "Usuario"}
                                    </span>
                                  </div>
                                  <span className="text-muted small">
                                    {formatFechaRelativa(comentarioTarea.created_at || comentarioTarea.fecha)}
                                  </span>
                                </div>
                                <p className="text-dark small mb-0" style={{ whiteSpace: "pre-wrap" }}>
                                  {comentarioTarea.comment || comentarioTarea.response_note || comentarioTarea.note || "Sin contenido"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-3 text-muted small">
                            <i className="fas fa-comment-slash mb-2"></i>
                            <p className="mb-0">No hay comentarios para esta tarea aún.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="mt-3 d-flex gap-2">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => openResponder(t.__raw ?? t)}
                  disabled={loadingResponder}
                >
                  Responder <FaExternalLinkAlt className="ms-1" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <NuevaTareaModal
        show={showNueva}
        onHide={closeNueva}
        onCreated={handleCreated}
        grupoFamiliarId={grupoId}
        clienteId={clienteId}
      />

      {selectedTask && (
        <ResponderOportunidadModal
          show={showResponder}
          onHide={closeResponder}
          tarea={selectedTask}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
