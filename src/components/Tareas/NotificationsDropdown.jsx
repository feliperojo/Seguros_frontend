import React, { useRef, useEffect, useState } from 'react';
import { FaBell, FaCircle, FaCheckDouble, FaAt, FaTasks, FaClipboardCheck } from 'react-icons/fa';
import { Spinner } from 'react-bootstrap';
import { useNotifications } from '../../hooks/useNotifications';
import { Link } from 'react-router-dom';
import apiRequest from '../../services/api';
import { listTasks as listAuditoriaTasks } from '../../services/auditoriasTasksService';

/**
 * Componente dropdown mejorado de notificaciones
 * Muestra tanto notificaciones de menciones como tareas pendientes
 * @param {Object} currentUser - Usuario actual
 * @param {number} pendientes - Número de tareas pendientes (opcional)
 * @param {boolean} loadingTask - Indica si se está cargando una tarea (opcional)
 * @param {Function} onNotificationClick - Callback cuando se hace clic en una notificación
 */
const NotificationsDropdown = ({ currentUser, pendientes = 0, loadingTask = false, onNotificationClick }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications(currentUser);

  // ✅ Estado para tareas pendientes (operativas y de auditoría)
  const [pendingTasks, setPendingTasks] = useState([]);
  const [loadingPendingTasks, setLoadingPendingTasks] = useState(false);

  // ✅ Total de notificaciones: menciones + tareas pendientes (si no están en notificaciones)
  // Si el backend ya incluye tareas pendientes en notificaciones, no duplicar
  const totalUnreadCount = unreadCount > 0 ? unreadCount : (pendientes > 0 ? pendientes : 0);

  // ✅ Cargar lista de tareas pendientes cuando se abre el dropdown (operativas y de auditoría)
  useEffect(() => {
    if (showDropdown && pendientes > 0 && pendingTasks.length === 0 && !loadingPendingTasks) {
      const loadPendingTasks = async () => {
        setLoadingPendingTasks(true);
        try {
          // ✅ Obtener tareas operativas pendientes
          const response = await apiRequest("tareas_operativas?per_page=10", "GET");
          
          let tareasData = [];
          if (response?.data?.data) {
            tareasData = Array.isArray(response.data.data) ? response.data.data : [];
          } else if (response?.data) {
            tareasData = Array.isArray(response.data) ? response.data : [];
          } else if (Array.isArray(response)) {
            tareasData = response;
          }

          // Filtrar solo tareas pendientes (pending, processing, in_progress)
          const estadosPendientes = ['pending', 'processing', 'in_progress'];
          const tareasPendientes = tareasData.filter(t => {
            const estado = t.status || t.estado || t.state;
            return estadosPendientes.includes(estado?.toLowerCase());
          });

          // ✅ Obtener tareas de auditoría pendientes
          let tareasAuditoriaPendientes = [];
          try {
            const auditoriaResponse = await listAuditoriaTasks({ 
              per_page: 10,
              status: 'pending,in_progress'
            });
            
            if (auditoriaResponse?.data && Array.isArray(auditoriaResponse.data)) {
              tareasAuditoriaPendientes = auditoriaResponse.data
                .filter(t => {
                  const estado = t.status;
                  return estadosPendientes.includes(estado?.toLowerCase());
                })
                .map(t => ({ ...t, tipo: 'auditoria' }));
            }
          } catch (auditError) {
            console.warn("Error al cargar tareas de auditoría pendientes:", auditError);
            // Continuar sin tareas de auditoría si hay error
          }

          // ✅ Combinar ambas listas
          const todasLasTareas = [...tareasPendientes, ...tareasAuditoriaPendientes];
          
          // Ordenar por fecha de creación (más recientes primero)
          todasLasTareas.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.scheduled_date || 0);
            const fechaB = new Date(b.created_at || b.scheduled_date || 0);
            return fechaB - fechaA;
          });

          setPendingTasks(todasLasTareas);
        } catch (error) {
          console.error("Error al cargar tareas pendientes:", error);
          setPendingTasks([]);
        } finally {
          setLoadingPendingTasks(false);
        }
      };

      loadPendingTasks();
    }
  }, [showDropdown, pendientes, pendingTasks.length, loadingPendingTasks]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  // Formatear fecha relativa
  const formatFechaRelativa = (fecha) => {
    if (!fecha) return 'Hace un momento';
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      
      const ahora = new Date();
      const diffMs = ahora - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Hace un momento';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      
      // Formato dd/mm/yyyy
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return fecha;
    }
  };

  // Manejar clic en notificación
  const handleNotificationClick = (notification) => {
    // Marcar como leída
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    // Cerrar dropdown
    setShowDropdown(false);

    // Ejecutar callback si existe
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  // Manejar marcar todas como leídas
  const handleMarkAllAsRead = async () => {
    if (unreadCount > 0) {
      await markAllAsRead();
    }
  };

  return (
    <div ref={dropdownRef} className="position-relative">
      {/* ✅ Icono de campana mejorado con badge (similar al estilo existente) */}
      <div className="tarea-alerta-wrapper position-relative">
          <button
            type="button"
            className="tarea-alerta-button"
            onClick={() => {
              const newShowState = !showDropdown;
              setShowDropdown(newShowState);
              if (newShowState) {
                fetchNotifications(false); // Cargar todas al abrir
                // Resetear lista de tareas pendientes para recargarlas
                if (pendientes > 0) {
                  setPendingTasks([]);
                }
              }
            }}
            title="Notificaciones y tareas pendientes"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer'
            }}
          >
          <i className="bi bi-bell-fill"></i>
          {(totalUnreadCount > 0) && (
            <span className="tarea-badge">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ✅ Dropdown de notificaciones mejorado */}
      {showDropdown && (
        <>
          {/* Overlay para cerrar al hacer clic fuera */}
          <div
            className="position-fixed"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              backgroundColor: 'transparent'
            }}
            onClick={() => setShowDropdown(false)}
          />
          {/* Dropdown - usar position-absolute para que sea relativo al contenedor padre */}
          <div
            className="position-absolute bg-white rounded shadow-lg border"
            style={{
              width: '400px',
              maxHeight: '600px',
              zIndex: 10000, // Z-index muy alto para estar por encima de todo
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              top: '100%',
              right: '0',
              marginTop: '8px',
              position: 'absolute' // Asegurar que sea absolute
            }}
            onClick={(e) => e.stopPropagation()} // Prevenir cierre al hacer clic dentro
          >
          {/* Header del dropdown */}
          <div
            className="d-flex justify-content-between align-items-center p-3 border-bottom"
            style={{ backgroundColor: '#f8f9fa' }}
          >
            <div className="d-flex align-items-center gap-2">
              <FaBell className="text-primary" size={18} />
              <strong style={{ fontSize: '0.95rem', color: '#212529' }}>
                Notificaciones
                {(totalUnreadCount > 0) && (
                  <span className="badge bg-primary ms-2" style={{ fontSize: '0.75rem' }}>
                    {totalUnreadCount}
                  </span>
                )}
              </strong>
            </div>
            {unreadCount > 0 && (
              <button
                className="btn btn-sm btn-link p-0 text-primary"
                onClick={handleMarkAllAsRead}
                title="Marcar todas como leídas"
                style={{ fontSize: '0.8rem', textDecoration: 'none' }}
              >
                <FaCheckDouble size={12} className="me-1" />
                Todas
              </button>
            )}
          </div>

          {/* ✅ Lista de notificaciones mejorada con secciones separadas */}
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {loading || loadingTask ? (
              <div className="d-flex align-items-center justify-content-center p-4">
                <Spinner size="sm" animation="border" variant="primary" className="me-2" />
                <span className="text-muted small">
                  {loadingTask ? 'Cargando tarea...' : 'Cargando notificaciones...'}
                </span>
              </div>
            ) : (
              <>
                {/* ✅ SECCIÓN 1: Menciones (Notificaciones del backend) */}
                {notifications.length > 0 && notifications.some(n => n.type === 'mention') && (
                  <>
                    <div 
                      className="px-3 py-2 border-bottom"
                      style={{ 
                        backgroundColor: '#f0f7ff',
                        borderLeft: '4px solid #1976d2'
                      }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <FaAt size={14} style={{ color: '#1976d2' }} />
                        <strong style={{ fontSize: '0.85rem', color: '#1976d2' }}>
                          Menciones ({notifications.filter(n => n.type === 'mention').length})
                        </strong>
                      </div>
                    </div>
                    
                    {notifications
                      .filter(notification => notification.type === 'mention')
                      .map((notification) => {
                        const isUnread = !notification.read_at;
                        const hasComment = !!notification.comment_id;
                        const hasTask = !!notification.task_id;

                        return (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className="p-3 border-bottom cursor-pointer"
                            style={{
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                              backgroundColor: isUnread ? '#f0f7ff' : 'white',
                              borderLeft: isUnread ? '4px solid #1976d2' : '4px solid transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#e3f2fd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isUnread ? '#f0f7ff' : 'white';
                            }}
                          >
                            <div className="d-flex align-items-start gap-2">
                              {/* Icono de mención */}
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2',
                                }}
                              >
                                <FaAt size={14} />
                              </div>

                              {/* Contenido de la notificación */}
                              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                <div className="d-flex justify-content-between align-items-start mb-1">
                                  <div className="flex-grow-1">
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                      <strong
                                        style={{
                                          fontSize: '0.85rem',
                                          color: isUnread ? '#212529' : '#6c757d',
                                          fontWeight: isUnread ? 600 : 500,
                                        }}
                                      >
                                        {notification.title || 'Fuiste mencionado'}
                                      </strong>
                                      {isUnread && (
                                        <FaCircle
                                          size={6}
                                          style={{ color: '#1976d2' }}
                                        />
                                      )}
                                    </div>
                                    
                                    {/* Mensaje con información del contexto */}
                                    {notification.message && (
                                      <p
                                        className="mb-1"
                                        style={{
                                          fontSize: '0.75rem',
                                          color: '#495057',
                                          lineHeight: '1.4',
                                        }}
                                      >
                                        {notification.message}
                                      </p>
                                    )}
                                    
                                    {/* Badges de contexto */}
                                    <div className="d-flex gap-1 flex-wrap mt-1">
                                      {hasTask && (
                                        <span
                                          className="badge"
                                          style={{ 
                                            fontSize: '0.65rem',
                                            backgroundColor: '#6c757d',
                                            color: '#fff'
                                          }}
                                        >
                                          📋 Tarea #{notification.task_id}
                                        </span>
                                      )}
                                      {hasComment && (
                                        <span
                                          className="badge"
                                          style={{ 
                                            fontSize: '0.65rem',
                                            backgroundColor: '#17a2b8',
                                            color: '#fff'
                                          }}
                                        >
                                          💬 Comentario #{notification.comment_id}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <span
                                    className="text-muted"
                                    style={{ fontSize: '0.7rem' }}
                                  >
                                    {formatFechaRelativa(notification.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </>
                )}

                {/* ✅ SECCIÓN 2: Tareas Pendientes/En Progreso */}
                {(() => {
                  // Combinar tareas pendientes del frontend con notificaciones de tareas del backend
                  const taskNotifications = notifications.filter(n => 
                    n.type !== 'mention' && (n.type === 'task_assigned' || n.type === 'task_pending' || n.type === 'task')
                  );
                  const allPendingTasks = [...pendingTasks];
                  
                  // Si hay notificaciones de tareas, agregarlas si no están ya en pendingTasks
                  taskNotifications.forEach(notif => {
                    if (notif.task_id && !allPendingTasks.find(t => (t.id || t.task_id) === notif.task_id)) {
                      allPendingTasks.push({
                        id: notif.task_id,
                        task_id: notif.task_id,
                        titulo: notif.title || 'Tarea',
                        status: 'pending',
                        created_at: notif.created_at,
                        notification_id: notif.id,
                      });
                    }
                  });

                  const hasPendingTasks = (pendientes > 0 && allPendingTasks.length > 0) || taskNotifications.length > 0;
                  
                  if (hasPendingTasks) {
                    return (
                      <>
                        {/* Separador visual si hay menciones arriba */}
                        {notifications.some(n => n.type === 'mention') && (
                          <div className="border-top" style={{ borderColor: '#dee2e6' }} />
                        )}
                        
                        {/* Encabezado de sección */}
                        <div 
                          className="px-3 py-2 border-bottom"
                          style={{ 
                            backgroundColor: '#fff8e1',
                            borderLeft: '4px solid #ffc107'
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <FaTasks size={14} style={{ color: '#ffc107' }} />
                            <strong style={{ fontSize: '0.85rem', color: '#856404' }}>
                              Tareas Pendientes/En Progreso ({allPendingTasks.length || pendientes || 0})
                            </strong>
                          </div>
                        </div>

                        {/* Lista de tareas */}
                        {loadingPendingTasks ? (
                          <div className="d-flex align-items-center justify-content-center p-3">
                            <Spinner size="sm" animation="border" variant="warning" className="me-2" />
                            <span className="text-muted small">Cargando tareas...</span>
                          </div>
                        ) : allPendingTasks.length > 0 ? (
                          allPendingTasks.slice(0, 10).map((task) => {
                            const taskId = task.id || task.task_id || task.task?.id;
                            const taskTitle = task.titulo || task.title || task.note || task.response_note || 'Tarea sin título';
                            const taskStatus = task.status || task.estado || 'pending';
                            const clienteNombre = task.log?.cliente?.nombre_completo || task.cliente?.nombre_completo || 'Sin cliente';
                            const fechaTarea = task.created_at || task.scheduled_date;
                            const esAuditoria = task.tipo === 'auditoria' || task.auditoria || task.item || task.run_id;
                            const taskIdField = esAuditoria ? 'audit_task_id' : 'task_id';
                            
                            return (
                              <div
                                key={taskId || `task-${task.created_at}`}
                                onClick={() => {
                                  if (onNotificationClick && taskId) {
                                    onNotificationClick({ 
                                      type: 'task_pending', 
                                      [taskIdField]: taskId,
                                      task_id: taskId, // Mantener para compatibilidad
                                      task: { ...task, tipo: esAuditoria ? 'auditoria' : 'operativa' }
                                    });
                                  }
                                  setShowDropdown(false);
                                }}
                                className="p-3 border-bottom cursor-pointer"
                                style={{
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease',
                                  backgroundColor: 'white',
                                  borderLeft: esAuditoria ? '4px solid #64748b' : '4px solid #ffc107',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = esAuditoria ? '#f1f5f9' : '#fff8e1';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'white';
                                }}
                              >
                                <div className="d-flex align-items-start gap-2">
                                  <div
                                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      backgroundColor: esAuditoria 
                                        ? (taskStatus === 'in_progress' ? '#cbd5e1' : '#e2e8f0')
                                        : (taskStatus === 'in_progress' ? '#e3f2fd' : '#fff3cd'),
                                      color: esAuditoria 
                                        ? '#475569' 
                                        : (taskStatus === 'in_progress' ? '#1976d2' : '#856404'),
                                    }}
                                  >
                                    {esAuditoria ? <FaClipboardCheck size={14} /> : <FaTasks size={14} />}
                                  </div>
                                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                      <strong
                                        className="d-block"
                                        style={{
                                          fontSize: '0.85rem',
                                          color: '#212529',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {esAuditoria ? '🔍' : '📋'} {taskTitle.length > 50 ? taskTitle.substring(0, 50) + '...' : taskTitle}
                                      </strong>
                                      {esAuditoria && (
                                        <span
                                          className="badge"
                                          style={{ 
                                            fontSize: '0.6rem',
                                            backgroundColor: '#64748b',
                                            color: '#fff'
                                          }}
                                        >
                                          Auditoría
                                        </span>
                                      )}
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mt-1">
                                      <span
                                        className="text-muted"
                                        style={{ fontSize: '0.7rem' }}
                                      >
                                        👤 {clienteNombre}
                                      </span>
                                      <span
                                        className="badge"
                                        style={{ 
                                          fontSize: '0.65rem',
                                          backgroundColor: esAuditoria
                                            ? (taskStatus === 'pending' ? '#94a3b8' : '#64748b')
                                            : (taskStatus === 'pending' ? '#ffc107' : '#17a2b8'),
                                          color: esAuditoria ? '#fff' : (taskStatus === 'pending' ? '#000' : '#fff')
                                        }}
                                      >
                                        {taskStatus === 'pending' ? 'Pendiente' : taskStatus === 'in_progress' ? 'En progreso' : taskStatus}
                                      </span>
                                    </div>
                                    {fechaTarea && (
                                      <div className="mt-1">
                                        <span
                                          className="text-muted"
                                          style={{ fontSize: '0.7rem' }}
                                        >
                                          📅 {formatFechaRelativa(fechaTarea)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <FaCircle
                                    className="flex-shrink-0"
                                    size={8}
                                    style={{ color: esAuditoria ? '#64748b' : '#ffc107', marginTop: '4px' }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-3 text-center text-muted">
                            <p className="mb-0 small">No hay tareas pendientes</p>
                          </div>
                        )}
                        
                        {/* Mostrar mensaje si hay más tareas pendientes */}
                        {allPendingTasks.length > 10 && (
                          <div className="p-2 text-center border-top" style={{ backgroundColor: '#fff8e1' }}>
                            <small className="text-muted">
                              Y {allPendingTasks.length - 10} tarea{allPendingTasks.length - 10 > 1 ? 's' : ''} más...
                            </small>
                          </div>
                        )}
                      </>
                    );
                  }
                  return null;
                })()}

                {/* Mensaje cuando no hay nada */}
                {notifications.length === 0 && pendientes === 0 && !loading && (
                  <div className="text-center p-4 text-muted">
                    <FaBell size={32} className="mb-2 opacity-50" />
                    <p className="mb-0 small">No hay notificaciones</p>
                    <p className="mb-0" style={{ fontSize: '0.75rem', color: '#adb5bd' }}>
                      Te notificaremos cuando seas mencionado en una tarea
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ✅ Footer mejorado con acción para ver todas */}
          {(notifications.length > 0 || pendientes > 0) && (
            <div
              className="text-center p-2 border-top"
              style={{ backgroundColor: '#f8f9fa' }}
            >
              <Link
                to="/Herramientas/operaciones"
                className="btn btn-sm btn-link text-primary p-0"
                onClick={() => {
                  setShowDropdown(false);
                  if (onNotificationClick) {
                    onNotificationClick({ type: 'view_all' });
                  }
                }}
                style={{ 
                  fontSize: '0.8rem',
                  textDecoration: 'none'
                }}
              >
                Ver todas las notificaciones
              </Link>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsDropdown;

