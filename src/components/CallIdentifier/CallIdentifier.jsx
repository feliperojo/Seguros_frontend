/**
 * Componente principal que integra todo el sistema de identificación de llamadas
 * Se conecta a Laravel que recibe webhooks de RingCentral
 * Debe ser incluido en el layout principal de la aplicación
 */

import React, { useState, useEffect } from 'react';
import { Button, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useRingCentral } from '../../hooks/useRingCentral';
import CallModal from './CallModal';
import CallNotification from './CallNotification';
import DiagnosticoLlamadas from './DiagnosticoLlamadas';
import { CALL_STATES } from '../../utils/constants';

const CallIdentifier = () => {
  const {
    isConnected,
    isConnecting,
    connectionMethod,
    currentCall,
    callState,
    clienteData,
    isLoadingCliente,
    error,
    connectionError,
    connect,
    disconnect,
    closeCallModal,
    crearClienteRapido,
    agregarNota
  } = useRingCentral();

  const [showCallModal, setShowCallModal] = useState(false);

  // Mostrar modal cuando hay una llamada activa
  useEffect(() => {
    const shouldShow = currentCall && 
      (callState === CALL_STATES.INCOMING || 
       callState === CALL_STATES.OUTGOING || 
       callState === CALL_STATES.ACTIVE);
    
    setShowCallModal(shouldShow);
  }, [currentCall, callState]);

  // Auto-conectar cuando el usuario está autenticado
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token && !isConnected && !isConnecting) {
      connect();
    }
  }, [isConnected, isConnecting, connect]);


  // Manejar desconexión
  const handleDisconnect = async () => {
    await disconnect();
  };

  // Obtener el estado visual de la conexión
  const getConnectionStatus = () => {
    if (isConnecting) {
      return { variant: 'warning', text: 'Conectando...', icon: 'hourglass-split' };
    }
    if (isConnected) {
      const methodText = connectionMethod === 'echo' ? ' (WebSocket)' : ' (Polling)';
      return { 
        variant: 'success', 
        text: `Conectado${methodText}`, 
        icon: connectionMethod === 'echo' ? 'wifi' : 'arrow-repeat' 
      };
    }
    return { variant: 'secondary', text: 'Desconectado', icon: 'x-circle' };
  };

  const status = getConnectionStatus();

  return (
    <>
      {/* Indicador de estado de conexión */}
      <OverlayTrigger
        placement="left"
        overlay={
          <Tooltip>
            {isConnected 
              ? `Conectado a Laravel - Recibiendo llamadas${connectionMethod === 'echo' ? ' (WebSocket)' : ' (Polling)'}`
              : 'No conectado - Las llamadas no se detectarán'}
          </Tooltip>
        }
      >
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-end'
          }}
        >
          {/* Botón de estado */}
          <Button
            variant={status.variant}
            size="sm"
            style={{
              borderRadius: '50px',
              padding: '8px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <i className={`bi bi-${status.icon}`}></i>
            <span className="ms-2 d-none d-md-inline">{status.text}</span>
            {currentCall && (
              <Badge bg="danger" className="ms-2">
                <i className="bi bi-telephone-fill"></i>
              </Badge>
            )}
          </Button>

          {/* Botones de acción rápida */}
          <div className="d-flex gap-2">
            {isConnected ? (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={handleDisconnect}
                disabled={isConnecting}
                style={{ borderRadius: '50px' }}
                title="Desconectar"
              >
                <i className="bi bi-power"></i>
              </Button>
            ) : (
              <Button
                variant="outline-success"
                size="sm"
                onClick={connect}
                disabled={isConnecting}
                style={{ borderRadius: '50px' }}
                title="Conectar"
              >
                <i className="bi bi-play-fill"></i>
              </Button>
            )}
          </div>
        </div>
      </OverlayTrigger>

      {/* Modal de llamada */}
      <CallModal
        show={showCallModal}
        onClose={closeCallModal}
        callState={callState}
        currentCall={currentCall}
        clienteData={clienteData}
        isLoadingCliente={isLoadingCliente}
        onCrearCliente={crearClienteRapido}
        onAgregarNota={agregarNota}
      />

      {/* Notificaciones */}
      <CallNotification
        connectionError={connectionError}
        error={error}
        isConnected={isConnected}
        callState={callState}
        currentCall={currentCall}
      />

      {/* Diagnóstico (solo en desarrollo o si hay error) */}
      {(import.meta.env.DEV || error || connectionError) && (
        <DiagnosticoLlamadas />
      )}
    </>
  );
};

export default CallIdentifier;

