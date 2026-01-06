// src/hooks/useCallMonitor.js
// Hook personalizado para monitorear llamadas activas mediante polling
// Consulta el backend que recibe webhooks de RingCentral

import { useState, useEffect, useRef } from 'react';
import apiRequest from '../services/api';
import { buscarCliente } from '../services/apiService';

const POLLING_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '2000', 10);

const useCallMonitor = () => {
  const [llamadaActiva, setLlamadaActiva] = useState(null);
  const [clienteData, setClienteData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [error, setError] = useState(null);
  const ultimoSessionIdRef = useRef(null);
  const intervalRef = useRef(null);

  // Función para buscar cliente por teléfono
  const buscarClientePorTelefono = async (telefono) => {
    if (!telefono) return null;

    try {
      setBuscandoCliente(true);
      const resultado = await buscarCliente(telefono);
      
      if (resultado.encontrado && resultado.cliente) {
        return resultado.cliente;
      }
      return null;
    } catch (err) {
      console.error('Error al buscar cliente:', err);
      return null;
    } finally {
      setBuscandoCliente(false);
    }
  };

  // Función para consultar llamada activa
  const consultarLlamadaActiva = async () => {
    try {
      setCargando(true);
      setError(null);

      const response = await apiRequest('/llamada-activa', 'GET');
      
      // Si hay una llamada activa
      if (response.llamada_activa && response.llamada_activa.session_id) {
        const sessionId = response.llamada_activa.session_id;
        const telefono = response.llamada_activa.numero || 
                        response.llamada_activa.telefono || 
                        response.llamada_activa.phone_number;

        // Verificar si es una nueva llamada (diferente session_id)
        if (sessionId !== ultimoSessionIdRef.current) {
          // Nueva llamada detectada
          ultimoSessionIdRef.current = sessionId;
          setLlamadaActiva({
            ...response.llamada_activa,
            telefono: telefono
          });

          // Buscar cliente por teléfono
          if (telefono) {
            const cliente = await buscarClientePorTelefono(telefono);
            setClienteData(cliente);
          } else {
            setClienteData(null);
          }
        } else {
          // Misma llamada, actualizar datos
          setLlamadaActiva({
            ...response.llamada_activa,
            telefono: telefono
          });
        }

        // Verificar si la llamada terminó
        const estado = response.llamada_activa.estado?.toLowerCase() || '';
        if (estado === 'completed' || estado === 'noanswer' || estado === 'disconnected') {
          // Cerrar modal después de 3 segundos
          setTimeout(() => {
            setLlamadaActiva(null);
            setClienteData(null);
            ultimoSessionIdRef.current = null;
          }, 3000);
        }
      } else {
        // No hay llamada activa
        if (llamadaActiva) {
          // Limpiar después de un breve delay
          setTimeout(() => {
            setLlamadaActiva(null);
            setClienteData(null);
          }, 1000);
        }
      }
    } catch (err) {
      // Solo mostrar error si no es un error de conexión temporal
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || err.message || 'Error al consultar llamada activa');
      }
    } finally {
      setCargando(false);
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
    setClienteData(null);
    ultimoSessionIdRef.current = null;
  };

  return {
    llamadaActiva,
    clienteData,
    cargando,
    buscandoCliente,
    error,
    cerrarModal,
  };
};

export default useCallMonitor;

