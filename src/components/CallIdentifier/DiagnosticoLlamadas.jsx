/**
 * Componente de diagnóstico para verificar el estado del sistema de llamadas
 * Muestra información útil para debugging (solo WebSocket)
 */

import React, { useState } from 'react';
import { Card, Button, Badge, ListGroup, Alert } from 'react-bootstrap';

const DiagnosticoLlamadas = () => {
  const [diagnostico, setDiagnostico] = useState({
    token: false,
    errores: []
  });
  const [mostrar, setMostrar] = useState(false);

  const ejecutarDiagnostico = () => {
    const resultado = {
      token: false,
      errores: []
    };

    // 1. Verificar token
    const token = localStorage.getItem('auth_token');
    resultado.token = !!token;

    if (!token) {
      resultado.errores.push('Token de autenticación no encontrado');
    }

    setDiagnostico(resultado);
  };

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
            className="w-100"
          >
            <i className="bi bi-arrow-clockwise"></i> Actualizar Diagnóstico
          </Button>
        </div>

        <Alert variant="info" className="mt-3 mb-0" style={{ fontSize: '12px' }}>
          <strong>Nota:</strong> Este sistema usa WebSocket (Laravel Echo) para recibir eventos en tiempo real.
          <br />
          <br />
          Requiere que Laravel:
          <ul className="mb-0 mt-2">
            <li>Reciba webhooks de RingCentral</li>
            <li>Emita eventos de broadcasting (WebSockets) al canal privado del usuario</li>
          </ul>
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default DiagnosticoLlamadas;

