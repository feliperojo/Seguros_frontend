/**
 * Hook personalizado para manejar eventos de llamadas desde Laravel
 * Usa Laravel Echo (WebSockets) o Polling como fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import llamadasService from '../services/llamadasService';
import { buscarCliente } from '../services/apiService';
import { CALL_STATES } from '../utils/constants';

export const useRingCentral = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState(null); // 'echo' o 'polling'
  const [currentCall, setCurrentCall] = useState(null);
  const [callState, setCallState] = useState(CALL_STATES.IDLE);
  const [clienteData, setClienteData] = useState(null);
  const [isLoadingCliente, setIsLoadingCliente] = useState(false);
  const [error, setError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Refs para mantener referencias estables
  const eventHandlersRef = useRef({});

  /**
   * Maneja eventos de llamadas recibidos desde Laravel
   */
  const handleLlamadaEvent = useCallback(async (llamadaData) => {
    try {
      console.log('📞 Evento de llamada recibido:', llamadaData);

      const { direction, phoneNumber, status, startTime, cliente, clienteId } = llamadaData;

      // Actualizar estado de la llamada
      const callInfo = {
        id: llamadaData.id,
        direction: direction === 'Inbound' ? 'Inbound' : 'Outbound',
        status: status || 'active',
        phoneNumber: phoneNumber,
        startTime: startTime || new Date().toISOString(),
        clienteId: clienteId,
        raw: llamadaData.raw
      };

      setCurrentCall(callInfo);

      // Determinar el estado de la llamada
      if (status === 'setup' || status === 'ringing' || status === 'proceeding') {
        setCallState(direction === 'Inbound' ? CALL_STATES.INCOMING : CALL_STATES.OUTGOING);
        
        // Si ya viene con datos del cliente, usarlos
        if (cliente) {
          setClienteData(cliente);
        } else if (phoneNumber) {
          // Si no, buscar el cliente por teléfono
          await buscarClientePorTelefono(phoneNumber);
        }
      } else if (status === 'connected' || status === 'active' || status === 'hold') {
        setCallState(CALL_STATES.ACTIVE);
        
        // Si ya viene con datos del cliente, usarlos
        if (cliente) {
          setClienteData(cliente);
        } else if (phoneNumber && !clienteData) {
          await buscarClientePorTelefono(phoneNumber);
        }
      } else if (status === 'disconnected' || status === 'ended' || status === 'completed') {
        setCallState(CALL_STATES.ENDED);
        // Limpiar datos después de un tiempo
        setTimeout(() => {
          setCurrentCall(null);
          setCallState(CALL_STATES.IDLE);
          setClienteData(null);
        }, 5000);
      }
    } catch (error) {
      console.error('Error al procesar evento de llamada:', error);
      setError(error.message);
    }
  }, []);

  /**
   * Busca un cliente por número de teléfono
   */
  const buscarClientePorTelefono = useCallback(async (phoneNumber) => {
    if (!phoneNumber) return;

    setIsLoadingCliente(true);
    setError(null);

    try {
      const result = await buscarCliente(phoneNumber);
      
      if (result.encontrado && result.cliente) {
        setClienteData(result.cliente);
      } else {
        setClienteData({
          encontrado: false,
          telefono: phoneNumber
        });
      }
    } catch (error) {
      console.error('Error al buscar cliente:', error);
      setError(error.message || 'Error al buscar el cliente');
      setClienteData({
        encontrado: false,
        telefono: phoneNumber,
        error: error.message
      });
    } finally {
      setIsLoadingCliente(false);
    }
  }, []);

  /**
   * Maneja eventos de conexión
   */
  const handleConnectionEvent = useCallback((data) => {
    setIsConnected(true);
    setConnectionMethod(data?.method || null);
    setConnectionError(null);
  }, []);

  /**
   * Configura los event listeners
   */
  useEffect(() => {
    // Registrar handlers
    eventHandlersRef.current.llamada = handleLlamadaEvent;
    eventHandlersRef.current.connected = handleConnectionEvent;

    llamadasService.on('llamada', eventHandlersRef.current.llamada);
    llamadasService.on('connected', eventHandlersRef.current.connected);

    // Actualizar estado de conexión periódicamente
    const connectionInterval = setInterval(() => {
      const status = llamadasService.getConnectionStatus();
      setIsConnected(status.isConnected);
      setConnectionMethod(status.method);
    }, 5000);

    return () => {
      // Limpiar listeners
      if (eventHandlersRef.current.llamada) {
        llamadasService.off('llamada', eventHandlersRef.current.llamada);
      }
      if (eventHandlersRef.current.connected) {
        llamadasService.off('connected', eventHandlersRef.current.connected);
      }
      clearInterval(connectionInterval);
    };
  }, [handleLlamadaEvent, handleConnectionEvent]);

  /**
   * Conecta al servicio de llamadas (Echo o Polling)
   */
  const connect = useCallback(async () => {
    // Verificar que hay token de autenticación
    const token = localStorage.getItem('auth_token');
    if (!token) {
      const errorMessage = 'No hay token de autenticación. Por favor, inicia sesión.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }

    setIsConnecting(true);
    setError(null);
    setConnectionError(null);

    try {
      await llamadasService.connect();
      const status = llamadasService.getConnectionStatus();
      setIsConnected(status.isConnected);
      setConnectionMethod(status.method);
      return { success: true, method: status.method };
    } catch (error) {
      const errorMessage = error.message || 'Error al conectar con el servicio de llamadas';
      setConnectionError(errorMessage);
      setError(errorMessage);
      setIsConnected(false);
      return { success: false, error: errorMessage };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Desconecta del servicio
   */
  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      llamadasService.disconnect();
      setIsConnected(false);
      setConnectionMethod(null);
      setCurrentCall(null);
      setCallState(CALL_STATES.IDLE);
      setClienteData(null);
    } catch (error) {
      console.error('Error al desconectar:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Cierra el modal manualmente
   */
  const closeCallModal = useCallback(() => {
    setCurrentCall(null);
    setCallState(CALL_STATES.IDLE);
    setClienteData(null);
  }, []);

  return {
    // Estados
    isConnected,
    isConnecting,
    connectionMethod, // 'echo' o 'polling'
    currentCall,
    callState,
    clienteData,
    isLoadingCliente,
    error,
    connectionError,

    // Acciones
    connect,
    disconnect,
    buscarClientePorTelefono,
    closeCallModal
  };
};

