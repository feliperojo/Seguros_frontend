import React, { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { FaLock, FaUnlock } from "react-icons/fa";
import apiRequest from "../services/api";
import { useAuth } from "../context/AuthContext";

const PasswordUnlockModal = ({ show, onHide, onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Verificar contraseña usando el endpoint de login
      // El backend validará la contraseña y devolverá un token si es correcta
      const response = await apiRequest("/v1/auth/login", "POST", {
        email: user?.email || user?.email_address || user?.emailAddress,
        password: password,
      });

      // Si obtenemos un token, la contraseña es correcta
      if (response.data?.token || response.token) {
        // Contraseña correcta - no guardamos el nuevo token ya que el usuario ya está autenticado
        setPassword("");
        onSuccess();
        onHide();
      } else {
        setError("Contraseña incorrecta");
      }
    } catch (err) {
      // Manejar errores específicos
      if (err.response?.status === 401 || err.response?.status === 422) {
        setError("Contraseña incorrecta");
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Error al verificar la contraseña. Por favor, intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaLock className="me-2" />
          Verificar Contraseña
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Por favor ingrese su contraseña para ver los datos sensibles.</p>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Contraseña</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              required
              autoFocus
            />
          </Form.Group>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? "Verificando..." : "Verificar"}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default PasswordUnlockModal;

