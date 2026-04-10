import React, { useState, useEffect } from "react";
import { Card, Badge, Button, Toast, ToastContainer, Modal, ListGroup, Tooltip, OverlayTrigger } from "react-bootstrap";
import { FaPlus, FaChartBar, FaChevronLeft, FaChevronRight, FaCalendarAlt, FaUser, FaCalendarCheck, FaTasks, FaAt, FaClipboardCheck } from "react-icons/fa";
import apiRequest from "../../services/api";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import ResponderTareaModal from "../Tareas/ResponderTareaModal";
import ResponderTareaAuditoriaModal from "../Tareas/ResponderTareaAuditoriaModal";
import ResumenTareasModal from "../Tareas/ResumenTareasModal";
import NotificationsDropdown from "../Tareas/NotificationsDropdown";
import { useHasPermission } from "../../hooks/useHasPermission";
import { isUserMentioned } from "../../utils/mentions";
import { listTasks as listAuditoriaTasks, getTask as getAuditoriaTask } from "../../services/auditoriasTasksService";
import { parseApiDateToLocalDate, formatDateToYmd } from "../../utils/formatters";

function getListFromApi(res) {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.tasks)) return res.data.tasks;
  if (Array.isArray(res?.tasks)) return res.tasks;
  return [];
}

function normalizeOperativaLite(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const t = { ...raw };

  t.id = t.id ?? t.task_id ?? t.task?.id;
  t.status = t.status ?? t.estado ?? t.state ?? t.task?.status ?? t.task?.estado ?? "pending";
  t.scheduled_date =
    t.scheduled_date ??
    t.scheduled_at ??
    t.fechaProgramada ??
    t.task?.scheduled_date ??
    t.task?.scheduled_at ??
    null;
  t.due_date =
    t.due_date ??
    t.due_at ??
    t.fechaLimite ??
    t.task?.due_date ??
    t.task?.due_at ??
    null;

  // Compatibilidad con nueva estructura donde `cliente` viene directo en la respuesta
  if (t.cliente?.id) {
    t.log = t.log || {};
    t.log.cliente = t.log.cliente || {
      id: t.cliente.id,
      nombre_completo: t.cliente.nombre_completo || t.cliente.nombre || "Cliente",
      telefono: t.cliente.telefono || "",
      estado_cliente: t.cliente.estado_cliente || "cliente",
    };
  }

  return t;
}

