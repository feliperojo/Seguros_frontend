// src/components/CallIdentifier/IncomingCallModal.jsx
// Modal que se abre automáticamente cuando llega un evento incoming_call

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Badge, Spinner, Alert, Form } from 'react-bootstrap';
import { FiPhone, FiUser, FiMail, FiBriefcase, FiX, FiExternalLink, FiCheckCircle } from 'react-icons/fi';
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
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    empresa: '',
    email: '',
  });
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (show && incomingCall && import.meta.env?.DEV) {
      console.log('🔄 Modal de llamada entrante abierto', {
        telefono: incomingCall.telefono,
        extension: incomingCall.extension,
        tieneCliente: !!clienteData,
      });
    }
  }, [show, incomingCall, clienteData]);

  if (!show || !incomingCall) return null;

  const telefono = incomingCall.telefono || 'N/A';
  const extension = incomingCall.extension || 'N/A';
  const extensionNumber = incomingCall.extensionNumber || 'N/A';
  const estadoRaw = (incomingCall.estado || incomingCall.raw?.status || 'ringing').toString();
  const estado = estadoRaw.toLowerCase();
  const estadoLabel = estado === 'ringing' || estadoRaw === 'Ringing' ? 'Sonando' :
    estado === 'callconnected' || estado === 'connected' || estadoRaw === 'CallConnected' ? 'Conectada' : estadoRaw;

  const validateEmail = (email) => {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

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
        toast.showSuccess('Cliente creado exitosamente');
        setMostrarFormularioCrear(false);
        setFormData({ nombre: '', empresa: '', email: '' });
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

  const handleVerFicha = () => {
    if (clienteData?.id) {
      onClose();
      navigate(`/clientes/${clienteData.id}/ficha`);
    }
  };

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

        {clienteData ? (
          <div className="mb-4">
            <Alert variant="success">
              <Alert.Heading className="d-flex align-items-center gap-2 mb-2">
                <FiCheckCircle size={24} className="text-success flex-shrink-0" />
                <span>Cliente encontrado</span>
              </Alert.Heading>
              <h4 className="mb-1 text-dark">
                {clienteData.nombre_completo || clienteData.nombre || clienteData.name || 'Sin nombre'}
              </h4>
              <p className="mb-0 text-muted small">
                ID: {clienteData.id}
              </p>
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
                    <Form.Label>Nombre <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label><FiBriefcase className="me-2" /> Empresa</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.empresa}
                      onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                      placeholder="Nombre de la empresa (opcional)"
                      disabled={creandoCliente}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label><FiMail className="me-2" /> Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@ejemplo.com (opcional)"
                      disabled={creandoCliente}
                      isInvalid={formData.email && !validateEmail(formData.email)}
                    />
                    {formData.email && !validateEmail(formData.email) && (
                      <Form.Control.Feedback type="invalid">Formato de email inválido</Form.Control.Feedback>
                    )}
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Teléfono</Form.Label>
                    <Form.Control type="text" value={telefono} readOnly disabled className="bg-light" />
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
                        <><Spinner size="sm" className="me-2" animation="border" /> Creando...</>
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
        {clienteData?.id && (
          <Button variant="primary" onClick={handleVerFicha} title="Abrir ficha del cliente">
            <FiExternalLink className="me-2" />
            Ver ficha del cliente
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default IncomingCallModal;
