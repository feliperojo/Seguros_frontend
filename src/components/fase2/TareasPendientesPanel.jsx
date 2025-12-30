import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FaExternalLinkAlt, FaComments, FaPaperclip, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { Spinner, Modal, Button } from "react-bootstrap";
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
  const [archivoPreview, setArchivoPreview] = useState(null); // { adjunto, tipo }
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);
  
  // Ref para rastrear qué logIds ya se están cargando o se cargaron
  const logIdsCargandoRef = useRef(new Set());

  const formatDate = (v) => {
    if (!v) return "mm/dd/yyyy";
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "mm/dd/yyyy";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
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
      
      // Formato mm/dd/yyyy hh:mm AM/PM
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, "0");
      
      return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
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
    // El logId puede estar en raw.log.id o directamente en raw.id (si la tarea está relacionada con un log)
    // También puede estar en raw.bitacora_operativa_id o similar
    const logId = raw?.log?.id || raw?.bitacora_operativa_id || raw?.log_id || raw?.id || null;
    
    // Debug: loguear para ver qué estructura tiene
    if (tareaId && !logId) {
      console.log("⚠️ Tarea sin logId:", { tareaId, raw: Object.keys(raw || {}) });
    }
    
    return { tareaId, logId };
  }, []);

  // Obtener nombre del usuario creador
  const getUsuarioCreador = useCallback((task) => {
    const raw = task?.__raw ?? task;
    return (
      raw?.user?.name ||
      raw?.usuario?.name ||
      raw?.user_name ||
      raw?.usuario ||
      raw?.created_by?.name ||
      raw?.log?.user?.name ||
      raw?.log?.usuario?.name ||
      raw?.log?.created_by?.name ||
      null
    );
  }, []);

  // Obtener nombre del usuario asignado
  const getUsuarioAsignado = useCallback((task) => {
    const raw = task?.__raw ?? task;
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
      null
    );
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
    if (!logId) {
      console.log("⚠️ cargarAdjuntos llamado sin logId");
      return;
    }
    
    // Verificar usando ref si ya se está cargando
    if (logIdsCargandoRef.current.has(logId)) {
      console.log("⏳ Adjuntos ya se están cargando para logId:", logId);
      return;
    }
    
    // Verificar si ya están cargados en el estado
    setAdjuntos((prev) => {
      if (prev[logId]) {
        console.log("✅ Adjuntos ya cargados en estado para logId:", logId);
        return prev;
      }
      
      // Marcar que se está cargando
      logIdsCargandoRef.current.add(logId);
      setLoadingAdjuntos((prevLoading) => ({ ...prevLoading, [logId]: true }));
      
      // Cargar adjuntos
      apiRequest(`adjuntos/bitacora/${logId}`, "GET")
        .then((data) => {
          const adjuntosLista = Array.isArray(data) ? data : data?.data || [];
          console.log(`✅ Adjuntos cargados para logId ${logId}:`, adjuntosLista.length, "archivos");
          
          setAdjuntos((prevAdj) => {
            if (prevAdj[logId]) {
              console.log("⚠️ Adjuntos ya existían, no sobrescribiendo para logId:", logId);
              return prevAdj;
            }
            return {
              ...prevAdj,
              [logId]: adjuntosLista,
            };
          });
        })
        .catch((err) => {
          console.error(`❌ Error al cargar adjuntos del log ${logId}:`, err);
          setAdjuntos((prevAdj) => {
            if (!prevAdj[logId]) {
              return { ...prevAdj, [logId]: [] };
            }
            return prevAdj;
          });
        })
        .finally(() => {
          logIdsCargandoRef.current.delete(logId);
          setLoadingAdjuntos((prevLoading) => ({ ...prevLoading, [logId]: false }));
        });
      
      return prev;
    });
  }, []);

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

  // Función para abrir previsualización
  const abrirPreview = useCallback((adjunto) => {
    const esImg = esImagen(adjunto);
    const esPdf = esPDF(adjunto);
    const esDoc = esWord(adjunto);
    
    setArchivoPreview({
      adjunto,
      tipo: esImg ? "imagen" : esPdf ? "pdf" : esDoc ? "word" : "otro"
    });
    setErrorCargaArchivo(false);
    setShowPreviewModal(true);
  }, [esImagen, esPDF, esWord]);

  // Función para descargar archivo
  const descargarArchivo = useCallback(async (adjunto) => {
    try {
      // Intentar usar el endpoint de descarga si existe
      if (adjunto.id) {
        try {
          const res = await apiRequest(`adjuntos/bitacora/${adjunto.id}/descargar`, "GET");
          if (res?.url) {
            const link = document.createElement("a");
            link.href = res.url;
            link.download = adjunto.nombre_original || "archivo";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
          }
        } catch (err) {
          console.log("Endpoint de descarga no disponible, usando URL directa");
        }
      }
      
      // Fallback: usar la URL directa con fetch para forzar descarga
      const response = await fetch(adjunto.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = adjunto.nombre_original || "archivo";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar archivo:", error);
      // Fallback final: abrir en nueva pestaña
      window.open(adjunto.url, "_blank");
    }
  }, []);

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
    if (!data || data.length === 0) return;
    
    // Recopilar todos los logIds únicos
    const logIdsSet = new Set();
    data.forEach((task) => {
      const { logId } = getTaskIds(task);
      if (logId) {
        logIdsSet.add(logId);
      }
    });
    
    // Intentar cargar adjuntos para cada logId (la función cargarAdjuntos maneja la verificación de si ya están cargados)
    logIdsSet.forEach((logId) => {
      cargarAdjuntos(logId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]); // Cuando cambia el número de tareas

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
                <div><strong>Estado:</strong> {estadoLabel(t.estado)}</div>
                {(() => {
                  const usuarioCreador = getUsuarioCreador(t);
                  const usuarioAsignado = getUsuarioAsignado(t);
                  
                  return (
                    <>
                      {usuarioCreador && (
                        <div><strong>Creada por:</strong> {usuarioCreador}</div>
                      )}
                      {usuarioAsignado && (
                        <div><strong>Asignada a:</strong> {usuarioAsignado}</div>
                      )}
                      {!usuarioCreador && !usuarioAsignado && t.responsable && (
                        <div><strong>Responsable:</strong> {t.responsable}</div>
                      )}
                    </>
                  );
                })()}
              </div>

              {t.nota && (
                <div className="mt-2 small">
                  <strong>Nota:</strong> <span className="text-muted">{t.nota}</span>
                </div>
              )}

              {/* Preview de imágenes - siempre visible si hay imágenes */}
              {(() => {
                const { logId } = getTaskIds(t);
                if (!logId) {
                  // Debug: ver por qué no hay logId
                  console.log("⚠️ Tarea sin logId en render:", { tareaId: t.id, titulo: t.titulo, raw: t.__raw });
                  return null;
                }

                const adjuntosLog = adjuntos[logId] || [];
                const estaCargandoAdjuntos = loadingAdjuntos[logId];
                const imagenesAdjuntas = adjuntosLog.filter(esImagen);

                // Mostrar spinner si está cargando
                if (estaCargandoAdjuntos) {
                  return (
                    <div className="mt-3 small">
                      <div className="d-flex align-items-center text-muted">
                        <Spinner animation="border" size="sm" className="me-2" />
                        <span>Cargando imágenes...</span>
                      </div>
                    </div>
                  );
                }

                // Si hay imágenes, mostrar preview directamente
                if (imagenesAdjuntas.length > 0) {
                  const previewLimit = 4; // Mostrar máximo 4 imágenes en preview
                  const imagenesPreview = imagenesAdjuntas.slice(0, previewLimit);
                  const hayMasImagenes = imagenesAdjuntas.length > previewLimit;

                  return (
                    <div className="mt-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="fas fa-image text-primary"></i>
                        <strong className="small">Imágenes ({imagenesAdjuntas.length})</strong>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {imagenesPreview.map((adjunto) => (
                          <div
                            key={adjunto.id}
                            className="position-relative border rounded overflow-hidden bg-white"
                            style={{ width: "100px", height: "100px", cursor: "pointer" }}
                            onClick={() => abrirPreview(adjunto)}
                            title={adjunto.nombre_original || "Haz clic para previsualizar"}
                          >
                            <img
                              src={adjunto.url}
                              alt={adjunto.nombre_original || "Imagen adjunta"}
                              className="w-100 h-100"
                              style={{ objectFit: "cover" }}
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.parentElement.innerHTML = `
                                  <div class="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-secondary bg-opacity-10">
                                    <i class="fas fa-image text-secondary" style="font-size: 1.5rem;"></i>
                                  </div>
                                `;
                              }}
                            />
                            <div className="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-0 opacity-0" 
                                 style={{ transition: "all 0.2s" }}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.classList.add("bg-opacity-30");
                                   e.currentTarget.classList.remove("opacity-0");
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.classList.remove("bg-opacity-30");
                                   e.currentTarget.classList.add("opacity-0");
                                 }}>
                              <div className="d-flex align-items-center justify-content-center h-100">
                                <i className="fas fa-eye text-white opacity-0" 
                                   style={{ transition: "opacity 0.2s" }}
                                   onMouseEnter={(e) => e.currentTarget.classList.remove("opacity-0")}
                                   onMouseLeave={(e) => e.currentTarget.classList.add("opacity-0")}></i>
                              </div>
                            </div>
                            <div className="position-absolute top-1 end-1 opacity-0" 
                                 style={{ transition: "opacity 0.2s" }}
                                 onMouseEnter={(e) => e.currentTarget.classList.remove("opacity-0")}
                                 onMouseLeave={(e) => e.currentTarget.classList.add("opacity-0")}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   descargarArchivo(adjunto);
                                 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary rounded-circle p-1 shadow"
                                title="Descargar archivo"
                              >
                                <i className="fas fa-download" style={{ fontSize: "0.7rem" }}></i>
                              </button>
                            </div>
                          </div>
                        ))}
                        {hayMasImagenes && (
                          <div
                            className="border rounded bg-light d-flex align-items-center justify-content-center"
                            style={{ width: "100px", height: "100px", cursor: "pointer" }}
                            onClick={() => toggleArchivos(logId)}
                            title="Ver todas las imágenes"
                          >
                            <div className="text-center">
                              <div className="fw-bold text-primary">+{imagenesAdjuntas.length - previewLimit}</div>
                              <div className="small text-muted">más</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Sección de archivos adjuntos (expandible) - solo si hay archivos no-imagen */}
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
                
                // Solo mostrar sección expandible si hay archivos que no sean imágenes
                // o si hay más de 4 imágenes (para permitir ver todas)
                const hayArchivosNoImagen = pdfsCount > 0 || wordsCount > 0 || otrosCount > 0;
                const hayMasDe4Imagenes = imagenesCount > 4;
                
                if (!hayArchivosNoImagen && !hayMasDe4Imagenes) return null;

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
                              className="position-relative border rounded overflow-hidden bg-white"
                              style={{ width: "150px", height: "150px", cursor: "pointer" }}
                              onClick={() => abrirPreview(adjunto)}
                              title={adjunto.nombre_original || "Haz clic para previsualizar"}
                            >
                              {esImg ? (
                                <>
                                  <img
                                    src={adjunto.url}
                                    alt={adjunto.nombre_original || "Imagen adjunta"}
                                    className="w-100 h-100"
                                    style={{ objectFit: "cover" }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.parentElement.innerHTML = `
                                        <div class="w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-secondary bg-opacity-10">
                                          <i class="fas fa-image text-secondary" style="font-size: 2rem;"></i>
                                        </div>
                                      `;
                                    }}
                                  />
                                  <div className="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-0 opacity-0" 
                                       style={{ transition: "all 0.2s" }}
                                       onMouseEnter={(e) => {
                                         e.currentTarget.classList.add("bg-opacity-30");
                                         e.currentTarget.classList.remove("opacity-0");
                                       }}
                                       onMouseLeave={(e) => {
                                         e.currentTarget.classList.remove("bg-opacity-30");
                                         e.currentTarget.classList.add("opacity-0");
                                       }}>
                                    <div className="d-flex align-items-center justify-content-center h-100">
                                      <i className="fas fa-eye text-white opacity-0" 
                                         style={{ transition: "opacity 0.2s" }}
                                         onMouseEnter={(e) => e.currentTarget.classList.remove("opacity-0")}
                                         onMouseLeave={(e) => e.currentTarget.classList.add("opacity-0")}></i>
                                    </div>
                                  </div>
                                </>
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
                              {adjunto.nombre_original && (
                                <div className="position-absolute bottom-0 start-0 end-0 bg-black bg-opacity-75 text-white small px-1 text-truncate">
                                  {adjunto.nombre_original}
                                </div>
                              )}
                              <div className="position-absolute top-1 end-1 opacity-0" 
                                   style={{ transition: "opacity 0.2s" }}
                                   onMouseEnter={(e) => e.currentTarget.classList.remove("opacity-0")}
                                   onMouseLeave={(e) => e.currentTarget.classList.add("opacity-0")}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     descargarArchivo(adjunto);
                                   }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary rounded-circle p-1 shadow"
                                  title="Descargar archivo"
                                >
                                  <i className="fas fa-download" style={{ fontSize: "0.7rem" }}></i>
                                </button>
                              </div>
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

      {/* Modal de previsualización de archivos */}
      <Modal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        size="xl"
        centered
        fullscreen="lg-down"
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className={`fas ${
              archivoPreview?.tipo === "imagen" ? "fa-image" :
              archivoPreview?.tipo === "pdf" ? "fa-file-pdf" :
              archivoPreview?.tipo === "word" ? "fa-file-word" :
              "fa-file"
            }`}></i>
            <span>{archivoPreview?.adjunto?.nombre_original || "Vista previa"}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ minHeight: "400px", maxHeight: "80vh" }}>
          {archivoPreview?.tipo === "imagen" && (
            <div className="d-flex align-items-center justify-content-center bg-dark" style={{ minHeight: "400px", position: "relative" }}>
              {errorCargaArchivo ? (
                <div className="text-center text-white p-5">
                  <i className="fas fa-exclamation-triangle mb-3" style={{ fontSize: "3rem" }}></i>
                  <h5>No se pudo cargar la imagen</h5>
                  <p className="text-white-50">La imagen puede requerir autenticación o no estar disponible.</p>
                  <Button
                    variant="light"
                    className="mt-3"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = archivoPreview.adjunto.url;
                      link.target = "_blank";
                      link.rel = "noopener noreferrer";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <i className="fas fa-external-link-alt me-2"></i>
                    Abrir en nueva pestaña
                  </Button>
                </div>
              ) : (
                <img
                  src={archivoPreview.adjunto.url}
                  alt={archivoPreview.adjunto.nombre_original || "Imagen"}
                  className="img-fluid"
                  style={{ maxHeight: "80vh", maxWidth: "100%", objectFit: "contain" }}
                  onError={() => {
                    console.error("Error al cargar imagen");
                    setErrorCargaArchivo(true);
                  }}
                />
              )}
            </div>
          )}
          {archivoPreview?.tipo === "pdf" && (
            <div style={{ height: "80vh", width: "100%" }}>
              {errorCargaArchivo ? (
                <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
                  <i className="fas fa-file-pdf text-danger" style={{ fontSize: "5rem" }}></i>
                  <h5 className="mt-3 mb-2">No se puede previsualizar el PDF</h5>
                  <p className="text-muted">El PDF puede requerir autenticación o no estar disponible para previsualización.</p>
                  <p className="text-muted small">Por favor, descárgalo o ábrelo en una nueva pestaña para verlo.</p>
                </div>
              ) : (
                <iframe
                  src={`${archivoPreview.adjunto.url}#toolbar=0`}
                  title={archivoPreview.adjunto.nombre_original || "PDF"}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none"
                  }}
                  onError={() => {
                    console.error("Error al cargar PDF en iframe");
                    setErrorCargaArchivo(true);
                  }}
                />
              )}
            </div>
          )}
          {(archivoPreview?.tipo === "word" || archivoPreview?.tipo === "otro") && (
            <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
              <div className="text-center mb-4">
                {archivoPreview?.tipo === "word" ? (
                  <i className="fas fa-file-word text-primary" style={{ fontSize: "5rem" }}></i>
                ) : (
                  <i className="fas fa-file text-secondary" style={{ fontSize: "5rem" }}></i>
                )}
                <h5 className="mt-3 mb-2">
                  {archivoPreview?.adjunto?.nombre_original || "Archivo"}
                </h5>
                <p className="text-muted">
                  {archivoPreview?.tipo === "word" 
                    ? "Los archivos Word no se pueden previsualizar directamente en el navegador."
                    : "Este tipo de archivo no se puede previsualizar directamente."}
                </p>
                <p className="text-muted small">
                  Puedes descargarlo para ver su contenido.
                </p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Cerrar
          </Button>
          {archivoPreview?.adjunto && (
            <Button
              variant="primary"
              onClick={() => {
                descargarArchivo(archivoPreview.adjunto);
              }}
            >
              <i className="fas fa-download me-2"></i>
              Descargar
            </Button>
          )}
          {archivoPreview?.adjunto && (
            <Button
              variant="outline-primary"
              onClick={() => {
                window.open(archivoPreview.adjunto.url, "_blank", "noopener,noreferrer");
              }}
            >
              <i className="fas fa-external-link-alt me-2"></i>
              Abrir en nueva pestaña
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
