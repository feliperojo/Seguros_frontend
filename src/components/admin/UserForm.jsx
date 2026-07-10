import React, { useState, useEffect } from "react";
import { Modal, Form, Button, Alert, Spinner } from "react-bootstrap";
import { toast } from "react-toastify";
import { usersService } from "../../services/adminApi";

const UserForm = ({ show, onHide, user = null, isViewOnly = false }) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    status: "active",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        password: "",
        password_confirmation: "",
        status: user.status || "active",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        status: "active",
      });
    }
    setErrors({});
  }, [user, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    if (!user && !formData.password) {
      newErrors.password = "La contraseña es requerida";
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = "La contraseña debe tener al menos 8 caracteres";
    }

    if (formData.password && formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = "Las contraseñas no coinciden";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isViewOnly) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const dataToSend = {
        name: formData.name,
        email: formData.email,
        status: formData.status,
      };

      if (!user || formData.password) {
        dataToSend.password = formData.password;
        dataToSend.password_confirmation = formData.password_confirmation;
      }

      if (user) {
        await usersService.update(user.id, dataToSend);
        toast.success("Usuario actualizado correctamente");
      } else {
        const result = await usersService.create(dataToSend);
        toast.success("Usuario creado correctamente");
        
        // Log para debugging
        if (import.meta.env.DEV) {
          console.log("✅ Usuario creado:", result);
        }
      }

      // Cerrar el modal y recargar la lista
      onHide();
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      
      if (err.response?.status === 422) {
        const backendErrors = err.response.errors || err.response.data?.errors || err.response.data?.error;
        if (backendErrors) {
          // Normalizar errores: pueden venir como objeto o array
          const normalizedErrors = {};
          Object.keys(backendErrors).forEach(key => {
            if (Array.isArray(backendErrors[key])) {
              normalizedErrors[key] = backendErrors[key][0]; // Tomar el primer error
            } else {
              normalizedErrors[key] = backendErrors[key];
            }
          });
          setErrors(normalizedErrors);
          const firstError = Object.values(normalizedErrors).flat()[0];
          if (firstError) {
            toast.error(firstError);
          }
        } else {
          toast.error(err.response.data?.message || err.response.data?.error || "Error de validación");
        }
      } else {
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Error al guardar usuario";
        toast.error(errorMsg);
      }
      
      // Log para debugging
      if (import.meta.env.DEV) {
        console.error("❌ Error al guardar usuario:", {
          error: err,
          status: err.response?.status,
          data: err.response?.data,
          errors: err.response?.errors,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isViewOnly
            ? "Detalles del Usuario"
            : user
            ? "Editar Usuario"
            : "Crear Usuario"}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>
              Nombre <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              isInvalid={!!errors.name}
              disabled={isViewOnly}
              required
            />
            <Form.Control.Feedback type="invalid">
              {errors.name}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Email <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              isInvalid={!!errors.email}
              disabled={isViewOnly}
              required
            />
            <Form.Control.Feedback type="invalid">
              {errors.email}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              {user ? "Nueva Contraseña (dejar vacío para mantener)" : "Contraseña"}{" "}
              {!user && <span className="text-danger">*</span>}
            </Form.Label>
            <Form.Control
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              isInvalid={!!errors.password}
              disabled={isViewOnly}
              required={!user}
            />
            <Form.Control.Feedback type="invalid">
              {errors.password}
            </Form.Control.Feedback>
            {user && (
              <Form.Text className="text-muted">
                Deja vacío si no deseas cambiar la contraseña
              </Form.Text>
            )}
          </Form.Group>

          {formData.password && (
            <Form.Group className="mb-3">
              <Form.Label>
                Confirmar Contraseña <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="password"
                name="password_confirmation"
                value={formData.password_confirmation}
                onChange={handleChange}
                isInvalid={!!errors.password_confirmation}
                disabled={isViewOnly}
                required={!!formData.password}
              />
              <Form.Control.Feedback type="invalid">
                {errors.password_confirmation}
              </Form.Control.Feedback>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Estado</Form.Label>
            <Form.Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={isViewOnly}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </Form.Select>
          </Form.Group>

          {Object.keys(errors).length > 0 && (
            <Alert variant="danger">
              <strong>Errores de validación:</strong>
              <ul className="mb-0">
                {Object.entries(errors).map(([key, value]) => {
                  if (Array.isArray(value)) {
                    return value.map((msg, idx) => (
                      <li key={`${key}-${idx}`}>{msg}</li>
                    ));
                  }
                  return <li key={key}>{value}</li>;
                })}
              </ul>
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            {isViewOnly ? "Cerrar" : "Cancelar"}
          </Button>
          {!isViewOnly && (
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Guardando...
                </>
              ) : user ? (
                "Actualizar"
              ) : (
                "Crear"
              )}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default UserForm;

