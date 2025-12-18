import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import apiRequest from "../../services/api"; // Ajusta la ruta según tu estructura

const DriveUrlModal = ({ show, onHide, grupoId, initialUrl = "", onSave }) => {
  const [driveUrl, setDriveUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Actualizar el estado cuando cambia initialUrl o cuando se abre el modal
    // Esto asegura que el campo muestre el valor correcto al abrir el modal
    setDriveUrl(initialUrl || "");
    // Limpiar errores cuando se abre el modal
    if (show) {
      setErrorMessage("");
    }
  }, [initialUrl, show]);

  const handleSave = async () => {
    // Validar que haya un grupoId
    if (!grupoId) {
      setErrorMessage("Error: No se ha especificado el grupo familiar");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // Normalizar la URL: trim y convertir a null si está vacía
      const urlNormalizada = driveUrl.trim() || null;

      // ✅ Actualiza solo el campo drive_url (permite null para eliminar)
      await apiRequest(`grupo_familiar/${grupoId}`, "PUT", {
        drive_url: urlNormalizada,
      });

      // Notifica al componente padre con la URL guardada (o null si se eliminó)
      const urlFinal = urlNormalizada || "";
      onSave(urlFinal);

      // Cierra el modal solo si todo fue exitoso
      onHide();
    } catch (error) {
      // Manejo mejorado de errores
      let mensajeError = "Error al guardar la URL";
      
      if (error.response) {
        // Si hay respuesta del servidor, usar su mensaje
        mensajeError = error.response.data?.message || error.message || mensajeError;
        
        // Mensajes específicos según el código de estado
        if (error.response.status === 404) {
          mensajeError = "Grupo familiar no encontrado";
        } else if (error.response.status === 422) {
          mensajeError = error.response.data?.message || "Datos inválidos. Verifica la URL ingresada";
        } else if (error.response.status === 403) {
          mensajeError = "No tienes permisos para actualizar este grupo familiar";
        }
      } else if (error.message) {
        mensajeError = error.message;
      }

      setErrorMessage(mensajeError);
      
      // Log para debugging en desarrollo
      if (import.meta.env.DEV) {
        console.error("Error al guardar drive_url:", {
          grupoId,
          driveUrl,
          error: error.message,
          response: error.response,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Verificar si hay una URL guardada (initialUrl es la que viene del servidor)
  const tieneUrlGuardada = initialUrl && initialUrl.trim();

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-folder2-open me-2"></i>
          Administrar URL de Google Drive
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

        {/* Sección: URL Guardada Actual */}
        {tieneUrlGuardada && (
          <div className="mb-4 p-3 bg-light border rounded">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h6 className="mb-1 text-primary">
                  <i className="bi bi-link-45deg me-2"></i>
                  URL Guardada Actualmente:
                </h6>
                <div className="text-break text-muted small mb-2" style={{ wordBreak: "break-all" }}>
                  {initialUrl}
                </div>
              </div>
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => window.open(initialUrl.trim(), "_blank")}
                disabled={loading}
                title="Abrir URL guardada en nueva pestaña"
              >
                <i className="bi bi-box-arrow-up-right me-1"></i>
                Abrir
              </Button>
            </div>
            <div className="text-muted small">
              <i className="bi bi-info-circle me-1"></i>
              Puedes modificar esta URL en el campo de abajo o dejarlo vacío para eliminarla
            </div>
          </div>
        )}

        {/* Sección: Editar/Agregar URL */}
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>
              <strong>
                {tieneUrlGuardada ? "Modificar URL de Google Drive" : "Agregar URL de Google Drive"}
              </strong>
            </Form.Label>
            <Form.Control
              type="url"
              placeholder="https://drive.google.com/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              disabled={loading}
              className={tieneUrlGuardada ? "border-warning" : ""}
            />
            <Form.Text className="text-muted">
              {tieneUrlGuardada 
                ? "Modifica la URL arriba o deja el campo vacío para eliminar la URL guardada"
                : "Ingresa la URL completa de Google Drive que deseas guardar"}
            </Form.Text>
          </Form.Group>
        </Form>

        {/* Vista previa de la URL ingresada (si es diferente a la guardada) */}
        {driveUrl && driveUrl.trim() && driveUrl.trim() !== (initialUrl || "").trim() && (
          <div className="mt-3 p-2 bg-info bg-opacity-10 border border-info rounded">
            <div className="d-flex justify-content-between align-items-center">
              <div className="flex-grow-1">
                <small className="text-info fw-bold">
                  <i className="bi bi-eye me-1"></i>
                  Vista previa - Nueva URL:
                </small>
                <div className="text-break small text-muted mt-1" style={{ wordBreak: "break-all" }}>
                  {driveUrl.trim()}
                </div>
              </div>
              <Button
                variant="outline-info"
                size="sm"
                onClick={() => window.open(driveUrl.trim(), "_blank")}
                disabled={loading}
                className="ms-2"
              >
                <i className="bi bi-box-arrow-up-right me-1"></i>
                Probar
              </Button>
            </div>
          </div>
        )}

        {/* Botón para abrir la URL actual del campo (si hay una y es válida) */}
        {driveUrl && driveUrl.trim() && (
          <div className="mt-3 text-center">
            <Button
              variant="outline-success"
              size="sm"
              onClick={() => window.open(driveUrl.trim(), "_blank")}
              disabled={loading}
            >
              <i className="bi bi-folder2-open me-2"></i>
              Abrir URL en Google Drive
            </Button>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={onHide}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={loading || !grupoId}
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
