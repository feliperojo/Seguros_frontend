// src/pages/tabs/FichaClienteAuditorias.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import { listTasks, getTaskComments } from "../../services/auditoriasTasksService";
import { Spinner, Modal, Button } from "react-bootstrap";
import { formatDateForDisplay } from "../../utils/formatters";
import { isTaskOverdue } from "../../utils/taskDueDate";
import ResponderTareaAuditoriaModal from "../../components/Tareas/ResponderTareaAuditoriaModal";
import { highlightMentions } from "../../utils/mentions";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteAuditorias() {
  const { cliente, coberturaPrincipal, selectedGrupoId } = useFichaCliente();
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTarea, setSelectedTarea] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [comentariosTareas, setComentariosTareas] = useState({}); // { taskId: [comentarios] }
  const [loadingComentariosTareas, setLoadingComentariosTareas] = useState({}); // { taskId: true/false }
  const [tareasExpandidas, setTareasExpandidas] = useState({}); // { taskId: true/false }
  const [archivoPreview, setArchivoPreview] = useState(null); // { adjunto, tipo }
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);

  // Obtener grupo familiar seleccionado del contexto (compartido con el tab General)
  const grupoFamiliarId = useMemo(() => {
    // Prioridad: grupo seleccionado del contexto > cobertura principal > cliente
    if (selectedGrupoId) {
      return toValidId(selectedGrupoId);
    }
    if (!cliente) return null;
    return (
      toValidId(coberturaPrincipal?.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar?.id) ??
      toValidId(cliente.grupo_familiar_id) ??
      null
    );
  }, [cliente, coberturaPrincipal, selectedGrupoId]);

  // Cargar tareas de auditoría del grupo familiar
  useEffect(() => {
    if (!grupoFamiliarId) {
      setTareas([]);
      setError("No hay grupo familiar asociado");
      return;
    }

    const cargarTareas = async () => {
      setLoading(true);
      setError("");
      try {
        const filters = { 
          grupo_familiar_id: grupoFamiliarId,
          per_page: 100 
        };

        const response = await listTasks(filters);
        const tareasData = response?.data || response || [];
        const tareasArray = Array.isArray(tareasData) ? tareasData : [];

        // Ordenar por fecha de creación (más reciente primero)
        const tareasOrdenadas = tareasArray.sort((a, b) => {
          const fechaA = new Date(a.created_at || a.createdAt || 0);
          const fechaB = new Date(b.created_at || b.createdAt || 0);
          return fechaB - fechaA; // Descendente (más reciente primero)
        });

        setTareas(tareasOrdenadas);
      } catch (err) {
        console.error("Error al cargar tareas de auditoría:", err);
        setError("No se pudieron cargar las tareas de auditoría");
        setTareas([]);
      } finally {
        setLoading(false);
      }
    };

    cargarTareas();
  }, [grupoFamiliarId]);

  // Formatear fecha - formato más compacto y moderno (igual que en Tareas y Notas)
  const formatFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      const d = new Date(fecha);
      if (isNaN(d)) return fecha;
      
      const ahora = new Date();
      const diffMs = ahora - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      // Formato relativo para fechas recientes
      if (diffMins < 1) return "Hace un momento";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return "Ayer";
      if (diffDays < 7) return `Hace ${diffDays} días`;
      
      // Formato completo para fechas más antiguas en formato mm/dd/yyyy hh:mm AM/PM
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
  };

  // Obtener nombre del usuario creador
  const getUsuarioCreadorNombre = (tarea) => {
    return (
      tarea?.created_by?.name ||
      tarea?.created_by?.nombre ||
      tarea?.user?.name ||
      tarea?.user?.nombre ||
      "Usuario desconocido"
    );
  };

  // Obtener nombre del usuario asignado
  const getUsuarioAsignadoNombre = (tarea) => {
    return (
      tarea?.assigned_user?.name ||
      tarea?.assigned_user?.nombre ||
      tarea?.assigned_to_user?.name ||
      tarea?.assigned_to_user?.nombre ||
      null
    );
  };

  // Obtener nombre del cliente
  const getClienteNombre = (tarea) => {
    return (
      tarea?.cliente?.nombre_completo ||
      tarea?.cliente?.name ||
      tarea?.cliente_name ||
      "Cliente"
    );
  };

  // Obtener concepto/categoría de la tarea
  const getConceptoNombre = (tarea) => {
    return (
      tarea?.item?.concept?.name ||
      tarea?.concept?.name ||
      tarea?.concepto?.name ||
      tarea?.concept_name ||
      tarea?.concepto ||
      "Tarea de Auditoría"
    );
  };

  // Obtener ID de la auditoría (run_id)
  const getAuditoriaId = (tarea) => {
    // Prioridad: auditoria.run_id > item.run_id > run_id directo
    return (
      tarea?.auditoria?.run_id ||
      tarea?.item?.run_id ||
      tarea?.run_id ||
      tarea?.run?.id ||
      tarea?.audit_run?.id ||
      tarea?.audit_run_id ||
      null
    );
  };

  // Obtener nombre/tipo de la auditoría
  const getTipoAuditoriaNombre = (tarea) => {
    // Prioridad: auditoria.tipo_auditoria > item.run.audit_type > otros
    if (tarea?.auditoria?.tipo_auditoria) {
      const tipo = tarea.auditoria.tipo_auditoria;
      if (typeof tipo === "object") {
        return tipo.nombre || tipo.descripcion || tipo.codigo || "Auditoría";
      }
      return tipo;
    }
    if (tarea?.item?.run?.audit_type) {
      const tipo = tarea.item.run.audit_type;
      if (typeof tipo === "object") {
        return tipo.nombre || tipo.descripcion || tipo.codigo || "Auditoría";
      }
      return tipo;
    }
    if (tarea?.run?.audit_type) {
      const tipo = tarea.run.audit_type;
      if (typeof tipo === "object") {
        return tipo.nombre || tipo.descripcion || tipo.codigo || "Auditoría";
      }
      return tipo;
    }
    if (tarea?.audit_run?.audit_type) {
      const tipo = tarea.audit_run.audit_type;
      if (typeof tipo === "object") {
        return tipo.nombre || tipo.descripcion || tipo.codigo || "Auditoría";
      }
      return tipo;
    }
    if (tarea?.audit_type) {
      const tipo = tarea.audit_type;
      if (typeof tipo === "object") {
        return tipo.nombre || tipo.descripcion || tipo.codigo || "Auditoría";
      }
      return tipo;
    }
    return null;
  };

  // Obtener ID de la cobertura
  const getCoberturaId = (tarea) => {
    return (
      tarea?.cobertura?.id ||
      tarea?.cobertura_id ||
      null
    );
  };

  // Cargar comentarios de una tarea
  const cargarComentariosTarea = async (tareaId) => {
    if (!tareaId || comentariosTareas[tareaId]) {
      return;
    }

    setLoadingComentariosTareas((prev) => ({ ...prev, [tareaId]: true }));
    try {
      const data = await getTaskComments(tareaId);
      setComentariosTareas((prev) => ({
        ...prev,
        [tareaId]: Array.isArray(data) ? data : data?.data || [],
      }));
    } catch (err) {
      console.error(`Error al cargar comentarios de la tarea ${tareaId}:`, err);
      setComentariosTareas((prev) => ({
        ...prev,
        [tareaId]: [],
      }));
    } finally {
      setLoadingComentariosTareas((prev) => ({ ...prev, [tareaId]: false }));
    }
  };

  // Toggle para expandir/colapsar comentarios de una tarea
  const toggleComentariosTarea = (tareaId) => {
    if (!tareasExpandidas[tareaId]) {
      cargarComentariosTarea(tareaId);
    }
    setTareasExpandidas((prev) => ({
      ...prev,
      [tareaId]: !prev[tareaId],
    }));
  };

  // Función para recargar tareas
  const recargarTareas = useCallback(() => {
    if (!grupoFamiliarId) return;

    setLoading(true);
    setComentariosTareas({});
    
    listTasks({ grupo_familiar_id: grupoFamiliarId, per_page: 100 })
      .then((response) => {
        const tareasData = response?.data || response || [];
        const tareasArray = Array.isArray(tareasData) ? tareasData : [];
        const tareasOrdenadas = tareasArray.sort((a, b) => {
          const fechaA = new Date(a.created_at || a.createdAt || 0);
          const fechaB = new Date(b.created_at || b.createdAt || 0);
          return fechaB - fechaA;
        });
        setTareas(tareasOrdenadas);
      })
      .catch((err) => {
        console.error("Error al recargar tareas:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [grupoFamiliarId]);

  const handleVerTarea = async (tarea) => {
    try {
      const tareaCompleta = await getTask(tarea.id);
      setSelectedTarea(tareaCompleta);
      setShowModal(true);
    } catch (err) {
      console.error("Error al cargar detalles de la tarea:", err);
      setSelectedTarea(tarea);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTarea(null);
    recargarTareas();
  };
  
  const handleTareaActualizada = (tareaActualizada) => {
    setTareas((prev) =>
      prev.map((t) => (t.id === tareaActualizada.id ? tareaActualizada : t))
    );
  };

  // Funciones helper para adjuntos de comentarios
  const esImagenAdjunto = (adj) => {
    return adj.tipo_mime?.startsWith("image/") || 
           adj.mime_type?.startsWith("image/") ||
           /\.(jpg|jpeg|png|gif|webp)$/i.test(adj.nombre_original || adj.filename || "");
  };

  const esPDF = (adj) => {
    return adj.tipo_mime === "application/pdf" || 
           adj.mime_type === "application/pdf" ||
           /\.pdf$/i.test(adj.nombre_original || adj.filename || "");
  };

  // Función para abrir preview de adjuntos
  const abrirPreview = (adjunto) => {
    const esImg = esImagenAdjunto(adjunto);
    const esPdf = esPDF(adjunto);
    
    setArchivoPreview({
      adjunto,
      tipo: esImg ? "imagen" : esPdf ? "pdf" : "otro"
    });
    setErrorCargaArchivo(false);
    setShowPreviewModal(true);
  };

  // Función para descargar archivo
  const descargarArchivo = async (adjunto) => {
    try {
      if (adjunto.url) {
        const response = await fetch(adjunto.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = adjunto.nombre_original || adjunto.filename || "archivo";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        window.open(adjunto.url, "_blank");
      }
    } catch (error) {
      console.error("Error al descargar archivo:", error);
      window.open(adjunto.url, "_blank");
    }
  };

  if (!cliente) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700">
        <div className="flex items-center gap-2">
          <i className="fas fa-info-circle text-gray-500"></i>
          <span>No se encontró información del cliente.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Estilos para renderizar contenido HTML de Quill */}
      <style>{`
        .ql-editor {
          font-size: 16px;
          line-height: 1.6;
          padding: 0;
        }
        .ql-editor p {
          margin: 0 0 0.5em 0;
        }
        .ql-editor p:last-child {
          margin-bottom: 0;
        }
        .ql-editor strong {
          font-weight: 600;
        }
        .ql-editor em {
          font-style: italic;
        }
        .ql-editor u {
          text-decoration: underline;
        }
        .ql-editor a {
          color: #2563eb;
          text-decoration: underline;
        }
        .ql-editor ul, .ql-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ql-editor blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #6b7280;
        }
      `}</style>
      
      {/* Header principal con diseño moderno (igual que Tareas y Notas) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        {/* Header con gradiente sutil */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shadow-sm">
                <i className="fas fa-clipboard-check text-white text-sm"></i>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 m-0">Auditorías</h2>
                <p className="text-sm text-gray-500 m-0 mt-0.5">Historial de tareas de auditoría del grupo familiar</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {!grupoFamiliarId ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <i className="fas fa-exclamation-triangle text-gray-500 text-sm"></i>
                </div>
                <div>
                  <p className="text-gray-700 font-medium m-0">No hay grupo familiar asociado</p>
                  <p className="text-gray-600 text-sm m-0 mt-1">Selecciona un grupo familiar en el tab General para ver las tareas de auditoría.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Badge de grupo familiar */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                  <i className="fas fa-users text-gray-500 text-xs"></i>
                  <span className="text-sm text-gray-600">
                    Grupo Familiar: <span className="font-semibold text-gray-800">GF #{grupoFamiliarId}</span>
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner animation="border" variant="primary" className="mb-4" />
                  <p className="text-gray-500 text-sm font-medium">Cargando tareas de auditoría...</p>
                </div>
              ) : error ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <i className="fas fa-exclamation-circle text-gray-600 text-sm"></i>
                    </div>
                    <p className="text-gray-700 font-medium m-0">{error}</p>
                  </div>
                </div>
              ) : tareas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <i className="fas fa-clipboard-check text-gray-400 text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay tareas de auditoría aún</h3>
                  <p className="text-gray-500 text-sm mb-6 text-center max-w-sm">
                    Las tareas de auditoría se crearán desde los reportes de auditoría y aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tareas.map((tarea, index) => {
                    const fecha = tarea.created_at || tarea.createdAt;
                    const concepto = getConceptoNombre(tarea);
                    const usuarioCreador = getUsuarioCreadorNombre(tarea);
                    const clienteNombre = getClienteNombre(tarea);
                    const usuarioAsignado = getUsuarioAsignadoNombre(tarea);
                    const nota = tarea.response_note || "Sin contenido";
                    const estadoTarea = tarea.status || null;
                    const tareaVencida = isTaskOverdue(tarea.due_date) && tarea.status !== "completed";
                    const auditoriaId = getAuditoriaId(tarea);
                    const tipoAuditoriaNombre = getTipoAuditoriaNombre(tarea);
                    const coberturaId = getCoberturaId(tarea);

                    return (
                      <div
                        key={tarea.id || index}
                        className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200 hover:border-gray-300"
                      >
                        {/* Línea vertical decorativa - Color gris oscuro profesional */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-slate-600"></div>
                        
                        {/* Header de la tarea */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            {/* Badges: Tipo, Estado y Concepto */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {/* Etiqueta de tipo (Tarea de Auditoría) */}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-200">
                                <i className="fas fa-clipboard-check text-[10px]"></i>
                                Tarea
                              </span>
                              {/* Badge de estado */}
                              {estadoTarea && (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                  estadoTarea === "completed" 
                                    ? "bg-gray-100 text-gray-700 border-gray-300"
                                    : estadoTarea === "pending"
                                    ? "bg-gray-50 text-gray-600 border-gray-200"
                                    : estadoTarea === "in_progress"
                                    ? "bg-slate-50 text-slate-700 border-slate-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                }`}>
                                  <i className={`fas ${
                                    estadoTarea === "completed" ? "fa-check-circle" :
                                    estadoTarea === "pending" ? "fa-clock" :
                                    estadoTarea === "in_progress" ? "fa-spinner" :
                                    "fa-info-circle"
                                  } text-[10px]`}></i>
                                  {estadoTarea === "completed" ? "Completada" : 
                                   estadoTarea === "pending" ? "Pendiente" : 
                                   estadoTarea === "in_progress" ? "En progreso" : estadoTarea}
                                </span>
                              )}
                              {/* Badge de concepto con ID de auditoría, ID de cobertura y tipo de auditoría */}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium border border-gray-200">
                                <i className="fas fa-tag text-[10px]"></i>
                                {concepto}
                                {auditoriaId && (
                                  <span className="text-slate-600 font-semibold">• Aud. ID: #{auditoriaId}</span>
                                )}
                                {coberturaId && (
                                  <span className="text-slate-600 font-semibold">• Cob. ID: #{coberturaId}</span>
                                )}
                                {tipoAuditoriaNombre && (
                                  <span className="text-slate-600 font-semibold">• {tipoAuditoriaNombre}</span>
                                )}
                              </span>
                            </div>
                            
                            {/* Información de usuarios y cliente */}
                            <div className="space-y-2">
                              {/* Usuario creador */}
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                  <i className="fas fa-user-plus text-gray-500 text-xs"></i>
                                </div>
                                <span className="text-gray-500 font-medium">Creado por:</span>
                                <span className="font-semibold text-gray-800">{usuarioCreador}</span>
                              </div>
                              
                              {/* Cliente */}
                              {clienteNombre && clienteNombre !== "Cliente" && (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i className="fas fa-user-circle text-gray-500 text-xs"></i>
                                  </div>
                                  <span className="text-gray-500 font-medium">Cliente:</span>
                                  <span className="font-semibold text-gray-800">{clienteNombre}</span>
                                </div>
                              )}
                              
                              {/* Usuario asignado */}
                              {usuarioAsignado && (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i className="fas fa-user-check text-gray-500 text-xs"></i>
                                  </div>
                                  <span className="text-gray-500 font-medium">Asignado a:</span>
                                  <span className="font-semibold text-gray-800">{usuarioAsignado}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Fecha */}
                          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                            <i className="fas fa-clock text-[10px]"></i>
                            <span className="font-medium">{formatFecha(fecha)}</span>
                          </div>
                        </div>
                        
                        {/* Contenido de la tarea */}
                        <div className="pl-2">
                          <div 
                            className="text-gray-700 leading-relaxed"
                            style={{
                              fontSize: '16px',
                              lineHeight: '1.6',
                              wordBreak: 'break-word'
                            }}
                            dangerouslySetInnerHTML={{ __html: nota || 'Sin contenido' }}
                          />
                        </div>

                        {/* Información adicional de la tarea */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex flex-wrap gap-4 text-sm">
                            {/* ID de Auditoría y Tipo */}
                            {auditoriaId && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <i className="fas fa-clipboard-list text-gray-400"></i>
                                <span className="font-medium">Auditoría ID:</span>
                                <span className="font-semibold text-slate-700">#{auditoriaId}</span>
                              </div>
                            )}
                            {tipoAuditoriaNombre && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <i className="fas fa-tag text-gray-400"></i>
                                <span className="font-medium">Tipo:</span>
                                <span className="font-semibold text-slate-700">{tipoAuditoriaNombre}</span>
                              </div>
                            )}
                            {tarea.scheduled_date && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <i className="fas fa-calendar-check text-gray-400"></i>
                                <span className="font-medium">Programada:</span>
                                <span>{formatDateForDisplay(tarea.scheduled_date)}</span>
                              </div>
                            )}
                            {tarea.due_date && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <i className={`fas fa-calendar-times ${tareaVencida ? "text-red-600" : "text-gray-400"}`}></i>
                                <span className="font-medium">Vence:</span>
                                <span className={tareaVencida ? "text-red-600 font-semibold" : ""}>
                                  {formatDateForDisplay(tarea.due_date)}
                                </span>
                              </div>
                            )}
                            {usuarioAsignado && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <i className="fas fa-user-check text-gray-400"></i>
                                <span className="font-medium">Asignada a:</span>
                                <span>{usuarioAsignado}</span>
                              </div>
                            )}
                            {estadoTarea && (
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  estadoTarea === "completed" 
                                    ? "bg-gray-100 text-gray-700"
                                    : estadoTarea === "pending"
                                    ? "bg-gray-50 text-gray-600"
                                    : estadoTarea === "in_progress"
                                    ? "bg-slate-50 text-slate-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}>
                                  {estadoTarea === "completed" ? "Completada" : 
                                   estadoTarea === "pending" ? "Pendiente" : 
                                   estadoTarea === "in_progress" ? "En progreso" : estadoTarea}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sección de comentarios de la tarea */}
                        {(() => {
                          const tareaId = tarea.id;
                          if (!tareaId) return null;

                          const comentariosTarea = comentariosTareas[tareaId] || [];
                          const estaExpandida = tareasExpandidas[tareaId];
                          const estaCargando = loadingComentariosTareas[tareaId];

                          return (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <button
                                type="button"
                                onClick={() => toggleComentariosTarea(tareaId)}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200"
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-comments text-gray-500"></i>
                                  <span className="font-semibold text-gray-700">
                                    Comentarios de la tarea
                                  </span>
                                  {comentariosTarea.length > 0 && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                      {comentariosTarea.length}
                                    </span>
                                  )}
                                  {tarea.comments_count > 0 && comentariosTarea.length === 0 && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                      {tarea.comments_count}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {estaCargando && (
                                    <Spinner animation="border" variant="primary" style={{ width: "1rem", height: "1rem" }} />
                                  )}
                                  <i className={`fas ${estaExpandida ? "fa-chevron-up" : "fa-chevron-down"} text-gray-400`}></i>
                                </div>
                              </button>

                              {estaExpandida && (
                                <div className="mt-3 space-y-3">
                                  {estaCargando ? (
                                    <div className="flex items-center justify-center py-4">
                                      <Spinner animation="border" variant="primary" style={{ width: "1rem", height: "1rem" }} />
                                      <span className="ml-2 text-sm text-gray-500">Cargando comentarios...</span>
                                    </div>
                                  ) : comentariosTarea.length > 0 ? (
                                    comentariosTarea.map((comentarioTarea) => {
                                      // Obtener adjuntos del comentario
                                      const adjuntos = comentarioTarea.attachments || comentarioTarea.adjuntos || [];
                                      
                                      return (
                                        <div
                                          key={comentarioTarea.id}
                                          className="bg-gray-50 border-l-4 border-slate-400 rounded-r-lg p-4 shadow-sm"
                                        >
                                          <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                <i className="fas fa-user text-gray-500 text-xs"></i>
                                              </div>
                                              <span className="font-medium text-gray-700 text-sm">
                                                {comentarioTarea.user?.name || comentarioTarea.user?.nombre || comentarioTarea.created_by?.name || "Usuario"}
                                              </span>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                              {formatFecha(comentarioTarea.created_at || comentarioTarea.fecha || comentarioTarea.createdAt)}
                                            </span>
                                          </div>
                                          <div 
                                            className="text-gray-700 text-sm mt-2 m-0"
                                            style={{
                                              fontSize: '14px',
                                              lineHeight: '1.5',
                                              wordBreak: 'break-word'
                                            }}
                                            dangerouslySetInnerHTML={{ 
                                              __html: highlightMentions(comentarioTarea.comment || comentarioTarea.response_note || comentarioTarea.note || "Sin contenido")
                                            }}
                                          />
                                          
                                          {/* Mostrar adjuntos del comentario */}
                                          {adjuntos.length > 0 && (
                                            <div className="mt-3">
                                              <div className="flex flex-wrap gap-2">
                                                {adjuntos.map((adjunto) => {
                                                  const esImg = esImagenAdjunto(adjunto);
                                                  const esPdf = esPDF(adjunto);
                                                  
                                                  return (
                                                    <div
                                                      key={adjunto.id || adjunto.url}
                                                      className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-slate-400 transition-all cursor-pointer"
                                                      style={{ width: "100px", height: "100px" }}
                                                      onClick={() => abrirPreview(adjunto)}
                                                      title="Haz clic para previsualizar"
                                                    >
                                                      {esImg ? (
                                                        <>
                                                          <img
                                                            src={adjunto.url}
                                                            alt={adjunto.nombre_original || adjunto.filename || "Imagen"}
                                                            className="w-full h-full object-cover"
                                                          />
                                                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                                                            <i className="fas fa-eye text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                                          </div>
                                                        </>
                                                      ) : esPdf ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                                          <i className="fas fa-file-pdf text-3xl text-gray-600 mb-1"></i>
                                                          <span className="text-xs text-gray-600 text-center px-1 truncate w-full">
                                                            {adjunto.nombre_original || adjunto.filename || "PDF"}
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                                          <i className="fas fa-file text-3xl text-gray-600 mb-1"></i>
                                                          <span className="text-xs text-gray-600 text-center px-1 truncate w-full">
                                                            {adjunto.nombre_original || adjunto.filename || "Archivo"}
                                                          </span>
                                                        </div>
                                                      )}
                                                      {/* Botón de descarga */}
                                                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            descargarArchivo(adjunto);
                                                          }}
                                                          className="bg-slate-600 hover:bg-slate-700 text-white rounded-full p-1 shadow-lg"
                                                          title="Descargar archivo"
                                                        >
                                                          <i className="fas fa-download text-xs"></i>
                                                        </button>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                      <i className="fas fa-comment-slash text-gray-400 mb-2"></i>
                                      <p className="m-0">No hay comentarios para esta tarea aún.</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Botón para ver/responder tarea */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => handleVerTarea(tarea)}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-slate-800 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
                          >
                            <i className="fas fa-eye text-xs"></i>
                            <span>Ver Detalles / Responder</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal para ver/responder tarea de auditoría */}
      {selectedTarea && (
        <ResponderTareaAuditoriaModal
          show={showModal}
          onHide={handleCloseModal}
          tarea={selectedTarea}
          onUpdated={handleTareaActualizada}
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
              "fa-file"
            }`}></i>
            <span>{archivoPreview?.adjunto?.nombre_original || archivoPreview?.adjunto?.filename || "Vista previa"}</span>
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
          {(archivoPreview?.tipo === "otro") && (
            <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
              <div className="text-center mb-4">
                <i className="fas fa-file text-secondary" style={{ fontSize: "5rem" }}></i>
                <h5 className="mt-3 mb-2">
                  {archivoPreview?.adjunto?.nombre_original || archivoPreview?.adjunto?.filename || "Archivo"}
                </h5>
                <p className="text-muted">
                  Este tipo de archivo no se puede previsualizar directamente.
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
    </>
  );
}
