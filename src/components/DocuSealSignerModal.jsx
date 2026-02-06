// src/components/DocuSealSignerModal.jsx
import React, { useState } from "react";
import { Modal, Button, Spinner, Alert } from "react-bootstrap";
import { getSubmissionStatus } from "../services/SignatureService";
import useToast from "../hooks/useToast";
import DocusealForm from "./DocusealForm";

/**
 * Modal para mostrar la firma embebida de DocuSeal.
 * Renderiza DocusealForm solo cuando embedSrc está disponible.
 *
 * @param {boolean} open - Controla si el modal está abierto
 * @param {Function} onClose - Función para cerrar el modal
 * @param {string} embedSrc - URL del formulario de firma (data.embed_src del backend)
 * @param {string} submissionId - ID de la solicitud de firma (opcional, para verificar estado)
 * @param {Function} onComplete - Callback al completar la firma en DocuSeal; recibe (data)
 */
const DocuSealSignerModal = ({ open, onClose, embedSrc, submissionId, onComplete }) => {
  const toast = useToast();
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [error, setError] = useState(null);

  if (!open) return null;

  // Usar embed_src tal cual (ej: https://docuseal.com/s/hmckurZ1TeARQg); opcionalmente normalizar dominio propio
  const normalizedEmbedSrc = embedSrc?.includes("firma.vantun.com")
    ? embedSrc
    : embedSrc;

  const handleCheckStatus = async () => {
    if (!submissionId) {
      toast.showWarning("No hay ID de solicitud disponible para verificar");
      return;
    }

    try {
      setCheckingStatus(true);
      setError(null);
      const status = await getSubmissionStatus(submissionId);
      setStatusInfo(status);
      
      if (status.completed) {
        toast.showSuccess("El documento ha sido firmado exitosamente");
      } else if (status.status) {
        toast.showInfo(`Estado: ${status.status}`);
      }
    } catch (err) {
      const errorMessage = err?.message || "Error al verificar el estado de la firma";
      setError(errorMessage);
      toast.showError(errorMessage);
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div
      className="modal fade show d-block overflow-auto"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1055,
        minHeight: "100vh",
        padding: "1rem 0",
      }}
      tabIndex="-1"
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        style={{
          maxWidth: "min(96vw, 1200px)",
          width: "100%",
          margin: "0 auto",
          maxHeight: "calc(100vh - 2rem)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="modal-content d-flex flex-column"
          style={{ maxHeight: "calc(100vh - 2rem)" }}
        >
          <div className="modal-header flex-shrink-0">
            <h5 className="modal-title">
              <i className="bi bi-file-earmark-sign me-2"></i>
              Firma del Documento
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Cerrar"
            />
          </div>

          <div
            className="modal-body p-0 flex-grow-1 d-flex flex-column overflow-hidden"
            style={{ minHeight: 0 }}
          >
            {error && (
              <Alert variant="danger" className="m-3 mb-0" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {statusInfo && (
              <Alert variant="info" className="m-3 mb-0">
                <strong>Estado:</strong> {statusInfo.status || "Verificando..."}
                {statusInfo.completed && (
                  <span className="ms-2 text-success">
                    <i className="bi bi-check-circle me-1"></i>
                    Completado
                  </span>
                )}
              </Alert>
            )}

            {normalizedEmbedSrc ? (
              <DocusealForm
                src={normalizedEmbedSrc}
                onComplete={(data) => {
                  if (typeof onComplete === "function") onComplete(data);
                  else toast.showSuccess("Documento firmado correctamente");
                }}
                className="docuseal-signer-embed flex-grow-1"
              />
            ) : (
              <div className="text-center p-5">
                <Alert variant="warning">
                  No se pudo cargar la URL de firma. Por favor, contacte al administrador.
                </Alert>
              </div>
            )}
          </div>

          <div className="modal-footer flex-shrink-0">
            {submissionId && (
              <Button
                variant="outline-info"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
              >
                {checkingStatus ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Verificar estado
                  </>
                )}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocuSealSignerModal;

