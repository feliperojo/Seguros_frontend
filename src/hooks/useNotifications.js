import { useState, useEffect, useCallback } from 'react';
import apiRequest from '../services/api';

/**
 * Hook para manejar notificaciones del usuario
 * @param {Object} currentUser - Usuario actual { id }
 * @returns {Object} { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }
 */
export const useNotifications = (currentUser) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deriveUnreadCount = useCallback((items, serverUnreadCount) => {
    if (typeof serverUnreadCount === 'number' && !Number.isNaN(serverUnreadCount)) {
      return serverUnreadCount;
    }
    return items.filter((notification) => notification.read === false).length;
  }, []);

  // Obtener notificaciones del backend
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!currentUser?.id) {
      setNotifications([]);
      setUnreadCount(0);
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
      if (response?.data?.data && Array.isArray(response.data.data)) {
        notificationsData = response.data.data;
      } else if (response?.data && Array.isArray(response.data)) {
        notificationsData = response.data;
      } else if (response?.notifications && Array.isArray(response.notifications)) {
        notificationsData = response.notifications;
      } else if (Array.isArray(response)) {
        notificationsData = response;
      }

      const normalizedNotifications = notificationsData.map((notification) => ({
        ...notification,
        read: typeof notification.read === 'boolean'
          ? notification.read
          : Boolean(notification.read_at),
      }));

      setNotifications(normalizedNotifications);
      const unreadFromServer =
        response?.unread_count ??
        response?.data?.unread_count ??
        response?.meta?.unread_count;

      setUnreadCount(deriveUnreadCount(normalizedNotifications, unreadFromServer));
    } catch (err) {
      // Si el endpoint no existe aún, no mostrar error (backend aún no implementado)
      if (err.response?.status !== 404 && err.response?.status !== 501) {
        console.warn("Error al cargar notificaciones (endpoint puede no existir aún):", err);
        setError(err.message);
      }
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentUser, deriveUnreadCount]);

  // Marcar notificación como leída
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiRequest(`notifications/${notificationId}/read`, "PATCH");
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 501) {
        console.error("Error al marcar notificación como leída:", err);
      }
    } finally {
      let shouldDecrement = false;
      setNotifications((prev) =>
        prev.map((notification) => {
          if (notification.id !== notificationId) {
            return notification;
          }
          if (notification.read) {
            return notification;
          }
          shouldDecrement = true;
          return {
            ...notification,
            read: true,
            read_at: notification.read_at || new Date().toISOString(),
          };
        })
      );
      if (shouldDecrement) {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    }
  }, []);

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest("notifications/read-all", "PATCH");
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 501) {
        console.error("Error al marcar todas como leídas:", err);
      }
    } finally {
      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          read: true,
          read_at: notification.read_at || nowIso,
        }))
      );
      setUnreadCount(0);
    }
  }, []);

  // Cargar notificaciones al montar y cuando cambia el usuario
  useEffect(() => {
    if (currentUser?.id) {
      fetchNotifications(false);

      // Refrescar cada 30 segundos (opcional, para notificaciones en tiempo real)
      const interval = setInterval(() => {
        fetchNotifications(false);
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