const CalendarioTareas = ({ tareas: tareasIniciales, currentUser }) => {

  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [añoActual, setAñoActual] = useState(hoy.getFullYear());

  const [tareas, setTareas] = useState(Array.isArray(tareasIniciales) ? tareasIniciales : []);
  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [showResponderAuditoriaModal, setShowResponderAuditoriaModal] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);
  const [tareaTipo, setTareaTipo] = useState(null); // 'operativa' | 'auditoria'
  const [showResumen, setShowResumen] = useState(false);
  const [fechaResumen, setFechaResumen] = useState(new Date());

  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [tareasDetalle, setTareasDetalle] = useState([]);

  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  // ✅ Estados para notificaciones y modal de respuesta
  const [pendientes, setPendientes] = useState(0);
  const [loadingTarea, setLoadingTarea] = useState(false);
  const [fromNotification, setFromNotification] = useState(false);

  const diasSemana = ["L", "M", "X", "J", "V", "S", "D"];
  const diasEnMes = new Date(añoActual, mesActual + 1, 0).getDate();
  const primerDiaSemana = new Date(añoActual, mesActual, 1).getDay();
  const offsetInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(currentUser?.id || null);

  const [usuarios, setUsuarios] = useState([]); // Lista de usuarios

  // Verificar permiso para ver usuarios
  const canViewUsers = useHasPermission("users.view");

  // ✅ Cargar contador de tareas pendientes
  useEffect(() => {
    const fetchPendientes = async () => {
      try {
        const res = await apiRequest("tareas_operativas/pendientes", "GET");
        setPendientes(res.pendientes || 0);
      } catch (error) {
        console.warn("No se pudieron obtener tareas pendientes en calendario:", error);
        setPendientes(0);
      }
    };
    fetchPendientes();
    
    // Refrescar cada 30 segundos
    const interval = setInterval(() => {
      fetchPendientes();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const nombreMes = new Date(añoActual, mesActual).toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  });

  // ✅ Función para cargar los detalles completos de una tarea
  const fetchTaskDetail = async (taskId) => {
    try {
      console.log("🔍 Obteniendo detalles de la tarea:", taskId);
      
      // ✅ NUEVO: Priorizar el endpoint directo /api/tareas_operativas/{id}
      let taskDetail = null;
      
      try {
        // ✅ Opción 1: Usar el nuevo endpoint directo (primera opción)
        try {
          const directResponse = await apiRequest(`tareas_operativas/${taskId}`, "GET");
          console.log("✅ Respuesta del endpoint directo:", directResponse);
          
          // Normalizar estructura de respuesta
          if (directResponse?.data) {
            taskDetail = directResponse.data;
          } else if (directResponse?.task) {
            taskDetail = directResponse.task;
          } else if (directResponse?.id || directResponse?.task_id) {
            taskDetail = directResponse;
          } else {
            // Si la respuesta no tiene estructura esperada, usar el objeto completo
            taskDetail = directResponse || {};
          }
          
          console.log("✅ Tarea obtenida del endpoint directo:", taskDetail?.id || taskDetail?.task_id);
        } catch (directError) {
          console.warn("⚠️ Error con endpoint directo, intentando fallbacks:", directError);
          
          // ✅ Opción 2: Buscar en las tareas ya cargadas (cache)
          const tareaEnCache = tareas.find(t => (t.id || t.task_id) === taskId);
          if (tareaEnCache) {
            console.log("✅ Tarea encontrada en cache");
            taskDetail = tareaEnCache;
          } else {
            // ✅ Opción 3: Obtener desde el endpoint de lista y buscar por ID
            const response = await apiRequest(`tareas_operativas?per_page=100`, "GET");
            
            let tareasData = [];
            if (response?.data?.data) {
              tareasData = Array.isArray(response.data.data) ? response.data.data : [];
            } else if (response?.data) {
              tareasData = Array.isArray(response.data) ? response.data : [];
            } else if (Array.isArray(response)) {
              tareasData = response;
            }
            
            // Buscar la tarea por ID
            taskDetail = tareasData.find(t => (t.id || t.task_id) === taskId);
            
            if (!taskDetail) {
              throw new Error(`No se encontró la tarea con ID ${taskId} en ninguna fuente`);
            }
          }
        }
      } catch (error) {
        console.error("❌ Error al obtener tarea:", error);
        throw new Error(`No se pudo obtener la tarea ${taskId}: ${error.message}`);
      }
      
      if (!taskDetail) {
        throw new Error(`No se encontró la tarea con ID ${taskId}`);
      }
      
      console.log("📦 Respuesta del backend (raw):", taskDetail);
      
      // Normalizar la estructura de la tarea
      let normalizedTask = taskDetail?.data || taskDetail || {};
      
      // Si la respuesta está vacía o no tiene ID, intentar con otra estructura
      if (!normalizedTask.id && taskDetail) {
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
      
      // Normalizar fechas
      const scheduled_date = normalizedTask.scheduled_date || normalizedTask.scheduled_at || normalizedTask.fechaProgramada || null;
      const due_date = normalizedTask.due_date || normalizedTask.due_at || normalizedTask.fechaLimite || null;
      
      normalizedTask.scheduled_date = scheduled_date;
      normalizedTask.due_date = due_date;
      
      // Normalizar estado
      normalizedTask.status = normalizedTask.status || normalizedTask.estado || 'pending';
      
      // ✅ Normalizar cliente si viene directamente en la nueva estructura
      if (normalizedTask.cliente && normalizedTask.cliente.id) {
        console.log("✅ Cliente encontrado directamente en la respuesta:", normalizedTask.cliente.id);
        
        // Inicializar log si no existe
        if (!normalizedTask.log) {
          normalizedTask.log = {};
        }
        
        // Normalizar estructura del cliente para compatibilidad con el modal
        const clienteData = normalizedTask.cliente;
        
        // Extraer teléfono principal del array de telefonos
        let telefonoPrincipal = "";
        if (clienteData.telefonos && Array.isArray(clienteData.telefonos) && clienteData.telefonos.length > 0) {
          const telefonoPrincipalObj = clienteData.telefonos.find(t => t.principal) || clienteData.telefonos[0];
          if (telefonoPrincipalObj) {
            // Formatear teléfono: incluir indicativo si existe
            const indicativo = telefonoPrincipalObj.indicativo ? `+${telefonoPrincipalObj.indicativo} ` : "";
            telefonoPrincipal = `${indicativo}${telefonoPrincipalObj.numero || ""}`.trim();
          }
        }
        
        normalizedTask.log.cliente = {
          id: clienteData.id,
          nombre_completo: clienteData.nombre_completo || 'Cliente',
          telefono: telefonoPrincipal || clienteData.telefono || "",
          estado_cliente: clienteData.estado_cliente || 'cliente',
          email: clienteData.email || null,
          // Mantener array de telefonos si es necesario para otras funcionalidades
          telefonos: clienteData.telefonos || []
        };
        
        console.log("✅ Cliente normalizado:", {
          id: normalizedTask.log.cliente.id,
          nombre: normalizedTask.log.cliente.nombre_completo,
          telefono: normalizedTask.log.cliente.telefono
        });
      }
      
      // Normalizar comentarios si vienen en la nueva estructura
      if (normalizedTask.comentarios && Array.isArray(normalizedTask.comentarios)) {
        // Los comentarios ya vienen en la estructura correcta
        normalizedTask.comments = normalizedTask.comentarios.map(c => ({
          id: c.id,
          comment: c.comment || '',
          user: c.user || 'Usuario',
          fecha: c.fecha || c.created_at,
          adjuntos: c.adjuntos || []
        }));
      }
      
      // ✅ Normalizar concepto para log si viene en la nueva estructura
      if (normalizedTask.concepto && !normalizedTask.log?.concept) {
        if (!normalizedTask.log) {
          normalizedTask.log = {};
        }
        normalizedTask.log.concept = {
          name: normalizedTask.concepto
        };
      }
      
      // ✅ Normalizar nota para log si viene en la nueva estructura
      if (normalizedTask.nota && !normalizedTask.log?.note) {
        if (!normalizedTask.log) {
          normalizedTask.log = {};
        }
        normalizedTask.log.note = normalizedTask.nota;
      }
      
      // ✅ Normalizar usuario creador para log si viene en la nueva estructura
      if (normalizedTask.creado_por && !normalizedTask.log?.user) {
        if (!normalizedTask.log) {
          normalizedTask.log = {};
        }
        normalizedTask.log.user = {
          name: normalizedTask.creado_por
        };
      }
      
      // ✅ Si la nueva estructura NO tiene log.cliente, intentar obtenerlo desde múltiples fuentes
      if (!normalizedTask.log || !normalizedTask.log.cliente || !normalizedTask.log.cliente.id) {
        console.log("🔍 Buscando log y cliente para la tarea...");
        
        // Opción 1: Buscar log_id o bitacora_operativa_id en la respuesta directa
        if (normalizedTask.log_id || normalizedTask.bitacora_operativa_id) {
          const logId = normalizedTask.log_id || normalizedTask.bitacora_operativa_id;
          console.log("📋 Encontrado log_id en tarea:", logId);
          try {
            const logDetail = await apiRequest(`bitacora_operativa/${logId}`, "GET");
            if (logDetail) {
              const logData = logDetail.data || logDetail;
              normalizedTask.log = {
                ...(normalizedTask.log || {}),
                ...logData,
                cliente: logData.cliente || normalizedTask.log?.cliente
              };
              
              // Si el log tiene cliente_id pero no cliente, obtenerlo
              if (normalizedTask.log.cliente_id && !normalizedTask.log.cliente?.id) {
                try {
                  const clienteDetail = await apiRequest(`cliente/${normalizedTask.log.cliente_id}`, "GET");
                  if (clienteDetail) {
                    normalizedTask.log.cliente = clienteDetail.data || clienteDetail;
                    console.log("✅ Cliente obtenido desde log_id:", normalizedTask.log.cliente.id);
                  }
                } catch (e) {
                  console.warn("⚠️ No se pudo obtener el cliente del log_id:", e);
                }
              }
            }
          } catch (e) {
            console.warn("⚠️ No se pudo obtener el log desde log_id:", e);
          }
        }
        
        // Opción 2: Si no tiene log_id, buscar en tareas ya cargadas (cache) que puedan tener el log completo
        if ((!normalizedTask.log || !normalizedTask.log.cliente?.id) && tareas.length > 0) {
          console.log("🔍 Buscando log en tareas cargadas (cache)...");
          const tareaEnCache = tareas.find(t => (t.id || t.task_id) === normalizedTask.id);
          if (tareaEnCache && tareaEnCache.log && tareaEnCache.log.cliente && tareaEnCache.log.cliente.id) {
            console.log("✅ Log encontrado en cache de tareas");
            normalizedTask.log = {
              ...(normalizedTask.log || {}),
              ...tareaEnCache.log,
              cliente: tareaEnCache.log.cliente
            };
          }
        }
        
        // Opción 3: Si aún no tiene log, buscar en lista completa de tareas
        if (!normalizedTask.log || !normalizedTask.log.cliente?.id) {
          try {
            console.log("🔍 Buscando log en lista completa de tareas...");
            const allTasksResponse = await apiRequest(`tareas_operativas?per_page=100`, "GET");
            let allTasks = [];
            
            if (allTasksResponse?.data?.data) {
              allTasks = Array.isArray(allTasksResponse.data.data) ? allTasksResponse.data.data : [];
            } else if (allTasksResponse?.data) {
              allTasks = Array.isArray(allTasksResponse.data) ? allTasksResponse.data : [];
            } else if (Array.isArray(allTasksResponse)) {
              allTasks = allTasksResponse;
            }
            
            // Buscar la misma tarea en la lista que pueda tener el log completo
            const tareaEnLista = allTasks.find(t => (t.id || t.task_id) === normalizedTask.id);
            if (tareaEnLista && tareaEnLista.log && tareaEnLista.log.cliente && tareaEnLista.log.cliente.id) {
              console.log("✅ Log encontrado en lista completa de tareas");
              normalizedTask.log = {
                ...(normalizedTask.log || {}),
                ...tareaEnLista.log,
                cliente: tareaEnLista.log.cliente
              };
            } else if (tareaEnLista && (tareaEnLista.log_id || tareaEnLista.bitacora_operativa_id)) {
              // Si la tarea en la lista tiene log_id, usarlo
              const logId = tareaEnLista.log_id || tareaEnLista.bitacora_operativa_id;
              try {
                const logDetail = await apiRequest(`bitacora_operativa/${logId}`, "GET");
                if (logDetail) {
                  const logData = logDetail.data || logDetail;
                  normalizedTask.log = {
                    ...(normalizedTask.log || {}),
                    ...logData,
                    cliente: logData.cliente || normalizedTask.log?.cliente
                  };
                  
                  if (normalizedTask.log.cliente_id && !normalizedTask.log.cliente?.id) {
                    try {
                      const clienteDetail = await apiRequest(`cliente/${normalizedTask.log.cliente_id}`, "GET");
                      if (clienteDetail) {
                        normalizedTask.log.cliente = clienteDetail.data || clienteDetail;
                        console.log("✅ Cliente obtenido desde log de lista:", normalizedTask.log.cliente.id);
                      }
                    } catch (e) {
                      console.warn("⚠️ No se pudo obtener el cliente:", e);
                    }
                  }
                }
              } catch (e) {
                console.warn("⚠️ No se pudo obtener el log desde lista:", e);
              }
            }
          } catch (e) {
            console.warn("⚠️ Error al buscar en lista completa:", e);
          }
        }
        
        // Opción 4: Intentar buscar cliente_id directamente en la tarea
        if (!normalizedTask.log?.cliente?.id) {
          const clienteId = normalizedTask.cliente_id || normalizedTask.log?.cliente_id;
          if (clienteId) {
            console.log("🔍 Encontrado cliente_id directo en tarea:", clienteId);
            try {
              const clienteDetail = await apiRequest(`cliente/${clienteId}`, "GET");
              if (clienteDetail) {
                if (!normalizedTask.log) {
                  normalizedTask.log = {};
                }
                normalizedTask.log.cliente = clienteDetail.data || clienteDetail;
                console.log("✅ Cliente obtenido directamente:", normalizedTask.log.cliente.id);
              }
            } catch (e) {
              console.warn("⚠️ No se pudo obtener el cliente directamente:", e);
            }
          }
        }
      } else {
        // Si ya tiene log pero no cliente completo, intentar obtenerlo
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
      }
      
      // ✅ Crear estructura mínima solo si realmente no hay cliente (para evitar errores)
      if (!normalizedTask.log) {
        normalizedTask.log = {};
      }
      
      // Solo crear cliente ficticio si realmente no se pudo obtener (id === null)
      if (!normalizedTask.log.cliente || !normalizedTask.log.cliente.id) {
        console.warn("⚠️ La tarea no tiene cliente asociado después de buscar en todas las fuentes");
        // No crear cliente ficticio aquí, dejar que el modal maneje la ausencia
        // El modal ya tiene protecciones con optional chaining
      }
      
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

  // ✅ Función para abrir el modal de respuesta con una tarea
  const openTaskResponseModal = async (taskId = null, isFromNotification = false) => {
    try {
      setLoadingTarea(true);
      
      // Si no se proporciona un taskId, obtener la primera tarea pendiente
      if (!taskId) {
        const pendientesRes = await apiRequest("tareas_operativas?per_page=1", "GET");
        let tareasPendientes = [];
        
        if (pendientesRes?.data?.data) {
          tareasPendientes = Array.isArray(pendientesRes.data.data) ? pendientesRes.data.data : [];
        } else if (pendientesRes?.data) {
          tareasPendientes = Array.isArray(pendientesRes.data) ? pendientesRes.data : [];
        } else if (Array.isArray(pendientesRes)) {
          tareasPendientes = pendientesRes;
        }
        
        const estadosPendientes = ['pending', 'processing', 'in_progress'];
        tareasPendientes = tareasPendientes.filter(t => {
          const estado = t.status || t.estado || t.state;
          return estadosPendientes.includes(estado?.toLowerCase());
        });
        
        if (tareasPendientes.length === 0) {
          setToast({ show: true, message: "No hay tareas pendientes para abrir.", variant: "info" });
          return;
        }
        
        const primeraTarea = tareasPendientes[0];
        taskId = primeraTarea.id || primeraTarea.task_id || primeraTarea.task?.id;
        
        if (!taskId) {
          console.error("No se pudo obtener el ID de la tarea pendiente");
          setToast({ show: true, message: "Error: No se pudo identificar la tarea.", variant: "danger" });
          return;
        }
      }
      
      // Cargar los detalles completos de la tarea
      const taskDetail = await fetchTaskDetail(taskId);
      
      // Validar que la tarea tenga los campos mínimos necesarios
      if (!taskDetail || (!taskDetail.id && !taskDetail.task_id)) {
        console.error("❌ La tarea no tiene ID válido:", taskDetail);
        setToast({ show: true, message: "Error: La tarea no tiene un ID válido.", variant: "danger" });
        return;
      }
      
      // Validar que tenga log y cliente (requerido para el modal)
      if (!taskDetail.log) {
        console.warn("⚠️ La tarea no tiene log asociado:", taskDetail);
        if (taskDetail.log_id || taskDetail.bitacora_operativa_id) {
          const logId = taskDetail.log_id || taskDetail.bitacora_operativa_id;
          try {
            const logDetail = await apiRequest(`bitacora_operativa/${logId}`, "GET");
            taskDetail.log = logDetail.data || logDetail;
            if (taskDetail.log?.cliente_id && !taskDetail.log.cliente?.id) {
              try {
                const clienteDetail = await apiRequest(`cliente/${taskDetail.log.cliente_id}`, "GET");
                if (clienteDetail) {
                  taskDetail.log.cliente = clienteDetail;
                }
              } catch (e) {
                console.warn("No se pudo obtener el cliente del log_id:", e);
              }
            }
          } catch (e) {
            console.warn("No se pudo obtener el log completo:", e);
          }
        }
      }
      
      if (!taskDetail.log?.cliente) {
        console.warn("⚠️ La tarea no tiene cliente asociado en el log:", taskDetail);
        if (taskDetail.log?.cliente_id) {
          try {
            const clienteDetail = await apiRequest(`cliente/${taskDetail.log.cliente_id}`, "GET");
            if (clienteDetail) {
              taskDetail.log.cliente = clienteDetail;
            }
          } catch (e) {
            console.warn("No se pudo obtener el cliente directamente:", e);
          }
        }
      }
      
      console.log("✅ Tarea validada y lista para el modal:", {
        id: taskDetail.id || taskDetail.task_id,
        tieneLog: !!taskDetail.log,
        tieneCliente: !!taskDetail.log?.cliente,
        clienteId: taskDetail.log?.cliente?.id,
        status: taskDetail.status
      });
      
      // ✅ Navegar a la fecha de la tarea en el calendario si tiene fecha programada
      if (taskDetail.scheduled_date || taskDetail.due_date) {
        const fechaTarea = taskDetail.scheduled_date || taskDetail.due_date;
        const fecha = parseApiDateToLocalDate(fechaTarea);
        if (!fecha) return;
        
        if (!isNaN(fecha.getTime())) {
          const mesTarea = fecha.getMonth();
          const añoTarea = fecha.getFullYear();
          
          // Si la tarea está en otro mes, cambiar el mes/año del calendario
          if (mesTarea !== mesActual || añoTarea !== añoActual) {
            setMesActual(mesTarea);
            setAñoActual(añoTarea);
            
            // Esperar un momento para que el calendario se actualice antes de hacer scroll
            setTimeout(() => {
              scrollToTaskDate(fecha.getDate());
            }, 300);
          } else {
            // Si está en el mes actual, hacer scroll inmediatamente
            setTimeout(() => {
              scrollToTaskDate(fecha.getDate());
            }, 100);
          }
        }
      }
      
      setTareaSeleccionada(taskDetail);
      setFromNotification(isFromNotification);
      setShowResponderModal(true);
    } catch (error) {
      console.error("Error al abrir modal de respuesta:", error);
      setToast({ show: true, message: "Error al abrir la tarea. Intente de nuevo.", variant: "danger" });
    } finally {
      setLoadingTarea(false);
    }
  };

  const abrirResponderTarea = async (tarea, isFromNotification = false) => {
    if (!tarea) return;
    
    // ✅ Determinar el tipo de tarea (operativa o auditoría)
    const tipo = tarea.tipo || (tarea.auditoria || tarea.item || tarea.run_id ? 'auditoria' : 'operativa');
    
    // ✅ Si es tarea de auditoría, cargar detalles completos
    if (tipo === 'auditoria' && tarea.id) {
      try {
        setLoadingTarea(true);
        const tareaCompleta = await getAuditoriaTask(tarea.id);
        tarea = tareaCompleta?.data || tareaCompleta || tarea;
      } catch (error) {
        console.warn("Error al cargar detalles de tarea de auditoría:", error);
        // Continuar con la tarea que tenemos
      } finally {
        setLoadingTarea(false);
      }
    }
    
    // ✅ Si la tarea tiene fecha programada, navegar a ese mes/año en el calendario
    if (tarea.scheduled_date || tarea.due_date) {
      const fechaTarea = tarea.scheduled_date || tarea.due_date;
      const fecha = parseApiDateToLocalDate(fechaTarea);
      if (!fecha) return;
      
      if (!isNaN(fecha.getTime())) {
        const mesTarea = fecha.getMonth();
        const añoTarea = fecha.getFullYear();
        
        // Si la tarea está en otro mes, cambiar el mes/año del calendario
        if (mesTarea !== mesActual || añoTarea !== añoActual) {
          setMesActual(mesTarea);
          setAñoActual(añoTarea);
          
          // Esperar un momento para que el calendario se actualice antes de hacer scroll
          setTimeout(() => {
            scrollToTaskDate(fecha.getDate());
          }, 100);
        } else {
          // Si está en el mes actual, hacer scroll inmediatamente
          scrollToTaskDate(fecha.getDate());
        }
      }
    }
    
    setTareaSeleccionada(tarea);
    setTareaTipo(tipo);
    setFromNotification(isFromNotification);
    
    // ✅ Abrir el modal correcto según el tipo
    if (tipo === 'auditoria') {
      setShowResponderAuditoriaModal(true);
    } else {
      setShowResponderModal(true);
    }
  };

  // ✅ Función para hacer scroll a la fecha de una tarea en el calendario
  const scrollToTaskDate = (dia) => {
    try {
      // Buscar el elemento del día usando data attributes para mayor precisión
      const dayCard = document.querySelector(
        `.calendar-day-card[data-day="${dia}"][data-month="${mesActual}"][data-year="${añoActual}"]`
      );
      
      if (dayCard) {
        // Hacer scroll suave al elemento
        dayCard.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // Resaltar brevemente el día
        const originalBg = dayCard.style.backgroundColor;
        const originalBorder = dayCard.style.border;
        
        dayCard.style.transition = 'all 0.3s ease';
        dayCard.style.backgroundColor = '#fff3cd';
        dayCard.style.border = '3px solid #ffc107';
        dayCard.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.4)';
        
        setTimeout(() => {
          dayCard.style.backgroundColor = originalBg || '';
          dayCard.style.border = originalBorder || '';
          dayCard.style.boxShadow = '';
        }, 2500);
      } else {
        // Fallback: buscar por el número del día
        const dayCards = document.querySelectorAll('.calendar-day-card');
        dayCards.forEach((card) => {
          const dayNumber = card.querySelector('strong');
          if (dayNumber && parseInt(dayNumber.textContent.trim()) === dia) {
            card.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            
            const originalBg = card.style.backgroundColor;
            const originalBorder = card.style.border;
            
            card.style.transition = 'all 0.3s ease';
            card.style.backgroundColor = '#fff3cd';
            card.style.border = '3px solid #ffc107';
            card.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.4)';
            
            setTimeout(() => {
              card.style.backgroundColor = originalBg || '';
              card.style.border = originalBorder || '';
              card.style.boxShadow = '';
            }, 2500);
            return;
          }
        });
      }
    } catch (error) {
      console.warn("No se pudo hacer scroll a la fecha de la tarea:", error);
    }
  };

  const abrirDetalleDia = (lista) => {
    if (!Array.isArray(lista)) return;
    setTareasDetalle(lista);
    setShowDetalleModal(true);
  };

  const onCreated = (nuevaTarea) => {
    if (!nuevaTarea) return;
    setTareas((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      return [...prevArray, nuevaTarea];
    });
    setToast({ show: true, message: "✅ Nueva tarea agregada", variant: "success" });
  };

  const onUpdated = (tareaActualizada) => {
    if (!tareaActualizada || !tareaActualizada.id) {
      console.warn("⚠️ onUpdated llamado sin tarea válida:", tareaActualizada);
      return;
    }
    
    // ✅ Log de depuración
    if (import.meta.env.DEV) {
      console.log("🔄 [CalendarioTareas] Actualizando tarea:", {
        id: tareaActualizada.id,
        estado: tareaActualizada.status,
        tarea_completa: tareaActualizada
      });
    }
    
    setTareas((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      const actualizado = prevArray.map((t) => {
        // ✅ Buscar por múltiples campos de ID para asegurar que se encuentre la tarea
        const tId = t?.id || t?.task_id || t?.tarea_id;
        const actualizadaId = tareaActualizada?.id || tareaActualizada?.task_id || tareaActualizada?.tarea_id;
        
        if (t && tId && actualizadaId && tId === actualizadaId) {
          // ✅ Asegurar que el estado se actualice correctamente
          return {
            ...t,
            ...tareaActualizada,
            status: tareaActualizada.status || t.status
          };
        }
        return t;
      });
      
      // ✅ Log de depuración del resultado
      if (import.meta.env.DEV) {
        const encontrada = actualizado.find(t => {
          const tId = t?.id || t?.task_id || t?.tarea_id;
          const actualizadaId = tareaActualizada?.id || tareaActualizada?.task_id || tareaActualizada?.tarea_id;
          return tId === actualizadaId;
        });
        console.log("🔄 [CalendarioTareas] Tarea actualizada en el estado:", {
          encontrada: !!encontrada,
          estado_final: encontrada?.status,
          total_tareas: actualizado.length
        });
      }
      
      // ✅ Si se cambió el usuario asignado y estamos filtrando por asignación (no menciones),
      // removemos la tarea del estado local si ya no pertenece al usuario actual del calendario.
      try {
        const updatedTaskId = tareaActualizada?.id || tareaActualizada?.task_id || tareaActualizada?.tarea_id;
        const updatedAssignedId =
          tareaActualizada?.assigned_user_id ||
          tareaActualizada?.assign_to_user_id ||
          tareaActualizada?.assigned_user?.id ||
          tareaActualizada?.assign_to_user?.id ||
          tareaActualizada?.log?.assigned_user?.id ||
          tareaActualizada?.log?.assign_to_user?.id;

        if (!filtroMenciones && updatedTaskId && updatedAssignedId && usuarioSeleccionado) {
          if (String(updatedAssignedId) !== String(usuarioSeleccionado)) {
            return actualizado.filter((t) => {
              const tId = t?.id || t?.task_id || t?.tarea_id;
              return String(tId) !== String(updatedTaskId);
            });
          }
        }
      } catch {
        // No bloqueamos si falla el cálculo
      }
      
      return actualizado;
    });
    
    setToast({ show: true, message: "✅ Tarea actualizada", variant: "info" });
  };

  const obtenerTodasTareasDelDia = (dia) => {
    if (!Array.isArray(tareas)) return [];
    return tareas.filter((t) => {
      if (!t) return false;
      // Usar scheduled_date primero, luego due_date, luego created_at
      const fechaStr = t.scheduled_date || t.due_date || t.created_at;
      if (!fechaStr) return false;
      
      const fecha = parseApiDateToLocalDate(fechaStr);
      if (!fecha) return false;
      
      if (isNaN(fecha.getTime())) return false;
      return fecha.getDate() === dia && fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    });
  };

  React.useEffect(() => {
    const fetchUsuarios = async () => {
      // Si no tiene permiso para ver usuarios, solo usar el usuario actual
      if (!canViewUsers) {
        if (currentUser?.id) {
          setUsuarios([currentUser]);
          setUsuarioSeleccionado(currentUser.id);
        }
        return;
      }

      try {
        // Usar el endpoint con per_page alto para obtener todos los usuarios
        const response = await apiRequest("/v1/users?per_page=1000", "GET");
        
        // Manejar diferentes estructuras de respuesta (similar a UsersList.jsx)
        let usuariosData = [];
        
        if (response && response.data) {
          if (response.data.data && Array.isArray(response.data.data)) {
            // Estructura anidada: { data: { data: [...], pagination: {...} } }
            usuariosData = response.data.data;
          } else if (Array.isArray(response.data)) {
            // Estructura simple: { data: [...] }
            usuariosData = response.data;
          } else {
            // Intentar encontrar un array en response.data
            const possibleArrays = Object.values(response.data).filter(Array.isArray);
            if (possibleArrays.length > 0) {
              usuariosData = possibleArrays[0];
            }
          }
        } else if (Array.isArray(response)) {
          // Si la respuesta es directamente un array
          usuariosData = response;
        } else if (response && response.users) {
          // Si la respuesta tiene estructura { users: [...] }
          usuariosData = Array.isArray(response.users) ? response.users : [];
        } else if (response && typeof response === 'object') {
          // Buscar cualquier array en la respuesta
          const possibleArrays = Object.values(response).filter(Array.isArray);
          if (possibleArrays.length > 0) {
            usuariosData = possibleArrays[0];
          }
        }
        
        // Asegurar que siempre sea un array
        if (!Array.isArray(usuariosData)) {
          console.warn("⚠️ La respuesta de usuarios no es un array:", response);
          usuariosData = [];
        }
        
        if (usuariosData.length > 0) {
          setUsuarios(usuariosData);
          const usuarioDefault = currentUser?.id ? usuariosData.find(u => u.id === currentUser?.id) : null;
          if (!usuarioSeleccionado) {
            setUsuarioSeleccionado(usuarioDefault ? usuarioDefault.id : (usuariosData[0]?.id || null));
          }
          
          // Log para debugging en desarrollo
          if (import.meta.env.DEV) {
            console.log("✅ Usuarios cargados en calendario:", {
              total: usuariosData.length,
              usuarios: usuariosData.map(u => ({ id: u.id, name: u.name }))
            });
          }
        } else {
          // Si no hay usuarios, usar solo el usuario actual
          if (currentUser?.id) {
            setUsuarios([currentUser]);
            setUsuarioSeleccionado(currentUser.id);
          }
        }
      } catch (error) {
        console.error("Error cargando usuarios:", error);
        // Si falla la carga, usar solo el usuario actual
        if (currentUser?.id) {
          setUsuarios([currentUser]);
          setUsuarioSeleccionado(currentUser.id);
        }
        // Solo mostrar toast si tenía permisos (error real)
        if (canViewUsers) {
          setToast({
            show: true,
            message: "Error al cargar la lista de usuarios",
            variant: "warning",
          });
        }
      }
    };
  
    fetchUsuarios();
  }, [currentUser, canViewUsers]);
  
  const [filtroMenciones, setFiltroMenciones] = useState(false); // ✅ Filtro para mostrar tareas con menciones

  React.useEffect(() => {
    const fetchTareasPorUsuario = async () => {
      try {
        if (!usuarioSeleccionado) return;
  
        // ✅ Cargar tareas operativas
        const endpoint = filtroMenciones 
          ? `tareas_operativas?mentioned_user_id=${usuarioSeleccionado}&per_page=100`
          : `tareas_operativas?assigned_user_id=${usuarioSeleccionado}&per_page=100`;
        
        const response = await apiRequest(endpoint, "GET");
        let tareasOperativas = getListFromApi(response).map(normalizeOperativaLite);

        // ✅ Si buscamos por menciones, también verificar en comentarios (por si el backend no lo soporta aún)
        if (filtroMenciones && tareasOperativas.length === 0) {
          // Fallback: obtener todas las tareas y filtrar localmente
          const allResponse = await apiRequest(`tareas_operativas?assigned_user_id=${usuarioSeleccionado}&per_page=100`, "GET");
          const allTareas = getListFromApi(allResponse).map(normalizeOperativaLite);
          
          // Filtrar tareas que tienen comentarios mencionando al usuario
          tareasOperativas = allTareas.filter(tarea => {
            if (tarea.comments && Array.isArray(tarea.comments)) {
              return tarea.comments.some(comment => 
                isUserMentioned(comment.comment || comment.response_note || '', usuarioSeleccionado)
              );
            }
            return false;
          });
        }

        // ✅ Marcar tareas operativas con tipo
        tareasOperativas = tareasOperativas.map(t => ({ ...t, tipo: 'operativa' }));

        // ✅ Cargar tareas de auditoría
        let tareasAuditoria = [];
        try {
          const auditoriaParams = filtroMenciones
            ? { mentioned_user_id: usuarioSeleccionado, per_page: 100 }
            : { assigned_user_id: usuarioSeleccionado, per_page: 100 };
          
          const auditoriaResponse = await listAuditoriaTasks(auditoriaParams);
          
          tareasAuditoria = getListFromApi(auditoriaResponse);

          // ✅ Marcar tareas de auditoría con tipo
          tareasAuditoria = tareasAuditoria.map(t => ({ ...t, tipo: 'auditoria' }));
        } catch (error) {
          console.warn("Error al cargar tareas de auditoría:", error);
          // No mostrar error al usuario, solo continuar con tareas operativas
        }
        
        // ✅ Combinar ambas listas
        const todasLasTareas = [...tareasOperativas, ...tareasAuditoria];
        setTareas(todasLasTareas);
        
      } catch (error) {
        console.error("Error al cargar tareas por usuario:", error);
        setToast({
          show: true,
          message: "Error al cargar tareas del usuario",
          variant: "danger",
        });
      }
    };
  
    fetchTareasPorUsuario();
  }, [usuarioSeleccionado, filtroMenciones]);
  
  

  // Agrupar tareas por día según scheduled_date o due_date
  const tareasPorDia = {};
  if (Array.isArray(tareas)) {
    // Incluir todas las tareas (incluyendo completadas) para mostrar los badges por estado
    tareas
      .filter((t) => t) // Solo filtrar tareas nulas/undefined
      .forEach((t) => {
        // Usar scheduled_date primero, luego due_date, luego created_at
        const fechaStr = t.scheduled_date || t.due_date || t.created_at;
        if (!fechaStr) return;
        
        const fecha = parseApiDateToLocalDate(fechaStr);
        if (!fecha) return;
        
        if (!isNaN(fecha.getTime()) && fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual) {
          const dia = fecha.getDate();
          if (!tareasPorDia[dia]) tareasPorDia[dia] = [];
          tareasPorDia[dia].push(t);
        }
      });
  }

  // ✅ Función helper para obtener el nombre del cliente según el tipo de tarea
  const getClienteNombre = (tarea) => {
    if (tarea.tipo === 'auditoria') {
      return tarea.cliente?.nombre_completo || tarea.cliente?.nombre || "Sin Cliente";
    }
    return tarea.log?.cliente?.nombre_completo || "Sin Cliente";
  };

  // ✅ Función helper para obtener el color del badge según tipo y estado
  const getBadgeColorByType = (tarea) => {
    const tipo = tarea.tipo || (tarea.auditoria || tarea.item || tarea.run_id ? 'auditoria' : 'operativa');
    const status = tarea.status;
    
    if (tipo === 'auditoria') {
      // Tareas de auditoría: usar colores más sutiles (slate/gray) para distinguirlas profesionalmente
      switch (status) {
        case "pending": return "secondary"; // Gray para pendientes
        case "in_progress": return "info"; // Azul claro para en progreso
        case "completed": return "success"; // Verde para completadas
        default: return "secondary";
      }
    } else {
      // Tareas operativas: mantener colores originales (warning para pending)
      return getBadgeColor(status);
    }
  };
  


  const cambiarMes = (incremento) => {
    let nuevoMes = mesActual + incremento;
    let nuevoAño = añoActual;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAño -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAño += 1;
    }
    setMesActual(nuevoMes);
    setAñoActual(nuevoAño);
  };

  const irAHoy = () => {
    const hoy = new Date();
    setMesActual(hoy.getMonth());
    setAñoActual(hoy.getFullYear());
  };

  const esMesActual = () => {
    const hoy = new Date();
    return mesActual === hoy.getMonth() && añoActual === hoy.getFullYear();
  };

  const onDragStart = (e, tarea) => {
    if (!tarea || tarea.status === "completed") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("tareaId", tarea.id);
  };

  const onDrop = async (e, dia) => {
    e.preventDefault();
    const tareaId = e.dataTransfer.getData("tareaId");
    if (!tareaId || !Array.isArray(tareas)) return;

    // Usar formato estable YYYY-MM-DD para el front y compatibilidad.
    // Si el backend ahora acepta/retorna MM-DD-YYYY, igual parseamos ambos al leer.
    const nuevaFecha = formatDateToYmd(new Date(añoActual, mesActual, dia));

    const tarea = tareas.find((t) => t && t.id === parseInt(tareaId));
    if (!tarea) return;

    // No permitir que la fecha de programación quede por encima de la de vencimiento
    const dueDateParsed = tarea.due_date ? parseApiDateToLocalDate(tarea.due_date) : null;
    const dueDateStr = dueDateParsed ? formatDateToYmd(dueDateParsed) : null;
    if (dueDateStr && nuevaFecha > dueDateStr) {
      setToast({
        show: true,
        message: "La fecha de programación no puede ser mayor que la fecha de vencimiento.",
        variant: "danger",
      });
      return;
    }

    // Solo actualizar scheduled_date; la fecha de vencimiento no se mueve
    const dueDateToSend = tarea.due_date || null;

    try {
      const payload = { scheduled_date: nuevaFecha };
      if (dueDateToSend) payload.due_date = dueDateToSend;
      await apiRequest(`tareas_operativas/${tareaId}/reprogramar`, "PUT", payload);

      setTareas((prev) =>
        prev.map((t) =>
          t.id === tarea.id ? { ...t, scheduled_date: nuevaFecha } : t
        )
      );

      setToast({
        show: true,
        message: `✅ Tarea movida al ${nuevaFecha}`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error reprogramando tarea:", error);
      setToast({
        show: true,
        message: "Error al reprogramar la tarea",
        variant: "danger",
      });
    }
  };

  const onDragOver = (e) => e.preventDefault();

  const celdas = [];
  for (let i = 0; i < offsetInicio; i++) {
    celdas.push(null);
  }
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(d);
  }

  return (
    <div className="calendario-tareas-container" style={{ position: 'relative' }}>
      <style>{`
        .calendar-day-card {
          user-select: none;
        }
        .calendar-day-card:hover {
          z-index: 10;
        }
        .calendar-day-card .badge {
          word-break: break-word;
          white-space: normal;
          line-height: 1.3;
        }
        @media (max-width: 768px) {
          .calendar-day-card {
            min-height: 100px !important;
          }
        }
        /* Asegurar que el dropdown de notificaciones se vea bien */
        .calendario-tareas-container .position-relative {
          position: relative !important;
        }
      `}</style>
      {/* Header mejorado */}
      <Card className="mb-4 shadow-sm border-0" style={{ position: 'relative', overflow: 'visible' }}>
        <Card.Body className="p-3" style={{ position: 'relative', overflow: 'visible' }}>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3" style={{ position: 'relative' }}>
            {/* Sección izquierda: Botones de acción */}
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowNuevaModal(true)}
                className="d-flex align-items-center gap-2"
              >
                <FaPlus /> Nueva Tarea
              </Button>

              {canViewUsers && (
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={() => {
                    setFechaResumen(new Date());
                    setShowResumen(true);
                  }}
                  className="d-flex align-items-center gap-2"
                >
                  <FaChartBar /> Resumen Diario
                </Button>
              )}
            </div>

            {/* Sección central: Navegación del calendario */}
            <div className="d-flex flex-column align-items-center flex-grow-1" style={{ minWidth: "200px" }}>
              <div className="d-flex align-items-center gap-3 mb-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cambiarMes(-1)}
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: "38px", height: "38px" }}
                >
                  <FaChevronLeft />
                </Button>
                
                <div className="text-center">
                  <h4 className="mb-0 text-capitalize fw-bold text-primary">
                    <FaCalendarAlt className="me-2" />
                    {nombreMes}
                  </h4>
                  {!esMesActual() && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={irAHoy}
                      className="p-0 text-decoration-none"
                      style={{ fontSize: "0.75rem" }}
                    >
                      Ir a hoy
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => cambiarMes(1)}
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: "38px", height: "38px" }}
                >
                  <FaChevronRight />
                </Button>
              </div>

              {/* Selector de usuario mejorado */}
              <div className="d-flex align-items-center gap-2" style={{ width: "100%", maxWidth: "350px" }}>
                <FaUser className="text-muted" />
                <select
                  className="form-select form-select-sm"
                  value={usuarioSeleccionado || ""}
                  onChange={(e) => setUsuarioSeleccionado(parseInt(e.target.value))}
                  disabled={!canViewUsers}
                  style={{ flex: 1 }}
                >
                  {usuarios.length > 0 ? (
                    usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Cargando usuarios...</option>
                  )}
                </select>
                {/* ✅ Toggle para filtrar por menciones */}
                <Button
                  variant={filtroMenciones ? "primary" : "outline-secondary"}
                  size="sm"
                  onClick={() => setFiltroMenciones(!filtroMenciones)}
                  title={filtroMenciones ? "Mostrar todas las tareas" : "Mostrar solo tareas donde fui mencionado"}
                  className="d-flex align-items-center"
                >
                  <FaAt />
                </Button>
              </div>
            </div>

            {/* Sección derecha: Notificaciones y Estadísticas */}
            <div className="d-flex align-items-center gap-3">
              {/* ✅ Dropdown de notificaciones */}
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
                          abrirResponderTarea({ ...tarea, tipo: 'auditoria' }, true);
                        } else {
                          throw new Error("No se pudo cargar la tarea de auditoría");
                        }
                      } catch (error) {
                        console.error("Error al cargar tarea de auditoría:", error);
                        setToast({ 
                          show: true, 
                          message: "Error al cargar la tarea de auditoría.", 
                          variant: "danger" 
                        });
                      } finally {
                        setLoadingTarea(false);
                      }
                    };
                    
                    // ✅ Función helper para buscar tarea de auditoría por comment_id
                    const buscarTareaAuditoriaPorComentario = async (commentId) => {
                      try {
                        const auditoriaTasksResponse = await listAuditoriaTasks({ per_page: 100 });
                        const auditoriaTasks = auditoriaTasksResponse?.data || [];
                        
                        for (const tarea of auditoriaTasks) {
                          // Cargar comentarios de la tarea
                          try {
                            const { getTaskComments } = await import("../../services/auditoriasTasksService");
                            const comentarios = await getTaskComments(tarea.id);
                            const comentariosArray = Array.isArray(comentarios) ? comentarios : (comentarios?.data || []);
                            
                            const comentarioEncontrado = comentariosArray.find(c => 
                              (c.id || c.comment_id) == commentId ||
                              parseInt(c.id || c.comment_id) === parseInt(commentId)
                            );
                            
                            if (comentarioEncontrado) {
                              return tarea.id;
                            }
                          } catch (comentariosError) {
                            // Continuar con la siguiente tarea si falla
                            continue;
                          }
                        }
                        return null;
                      } catch (error) {
                        console.warn("Error al buscar tarea de auditoría por comentario:", error);
                        return null;
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
                        const numericTaskId = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
                        if (notification.task && notification.task.id) {
                          // Cuando viene desde menciones, el objeto `notification.task` suele venir incompleto
                          // (por ejemplo sin `log.cliente`), y el modal muestra "Cliente no disponible".
                          // En ese caso, abrimos el modal cargando `tareas_operativas/{id}`.
                          const tieneClienteEnNotificacion = !!notification.task?.log?.cliente?.id;
                          if (tieneClienteEnNotificacion) {
                            abrirResponderTarea(notification.task, true);
                          } else {
                            await openTaskResponseModal(numericTaskId, true);
                          }
                        } else {
                          await openTaskResponseModal(numericTaskId, true);
                        }
                        return;
                      }
                      
                      // ✅ Si no hay task_id pero hay comment_id, buscar el task_id
                      if (!taskId && commentId) {
                        console.log("🔍 Buscando task_id para comment_id:", commentId, "esAuditoria:", esAuditoria);
                        
                        try {
                          // ✅ Primero intentar buscar en tareas de auditoría si es notificación de auditoría
                          if (esAuditoria) {
                            const tareaIdEncontrada = await buscarTareaAuditoriaPorComentario(commentId);
                            if (tareaIdEncontrada) {
                              await abrirTareaAuditoria(tareaIdEncontrada);
                              return;
                            }
                          }
                          
                          // Si no es auditoría o no se encontró, buscar en tareas operativas
                          const allTasksResponse = await apiRequest(`tareas_operativas?per_page=100`, "GET");
                          let allTasks = [];
                          
                          if (allTasksResponse?.data?.data) {
                            allTasks = Array.isArray(allTasksResponse.data.data) ? allTasksResponse.data.data : [];
                          } else if (allTasksResponse?.data) {
                            allTasks = Array.isArray(allTasksResponse.data) ? allTasksResponse.data : [];
                          } else if (Array.isArray(allTasksResponse)) {
                            allTasks = allTasksResponse;
                          }
                          
                          // Buscar en todas las tareas por el comentario
                          for (const tarea of allTasks) {
                            const tareaId = tarea.id || tarea.task_id;
                            if (!tareaId) continue;
                            
                            // Si la tarea tiene comentarios en su estructura, buscar ahí
                            if (tarea.comments && Array.isArray(tarea.comments)) {
                              const comentarioEncontrado = tarea.comments.find(c => 
                                (c.id || c.comment_id) == notification.comment_id ||
                                parseInt(c.id || c.comment_id) === parseInt(notification.comment_id)
                              );
                              if (comentarioEncontrado) {
                                taskId = tareaId;
                                console.log("✅ Task ID encontrado en comentarios de tarea:", taskId);
                                break;
                              }
                            }
                            
                            // Si no está en la estructura, intentar cargar comentarios de la tarea
                            try {
                              const comentariosResponse = await apiRequest(`tareas_operativas/${tareaId}/comentarios`, "GET");
                              const comentarios = Array.isArray(comentariosResponse) 
                                ? comentariosResponse 
                                : (Array.isArray(comentariosResponse?.data) ? comentariosResponse.data : []);
                              
                              const comentarioEncontrado = comentarios.find(c => 
                                (c.id || c.comment_id) == notification.comment_id ||
                                parseInt(c.id || c.comment_id) === parseInt(notification.comment_id)
                              );
                              
                              if (comentarioEncontrado) {
                                taskId = tareaId;
                                console.log("✅ Task ID encontrado después de cargar comentarios:", taskId);
                                break;
                              }
                            } catch (comentariosError) {
                              // Continuar con la siguiente tarea si falla
                              continue;
                            }
                          }
                          
                          if (!taskId) {
                            console.error("❌ No se pudo encontrar el task_id para el comentario:", notification.comment_id);
                            setToast({ 
                              show: true, 
                              message: "No se pudo encontrar la tarea asociada a este comentario.", 
                              variant: "warning" 
                            });
                            return;
                          }
                        } catch (error) {
                          console.error("❌ Error al buscar tarea del comentario:", error);
                          setToast({ 
                            show: true, 
                            message: "No se pudo obtener la tarea asociada al comentario.", 
                            variant: "warning" 
                          });
                          return;
                        }
                      }
                      
                      // ✅ Usar openTaskResponseModal para tareas operativas o abrir tarea de auditoría
                      if (taskId && !isNaN(taskId) && taskId > 0) {
                        const numericTaskId = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
                        
                        // Si ya tenemos el objeto task completo en la notificación, usarlo directamente
                        if (notification.task && notification.task.id) {
                          const tieneClienteEnNotificacion = !!notification.task?.log?.cliente?.id;
                          if (tieneClienteEnNotificacion) {
                            console.log("✅ Usando objeto task completo de la notificación");
                            abrirResponderTarea(notification.task, true);
                          } else {
                            console.log("⚠️ notification.task incompleto; cargando detalle por taskId");
                            await openTaskResponseModal(numericTaskId, true);
                          }
                        } else if (isAuditoriaNotification) {
                          // Si es auditoría, cargar y abrir
                          await abrirTareaAuditoria(numericTaskId);
                        } else {
                          // Usar el mismo método que funciona para notificaciones de tareas operativas
                          console.log("✅ Abriendo modal con taskId usando openTaskResponseModal:", numericTaskId);
                          await openTaskResponseModal(numericTaskId, true);
                        }
                      } else {
                        // ✅ Intentar obtener task_id desde otros campos de la notificación
                        let taskIdFromData = null;
                        let esAuditoriaFromData = false;
                        
                        // Buscar en data, metadata, related_id, etc.
                        if (notification.data) {
                          taskIdFromData = notification.data.task_id || 
                                           notification.data.auditoria_task_id ||
                                           notification.data.audit_task_id || 
                                           notification.data.task?.id ||
                                           notification.data.audit_task?.id;
                          esAuditoriaFromData = !!(notification.data.auditoria_task_id || notification.data.audit_task_id);
                        }
                        
                        if (notification.metadata) {
                          taskIdFromData = taskIdFromData || 
                                          notification.metadata.task_id || 
                                          notification.metadata.auditoria_task_id ||
                                          notification.metadata.audit_task_id;
                          esAuditoriaFromData = esAuditoriaFromData || !!(notification.metadata.auditoria_task_id || notification.metadata.audit_task_id);
                        }
                        
                        if (notification.related_id) {
                          taskIdFromData = notification.related_id;
                        }
                        
                        // Si encontramos un task_id en otros campos, intentar usarlo
                        if (taskIdFromData) {
                          const numericTaskId = typeof taskIdFromData === 'string' ? parseInt(taskIdFromData, 10) : taskIdFromData;
                          if (!isNaN(numericTaskId) && numericTaskId > 0) {
                            if (esAuditoriaFromData || isAuditoriaNotification) {
                              await abrirTareaAuditoria(numericTaskId);
                            } else {
                              await openTaskResponseModal(numericTaskId, true);
                            }
                            return;
                          }
                        }
                        
                        // ✅ Si hay link, intentar extraer task_id del link
                        if (notification.link) {
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
                                  await openTaskResponseModal(numericTaskId, true);
                                }
                                return;
                              }
                            }
                          } catch (linkError) {
                            console.warn("Error al extraer task_id del link:", linkError);
                          }
                        }
                        
                        // Si aún no tenemos task_id, mostrar mensaje más informativo
                        console.error("❌ No se pudo obtener un task_id válido de la notificación:", {
                          notification_id: notification.id,
                          notification_type: notification.type,
                          task_id: notification.task_id,
                          auditoria_task_id: notification.auditoria_task_id,
                          audit_task_id: notification.audit_task_id,
                          comment_id: notification.comment_id,
                          auditoria_comment_id: notification.auditoria_comment_id,
                          data: notification.data,
                          metadata: notification.metadata,
                          related_id: notification.related_id
                        });
                        
                        setToast({ 
                          show: true, 
                          message: "Esta notificación no tiene información de tarea asociada. Por favor, contacte al administrador.", 
                          variant: "warning" 
                        });
                      }
                    } else if (notification.type === 'task_assigned' && (notification.task_id || notification.auditoria_task_id || notification.audit_task_id)) {
                      const taskId = notification.auditoria_task_id || notification.audit_task_id || notification.task_id;
                      const esAuditoria = !!(notification.auditoria_task_id || notification.audit_task_id);
                      const numericTaskId = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
                      
                      if (esAuditoria) {
                        await abrirTareaAuditoria(numericTaskId);
                      } else if (notification.task && notification.task.id) {
                        const tieneClienteEnNotificacion = !!notification.task?.log?.cliente?.id;
                        if (tieneClienteEnNotificacion) {
                          abrirResponderTarea(notification.task, true);
                        } else {
                          await openTaskResponseModal(numericTaskId, true);
                        }
                      } else {
                        await openTaskResponseModal(numericTaskId, true);
                      }
                    } else if (notification.type === 'task_pending') {
                      const taskId = notification.auditoria_task_id || notification.audit_task_id || notification.task_id;
                      const esAuditoria = !!(notification.auditoria_task_id || notification.audit_task_id);
                      
                      if (taskId) {
                        const numericTaskId = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
                        if (esAuditoria) {
                          await abrirTareaAuditoria(numericTaskId);
                        } else if (notification.task && notification.task.id) {
                          const tieneClienteEnNotificacion = !!notification.task?.log?.cliente?.id;
                          if (tieneClienteEnNotificacion) {
                            abrirResponderTarea(notification.task, true);
                          } else {
                            await openTaskResponseModal(numericTaskId, true);
                          }
                        } else {
                          await openTaskResponseModal(numericTaskId, true);
                        }
                      } else {
                        await openTaskResponseModal(null, true);
                      }
                    } else if (notification.type === 'task' && (notification.task_id || notification.auditoria_task_id || notification.audit_task_id)) {
                      const taskId = notification.auditoria_task_id || notification.audit_task_id || notification.task_id;
                      const esAuditoria = !!(notification.auditoria_task_id || notification.audit_task_id);
                      const numericTaskId = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
                      
                      if (esAuditoria) {
                        await abrirTareaAuditoria(numericTaskId);
                      } else if (notification.task && notification.task.id) {
                        const tieneClienteEnNotificacion = !!notification.task?.log?.cliente?.id;
                        if (tieneClienteEnNotificacion) {
                          abrirResponderTarea(notification.task, true);
                        } else {
                          await openTaskResponseModal(numericTaskId, true);
                        }
                      } else {
                        await openTaskResponseModal(numericTaskId, true);
                      }
                    } else if (notification.type === 'view_all') {
                      // Navegar a operaciones (opcional)
                      window.location.href = '/Herramientas/operaciones';
                    } else {
                      if (pendientes > 0) {
                        await openTaskResponseModal(null, true);
                      }
                    }
                  } catch (error) {
                    console.error("❌ Error al procesar notificación:", error);
                    setToast({ 
                      show: true, 
                      message: "Error al abrir la tarea. Por favor, intente de nuevo.", 
                      variant: "danger" 
                    });
                  }
                }}
              />

              {/* Estadísticas rápidas */}
              <div className="d-flex flex-column align-items-end gap-1">
                <div className="d-flex align-items-center gap-2">
                  <FaTasks className="text-primary" />
                  <span className="text-muted small">
                    {tareas.filter(t => t && t.status !== "completed").length} tareas activas
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>


      

      {/* Días de la semana mejorados */}
      <div className="d-grid mb-3 fw-bold text-center text-muted" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
        {diasSemana.map((d, idx) => (
          <div key={`weekday-${idx}-${d}`} className="p-2" style={{ fontSize: "0.9rem" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Celdas del calendario mejoradas */}
      <div className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "10px" }}>
        {celdas.map((dia, index) => {
          if (dia === null) return <div key={`empty-${index}`}></div>;

          const tareasDia = tareasPorDia[dia] || [];
          const todasLasTareas = obtenerTodasTareasDelDia(dia);
          const esHoy = dia === hoy.getDate() && mesActual === hoy.getMonth() && añoActual === hoy.getFullYear();
          const esPasado = new Date(añoActual, mesActual, dia) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
          const tieneTareas = tareasDia.length > 0;
          
          // Calcular contadores por estado para este día
          const contadoresPorEstado = {
            pending: 0,
            in_progress: 0,
            completed: 0
          };
          
          tareasDia.forEach((t) => {
            const estado = (t.status || t.estado || 'pending').toLowerCase();
            if (estado === 'pending' || estado === 'pendiente') {
              contadoresPorEstado.pending++;
            } else if (estado === 'in_progress' || estado === 'en_progreso' || estado === 'processing') {
              contadoresPorEstado.in_progress++;
            } else if (estado === 'completed' || estado === 'completada' || estado === 'completado') {
              contadoresPorEstado.completed++;
            }
          });

          // ✅ Key única combinando día, mes y año para evitar duplicados
          const uniqueKey = `day-${añoActual}-${mesActual}-${dia}-${index}`;

          return (
            <Card
              key={uniqueKey}
              data-day={dia}
              data-month={mesActual}
              data-year={añoActual}
              onDrop={(e) => onDrop(e, dia)}
              onDragOver={onDragOver}
              onClick={(e) => {
                if (e.target.tagName !== "SPAN" && e.target.tagName !== "SMALL") {
                  if (todasLasTareas.length > 0) {
                    abrirDetalleDia(todasLasTareas);
                  }
                }
              }}
              className="calendar-day-card p-2 text-center position-relative"
              style={{
                minHeight: "140px",
                borderRadius: "12px",
                border: esHoy 
                  ? "2px solid #0d6efd" 
                  : tieneTareas 
                    ? "1px solid #0d6efd" 
                    : "1px solid #e0e0e0",
                backgroundColor: esHoy 
                  ? "#e7f3ff" 
                  : esPasado 
                    ? "#f8f9fa" 
                    : "#fff",
                cursor: todasLasTareas.length > 0 ? "pointer" : "default",
                transition: "all 0.2s ease-in-out",
                boxShadow: esHoy 
                  ? "0 2px 8px rgba(13, 110, 253, 0.15)" 
                  : tieneTareas 
                    ? "0 1px 4px rgba(13, 110, 253, 0.1)" 
                    : "none",
              }}
              onMouseEnter={(e) => {
                if (todasLasTareas.length > 0) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(13, 110, 253, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = esHoy 
                  ? "0 2px 8px rgba(13, 110, 253, 0.15)" 
                  : tieneTareas 
                    ? "0 1px 4px rgba(13, 110, 253, 0.1)" 
                    : "none";
              }}
            >
              {/* Indicador de día */}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <strong 
                  className={esHoy ? "text-primary" : esPasado ? "text-muted" : ""}
                  style={{ fontSize: "1.1rem" }}
                >
                  {dia}
                </strong>
                {/* Badges circulares por estado */}
                {tieneTareas && (
                  <div className="d-flex gap-1 align-items-center flex-wrap justify-content-end" style={{ maxWidth: "60%" }}>
                    {contadoresPorEstado.pending > 0 && (
                      <Badge 
                        bg="warning" 
                        pill 
                        style={{ 
                          fontSize: "0.65rem", 
                          minWidth: "18px", 
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 4px"
                        }}
                        title={`${contadoresPorEstado.pending} pendiente${contadoresPorEstado.pending !== 1 ? 's' : ''}`}
                      >
                        {contadoresPorEstado.pending}
                      </Badge>
                    )}
                    {contadoresPorEstado.in_progress > 0 && (
                      <Badge 
                        bg="info" 
                        pill 
                        style={{ 
                          fontSize: "0.65rem", 
                          minWidth: "18px", 
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 4px"
                        }}
                        title={`${contadoresPorEstado.in_progress} en progreso`}
                      >
                        {contadoresPorEstado.in_progress}
                      </Badge>
                    )}
                    {contadoresPorEstado.completed > 0 && (
                      <Badge 
                        bg="success" 
                        pill 
                        style={{ 
                          fontSize: "0.65rem", 
                          minWidth: "18px", 
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 4px"
                        }}
                        title={`${contadoresPorEstado.completed} completada${contadoresPorEstado.completed !== 1 ? 's' : ''}`}
                      >
                        {contadoresPorEstado.completed}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Lista de tareas - Solo mostrar tareas no completadas en la lista */}
              <div className="mt-2" style={{ minHeight: "80px" }}>
                {(() => {
                  const tareasNoCompletadas = tareasDia.filter(t => {
                    const estado = (t.status || t.estado || 'pending').toLowerCase();
                    return estado !== 'completed' && estado !== 'completada' && estado !== 'completado';
                  });
                  return tareasNoCompletadas.length > 0 ? (
                    <>
                      {tareasNoCompletadas.slice(0, 4).map((t, tIndex) => {
                      if (!t) return null;
                      const tipo = t.tipo || (t.auditoria || t.item || t.run_id ? 'auditoria' : 'operativa');
                      const clienteNombre = getClienteNombre(t);
                      const esAuditoria = tipo === 'auditoria';
                      const tooltipText = `${esAuditoria ? '🔍 ' : ''}${clienteNombre} - ${getStatusLabel(t?.status)}${esAuditoria ? ' (Auditoría)' : ''}`;
                      
                      // ✅ Key única combinando ID de tarea, día e índice para evitar duplicados
                      const taskKey = t.id ? `task-${t.id}-${dia}-${tIndex}` : `task-${dia}-${tIndex}-${Date.now()}`;
                      
                      return (
                        <OverlayTrigger
                          key={taskKey}
                          placement="top"
                          overlay={<Tooltip>{tooltipText}</Tooltip>}
                        >
                          <Badge
                            bg={getBadgeColorByType(t)}
                            className="d-flex align-items-center gap-1 mb-1 text-truncate"
                            style={{ 
                              fontSize: "0.7rem", 
                              cursor: "pointer",
                              maxWidth: "100%",
                              transition: "all 0.2s ease",
                              borderLeft: esAuditoria ? "3px solid #64748b" : "none",
                              paddingLeft: esAuditoria ? "4px" : "8px",
                              backgroundColor: esAuditoria ? (t.status === "pending" ? "#e2e8f0" : t.status === "in_progress" ? "#cbd5e1" : undefined) : undefined
                            }}
                            draggable={t?.status !== "completed" && !esAuditoria}
                            onDragStart={(e) => {
                              if (!esAuditoria) {
                                onDragStart(e, t);
                              } else {
                                e.preventDefault();
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirResponderTarea(t);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.opacity = "0.9";
                              if (esAuditoria) {
                                e.currentTarget.style.borderLeft = "3px solid #475569";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.opacity = "1";
                              if (esAuditoria) {
                                e.currentTarget.style.borderLeft = "3px solid #64748b";
                              }
                            }}
                          >
                            {esAuditoria && <FaClipboardCheck style={{ fontSize: "0.6rem", marginRight: "2px" }} />}
                            <span className="text-truncate" style={{ flex: 1, minWidth: 0 }}>
                              {clienteNombre}
                            </span>
                          </Badge>
                        </OverlayTrigger>
                      );
                    })}
                    {tareasNoCompletadas.length > 4 && (
                      <small
                        className="text-primary fw-bold d-block mt-1"
                        style={{ 
                          cursor: "pointer", 
                          fontSize: "0.75rem",
                          textDecoration: "underline"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDetalleDia(tareasDia);
                        }}
                      >
                        +{tareasNoCompletadas.length - 4} más
                      </small>
                    )}
                    </>
                  ) : (
                    <div className="text-muted" style={{ fontSize: "0.75rem", paddingTop: "20px" }}>
                      <FaCalendarCheck className="opacity-50" />
                    </div>
                  );
                })()}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Toast */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast bg={toast.variant} show={toast.show} onClose={() => setToast({ ...toast, show: false })} delay={3000} autohide>
          <Toast.Body className="text-white">{toast.message}</Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Modal Detalle mejorado */}
      <Modal 
        show={showDetalleModal} 
        onHide={() => setShowDetalleModal(false)} 
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="d-flex align-items-center gap-2">
            <FaCalendarAlt />
            Tareas del día
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {Array.isArray(tareasDetalle) && tareasDetalle.length > 0 ? (
            <ListGroup variant="flush">
              {tareasDetalle.map((t, idx) => {
                if (!t) return null;
                // ✅ Key única combinando ID e índice para evitar duplicados
                const detailKey = t.id ? `detail-${t.id}-${idx}` : `detail-${idx}-${Date.now()}`;
                return (
                  <ListGroup.Item
                    key={detailKey}
                    className="d-flex justify-content-between align-items-center p-3 border-bottom"
                    style={{ 
                      transition: "background-color 0.2s ease",
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onClick={() => {
                      abrirResponderTarea(t);
                      setShowDetalleModal(false);
                    }}
                  >
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <Badge bg={getBadgeColorByType(t)} className="px-2 py-1">
                          {getStatusLabel(t?.status)}
                        </Badge>
                        {(t.tipo === 'auditoria' || t.auditoria || t.item || t.run_id) && (
                          <Badge bg="secondary" className="px-2 py-1 d-flex align-items-center gap-1" style={{ fontSize: "0.7rem" }}>
                            <FaClipboardCheck style={{ fontSize: "0.65rem" }} />
                            Auditoría
                          </Badge>
                        )}
                        <span className="fw-bold text-dark">
                          {t.tipo === 'auditoria' 
                            ? "Tarea de Auditoría" 
                            : (t.log?.concept?.name || "Tarea")}
                        </span>
                      </div>
                      <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: "0.9rem" }}>
                        <FaUser className="opacity-50" style={{ fontSize: "0.75rem" }} />
                        {getClienteNombre(t)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="ms-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirResponderTarea(t);
                        setShowDetalleModal(false);
                      }}
                    >
                      Ver / Responder
                    </Button>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          ) : (
            <div className="text-center py-5">
              <FaCalendarCheck className="text-muted mb-3" style={{ fontSize: "3rem", opacity: 0.3 }} />
              <p className="text-muted mb-0">No hay tareas para este día</p>
            </div>
          )}
        </Modal.Body>
      </Modal>


      {/* Modales */}
      {showResponderModal && tareaSeleccionada && (
  <ResponderTareaModal
    show={showResponderModal}
    onHide={(updated) => {
      setShowResponderModal(false);
      setTareaSeleccionada(null);
      setFromNotification(false);
      if (updated) {
        // ✅ Actualizar contador de pendientes cuando se cierra el modal
        apiRequest("tareas_operativas/pendientes", "GET")
          .then((res) => setPendientes(res.pendientes || 0))
          .catch(() => {});
        // ✅ El onUpdated ya se llamó antes, no necesitamos llamarlo de nuevo aquí
      }
    }}
    tarea={tareaSeleccionada}
    fromNotification={fromNotification}
    onUpdated={(tareaActualizada) => {
      // ✅ Actualizar el estado INMEDIATAMENTE cuando se agrega el comentario
      // Esto asegura que el cambio de color se vea antes de cerrar el modal
      onUpdated(tareaActualizada);
      
      // ✅ Log de depuración
      if (import.meta.env.DEV) {
        console.log("🔄 [CalendarioTareas] Tarea actualizada desde modal (onUpdated):", {
          id: tareaActualizada?.id,
          estado: tareaActualizada?.status,
          estado_anterior: tareaSeleccionada?.status,
          timestamp: new Date().toISOString()
        });
      }
      
      // ✅ El modal se cierra automáticamente después de un delay en ResponderTareaModal
      // No cerramos aquí para evitar conflictos con el delay
    }}
  />
)}

{showResponderAuditoriaModal && tareaSeleccionada && (
  <ResponderTareaAuditoriaModal
    show={showResponderAuditoriaModal}
    onHide={() => {
      setShowResponderAuditoriaModal(false);
      setTareaSeleccionada(null);
      setTareaTipo(null);
      setFromNotification(false);
    }}
    tarea={tareaSeleccionada}
    onUpdated={(tareaActualizada) => {
      // ✅ Actualizar la tarea en el estado del calendario
      onUpdated(tareaActualizada);
    }}
  />
)}

{showNuevaModal && (
  <NuevaTareaModal
    show={showNuevaModal}
    onHide={() => setShowNuevaModal(false)}
    onCreated={(nuevaTarea) => {
      onCreated(nuevaTarea); // ✅ Agrega la nueva tarea al estado
      setShowNuevaModal(false); // ✅ Cierra modal después
    }}
  />
)}

<ResumenTareasModal
  show={showResumen}
  onHide={() => setShowResumen(false)}
  tareas={tareas}
  usuarios={usuarios}
  fecha={fechaResumen}
  setFecha={setFechaResumen}
/>



    </div>
  );
};

// ✅ Función para obtener el color del badge según el estado de la tarea
const getBadgeColor = (status) => {
  switch (status) {
    case "pending": return "warning";
    case "in_progress": return "info";
    case "completed": return "success";
    default: return "secondary";
  }
};
const getStatusLabel = (status) => {
  switch (status) {
    case "pending": return "Pendiente";
    case "in_progress": return "En Progreso";
    case "completed": return "Completada";
    default: return "Desconocido";
  }
};


export default CalendarioTareas;
