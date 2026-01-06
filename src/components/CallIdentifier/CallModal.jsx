// src/components/CallIdentifier/CallModal.jsx
// Modal que muestra información completa de la llamada y del cliente

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Alert, Table, Spinner } from 'react-bootstrap';
import { FiPhone, FiMail, FiBuilding, FiUser, FiX, FiExternalLink, FiEdit3 } from 'react-icons/fi';
import CreateClientQuickForm from './CreateClientQuickForm';
import './CallIdentifier.css';

const CallModal = ({ show, llamada, onClose }) => {
  const [mostrarFormularioCrear, setMostrarFormularioCrear] = useState(false);
  const [clienteActualizado, setClienteActualizado] = useState(null);
  const [haMostradoShake, setHaMostradoShake] = useState(false);

  // Animación shake al aparecer por primera vez
  useEffect(() => {
    if (show && !haMostradoShake) {
      setHaMostradoShake(true);
    }
  }, [show, haMostradoShake]);

  // Resetear estado cuando se cierra el modal
  useEffect(() => {
    if (!show) {
      setMostrarFormularioCrear(false);
      setClienteActualizado(null);
    }
  }, [show]);

  if (!llamada) return null;

  // Extraer información de la llamada
  const numeroTelefono = llamada.numero || llamada.telefono || llamada.phone_number || 'N/A';
  const direccion = llamada.direccion || llamada.direction || 'Inbound';
  const esEntrante = direccion === 'Inbound' || direccion === 'entrante';
  const estado = llamada.estado || llamada.status || 'Desconocido';
  const estadoNormalizado = estado.toLowerCase();

  // Información del cliente
  const cliente = clienteActualizado || llamada.cliente;
  // Cliente existe si tiene id y no tiene la propiedad 'encontrado' en false
  const clienteExiste = cliente && cliente.id && cliente.encontrado !== false;
  // Cliente no encontrado si no hay cliente o si explícitamente dice que no fue encontrado
  const clienteNoEncontrado = !cliente || (cliente.encontrado === false && !cliente.id);

  // Historial de llamadas
  const historialLlamadas = llamada.historial_llamadas || llamada.historial || [];

  // Notas importantes
  const notasImportantes = llamada.notas_importantes || llamada.notas || [];

  // Determinar título del modal
  const titulo = esEntrante ? '📞 Llamada Entrante' : '📲 Llamando a...';

  // Determinar color del badge de estado
  const getEstadoBadgeColor = () => {
    if (estadoNormalizado === 'ringing' || estadoNormalizado === 'sonando') return 'warning';
    if (estadoNormalizado === 'connected' || estadoNormalizado === 'conectada' || estadoNormalizado === 'callconnected') return 'success';
    if (estadoNormalizado === 'completed' || estadoNormalizado === 'noanswer') return 'secondary';
    return 'info';
  };

  // Manejar creación exitosa de cliente
  const handleClienteCreado = (nuevoCliente) => {
    setClienteActualizado(nuevoCliente);
    setMostrarFormularioCrear(false);
  };

  // Auto-cerrar cuando la llamada termine
  useEffect(() => {
    if (estadoNormalizado === 'completed' || estadoNormalizado === 'noanswer') {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [estadoNormalizado, onClose]);

  // Función para ver perfil completo
  const handleVerPerfil = () => {
    if (clienteExiste && cliente.id) {
      window.location.href = `/clientes/${cliente.id}/ficha`;
    }
  };

  // Función para agregar nota
  const handleAgregarNota = () => {
    if (clienteExiste && cliente.id) {
      window.location.href = `/clientes/${cliente.id}/ficha?tab=comentarios`;
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
      className={`call-identifier-modal ${show && !haMostradoShake ? 'shake' : ''}`}
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <span>{titulo}</span>
          <Badge bg={getEstadoBadgeColor()}>
            {estadoNormalizado === 'ringing' || estadoNormalizado === 'sonando' ? 'Sonando' :
             estadoNormalizado === 'connected' || estadoNormalizado === 'conectada' ? 'Conectada' :
             estadoNormalizado === 'completed' ? 'Completada' :
             estadoNormalizado === 'noanswer' ? 'Sin respuesta' : estado}
          </Badge>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Sección 1: Información del número */}
        <div className="mb-4">
          <h5 className="mb-3">
            <FiPhone className="me-2" />
            Información del Número
          </h5>
          <div className="call-phone-number">
            {numeroTelefono}
          </div>
          <div className="d-flex gap-2 mt-2">
            <Badge bg={esEntrante ? 'success' : 'primary'}>
              {esEntrante ? 'Entrante' : 'Saliente'}
            </Badge>
            <Badge bg={getEstadoBadgeColor()}>
              {estadoNormalizado === 'ringing' || estadoNormalizado === 'sonando' ? 'Sonando' :
               estadoNormalizado === 'connected' || estadoNormalizado === 'conectada' ? 'Conectada' :
               estado}
            </Badge>
          </div>
        </div>

        {/* Sección 2: Información del cliente */}
        {clienteExiste ? (
          <div className="mb-4">
            <h5 className="mb-3">
              <FiUser className="me-2" />
              Información del Cliente
            </h5>
            <div className="call-client-info">
              <h3 className="mb-2">
                {cliente.nombre_completo || cliente.nombre || cliente.name || 'N/A'}
              </h3>
              {cliente.empresa && (
                <p className="text-muted mb-2">
                  <FiBuilding className="me-2" />
                  {cliente.empresa}
                </p>
              )}
              {cliente.email && (
                <p className="mb-2">
                  <FiMail className="me-2" />
                  {cliente.email}
                </p>
              )}
              {cliente.vip && (
                <Badge bg="warning" className="mt-2">
                  Cliente VIP
                </Badge>
              )}
            </div>
          </div>
        ) : clienteNoEncontrado ? (
          <div className="mb-4">
            <Alert variant="info">
              <Alert.Heading>Cliente nuevo</Alert.Heading>
              <p>No se encontró un cliente con el número <strong>{numeroTelefono}</strong></p>
              {!mostrarFormularioCrear ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMostrarFormularioCrear(true)}
                >
                  Crear Cliente Rápido
                </Button>
              ) : (
                <CreateClientQuickForm
                  telefono={numeroTelefono}
                  onClienteCreado={handleClienteCreado}
                  onCancel={() => setMostrarFormularioCrear(false)}
                />
              )}
            </Alert>
          </div>
        ) : (
          <div className="mb-4">
            <div className="text-center py-3">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Buscando información del cliente...</p>
            </div>
          </div>
        )}

        {/* Sección 3: Historial de llamadas */}
        {historialLlamadas.length > 0 && (
          <div className="mb-4">
            <h5 className="mb-3">Historial de Llamadas</h5>
            <div className="table-responsive">
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Duración</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {historialLlamadas.slice(0, 5).map((llamadaHist, index) => (
                    <tr key={index}>
                      <td>
                        {llamadaHist.fecha_hora
                          ? new Date(llamadaHist.fecha_hora).toLocaleString('es-ES')
                          : 'N/A'}
                      </td>
                      <td>
                        {llamadaHist.duracion
                          ? `${Math.floor(llamadaHist.duracion / 60)}:${String(llamadaHist.duracion % 60).padStart(2, '0')}`
                          : 'N/A'}
                      </td>
                      <td>
                        <Badge bg={llamadaHist.direccion === 'Inbound' ? 'success' : 'primary'}>
                          {llamadaHist.direccion === 'Inbound' ? 'Entrante' : 'Saliente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}

        {/* Sección 4: Notas importantes */}
        {notasImportantes.length > 0 && (
          <div className="mb-4">
            <Alert variant="warning">
              <Alert.Heading>Notas Importantes</Alert.Heading>
              <ul className="mb-0">
                {notasImportantes.map((nota, index) => (
                  <li key={index}>
                    {typeof nota === 'string' ? nota : nota.contenido || nota.texto || 'Nota'}
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          <FiX className="me-2" />
          Cerrar
        </Button>
        {clienteExiste && (
          <>
            <Button variant="outline-primary" onClick={handleAgregarNota}>
              <FiEdit3 className="me-2" />
              Agregar Nota
            </Button>
            <Button variant="primary" onClick={handleVerPerfil}>
              <FiExternalLink className="me-2" />
              Ver Perfil Completo
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default CallModal;
