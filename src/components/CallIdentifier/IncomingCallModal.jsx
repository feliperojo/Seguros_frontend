// src/components/CallIdentifier/IncomingCallModal.jsx
// Modal que se abre automáticamente cuando llega un evento incoming_call

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Spinner, Alert, Form } from 'react-bootstrap';
import { FiPhone, FiUser, FiMail, FiBriefcase, FiX, FiExternalLink } from 'react-icons/fi';
import DetalleClienteModal from '../DetalleClienteModal';
import apiRequest from '../../services/api';
import useToast from '../../hooks/useToast';

// Segundos tras los cuales se cierra el popup si no hay interacción (0 = no auto-cierre; el usuario cierra manualmente)
const AUTO_CLOSE_SECONDS = 0;

const IncomingCallModal = ({ 
  show, 
  incomingCall, 
  clienteData, 
  buscandoCliente, 
  onClose 
}) => {
  const [mostrarFormularioCrear, setMostrarFormularioCrear] = useState(false);
  const [mostrarDetalleCliente, setMostrarDetalleCliente] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    empresa: '',
    email: '',
  });
  const toast = useToast();

  // Log cuando se abre el modal
  useEffect(() => {
    if (show && incomingCall) {
      if (import.meta.env?.DEV) {
        console.log('🔄 Modal de llamada entrante abierto', {
          telefono: incomingCall.telefono,
          extension: incomingCall.extension,
          tieneCliente: !!clienteData
        });
      }
    }
  }, [show, incomingCall, clienteData]);

  // Auto-cierre desactivado: el modal solo se cierra cuando el usuario pulsa "Cerrar" para poder analizar número y llamante
  // (Si en el futuro se desea auto-cierre, usar AUTO_CLOSE_SECONDS > 0 y el useEffect correspondiente)

  if (!show || !incomingCall) return null;

  const telefono = incomingCall.telefono || 'N/A';
  const extension = incomingCall.extension || 'N/A';
  const extensionNumber = incomingCall.extensionNumber || 'N/A';
  // Backend envía status: "Ringing" | "CallConnected"; normalizar para mostrar
  const estadoRaw = (incomingCall.estado || incomingCall.raw?.status || 'ringing').toString();
  const estado = estadoRaw.toLowerCase();
  const estadoLabel = estado === 'ringing' || estadoRaw === 'Ringing' ? 'Sonando' :
    estado === 'callconnected' || estado === 'connected' || estadoRaw === 'CallConnected' ? 'Conectada' : estadoRaw;

  // Validar email
  const validateEmail = (email) => {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Manejar creación de cliente
  const handleCrearCliente = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.showError('El nombre es requerido');
      return;
    }

    if (formData.email && !validateEmail(formData.email)) {
      toast.showError('Formato de email inválido');
      return;
    }

    setCreandoCliente(true);

    try {
      const response = await apiRequest('/cliente/crear-rapido', 'POST', {
        nombre: formData.nombre.trim(),
        empresa: formData.empresa.trim() || null,
        email: formData.email.trim() || null,
        telefono: telefono,
      });

      if (response && (response.success || response.cliente || response.data)) {
        const nuevoCliente = response.cliente || response.data || response;
        toast.showSuccess('Cliente creado exitosamente');
        
        // Cerrar formulario y mostrar detalle del cliente
        setMostrarFormularioCrear(false);
        setFormData({ nombre: '', empresa: '', email: '' });
        
        // Abrir modal de detalle del cliente
        setMostrarDetalleCliente(true);
        
        // Pasar el nuevo cliente al componente padre si es necesario
        // onClienteCreado?.(nuevoCliente);
      } else {
        toast.showError(response?.message || 'Error al crear el cliente');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Error al crear el cliente';
      toast.showError(errorMessage);
    } finally {
      setCreandoCliente(false);
    }
  };

  // Manejar ver ficha del cliente
  const handleVerFicha = () => {
    if (clienteData?.id) {
      setMostrarDetalleCliente(true);
    }
  };

  // Si está buscando cliente, mostrar spinner
  if (buscandoCliente) {
    return (
      <Modal show={show} onHide={onClose} centered size="sm">
        <Modal.Body className="text-center py-4">
          <Spinner animation="border" variant="primary" className="mb-3" />
          <p>Buscando información del cliente...</p>
          <p className="text-muted small">{telefono}</p>
        </Modal.Body>
      </Modal>
    );
  }

  // Si hay cliente y se debe mostrar detalle, mostrar DetalleClienteModal
  if (mostrarDetalleCliente && clienteData) {
    return (
      <DetalleClienteModal
        show={true}
        onHide={() => {
          setMostrarDetalleCliente(false);
          onClose();
        }}
        clienteData={clienteData}
        grupoFamiliarId={clienteData.grupo_familiar_id || null}
      />
    );
  }

  // Modal principal
  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      size="lg"
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title className="d-flex align-items-center gap-2">
          <FiPhone size={24} />
          <span>Llamada Entrante</span>
          <Badge bg={
            estado === 'ringing' || estadoRaw === 'Ringing' ? 'warning' :
            estado === 'callconnected' || estado === 'connected' || estadoRaw === 'CallConnected' ? 'success' :
            'info'
          } className="ms-2">
            {estadoLabel}
          </Badge>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Información de la llamada */}
        <div className="mb-4">
          <h5 className="mb-3">Información de la Llamada</h5>
          <div className="row">
            <div className="col-md-6 mb-3">
              <div className="d-flex align-items-center mb-2">
                <FiPhone className="me-2 text-primary" />
                <strong>Número:</strong>
              </div>
              <h4 className="text-primary mb-0">{telefono}</h4>
            </div>
            <div className="col-md-6 mb-3">
              <div className="d-flex align-items-center mb-2">
                <FiUser className="me-2 text-info" />
                <strong>Extensión:</strong>
              </div>
              <p className="mb-0">
                {extension} {extensionNumber !== 'N/A' && `(${extensionNumber})`}
              </p>
            </div>
          </div>
        </div>

        {/* Información del cliente */}
        {clienteData ? (
          <div className="mb-4">
            <Alert variant="success">
              <Alert.Heading className="d-flex align-items-center">
                <FiUser className="me-2" />
                Cliente Encontrado
              </Alert.Heading>
              <div className="mt-3">
                <h4>{clienteData.nombre_completo || clienteData.nombre || clienteData.name || 'N/A'}</h4>
                {clienteData.empresa && (
                  <p className="mb-2">
                    <FiBriefcase className="me-2" />
                    {clienteData.empresa}
                  </p>
                )}
                {clienteData.email && (
                  <p className="mb-2">
                    <FiMail className="me-2" />
                    {clienteData.email}
                  </p>
                )}
                {clienteData.vip && (
                  <Badge bg="warning" className="mt-2">
                    Cliente VIP
                  </Badge>
                )}
              </div>
            </Alert>
          </div>
        ) : (
          <div className="mb-4">
            <Alert variant="info">
              <Alert.Heading>Cliente no encontrado</Alert.Heading>
              <p>No se encontró un cliente con el número <strong>{telefono}</strong></p>
              
              {!mostrarFormularioCrear ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMostrarFormularioCrear(true)}
                  className="mt-2"
                >
                  Crear Cliente Rápido
                </Button>
              ) : (
                <Form onSubmit={handleCrearCliente} className="mt-3">
                  <Form.Group className="mb-3">
                    <Form.Label>
                      Nombre <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Nombre completo del cliente"
                      required
                      disabled={creandoCliente}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FiBriefcase className="me-2" />
                      Empresa
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.empresa}
                      onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                      placeholder="Nombre de la empresa (opcional)"
                      disabled={creandoCliente}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FiMail className="me-2" />
                      Email
                    </Form.Label>
                    <Form.Control
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@ejemplo.com (opcional)"
                      disabled={creandoCliente}
                      isInvalid={formData.email && !validateEmail(formData.email)}
                    />
                    {formData.email && !validateEmail(formData.email) && (
                      <Form.Control.Feedback type="invalid">
                        Formato de email inválido
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Teléfono</Form.Label>
                    <Form.Control
                      type="text"
                      value={telefono}
                      readOnly
                      disabled
                      className="bg-light"
                    />
                  </Form.Group>

                  <div className="d-flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setMostrarFormularioCrear(false);
                        setFormData({ nombre: '', empresa: '', email: '' });
                      }}
                      disabled={creandoCliente}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={creandoCliente || !formData.nombre.trim()}
                    >
                      {creandoCliente ? (
                        <>
                          <Spinner size="sm" className="me-2" animation="border" />
                          Creando...
                        </>
                      ) : (
                        'Crear Cliente'
                      )}
                    </Button>
                  </div>
                </Form>
              )}
            </Alert>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          <FiX className="me-2" />
          Cerrar
        </Button>
        {clienteData && (
          <Button variant="primary" onClick={handleVerFicha} title="Abrir ficha del cliente en el ERP">
            <FiExternalLink className="me-2" />
            Ver en ERP
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default IncomingCallModal;

