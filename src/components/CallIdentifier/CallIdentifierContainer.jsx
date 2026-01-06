// src/components/CallIdentifier/CallIdentifierContainer.jsx
// Componente principal que integra el sistema de identificación de llamadas
// Reutiliza componentes existentes como DetalleClienteModal

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { FiPhone } from 'react-icons/fi';
import useCallMonitor from '../../hooks/useCallMonitor';
import DetalleClienteModal from '../DetalleClienteModal';
import useToast from '../../hooks/useToast';

const CallIdentifierContainer = () => {
  const { llamadaActiva, clienteData, cargando, buscandoCliente, error, cerrarModal } = useCallMonitor();
  const [showClienteModal, setShowClienteModal] = useState(false);
  const toast = useToast();

  // Mostrar modal de cliente cuando hay datos
  useEffect(() => {
    if (llamadaActiva && clienteData) {
      setShowClienteModal(true);
    } else if (!llamadaActiva) {
      setShowClienteModal(false);
    }
  }, [llamadaActiva, clienteData]);

  // Mostrar notificación cuando hay nueva llamada
  useEffect(() => {
    if (llamadaActiva && llamadaActiva.telefono) {
      const nombreCliente = clienteData?.nombre_completo || clienteData?.nombre || 'Número desconocido';
      const mensaje = clienteData 
        ? `Llamada de ${nombreCliente}` 
        : `Llamada entrante: ${llamadaActiva.telefono}`;
      toast.showInfo(mensaje, { autoClose: 3000 });
    }
  }, [llamadaActiva, clienteData, toast]);

  // Determinar si es llamada entrante o saliente
  const esEntrante = llamadaActiva?.direccion === 'Inbound' || 
                    llamadaActiva?.direction === 'Inbound' ||
                    !llamadaActiva?.direccion; // Por defecto asumir entrante

  return (
    <>
      {/* Modal simple con información de la llamada cuando NO hay cliente */}
      {llamadaActiva && !clienteData && !buscandoCliente && (
        <Modal
          show={true}
          onHide={cerrarModal}
          centered
          size="md"
        >
          <Modal.Header closeButton>
            <Modal.Title className="d-flex align-items-center gap-2">
              <FiPhone />
              <span>{esEntrante ? 'Llamada Entrante' : 'Llamada Saliente'}</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="text-center py-4">
              <div className="mb-3">
                <h4 className="text-primary">{llamadaActiva.telefono || 'Número no disponible'}</h4>
              </div>
              <Badge bg={esEntrante ? 'success' : 'primary'} className="mb-3">
                {esEntrante ? 'Entrante' : 'Saliente'}
              </Badge>
              <p className="text-muted mt-3">
                Cliente no encontrado en la base de datos
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={cerrarModal}>
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Spinner mientras busca cliente */}
      {llamadaActiva && buscandoCliente && (
        <Modal show={true} onHide={cerrarModal} centered size="sm">
          <Modal.Body className="text-center py-4">
            <Spinner animation="border" variant="primary" className="mb-3" />
            <p>Buscando información del cliente...</p>
            <p className="text-muted small">{llamadaActiva.telefono}</p>
          </Modal.Body>
        </Modal>
      )}

      {/* Modal de detalle del cliente (reutilizando componente existente) */}
      {clienteData && (
        <DetalleClienteModal
          show={showClienteModal}
          onHide={() => {
            setShowClienteModal(false);
            cerrarModal();
          }}
          clienteData={clienteData}
          grupoFamiliarId={clienteData.grupo_familiar_id || null}
        />
      )}
    </>
  );
};

export default CallIdentifierContainer;

