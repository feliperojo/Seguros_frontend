// src/components/CallIdentifier/CallIdentifierContainer.jsx
// Componente principal que integra todo el sistema de identificación de llamadas

import React, { useState, useEffect } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import useCallMonitor from '../../hooks/useCallMonitor';
import CallModal from './CallModal';
import CallNotification from './CallNotification';
import useToast from '../../hooks/useToast';

const CallIdentifierContainer = () => {
  const { llamadaActiva, cargando, error, cerrarModal } = useCallMonitor();
  const [showNotification, setShowNotification] = useState(false);
  const [ultimaLlamadaId, setUltimaLlamadaId] = useState(null);
  const toast = useToast();

  // Mostrar notificación cuando hay nueva llamada
  useEffect(() => {
    if (llamadaActiva) {
      const sessionId = llamadaActiva.session_id || llamadaActiva.id;
      
      // Solo mostrar notificación si es una nueva llamada
      if (sessionId !== ultimaLlamadaId) {
        setShowNotification(true);
        setUltimaLlamadaId(sessionId);
        
        // Reproducir sonido opcional (comentado por ahora)
        // try {
        //   const audio = new Audio('/notification-sound.mp3');
        //   audio.play().catch(() => {});
        // } catch (e) {}
      }
    } else {
      setShowNotification(false);
      setUltimaLlamadaId(null);
    }
  }, [llamadaActiva, ultimaLlamadaId]);

  // Mostrar error si existe
  useEffect(() => {
    if (error && error !== 'Error al consultar llamada activa') {
      // Solo mostrar errores importantes, no errores de conexión temporales
      if (!error.includes('Network Error') && !error.includes('timeout')) {
        toast.showError(error);
      }
    }
  }, [error, toast]);

  return (
    <>
      {/* Notificación toast */}
      <CallNotification
        show={showNotification}
        llamada={llamadaActiva}
        onClose={() => setShowNotification(false)}
      />

      {/* Modal de llamada */}
      <CallModal
        show={!!llamadaActiva}
        llamada={llamadaActiva}
        onClose={cerrarModal}
      />

      {/* Indicador de carga discreto (opcional) */}
      {cargando && !llamadaActiva && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 1050,
            opacity: 0.7,
          }}
        >
          <Spinner size="sm" animation="border" variant="primary" />
        </div>
      )}

      {/* Alerta de error de conexión (discreta) */}
      {error && error.includes('Network Error') && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 1050,
            maxWidth: '300px',
          }}
        >
          <Alert variant="warning" className="mb-0 py-2 px-3" style={{ fontSize: '0.85rem' }}>
            <small>Reintentando conexión...</small>
          </Alert>
        </div>
      )}
    </>
  );
};

export default CallIdentifierContainer;

