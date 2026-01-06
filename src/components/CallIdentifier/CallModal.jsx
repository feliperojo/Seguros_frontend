/**
 * Componente Modal que muestra la información del cliente durante una llamada
 * Se muestra automáticamente cuando se detecta una llamada entrante o saliente
 */

import React, { useEffect } from 'react';
import { Modal, Button, Spinner, Card, Badge, ListGroup, Row, Col } from 'react-bootstrap';
import { CALL_STATES } from '../../utils/constants';

const CallModal = ({
  show,
  onClose,
  callState,
  currentCall,
  clienteData,
  isLoadingCliente,
  onCrearCliente,
  onAgregarNota
}) => {
  const [mostrandoFormularioCrear, setMostrandoFormularioCrear] = React.useState(false);
  const [mostrandoFormularioNota, setMostrandoFormularioNota] = React.useState(false);
  const [formularioCrear, setFormularioCrear] = React.useState({ nombre: '', email: '' });
  const [formularioNota, setFormularioNota] = React.useState({ nota: '' });
  const [creandoCliente, setCreandoCliente] = React.useState(false);
  const [agregandoNota, setAgregandoNota] = React.useState(false);
  // Auto-cerrar cuando la llamada termine
  useEffect(() => {
    if (callState === 'ended' && show) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Cerrar después de 5 segundos

      return () => clearTimeout(timer);
    }
  }, [callState, show, onClose]);

  // Determinar el título y el tipo de llamada
  const getCallInfo = () => {
    if (!currentCall) return { title: 'Llamada', type: 'unknown', badge: 'secondary' };

    const isIncoming = currentCall.direction === 'Inbound';
    const title = isIncoming ? 'Llamada Entrante' : 'Llamada Saliente';
    const type = isIncoming ? 'incoming' : 'outgoing';
    const badge = isIncoming ? 'success' : 'primary';

    return { title, type, badge };
  };

  const callInfo = getCallInfo();
  const phoneNumber = currentCall?.phoneNumber || 'N/A';
  const extensionName = currentCall?.extensionName || currentCall?.raw?.extension_name || 'N/A';
  const extensionNumber = currentCall?.extensionNumber || currentCall?.raw?.extension_number || 'N/A';

  // Manejar creación de cliente rápido
  const handleCrearCliente = async () => {
    if (!formularioCrear.nombre.trim()) {
      alert('Por favor, ingresa el nombre del cliente');
      return;
    }

    setCreandoCliente(true);
    try {
      const result = await onCrearCliente(
        formularioCrear.nombre,
        phoneNumber,
        formularioCrear.email || null
      );
      
      if (result.success) {
        setMostrandoFormularioCrear(false);
        setFormularioCrear({ nombre: '', email: '' });
        alert('Cliente creado exitosamente');
      } else {
        alert(result.error || 'Error al crear el cliente');
      }
    } catch (error) {
      alert('Error al crear el cliente: ' + error.message);
    } finally {
      setCreandoCliente(false);
    }
  };

  // Manejar agregar nota
  const handleAgregarNota = async () => {
    if (!formularioNota.nota.trim()) {
      alert('Por favor, ingresa la nota');
      return;
    }

    if (!clienteData?.id) {
      alert('No hay cliente asociado');
      return;
    }

    setAgregandoNota(true);
    try {
      const result = await onAgregarNota(clienteData.id, formularioNota.nota);
      
      if (result.success) {
        setMostrandoFormularioNota(false);
        setFormularioNota({ nota: '' });
        alert('Nota agregada exitosamente');
      } else {
        alert(result.error || 'Error al agregar la nota');
      }
    } catch (error) {
      alert('Error al agregar la nota: ' + error.message);
    } finally {
      setAgregandoNota(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="lg"
      centered
      backdrop="static"
      keyboard={false}
      className="call-identifier-modal"
      style={{
        animation: show ? 'fadeIn 0.3s ease-in' : 'fadeOut 0.3s ease-out'
      }}
    >
      <Modal.Header 
        closeButton={callState !== 'active'}
        style={{
          backgroundColor: callInfo.badge === 'success' ? '#d4edda' : '#cfe2ff',
          borderBottom: '2px solid #dee2e6'
        }}
      >
        <Modal.Title className="d-flex align-items-center gap-2">
          <i className={`bi bi-telephone-${callInfo.type === 'incoming' ? 'inbound' : 'outbound'}-fill`}></i>
          <span>{callInfo.title}</span>
          <Badge bg={callInfo.badge} className="ms-2">
            {callState === 'incoming' || callState === 'outgoing' ? 'En espera' : 
             callState === 'active' ? 'En curso' : 'Finalizada'}
          </Badge>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Información de la llamada */}
        <Card className="mb-3">
          <Card.Body>
            <Row>
              <Col md={4}>
                <strong>Extensión:</strong>
                <p className="mb-0">
                  <Badge bg="info" className="fs-6">
                    {extensionName} ({extensionNumber})
                  </Badge>
                </p>
              </Col>
              <Col md={4}>
                <strong>Número de teléfono:</strong>
                <p className="mb-0">
                  <Badge bg="secondary" className="fs-6">{phoneNumber}</Badge>
                </p>
              </Col>
              <Col md={4}>
                <strong>Hora de inicio:</strong>
                <p className="mb-0">
                  {currentCall?.startTime 
                    ? new Date(currentCall.startTime).toLocaleString('es-ES')
                    : new Date().toLocaleString('es-ES')}
                </p>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Información del cliente */}
        {isLoadingCliente ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Buscando información del cliente...</p>
          </div>
        ) : clienteData ? (
          clienteData.encontrado === false ? (
            // Cliente no encontrado
            <Card className="border-warning">
              <Card.Body>
                <div className="text-center py-3">
                  <i className="bi bi-exclamation-triangle-fill text-warning fs-1"></i>
                  <h5 className="mt-3">Cliente no encontrado</h5>
                  <p className="text-muted">
                    No se encontró un cliente con el número <strong>{phoneNumber}</strong>
                  </p>
                  
                  {!mostrandoFormularioCrear ? (
                    <Button
                      variant="primary"
                      onClick={() => setMostrandoFormularioCrear(true)}
                      className="mt-2"
                    >
                      <i className="bi bi-person-plus"></i> Crear nuevo cliente
                    </Button>
                  ) : (
                    <div className="mt-3">
                      <div className="mb-3">
                        <label className="form-label">Nombre del Cliente *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formularioCrear.nombre}
                          onChange={(e) => setFormularioCrear({ ...formularioCrear, nombre: e.target.value })}
                          placeholder="Ingresa el nombre"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Email (Opcional)</label>
                        <input
                          type="email"
                          className="form-control"
                          value={formularioCrear.email}
                          onChange={(e) => setFormularioCrear({ ...formularioCrear, email: e.target.value })}
                          placeholder="email@ejemplo.com"
                        />
                      </div>
                      <div className="d-flex gap-2 justify-content-center">
                        <Button
                          variant="success"
                          onClick={handleCrearCliente}
                          disabled={creandoCliente || !formularioCrear.nombre.trim()}
                        >
                          {creandoCliente ? (
                            <>
                              <Spinner size="sm" className="me-2" />
                              Creando...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check-circle"></i> Crear Cliente
                            </>
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setMostrandoFormularioCrear(false);
                            setFormularioCrear({ nombre: '', email: '' });
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          ) : (
            // Cliente encontrado - Mostrar información
            <>
              <Card className="mb-3 border-success">
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-person-check-fill"></i> Información del Cliente
                  </h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <h4>{clienteData.nombre_completo || clienteData.nombre || clienteData.name || 'N/A'}</h4>
                      {clienteData.empresa && (
                        <p className="text-muted mb-2">
                          <i className="bi bi-building"></i> {clienteData.empresa}
                        </p>
                      )}
                      {clienteData.email && (
                        <p className="mb-1">
                          <i className="bi bi-envelope"></i> {clienteData.email}
                        </p>
                      )}
                      {clienteData.telefono && (
                        <p className="mb-1">
                          <i className="bi bi-telephone"></i> {clienteData.telefono}
                        </p>
                      )}
                      {clienteData.telefonos && Array.isArray(clienteData.telefonos) && clienteData.telefonos.length > 0 && (
                        <p className="mb-1">
                          <i className="bi bi-telephone-fill"></i> {clienteData.telefonos.join(', ')}
                        </p>
                      )}
                    </Col>
                    <Col md={6}>
                      {clienteData.id && (
                        <p className="mb-1">
                          <strong>ID Cliente:</strong> #{clienteData.id}
                        </p>
                      )}
                      {clienteData.estado && (
                        <p className="mb-1">
                          <strong>Estado:</strong>{' '}
                          <Badge bg="info">{clienteData.estado}</Badge>
                        </p>
                      )}
                      {clienteData.tags && Array.isArray(clienteData.tags) && clienteData.tags.length > 0 && (
                        <div className="mt-2">
                          <strong>Tags:</strong>
                          <div className="mt-1">
                            {clienteData.tags.map((tag, index) => (
                              <Badge key={index} bg="secondary" className="me-1">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Col>
                  </Row>
                  
                  {/* Formulario para agregar nota */}
                  {mostrandoFormularioNota ? (
                    <div className="mt-3 p-3 bg-light rounded">
                      <label className="form-label"><strong>Agregar Nota:</strong></label>
                      <textarea
                        className="form-control mb-2"
                        rows="3"
                        value={formularioNota.nota}
                        onChange={(e) => setFormularioNota({ nota: e.target.value })}
                        placeholder="Escribe una nota sobre esta llamada..."
                      />
                      <div className="d-flex gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={handleAgregarNota}
                          disabled={agregandoNota || !formularioNota.nota.trim()}
                        >
                          {agregandoNota ? (
                            <>
                              <Spinner size="sm" className="me-2" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check"></i> Guardar Nota
                            </>
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setMostrandoFormularioNota(false);
                            setFormularioNota({ nota: '' });
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => setMostrandoFormularioNota(true)}
                      >
                        <i className="bi bi-sticky"></i> Agregar Nota
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/* Historial de compras */}
              {clienteData.historialCompras && Array.isArray(clienteData.historialCompras) && clienteData.historialCompras.length > 0 && (
                <Card className="mb-3">
                  <Card.Header>
                    <h6 className="mb-0">
                      <i className="bi bi-cart-check"></i> Historial de Compras
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <ListGroup variant="flush">
                      {clienteData.historialCompras.slice(0, 5).map((compra, index) => (
                        <ListGroup.Item key={index}>
                          <div className="d-flex justify-content-between">
                            <div>
                              <strong>{compra.producto || compra.servicio || 'Producto'}</strong>
                              <br />
                              <small className="text-muted">
                                {compra.fecha 
                                  ? new Date(compra.fecha).toLocaleDateString('es-ES')
                                  : 'Fecha no disponible'}
                              </small>
                            </div>
                            {compra.monto && (
                              <div className="text-end">
                                <strong className="text-success">
                                  ${parseFloat(compra.monto).toLocaleString('es-ES', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </strong>
                              </div>
                            )}
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Card.Body>
                </Card>
              )}

              {/* Notas importantes */}
              {clienteData.notas && Array.isArray(clienteData.notas) && clienteData.notas.length > 0 && (
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">
                      <i className="bi bi-sticky"></i> Notas Importantes
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <ListGroup variant="flush">
                      {clienteData.notas.slice(0, 3).map((nota, index) => (
                        <ListGroup.Item key={index}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <p className="mb-1">{nota.contenido || nota.texto || nota}</p>
                              {nota.fecha && (
                                <small className="text-muted">
                                  {new Date(nota.fecha).toLocaleDateString('es-ES')}
                                </small>
                              )}
                            </div>
                            {nota.importante && (
                              <Badge bg="warning" className="ms-2">
                                Importante
                              </Badge>
                            )}
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Card.Body>
                </Card>
              )}
            </>
          )
        ) : (
          // Sin datos del cliente aún
          <Card>
            <Card.Body>
              <div className="text-center py-3 text-muted">
                <i className="bi bi-info-circle fs-1"></i>
                <p className="mt-2">Esperando información del cliente...</p>
              </div>
            </Card.Body>
          </Card>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          <i className="bi bi-x-circle"></i> Cerrar
        </Button>
        {clienteData && clienteData.id && (
          <Button variant="primary" onClick={() => {
            // Redirigir a la página de detalle del cliente
            window.location.href = `/clientes/${clienteData.id}`;
          }}>
            <i className="bi bi-person-lines-fill"></i> Ver Detalle Completo
          </Button>
        )}
      </Modal.Footer>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.9);
          }
        }

        .call-identifier-modal .modal-content {
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </Modal>
  );
};

export default CallModal;

