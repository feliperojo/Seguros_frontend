import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import apiRequest from "../../services/api"; // Ajusta la ruta según tu estructura

const DriveUrlModal = ({ show, onHide, grupoId, initialUrl = "", onSave }) => {
  const [driveUrl, setDriveUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setDriveUrl(initialUrl || "");
    setErrorMessage("");
  }, [initialUrl, show]);

  const handleSave = async () => {
    if (!driveUrl.trim()) {
      setErrorMessage("Por favor ingresa una URL válida");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // ✅ Actualiza solo el campo drive_url
      await apiRequest(`grupo_familiar/${grupoId}`, "PUT", {
        drive_url: driveUrl,
      });

      onSave(driveUrl); // Notifica al componente padre
      onHide(); // Cierra el modal
    } catch (error) {
      setErrorMessage(error.message || "Error al guardar la URL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Administrar URL de Google Drive</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

        <Form>
          <Form.Group>
            <Form.Label>Enlace de Google Drive</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://drive.google.com/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />
          </Form.Group>
        </Form>

        {driveUrl && (
          <div className="mt-3 text-center">
            <Button
              variant="outline-success"
              size="sm"
              onClick={() => window.open(driveUrl, "_blank")}
            >
              <i className="bi bi-folder2-open me-2"></i>
              Abrir en Google Drive
            </Button>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DriveUrlModal;
