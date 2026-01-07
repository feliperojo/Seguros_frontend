// src/components/CallIdentifier/IncomingCallDiagnostic.jsx
// Componente de diagnóstico para monitorear la conexión WebSocket y probar eventos

import React, { useState } from 'react';
import { Card, Button, Badge, Alert, ListGroup } from 'react-bootstrap';
import { FiWifi, FiWifiOff, FiRefreshCw, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import './CallIdentifier.css';

const IncomingCallDiagnostic = ({ 
  isConnected, 
  connectedChannels, 
  onTestBroadcast 
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTestBroadcast = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await onTestBroadcast();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  // Solo mostrar en desarrollo
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <Card className="mt-3" style={{ position: 'fixed', bottom: '20px', right: '20px', width: '350px', zIndex: 1050 }}>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <strong>🔍 Diagnóstico WebSocket</strong>
        <Badge bg={isConnected ? 'success' : 'danger'}>
          {isConnected ? (
            <>
              <FiWifi className="me-1" />
              Conectado
            </>
          ) : (
            <>
              <FiWifiOff className="me-1" />
              Desconectado
            </>
          )}
        </Badge>
      </Card.Header>
      <Card.Body>
        <div className="mb-3">
          <strong>Canales conectados:</strong>
          {connectedChannels.length > 0 ? (
            <ListGroup variant="flush" className="mt-2">
              {connectedChannels.map((channel, index) => (
                <ListGroup.Item key={index} className="px-0 py-1 small">
                  <FiCheckCircle className="me-2 text-success" size={14} />
                  {channel}
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p className="text-muted small mt-2 mb-0">
              <FiXCircle className="me-2 text-danger" size={14} />
              Ningún canal conectado
            </p>
          )}
        </div>

        <div className="d-grid gap-2">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleTestBroadcast}
            disabled={testing}
          >
            {testing ? (
              <>
                <FiRefreshCw className="me-2 spinning" />
                Probando...
              </>
            ) : (
              <>
                <FiRefreshCw className="me-2" />
                Probar Broadcast
              </>
            )}
          </Button>
        </div>

        {testResult && (
          <Alert 
            variant={testResult.success ? 'success' : 'danger'} 
            className="mt-3 mb-0 small"
          >
            {testResult.success ? (
              <>
                <FiCheckCircle className="me-2" />
                <strong>Éxito:</strong> {testResult.data?.message || 'Evento enviado correctamente'}
              </>
            ) : (
              <>
                <FiXCircle className="me-2" />
                <strong>Error:</strong> {testResult.error || 'Error desconocido'}
              </>
            )}
          </Alert>
        )}

        <div className="mt-3 small text-muted">
          <strong>Nota:</strong> Abre la consola del navegador para ver logs detallados.
        </div>
      </Card.Body>
    </Card>
  );
};

export default IncomingCallDiagnostic;

