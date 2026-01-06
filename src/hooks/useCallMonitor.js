// src/hooks/useCallMonitor.js
// Hook personalizado para monitorear llamadas activas mediante polling

import { useState, useEffect, useRef } from 'react';
import axiosInstance from '../services/axios';

const POLLING_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '2000', 10);

const useCallMonitor = () => {
  const [llamadaActiva, setLlamadaActiva] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const ultimoSessionIdRef = useRef(null);
  const intervalRef = useRef(null);
  const llamadaTerminadaRef = useRef(false);

  // Función para consultar llamada activa
  const consultarLlamadaActiva = async () => {
    try {
      setCargando(true);
      setError(null);

      const response = await axiosInstance.get('/llamada-activa');
      const data = response.data;

      // Si hay una llamada activa
      if (data.llamada_activa && data.llamada_activa.session_id) {
        const sessionId = data.llamada_activa.session_id;

        // Verificar si es una nueva llamada (diferente session_id)
        if (sessionId !== ultimoSessionIdRef.current) {
          // Nueva llamada detectada
          setLlamadaActiva(data.llamada_activa);
          ultimoSessionIdRef.current = sessionId;
          llamadaTerminadaRef.current = false;

          // Reproducir sonido opcional (comentado por ahora)
          // try {
          //   const audio = new Audio('/notification-sound.mp3');
          //   audio.play().catch(() => {});
          // } catch (e) {}
        } else {
          // Misma llamada, actualizar datos
          setLlamadaActiva(data.llamada_activa);
        }

        // Verificar si la llamada terminó
        const estado = data.llamada_activa.estado?.toLowerCase() || '';
        if ((estado === 'completed' || estado === 'noanswer' || estado === 'disconnected') && !llamadaTerminadaRef.current) {
          llamadaTerminadaRef.current = true;
          
          // Registrar la llamada automáticamente
          if (data.llamada_activa.duracion) {
            registrarLlamada(sessionId, data.llamada_activa.duracion).catch(() => {
              // Silenciar errores al registrar
            });
          }

          // Cerrar modal después de 3 segundos
          setTimeout(() => {
            setLlamadaActiva(null);
            ultimoSessionIdRef.current = null;
            llamadaTerminadaRef.current = false;
          }, 3000);
        }
      } else {
        // No hay llamada activa
        setLlamadaActiva(null);
        // No limpiar ultimoSessionIdRef aquí para permitir detectar nuevas llamadas
      }
    } catch (err) {
      // Solo mostrar error si no es un error de conexión temporal
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || err.message || 'Error al consultar llamada activa');
      }
      
      // Si hay error de conexión, intentar reconexión cada 10 segundos
      if (!err.response || err.response.status >= 500) {
        // El intervalo seguirá intentando
      }
    } finally {
      setCargando(false);
    }
  };

  // Función para registrar llamada
  const registrarLlamada = async (sessionId, duracion) => {
    try {
      const fechaHora = new Date().toISOString();
      
      await axiosInstance.post('/registrar-llamada', {
        session_id: sessionId,
        duracion: duracion,
        fecha_hora: fechaHora,
      });
    } catch (err) {
      console.error('Error al registrar llamada:', err);
      // No lanzar error, solo loguear
    }
  };

  // Efecto para iniciar polling
  useEffect(() => {
    // Verificar si hay token antes de iniciar polling
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return;
    }

    // Consultar inmediatamente
    consultarLlamadaActiva();

    // Configurar intervalo de polling
    intervalRef.current = setInterval(() => {
      consultarLlamadaActiva();
    }, POLLING_INTERVAL);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Solo ejecutar una vez al montar

  // Función para cerrar modal manualmente
  const cerrarModal = () => {
    setLlamadaActiva(null);
    ultimoSessionIdRef.current = null;
  };

  return {
    llamadaActiva,
    cargando,
    error,
    cerrarModal,
  };
};

export default useCallMonitor;

