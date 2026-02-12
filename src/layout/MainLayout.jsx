import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";
import apiRequest from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import NotificationsDropdown from "../components/Tareas/NotificationsDropdown";
import ResponderTareaModal from "../components/Tareas/ResponderTareaModal";
import ResponderTareaAuditoriaModal from "../components/Tareas/ResponderTareaAuditoriaModal";
import { getTask as getAuditoriaTask, listTasks as listAuditoriaTasks } from "../services/auditoriasTasksService";
import DateTimeDisplay from "../components/DateTimeDisplay";

const MainLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const sidebarRef = useRef(null);
  const navigate = useNavigate();
  
  // ✅ Estados para el modal de respuesta de tarea
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [showResponderAuditoriaModal, setShowResponderAuditoriaModal] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState(null);
  const [tareaTipo, setTareaTipo] = useState(null); // 'operativa' | 'auditoria'
  const [loadingTarea, setLoadingTarea] = useState(false);
  const [fromNotification, setFromNotification] = useState(false);
  
  // ✅ Obtener usuario actual para notificaciones
  const currentUser = React.useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (e) {
      console.error("Error obteniendo usuario actual:", e);
    }
    return null;
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (e) => {
    if (
      sidebarRef.current &&
      !sidebarRef.current.contains(e.target) &&
      isOpen
    ) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const fetchPendientes = async () => {
      try {
        const res = await apiRequest("tareas_operativas/pendientes", "GET");
        setPendientes(res.pendientes || 0);
      } catch (error) {
        console.warn("No se pudieron obtener tareas pendientes");
      }
    };
    fetchPendientes();
  }, []);

  // ✅ Función para cargar los detalles completos de una tarea
  const fetchTaskDetail = async (taskId) => {
    try {
      console.log("🔍 Obteniendo detalles de la tarea:", taskId);
      
      // Obtener los detalles completos de la tarea
      const taskDetail = await apiRequest(`tareas_operativas/${taskId}`, "GET");
      
      console.log("📦 Respuesta del backend (raw):", taskDetail);
      
      // Normalizar la estructura de la tarea (similar a TareasPendientesPanel)
      let normalizedTask = taskDetail?.data || taskDetail || {};
      
      // Si la respuesta está vacía o no tiene ID, intentar con otra estructura
      if (!normalizedTask.id && taskDetail) {
        // Intentar diferentes estructuras de respuesta
        if (taskDetail.id) {
          normalizedTask = taskDetail;
        } else if (taskDetail.task) {
          normalizedTask = taskDetail.task;
        }
      }
      
      // Verificar que tenemos al menos el ID
      if (!normalizedTask.id && !normalizedTask.task_id) {
        console.error("❌ La tarea no tiene ID:", normalizedTask);
        throw new Error("La tarea no tiene ID válido");
      }
      
      // Normalizar fechas (pueden venir con diferentes nombres)
      const scheduled_date = normalizedTask.scheduled_date || normalizedTask.scheduled_at || normalizedTask.fechaProgramada || null;
      const due_date = normalizedTask.due_date || normalizedTask.due_at || normalizedTask.fechaLimite || null;
      
      // Asegurar que el objeto tenga las fechas normalizadas
      normalizedTask.scheduled_date = scheduled_date;
      normalizedTask.due_date = due_date;
      
      // Si tiene log pero no tiene cliente completo, intentar obtenerlo
      if (normalizedTask.log) {
        // Si el log tiene ID pero no tiene cliente completo
        if (normalizedTask.log.id && (!normalizedTask.log.cliente || !normalizedTask.log.cliente.id)) {
          try {
            const logDetail = await apiRequest(`bitacora_operativa/${normalizedTask.log.id}`, "GET");
            if (logDetail?.cliente) {
              normalizedTask.log.cliente = logDetail.cliente;
            } else if (logDetail?.data?.cliente) {
              normalizedTask.log.cliente = logDetail.data.cliente;
            }
          } catch (e) {
            console.warn("⚠️ No se pudo obtener el cliente del log:", e);
          }
        }
        
        // Si el log tiene cliente_id pero no el objeto cliente completo
        if (normalizedTask.log.cliente_id && !normalizedTask.log.cliente?.id) {
          try {
            const clienteDetail = await apiRequest(`cliente/${normalizedTask.log.cliente_id}`, "GET");
            if (clienteDetail) {
              normalizedTask.log.cliente = clienteDetail.data || clienteDetail;
            }
          } catch (e) {
            console.warn("⚠️ No se pudo obtener el cliente:", e);
          }
        }
      } else if (normalizedTask.log_id || normalizedTask.bitacora_operativa_id) {
        // Si no tiene objeto log pero tiene log_id, intentar obtenerlo
        const logId = normalizedTask.log_id || normalizedTask.bitacora_operativa_id;
        try {
          const logDetail = await apiRequest(`bitacora_operativa/${logId}`, "GET");
          if (logDetail) {
            normalizedTask.log = logDetail.data || logDetail;
            if (normalizedTask.log?.cliente_id && !normalizedTask.log.cliente?.id) {
              try {
                const clienteDetail = await apiRequest(`cliente/${normalizedTask.log.cliente_id}`, "GET");
                if (clienteDetail) {
                  normalizedTask.log.cliente = clienteDetail.data || clienteDetail;
                }
              } catch (e) {
                console.warn("⚠️ No se pudo obtener el cliente del log:", e);
              }
            }
          }
        } catch (e) {
          console.warn("⚠️ No se pudo obtener el log:", e);
        }
      }
      
      // Log para debugging
      console.log("✅ Tarea normalizada:", {
        id: normalizedTask.id,
        tieneLog: !!normalizedTask.log,
        tieneCliente: !!normalizedTask.log?.cliente,
        clienteId: normalizedTask.log?.cliente?.id,
        status: normalizedTask.status
      });
      
      return normalizedTask;
    } catch (error) {
      console.error("❌ Error al cargar detalles de la tarea:", error);
      throw error;
    }
  };

  // ✅ Función para abrir el modal de respuesta con una tarea pendiente
  const openTaskResponseModal = async (taskId = null, isFromNotification = false) => {
    try {
      setLoadingTarea(true);
      
      // Si no se proporciona un taskId, obtener la primera tarea pendiente
      if (!taskId) {
        // Obtener tareas pendientes (estado pending, processing, in_progress)
        const pendientesRes = await apiRequest("tareas_operativas?per_page=1", "GET");
        let tareasPendientes = [];
        
        // Manejar diferentes estructuras de respuesta
        if (pendientesRes?.data?.data) {
          tareasPendientes = Array.isArray(pendientesRes.data.data) ? pendientesRes.data.data : [];
        } else if (pendientesRes?.data) {
          tareasPendientes = Array.isArray(pendientesRes.data) ? pendientesRes.data : [];
        } else if (Array.isArray(pendientesRes)) {
          tareasPendientes = pendientesRes;
        }
        
        // Filtrar solo tareas pendientes (pending, processing, in_progress)
        const estadosPendientes = ['pending', 'processing', 'in_progress'];
        tareasPendientes = tareasPendientes.filter(t => {
          const estado = t.status || t.estado || t.state;
          return estadosPendientes.includes(estado?.toLowerCase());
        });
        
        if (tareasPendientes.length === 0) {
          // No hay tareas pendientes, navegar a operaciones
          navigate('/Herramientas/operaciones');
          return;
        }
        
        // Obtener el ID de la primera tarea pendiente
        const primeraTarea = tareasPendientes[0];
        taskId = primeraTarea.id || primeraTarea.task_id || primeraTarea.task?.id;
        
        if (!taskId) {
          console.error("No se pudo obtener el ID de la tarea pendiente");
          navigate('/Herramientas/operaciones');
          return;
        }
      }
      
      // Cargar los detalles completos de la tarea
      const taskDetail = await fetchTaskDetail(taskId);
      
      // Validar que la tarea tenga los campos mínimos necesarios
      if (!taskDetail || (!taskDetail.id && !taskDetail.task_id)) {
        console.error("❌ La tarea no tiene ID válido:", taskDetail);
        navigate('/Herramientas/operaciones');
        return;
      }
      
      // Validar que tenga log y cliente (requerido para el modal)
      if (!taskDetail.log) {
        console.warn("⚠️ La tarea no tiene log asociado:", taskDetail);
        // Intentar obtener el log si tenemos log_id
        if (taskDetail.log_id || taskDetail.bitacora_operativa_id) {
          const logId = taskDetail.log_id || taskDetail.bitacora_operativa_id;
          try {
            const logDetail = await apiRequest(`bitacora_operativa/${logId}`, "GET");
            taskDetail.log = logDetail.data || logDetail;
          } catch (e) {
            console.error("❌ No se pudo obtener el log:", e);
          }
        }
      }
      
      if (!taskDetail.log?.cliente?.id) {
        console.warn("⚠️ La tarea no tiene cliente asociado:", taskDetail);
        // El modal puede funcionar sin cliente, pero es mejor tenerlo
        // Continuamos de todas formas
      }
      
      console.log("✅ Tarea validada y lista para el modal:", {
        id: taskDetail.id || taskDetail.task_id,
        tieneLog: !!taskDetail.log,
        tieneCliente: !!taskDetail.log?.cliente,
        clienteId: taskDetail.log?.cliente?.id,
        status: taskDetail.status
      });
      
      setSelectedTarea(taskDetail);
      setFromNotification(isFromNotification);
      setShowResponderModal(true);
    } catch (error) {
      console.error("Error al abrir modal de respuesta:", error);
      // En caso de error, navegar a operaciones
      navigate('/Herramientas/operaciones');
    } finally {
      setLoadingTarea(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div ref={sidebarRef}>
        <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />
      </div>
      <div className={`main-content ${isOpen ? "expanded" : "collapsed"}`}>
      <div className="topbar d-flex justify-content-between align-items-center gap-3 p-2">
        {/* Fecha y Hora */}
        <DateTimeDisplay />
        
        {/* ✅ Dropdown mejorado de notificaciones (reemplaza la campana simple) */}
        {/* Muestra tanto notificaciones de menciones como tareas pendientes */}
        <NotificationsDropdown 
          currentUser={currentUser}
          pendientes={pendientes}
          loadingTask={loadingTarea}
          onNotificationClick={async (notification) => {
            try {
              // ✅ Detectar si es una notificación de auditoría
              // El backend usa 'auditoria_task_id' (no 'audit_task_id')
              const isAuditoriaNotification = 
                notification.auditoria_task_id || 
                notification.audit_task_id ||  // Mantener compatibilidad
                notification.task_type === 'auditoria' ||
                notification.type === 'audit_task' ||
                notification.type === 'audit_mention' ||
                notification.audit_task ||
                notification.data?.auditoria_task_id ||
                notification.data?.audit_task_id ||
                notification.data?.task_type === 'auditoria' ||
                (notification.task && (notification.task.auditoria || notification.task.item || notification.task.run_id));
              
              // ✅ Función helper para cargar y abrir tarea de auditoría
              const abrirTareaAuditoria = async (taskId) => {
                try {
                  setLoadingTarea(true);
                  const tareaCompleta = await getAuditoriaTask(taskId);
                  const tarea = tareaCompleta?.data || tareaCompleta;
                  if (tarea) {
                    setSelectedTarea({ ...tarea, tipo: 'auditoria' });
                    setTareaTipo('auditoria');
                    setFromNotification(true);
                    setShowResponderAuditoriaModal(true);
                  } else {
                    throw new Error("No se pudo cargar la tarea de auditoría");
                  }
                } catch (error) {
                  console.error("Error al cargar tarea de auditoría:", error);
                  navigate('/Herramientas/operaciones');
                } finally {
                  setLoadingTarea(false);
                }
              };
              
              // Manejar según el tipo de notificación
              const mentionLikeTypes = ['mention', 'audit_mention', 'reply_on_mentioned_task', 'mention_reply'];

              if (mentionLikeTypes.includes(notification.type)) {
                // ✅ Obtener task_id - El backend usa 'auditoria_task_id' para auditorías
                let taskId = null;
                let commentId = null;
                
                // Determinar si es auditoría primero
                const esAuditoria = notification.auditoria_task_id || notification.audit_task_id;
                
                if (esAuditoria) {
                  // Es notificación de auditoría
                  taskId = notification.auditoria_task_id || notification.audit_task_id;
                  commentId = notification.auditoria_comment_id || notification.audit_comment_id;
                } else {
                  // Es notificación de tarea operativa
                  taskId = notification.task_id;
                  commentId = notification.comment_id;
                }
                
                // También buscar en campos alternativos
                if (!taskId) {
                  taskId = notification.data?.task_id || 
                          notification.data?.auditoria_task_id ||
                          notification.data?.audit_task_id ||
                          notification.metadata?.task_id ||
                          notification.metadata?.auditoria_task_id ||
                          notification.metadata?.audit_task_id;
                }
                
                // ✅ Si es notificación de auditoría y tenemos task_id, abrir directamente
                if (esAuditoria && taskId) {
                  await abrirTareaAuditoria(taskId);
                  return;
                }
                
                // ✅ Si es tarea operativa y tenemos task_id, abrir directamente
                if (!esAuditoria && taskId) {
                  openTaskResponseModal(taskId, true);
                  return;
                }
                
                // ✅ Si no hay task_id pero hay comment_id, buscar el task_id
                if (!taskId && commentId) {
                  console.log("🔍 Buscando task_id para comment_id:", commentId, "esAuditoria:", esAuditoria);
                  
                  // Para tareas operativas, buscar en comentarios
                  if (!esAuditoria) {
                    try {
                      const commentDetail = await apiRequest(`tareas_operativas/comentarios/${commentId}`, "GET");
                      taskId = commentDetail?.task_id || commentDetail?.tarea_id || commentDetail?.data?.task_id;
                      if (taskId) {
                        openTaskResponseModal(taskId, true);
                        return;
                      }
                    } catch (error) {
                      console.error("Error al obtener tarea del comentario:", error);
                    }
                  }
                  // Para tareas de auditoría, buscar en comentarios de auditoría
                  else {
                    try {
                      const { listTasks, getTaskComments } = await import("../services/auditoriasTasksService");
                      const auditoriaTasksResponse = await listTasks({ per_page: 100 });
                      const auditoriaTasks = auditoriaTasksResponse?.data || [];
                      
                      for (const tarea of auditoriaTasks) {
                        try {
                          const comentarios = await getTaskComments(tarea.id);
                          const comentariosArray = Array.isArray(comentarios) ? comentarios : (comentarios?.data || []);
                          
                          const comentarioEncontrado = comentariosArray.find(c => 
                            (c.id || c.comment_id) == commentId
                          );
                          
                          if (comentarioEncontrado) {
                            await abrirTareaAuditoria(tarea.id);
                            return;
                          }
                        } catch (comentariosError) {
                          continue;
                        }
                      }
                    } catch (auditError) {
                      console.warn("Error al buscar en tareas de auditoría:", auditError);
                    }
                  }
                }
                
                // ✅ Si hay link, intentar extraer task_id del link
                if (!taskId && notification.link) {
                  try {
                    const urlParams = new URLSearchParams(notification.link.split('?')[1] || '');
                    const taskIdFromLink = urlParams.get('task_id');
                    if (taskIdFromLink) {
                      const numericTaskId = parseInt(taskIdFromLink, 10);
                      if (!isNaN(numericTaskId) && numericTaskId > 0) {
                        // Determinar si es auditoría por el link
                        const esAuditoriaFromLink = notification.link.includes('/auditorias');
                        if (esAuditoriaFromLink) {
                          await abrirTareaAuditoria(numericTaskId);
                        } else {
                          openTaskResponseModal(numericTaskId, true);
                        }
                        return;
                      }
                    }
                  } catch (linkError) {
                    console.warn("Error al extraer task_id del link:", linkError);
                  }
                }
                
                // ✅ Si no hay task_id pero hay comment_id, obtener la tarea del comentario
                if (!taskId && notification.comment_id) {
                  try {
                    // ✅ Primero intentar buscar en tareas de auditoría si es notificación de auditoría
                    if (isAuditoriaNotification) {
                      try {
                        const auditoriaTasksResponse = await listAuditoriaTasks({ per_page: 100 });
                        const auditoriaTasks = auditoriaTasksResponse?.data || [];
                        
                        for (const tarea of auditoriaTasks) {
                          if (tarea.comments && Array.isArray(tarea.comments)) {
                            const comentarioEncontrado = tarea.comments.find(c => 
                              (c.id || c.comment_id) == notification.comment_id
                            );
                            if (comentarioEncontrado) {
                              await abrirTareaAuditoria(tarea.id);
                              return;
                            }
                          }
                        }
                      } catch (auditError) {
                        console.warn("Error al buscar en tareas de auditoría:", auditError);
                      }
                    }
                    
                    // Si no es auditoría o no se encontró, buscar en tareas operativas
                    const commentDetail = await apiRequest(`tareas_operativas/comentarios/${notification.comment_id}`, "GET");
                    taskId = commentDetail?.task_id || commentDetail?.tarea_id || commentDetail?.data?.task_id;
                  } catch (error) {
                    console.error("Error al obtener tarea del comentario:", error);
                  }
                }
                
                // Si tenemos task_id, abrir la tarea
                if (taskId) {
                  if (isAuditoriaNotification) {
                    await abrirTareaAuditoria(taskId);
                  } else {
                    openTaskResponseModal(taskId, true);
                  }
                } else {
                  console.warn("No se pudo obtener task_id de la notificación de mención:", notification);
                  // Navegar a operaciones como fallback
                  navigate('/Herramientas/operaciones');
                }
              } else if (notification.type === 'task_assigned' && (notification.task_id || notification.auditoria_task_id || notification.audit_task_id)) {
                const taskId = notification.auditoria_task_id || notification.audit_task_id || notification.task_id;
                const esAuditoria = !!(notification.auditoria_task_id || notification.audit_task_id);
                if (esAuditoria) {
                  await abrirTareaAuditoria(taskId);
                } else {
                  openTaskResponseModal(taskId, true);
                }
              } else if (notification.type === 'task_pending') {
                const taskId = notification.auditoria_task_id || notification.audit_task_id || notification.task_id;
                const esAuditoria = !!(notification.auditoria_task_id || notification.audit_task_id);
                if (taskId) {
                  if (esAuditoria) {
                    await abrirTareaAuditoria(taskId);
                  } else {
                    openTaskResponseModal(taskId, true);
                  }
                } else {
                  // Si no tiene task_id, abrir con la primera tarea pendiente
                  openTaskResponseModal(null, true);
                }
              } else if (notification.type === 'task' && (notification.task_id || notification.auditoria_task_id || notification.audit_task_id)) {
                const taskId = notification.auditoria_task_id || notification.audit_task_id || notification.task_id;
                const esAuditoria = !!(notification.auditoria_task_id || notification.audit_task_id);
                if (esAuditoria) {
                  await abrirTareaAuditoria(taskId);
                } else {
                  openTaskResponseModal(taskId, true);
                }
              } else if (notification.type === 'view_all') {
                // Ver todas las tareas - navegar a operaciones
                navigate('/Herramientas/operaciones');
              } else {
                // Por defecto, intentar abrir primera tarea pendiente
                if (pendientes > 0) {
                  openTaskResponseModal(null, true);
                } else {
                  navigate('/Herramientas/operaciones');
                }
              }
            } catch (error) {
              console.error("Error al procesar notificación:", error);
              navigate('/Herramientas/operaciones');
            }
          }}
        />
      </div>

        <div className="dashboard-content">{children}</div>
      </div>

      {/* ✅ Modal de respuesta de tarea operativa */}
      {selectedTarea && tareaTipo !== 'auditoria' && (
        <ResponderTareaModal
          show={showResponderModal}
          onHide={(updated) => {
            setShowResponderModal(false);
            setSelectedTarea(null);
            setTareaTipo(null);
            setFromNotification(false);
            // Actualizar contador de pendientes si se actualizó la tarea
            if (updated) {
              apiRequest("tareas_operativas/pendientes", "GET")
                .then((res) => setPendientes(res.pendientes || 0))
                .catch(() => {});
            }
          }}
          tarea={selectedTarea}
          fromNotification={fromNotification}
        />
      )}

      {/* ✅ Modal de respuesta de tarea de auditoría */}
      {selectedTarea && tareaTipo === 'auditoria' && (
        <ResponderTareaAuditoriaModal
          show={showResponderAuditoriaModal}
          onHide={() => {
            setShowResponderAuditoriaModal(false);
            setSelectedTarea(null);
            setTareaTipo(null);
            setFromNotification(false);
          }}
          tarea={selectedTarea}
          onUpdated={(tareaActualizada) => {
            // Actualizar la tarea en el estado
            setSelectedTarea(tareaActualizada);
          }}
        />
      )}
    </div>
  );
};

export default MainLayout;