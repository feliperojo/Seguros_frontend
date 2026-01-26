import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";
import apiRequest from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import NotificationsDropdown from "../components/Tareas/NotificationsDropdown";
import ResponderTareaModal from "../components/Tareas/ResponderTareaModal";

const MainLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const sidebarRef = useRef(null);
  const navigate = useNavigate();
  
  // ✅ Estados para el modal de respuesta de tarea
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState(null);
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
      <div className="topbar d-flex justify-content-end align-items-center gap-3 p-2">
        {/* ✅ Dropdown mejorado de notificaciones (reemplaza la campana simple) */}
        {/* Muestra tanto notificaciones de menciones como tareas pendientes */}
        <NotificationsDropdown 
          currentUser={currentUser}
          pendientes={pendientes}
          loadingTask={loadingTarea}
          onNotificationClick={async (notification) => {
            // Manejar según el tipo de notificación
            if (notification.type === 'mention') {
              let taskId = notification.task_id;
              
              // ✅ Si no hay task_id pero hay comment_id, obtener la tarea del comentario
              if (!taskId && notification.comment_id) {
                try {
                  const commentDetail = await apiRequest(`tareas_operativas/comentarios/${notification.comment_id}`, "GET");
                  taskId = commentDetail?.task_id || commentDetail?.tarea_id || commentDetail?.data?.task_id;
                } catch (error) {
                  console.error("Error al obtener tarea del comentario:", error);
                }
              }
              
              // Si tenemos task_id, abrir la tarea
              if (taskId) {
                openTaskResponseModal(taskId, true);
              } else {
                console.warn("No se pudo obtener task_id de la notificación de mención:", notification);
                // Navegar a operaciones como fallback
                navigate('/Herramientas/operaciones');
              }
            } else if (notification.type === 'task_assigned' && notification.task_id) {
              // Abrir modal de respuesta con la tarea asignada
              openTaskResponseModal(notification.task_id, true);
            } else if (notification.type === 'task_pending') {
              // ✅ Abrir modal de respuesta con la tarea específica si tiene task_id
              if (notification.task_id) {
                openTaskResponseModal(notification.task_id, true);
              } else {
                // Si no tiene task_id, abrir con la primera tarea pendiente
                openTaskResponseModal(null, true);
              }
            } else if (notification.type === 'task' && notification.task_id) {
              // Abrir modal de respuesta con la tarea
              openTaskResponseModal(notification.task_id, true);
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
          }}
        />
      </div>

        <div className="dashboard-content">{children}</div>
      </div>

      {/* ✅ Modal de respuesta de tarea */}
      {selectedTarea && (
        <ResponderTareaModal
          show={showResponderModal}
          onHide={(updated) => {
            setShowResponderModal(false);
            setSelectedTarea(null);
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
    </div>
  );
};

export default MainLayout;