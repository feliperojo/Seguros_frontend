// src/components/CallIdentifier/CallIdentifierContainer.jsx
// Componente principal que integra el sistema de identificación de llamadas
// Combina polling (useCallMonitor) y WebSocket (useIncomingCalls)

import React from 'react';
import useCallMonitor from '../../hooks/useCallMonitor';
import useIncomingCalls from '../../hooks/useIncomingCalls';
import IncomingCallModal from './IncomingCallModal';
import IncomingCallDiagnostic from './IncomingCallDiagnostic';

const CallIdentifierContainer = () => {
  // Hook para polling (fallback)
  const pollingData = useCallMonitor();
  
  // Hook para WebSocket (preferido)
  const wsData = useIncomingCalls();

  // Priorizar WebSocket si hay datos, sino usar polling
  const activeData = wsData.incomingCall ? wsData : {
    incomingCall: pollingData.llamadaActiva,
    clienteData: pollingData.clienteData,
    buscandoCliente: pollingData.buscandoCliente,
    error: pollingData.error,
    cerrarModal: pollingData.cerrarModal,
    isConnected: false,
    connectedChannels: [],
    testBroadcast: () => ({ success: false, error: 'WebSocket no disponible' })
  };

  return (
    <>
      <IncomingCallModal
        show={!!activeData.incomingCall}
        incomingCall={activeData.incomingCall}
        clienteData={activeData.clienteData}
        buscandoCliente={activeData.buscandoCliente}
        onClose={activeData.cerrarModal}
      />
      
      {/* Componente de diagnóstico (solo en desarrollo) */}
      <IncomingCallDiagnostic
        isConnected={wsData.isConnected || false}
        connectedChannels={wsData.connectedChannels || []}
        onTestBroadcast={wsData.testBroadcast || (() => Promise.resolve({ success: false }))}
      />
    </>
  );
};

export default CallIdentifierContainer;

