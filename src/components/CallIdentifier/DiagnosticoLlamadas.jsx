/**
 * Componente de diagnóstico para verificar el estado del sistema de llamadas
 * Muestra información útil para debugging
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, ListGroup, Alert } from 'react-bootstrap';
import llamadasService from '../../services/llamadasService';
import apiRequest from '../../services/api';

const DiagnosticoLlamadas = () => {
  const [diagnostico, setDiagnostico] = useState({
    conectado: false,
    metodo: null,
    token: false,
    endpointPolling: null,
    ultimaLlamada: null,
    errores: []
  });
  const [mostrar, setMostrar] = useState(false);
  const [probandoEndpoint, setProbandoEndpoint] = useState(false);

  const ejecutarDiagnostico = async () => {
    const resultado = {
      conectado: false,
      metodo: null,
      token: false,
      endpointPolling: null,
      ultimaLlamada: null,
      errores: []
    };

    // 1. Verificar token
    const token = localStorage.getItem('auth_token');
    resultado.token = !!token;

    // 2. Verificar estado de conexión
    const status = llamadasService.getConnectionStatus();
    resultado.conectado = status.isConnected;
    resultado.metodo = status.method;

    // 3. Probar endpoint de polling
    if (token) {
      setProbandoEndpoint(true);
      try {
        const response = await apiRequest('/api/ringcentral/identificar-llamadas-activas', 'GET');
        resultado.endpointPolling = {
          existe: true,
          respuesta: response,
          tieneDatos: !!(response.success && response.data && response.data.length > 0),
          total: response.total || 0
        };
      } catch (error) {
        resultado.endpointPolling = {
          existe: false,
          error: error.message,
          status: error.response?.status
        };
        resultado.errores.push(`Endpoint polling: ${error.message}`);
      } finally {
        setProbandoEndpoint(false);
      }
    }

    setDiagnostico(resultado);
  };

  useEffect(() => {
    if (mostrar) {
      ejecutarDiagnostico();
      const interval = setInterval(ejecutarDiagnostico, 5000);
      return () => clearInterval(interval);
    }
  }, [mostrar]);

  if (!mostrar) {
    return (
      <Button
        variant="outline-info"
        size="sm"
        onClick={() => setMostrar(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 1050,
          borderRadius: '50px'
        }}
      >
        <i className="bi bi-bug"></i> Diagnóstico
      </Button>
    );
  }

  return (
    <Card
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '400px',
        maxHeight: '500px',
        zIndex: 1051,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      <Card.Header className="d-flex justify-content-between align-items-center">
        <strong>🔍 Diagnóstico de Llamadas</strong>
        <Button
          variant="link"
          size="sm"
          onClick={() => setMostrar(false)}
          className="p-0"
        >
          <i className="bi bi-x-lg"></i>
        </Button>
      </Card.Header>
      <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <ListGroup variant="flush">
          {/* Token */}
          <ListGroup.Item className="d-flex justify-content-between">
            <span>Token de autenticación:</span>
            <Badge bg={diagnostico.token ? 'success' : 'danger'}>
              {diagnostico.token ? '✓ Presente' : '✗ Faltante'}
            </Badge>
          </ListGroup.Item>

          {/* Conexión */}
          <ListGroup.Item className="d-flex justify-content-between">
            <span>Estado de conexión:</span>
            <Badge bg={diagnostico.conectado ? 'success' : 'secondary'}>
              {diagnostico.conectado 
                ? `✓ ${diagnostico.metodo || 'Conectado'}` 
                : '✗ Desconectado'}
            </Badge>
          </ListGroup.Item>

          {/* Endpoint Polling */}
          <ListGroup.Item>
            <div className="d-flex justify-content-between mb-2">
              <span>Endpoint Polling:</span>
              {probandoEndpoint && <Badge bg="warning">Probando...</Badge>}
            </div>
            {diagnostico.endpointPolling && (
              <div>
                {diagnostico.endpointPolling.existe ? (
                  <>
                    <Badge bg="success" className="me-2">✓ Existe</Badge>
                    {diagnostico.endpointPolling.tieneDatos ? (
                      <>
                        <Badge bg="info">Con datos</Badge>
                        {diagnostico.endpointPolling.total !== undefined && (
                          <Badge bg="success" className="ms-2">
                            {diagnostico.endpointPolling.total} llamada(s)
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge bg="warning">Sin datos</Badge>
                    )}
                    <pre className="mt-2 p-2 bg-light rounded" style={{ fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
                      {JSON.stringify(diagnostico.endpointPolling.respuesta, null, 2)}
                    </pre>
                  </>
                ) : (
                  <>
                    <Badge bg="danger" className="me-2">✗ No existe</Badge>
                    <div className="text-danger small mt-1">
                      {diagnostico.endpointPolling.error}
                      {diagnostico.endpointPolling.status && (
                        <span> (Status: {diagnostico.endpointPolling.status})</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </ListGroup.Item>

          {/* Errores */}
          {diagnostico.errores.length > 0 && (
            <ListGroup.Item>
              <Alert variant="danger" className="mb-0">
                <strong>Errores:</strong>
                <ul className="mb-0 mt-2">
                  {diagnostico.errores.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </Alert>
            </ListGroup.Item>
          )}
        </ListGroup>

        <div className="mt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={ejecutarDiagnostico}
            disabled={probandoEndpoint}
            className="w-100"
          >
            <i className="bi bi-arrow-clockwise"></i> Actualizar Diagnóstico
          </Button>
        </div>

        <Alert variant="info" className="mt-3 mb-0" style={{ fontSize: '12px' }}>
          <strong>Nota:</strong> Este sistema requiere que Laravel reciba webhooks de RingCentral y luego:
          <ul className="mb-0 mt-2">
            <li>Emita eventos de broadcasting (WebSockets), o</li>
            <li>Exponga llamadas en GET /api/llamadas/activas (Polling)</li>
          </ul>
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default DiagnosticoLlamadas;

