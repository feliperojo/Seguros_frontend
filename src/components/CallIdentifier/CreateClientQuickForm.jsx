// src/components/CallIdentifier/CreateClientQuickForm.jsx
// Formulario inline para crear cliente rápido desde el modal de llamada

import React, { useState } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { FiMail, FiUser, FiBuilding } from 'react-icons/fi';
import axiosInstance from '../../services/axios';

const CreateClientQuickForm = ({ telefono, onClienteCreado, onCancel }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    empresa: '',
    email: '',
  });
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Validar formato de email
  const validateEmail = (email) => {
    if (!email) return true; // Email es opcional
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Validar email en tiempo real
    if (name === 'email') {
      if (value && !validateEmail(value)) {
        setError('Formato de email inválido');
      } else {
        setError(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validaciones
    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (formData.email && !validateEmail(formData.email)) {
      setError('Formato de email inválido');
      return;
    }

    setValidating(true);

    try {
      const response = await axiosInstance.post('/cliente/crear-rapido', {
        nombre: formData.nombre.trim(),
        empresa: formData.empresa.trim() || null,
        email: formData.email.trim() || null,
        telefono: telefono,
      });

      if (response.data && (response.data.success || response.data.cliente)) {
        setSuccess(true);
        
        // Llamar callback con el nuevo cliente
        if (onClienteCreado) {
          onClienteCreado(response.data.cliente || response.data.data);
        }

        // Limpiar formulario después de un breve delay
        setTimeout(() => {
          setFormData({ nombre: '', empresa: '', email: '' });
          setSuccess(false);
        }, 2000);
      } else {
        setError(response.data?.message || 'Error al crear el cliente');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Error al crear el cliente';
      setError(errorMessage);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="create-client-quick-form">
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-3">
          ✓ Cliente creado exitosamente
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>
            <FiUser className="me-2" />
            Nombre <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Nombre completo del cliente"
            required
            disabled={validating}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>
            <FiBuilding className="me-2" />
            Empresa
          </Form.Label>
          <Form.Control
            type="text"
            name="empresa"
            value={formData.empresa}
            onChange={handleChange}
            placeholder="Nombre de la empresa (opcional)"
            disabled={validating}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>
            <FiMail className="me-2" />
            Email
          </Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@ejemplo.com (opcional)"
            disabled={validating}
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
            value={telefono || 'N/A'}
            readOnly
            disabled
            className="bg-light"
          />
        </Form.Group>

        <div className="d-flex gap-2 justify-content-end">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={validating}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={validating || !formData.nombre.trim()}
          >
            {validating ? (
              <>
                <Spinner size="sm" className="me-2" animation="border" />
                Guardando...
              </>
            ) : (
              'Guardar Cliente'
            )}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default CreateClientQuickForm;

