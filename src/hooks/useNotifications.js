import { useState, useEffect, useCallback } from 'react';
import apiRequest from '../services/api';

/**
 * Hook para manejar notificaciones del usuario
 * @param {Object} currentUser - Usuario actual { id }
 * @returns {Object} { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }
 */
export const useNotifications = (currentUser) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener notificaciones del backend
  const fetchNotifications = useCallback(async (unreadOnly = true) => {
    if (!currentUser?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Intentar obtener notificaciones del backend
      // Si el endpoint no existe aún, retornar array vacío (no romper funcionalidad)
      const endpoint = unreadOnly 
        ? `notifications?unread_only=true&per_page=50`
        : `notifications?per_page=50`;
      
      const response = await apiRequest(endpoint, "GET");
      
      let notificationsData = [];
      if (response?.data && Array.isArray(response.data)) {
        notificationsData = response.data;
      } else if (response?.notifications && Array.isArray(response.notifications)) {
        notificationsData = response.notifications;
      } else if (Array.isArray(response)) {
        notificationsData = response;
      }

      setNotifications(notificationsData);
    } catch (err) {
      // Si el endpoint no existe aún, no mostrar error (backend aún no implementado)
      if (err.response?.status !== 404 && err.response?.status !== 501) {
        console.warn("Error al cargar notificaciones (endpoint puede no existir aún):", err);
        setError(err.message);
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Marcar notificación como leída
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiRequest(`notifications/${notificationId}/read`, "PATCH");
      
      // Actualizar estado local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      // Si el endpoint no existe aún, actualizar solo localmente
      if (err.response?.status === 404 || err.response?.status === 501) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
      } else {
        console.error("Error al marcar notificación como leída:", err);
      }
    }
  }, []);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest("notifications/read-all", "PATCH");
      
      // Actualizar estado local
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      // Si el endpoint no existe aún, actualizar solo localmente
      if (err.response?.status === 404 || err.response?.status === 501) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
        );
      } else {
        console.error("Error al marcar todas como leídas:", err);
      }
    }
  }, []);

  // Contar notificaciones no leídas
  const unreadCount = notifications.filter(n => !n.read_at).length;

  // Cargar notificaciones al montar y cuando cambia el usuario
  useEffect(() => {
    if (currentUser?.id) {
      fetchNotifications(true);
      
      // Refrescar cada 30 segundos (opcional, para notificaciones en tiempo real)
      const interval = setInterval(() => {
        fetchNotifications(true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [currentUser, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};

export default useNotifications;

