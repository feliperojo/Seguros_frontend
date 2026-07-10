import React, { useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import systemConfigService from "../../services/SystemConfigService";

const SuperAdminPasswordModal = ({
  show,
  onHide,
  onSuccess,
  title = "Clave del super administrador",
  message = "Para acceder a años anteriores debe ingresar la contraseña del super administrador configurado en el sistema.",
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setPassword("");
    setError("");
    onHide?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Ingrese la contraseña del super administrador.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await systemConfigService.verifySuperAdminPassword(password.trim());
      onSuccess?.(password.trim());
      setPassword("");
      setError("");
    } catch (err) {
      setError(
        err?.message ||
          err?.response?.data?.message ||
          "La contraseña del super administrador no es correcta."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <p className="text-muted small mb-3">{message}</p>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}
          <Form.Group>
            <Form.Label>Contraseña del super administrador</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Verificando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default SuperAdminPasswordModal;
