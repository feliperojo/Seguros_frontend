// src/components/CallIdentifier/CallIdentifierContainer.jsx
// Componente principal que integra el sistema de identificación de llamadas
// Usa WebSocket (Laravel Echo) para recibir eventos en tiempo real

import React from 'react';
import useIncomingCalls from '../../hooks/useIncomingCalls';
import IncomingCallModal from './IncomingCallModal';

const CallIdentifierContainer = () => {
  // Hook para WebSocket (Laravel Echo)
  const wsData = useIncomingCalls();

  return (
    <IncomingCallModal
      show={!!wsData.incomingCall}
      incomingCall={wsData.incomingCall}
      clienteData={wsData.clienteData}
      buscandoCliente={wsData.buscandoCliente}
      onClose={wsData.cerrarModal}
    />
  );
};

export default CallIdentifierContainer;

