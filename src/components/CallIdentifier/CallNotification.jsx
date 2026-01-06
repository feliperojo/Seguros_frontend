/**
 * Componente que muestra notificaciones toast para eventos de llamadas
 * y el estado de conexión con RingCentral
 */

import React, { useEffect, useRef } from 'react';
import useToast from '../../hooks/useToast';

const CallNotification = ({ 
  connectionError, 
  error, 
  isConnected, 
  callState,
  currentCall 
}) => {
  const { showError, showSuccess, showInfo } = useToast();
  const hasShownConnectionSuccess = useRef(false);
  const hasShownCallNotification = useRef(new Set());

  // Mostrar notificación cuando hay error de conexión
  useEffect(() => {
    if (connectionError) {
      showError(connectionError);
    }
  }, [connectionError, showError]);

  // Mostrar notificación cuando hay un error general
  useEffect(() => {
    if (error && !connectionError) {
      showError(error);
    }
  }, [error, connectionError, showError]);

  // Mostrar notificación cuando se conecta (solo una vez)
  useEffect(() => {
    if (isConnected && !hasShownConnectionSuccess.current) {
      showSuccess('Conexión establecida con RingCentral');
      hasShownConnectionSuccess.current = true;
    } else if (!isConnected) {
      hasShownConnectionSuccess.current = false;
    }
  }, [isConnected, showSuccess]);

  // Mostrar notificación cuando se detecta una llamada
  useEffect(() => {
    if (currentCall && (callState === 'incoming' || callState === 'outgoing')) {
      const callId = currentCall.id || currentCall.phoneNumber;
      
      // Solo mostrar una vez por llamada
      if (!hasShownCallNotification.current.has(callId)) {
        const tipo = currentCall.direction === 'Inbound' ? 'entrante' : 'saliente';
        showInfo(
          `Llamada ${tipo} desde ${currentCall.phoneNumber || 'número desconocido'}`
        );
        hasShownCallNotification.current.add(callId);
      }
    }
  }, [currentCall, callState, showInfo]);

  return null; // Este componente solo maneja notificaciones, no renderiza UI
};

export default CallNotification;

