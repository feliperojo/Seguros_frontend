// src/components/CallIdentifier/CallNotification.jsx
// Toast notification que aparece brevemente cuando hay una nueva llamada

import React, { useEffect, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { FiPhone } from 'react-icons/fi';

const CallNotification = ({ show, llamada, onClose }) => {
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (show && llamada) {
      setShowToast(true);
      
      // Auto-desaparecer después de 3 segundos
      const timer = setTimeout(() => {
        setShowToast(false);
        if (onClose) {
          setTimeout(onClose, 300); // Esperar a que termine la animación
        }
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setShowToast(false);
    }
  }, [show, llamada, onClose]);

  if (!llamada) return null;

  // Obtener nombre o número para mostrar
  const nombreCliente = llamada.cliente?.nombre_completo || 
                       llamada.cliente?.nombre || 
                       llamada.cliente?.name;
  const numeroTelefono = llamada.numero || llamada.telefono || llamada.phone_number || 'número desconocido';
  const displayText = nombreCliente || numeroTelefono;

  // Determinar tipo de llamada
  const esEntrante = llamada.direccion === 'Inbound' || llamada.direction === 'Inbound' || llamada.tipo === 'entrante';
  const tipoTexto = esEntrante ? 'entrante' : 'saliente';

  return (
    <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
      <Toast
        show={showToast}
        onClose={() => {
          setShowToast(false);
          if (onClose) {
            setTimeout(onClose, 300);
          }
        }}
        delay={3000}
        autohide
        bg={esEntrante ? 'success' : 'primary'}
      >
        <Toast.Header>
          <FiPhone className="me-2" />
          <strong className="me-auto">Nueva Llamada {tipoTexto}</strong>
        </Toast.Header>
        <Toast.Body className="text-white">
          <div className="d-flex align-items-center">
            <FiPhone className="me-2" size={20} />
            <div>
              <strong>Llamada {tipoTexto} de:</strong>
              <br />
              {displayText}
            </div>
          </div>
        </Toast.Body>
      </Toast>
    </ToastContainer>
  );
};

export default CallNotification;
