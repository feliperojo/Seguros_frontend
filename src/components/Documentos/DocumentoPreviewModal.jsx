import React, { useState } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import { obtenerTipoVistaPrevia } from "./archivoPreviewUtils";

const DocumentoPreviewModal = ({ show, onHide, archivo, url, loading }) => {
  const [errorCarga, setErrorCarga] = useState(false);

  const handleClose = () => {
    setErrorCarga(false);
    onHide();
  };

  if (!archivo) return null;

  const tipo = obtenerTipoVistaPrevia(archivo.tipo_mime, archivo.nombre_original);
  const nombre = archivo.nombre_original || "Vista previa";

  return (
    <Modal show={show} onHide={handleClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title className="text-truncate" style={{ maxWidth: "90%" }}>
          {tipo === "imagen" && <i className="fas fa-image me-2 text-primary" />}
          {tipo === "pdf" && <i className="fas fa-file-pdf me-2 text-danger" />}
          {tipo === "otro" && <i className="fas fa-file me-2 text-secondary" />}
          {nombre}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ minHeight: "300px" }}>
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="text-muted small mt-2">Cargando vista previa...</p>
          </div>
        ) : !url ? (
          <div className="text-center py-5 text-muted">
            <i className="fas fa-exclamation-circle fa-2x mb-2" />
            <p>No se pudo obtener la URL del documento.</p>
          </div>
        ) : tipo === "imagen" ? (
          <div className="text-center">
            {errorCarga ? (
              <p className="text-muted">No se pudo cargar la imagen. Intenta descargarla.</p>
            ) : (
              <img
                src={url}
                alt={nombre}
                className="img-fluid"
                style={{ maxHeight: "75vh", objectFit: "contain" }}
                onError={() => setErrorCarga(true)}
              />
            )}
          </div>
        ) : tipo === "pdf" ? (
          <div style={{ height: "75vh", width: "100%" }}>
            {errorCarga ? (
              <div className="text-center py-5 text-muted">
                <i className="fas fa-file-pdf fa-3x text-danger mb-3" />
                <p>No se pudo mostrar el PDF aquí. Ábrelo en una nueva pestaña.</p>
              </div>
            ) : (
              <iframe
                src={`${url}#toolbar=1`}
                title={nombre}
                style={{ width: "100%", height: "100%", border: "none" }}
                onError={() => setErrorCarga(true)}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-5 text-muted">
            <i className="fas fa-file fa-3x mb-3 opacity-50" />
            <p>Este tipo de archivo no se puede previsualizar en el navegador.</p>
            <Button variant="primary" onClick={() => window.open(url, "_blank")}>
              <i className="fas fa-external-link-alt me-2" />
              Abrir en nueva pestaña
            </Button>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cerrar
        </Button>
        {url && (
          <Button variant="outline-primary" onClick={() => window.open(url, "_blank")}>
            <i className="fas fa-external-link-alt me-2" />
            Abrir en pestaña nueva
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default DocumentoPreviewModal;
