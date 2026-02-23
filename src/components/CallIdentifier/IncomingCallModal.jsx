// src/components/CallIdentifier/IncomingCallModal.jsx
// Modal que se abre automáticamente cuando llega un evento incoming_call

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Badge, Spinner, Alert, Form } from 'react-bootstrap';
import { FiPhone, FiUser, FiMail, FiBriefcase, FiX, FiExternalLink } from 'react-icons/fi';
import DetalleClienteModal from '../DetalleClienteModal';
import TelefonosPro from '../fase2/TelefonosPro';
import apiRequest from '../../services/api';
import useToast from '../../hooks/useToast';

/** Parsea el número entrante (ej. +17866142302) a { iso, indicativo, numero } para TelefonosPro */
function parseTelefonoIncoming(telefonoStr, fallbackIso = 'us') {
  const digits = String(telefonoStr || '').replace(/\D/g, '');
  if (!digits.length) return { iso: fallbackIso, indicativo: '1', numero: '', principal: true };
  let indicativo = '';
  let numero = digits;
  if (digits.startsWith('1') && digits.length >= 11) {
    indicativo = '1';
    numero = digits.slice(1);
  } else if (digits.length >= 12) {
    indicativo = digits.slice(0, 3);
    numero = digits.slice(3);
  } else if (digits.length >= 11) {
    indicativo = digits.slice(0, 2);
    numero = digits.slice(2);
  } else if (digits.length > 10) {
    indicativo = digits.slice(0, digits.length - 10);
    numero = digits.slice(-10);
  }
  return { iso: fallbackIso, indicativo: indicativo || '1', numero, principal: true };
}

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
  const [telefonos, setTelefonos] = useState([]);
  const [clienteParaDetalle, setClienteParaDetalle] = useState(null);
  const toast = useToast();

  // Inicializar teléfonos con el número de la llamada cuando se abre el formulario de crear
  const telefonoInicialParaCrear = useMemo(() => {
    const t = incomingCall?.telefono || '';
    if (!t) return [];
    const parsed = parseTelefonoIncoming(t, 'us');
    return [{ id: `ph-${Date.now()}`, ...parsed, tipo: 'Móvil' }];
  }, [incomingCall?.telefono]);


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

  // Construir teléfono para enviar al backend (indicativo + número del principal o primero)
  const telefonoParaEnvio = useMemo(() => {
    if (telefonos.length === 0) return telefono;
    const principal = telefonos.find((t) => t.principal) || telefonos[0];
    const ind = String(principal?.indicativo || '').replace(/\D/g, '');
    const num = String(principal?.numero || '').replace(/\D/g, '');
    if (!num) return telefono;
    return ind ? `+${ind}${num}` : num;
  }, [telefonos, telefono]);

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

    if (!telefonoParaEnvio || telefonoParaEnvio === 'N/A') {
      toast.showError('Agregue al menos un número de teléfono');
      return;
    }

    setCreandoCliente(true);

    try {
      const payload = {
        nombre: formData.nombre.trim(),
        empresa: formData.empresa.trim() || null,
        email: formData.email.trim() || null,
        telefono: telefonoParaEnvio,
      };
      const response = await apiRequest('/cliente/crear-rapido', 'POST', payload);

      if (response && (response.success || response.cliente || response.data)) {
        const nuevoCliente = response.cliente || response.data || response;
        toast.showSuccess('Cliente creado exitosamente');

        setMostrarFormularioCrear(false);
        setFormData({ nombre: '', empresa: '', email: '' });
        setTelefonos([]);

        setClienteParaDetalle(nuevoCliente);
        setMostrarDetalleCliente(true);
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

  // Si hay cliente y se debe mostrar detalle (encontrado o recién creado), mostrar DetalleClienteModal
  const clienteParaFicha = clienteData || clienteParaDetalle;
  if (mostrarDetalleCliente && clienteParaFicha) {
    return (
      <DetalleClienteModal
        show={true}
        onHide={() => {
          setMostrarDetalleCliente(false);
          setClienteParaDetalle(null);
          onClose();
        }}
        clienteData={clienteParaFicha}
        grupoFamiliarId={clienteParaFicha.grupo_familiar_id || null}
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
                  onClick={() => {
                    setTelefonos(telefonoInicialParaCrear.length ? telefonoInicialParaCrear : [{ id: `ph-${Date.now()}`, iso: 'us', indicativo: '1', numero: '', tipo: 'Móvil', principal: true }]);
                    setMostrarFormularioCrear(true);
                  }}
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
                    <Form.Label className="d-block mb-2">
                      <FiPhone className="me-2" />
                      Teléfonos
                    </Form.Label>
                    <TelefonosPro
                      value={telefonos}
                      onChange={setTelefonos}
                      readOnly={creandoCliente}
                      fallbackIso="us"
                      addLabel="Agregar teléfono"
                    />
                  </Form.Group>

                  <div className="d-flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setMostrarFormularioCrear(false);
                        setFormData({ nombre: '', empresa: '', email: '' });
                        setTelefonos([]);
                      }}
                      disabled={creandoCliente}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={creandoCliente || !formData.nombre.trim() || !telefonoParaEnvio || telefonoParaEnvio === 'N/A'}
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

