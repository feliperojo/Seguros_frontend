// src/components/DocumentFlowGuide.jsx
import React from "react";
import { Card, Button, ProgressBar } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaClock,
  FaEnvelope,
  FaFileAlt,
  FaDownload,
  FaTimes,
} from "react-icons/fa";

const STEPS = [
  {
    id: "template_created",
    title: "Plantilla creada",
    description: "Tu documento ha sido preparado con todos los campos.",
    action: "Ahora puedes enviarlo para firmar.",
    nextStep: "send",
    icon: FaFileAlt,
    variant: "success",
    borderClass: "border-success",
    iconClass: "text-success bg-success bg-opacity-10",
  },
  {
    id: "sending",
    title: "Enviando documento...",
    description: "Estamos enviando el documento a los firmantes.",
    action: "Por favor espera un momento.",
    nextStep: null,
    icon: FaClock,
    variant: "info",
    borderClass: "border-info",
    iconClass: "text-info bg-info bg-opacity-10",
  },
  {
    id: "sent",
    title: "Documento enviado",
    description: "Los firmantes han recibido el correo con el enlace.",
    action: "Puedes ver el estado en la sección de Informes.",
    nextStep: "track",
    icon: FaEnvelope,
    variant: "success",
    borderClass: "border-success",
    iconClass: "text-success bg-success bg-opacity-10",
  },
  {
    id: "pending_signature",
    title: "Esperando firmas",
    description: (data) =>
      `Pendiente: ${data?.pending_signers ?? data?.signers?.length ?? 0} firmante(s).`,
    action: "Te notificaremos cuando todos firmen.",
    nextStep: "wait",
    icon: FaClock,
    variant: "warning",
    borderClass: "border-warning",
    iconClass: "text-warning bg-warning bg-opacity-10",
  },
  {
    id: "completed",
    title: "¡Documento completado!",
    description: "Todos los firmantes han completado el documento.",
    action: "Ya puedes descargar el documento firmado.",
    nextStep: "download",
    icon: FaCheckCircle,
    variant: "success",
    borderClass: "border-success",
    iconClass: "text-success bg-success bg-opacity-10",
  },
];

/**
 * Guía de flujo del documento: muestra el paso actual, siguiente acción y progreso.
 * @param {string} currentStep - Id del paso: template_created | sending | sent | pending_signature | completed
 * @param {Object} documentData - { name, signers, pending_signers?, progress? }
 * @param {boolean} visible - Si se muestra el panel (controlado por el padre)
 * @param {Function} onClose - Callback al cerrar la guía
 * @param {Function} onSendNow - Callback para "Enviar ahora" (cuando nextStep === 'send')
 * @param {Function} onDownload - Callback para "Descargar" (cuando nextStep === 'download')
 */
const DocumentFlowGuide = ({
  currentStep,
  documentData = {},
  visible = true,
  onClose,
  onSendNow,
  onDownload,
}) => {
  const navigate = useNavigate();

  if (!visible) return null;

  const stepConfig = STEPS.find((s) => s.id === currentStep);
  if (!stepConfig) return null;

  const Icon = stepConfig.icon;
  const description =
    typeof stepConfig.description === "function"
      ? stepConfig.description(documentData)
      : stepConfig.description;

  const handleClose = () => onClose?.();

  const progress = documentData?.progress ?? 0;

  return (
    <div
      className="position-fixed bottom-0 end-0 p-3 m-2"
      style={{ zIndex: 1060, maxWidth: "420px" }}
    >
      <Card className={`shadow border-2 ${stepConfig.borderClass}`}>
        <Card.Body className="p-0">
          {/* Header con icono y título */}
          <div className="d-flex align-items-start gap-3 p-3 pb-2">
            <div
              className={`rounded-circle p-2 flex-shrink-0 ${stepConfig.iconClass}`}
            >
              <Icon size={22} />
            </div>
            <div className="flex-grow-1 min-w-0">
              <Card.Title className="mb-1 fs-6 fw-semibold text-dark">
                {stepConfig.title}
              </Card.Title>
              <Card.Text className="text-muted small mb-0">
                {description}
              </Card.Text>
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-secondary p-0 align-self-start"
              onClick={handleClose}
              aria-label="Cerrar"
            >
              <FaTimes size={18} />
            </Button>
          </div>

          {/* Datos del documento */}
          {(documentData?.name || documentData?.signers) && (
            <div className="bg-light rounded mx-3 mb-2 p-2 small">
              {documentData.name && (
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Documento:</span>
                  <span className="fw-medium text-truncate ms-2">
                    {documentData.name}
                  </span>
                </div>
              )}
              {documentData.signers != null && (
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Firmantes:</span>
                  <span className="fw-medium">
                    {Array.isArray(documentData.signers)
                      ? documentData.signers.length
                      : documentData.signers}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Siguiente paso */}
          <div className="bg-primary bg-opacity-10 rounded mx-3 mb-2 p-2">
            <p className="small text-primary mb-0">
              <span className="fw-semibold">Siguiente paso: </span>
              {stepConfig.action}
            </p>
          </div>

          {/* Botones de acción */}
          <div className="d-flex gap-2 flex-wrap p-3 pt-0">
            {stepConfig.nextStep === "send" && onSendNow && (
              <Button variant="primary" size="sm" onClick={onSendNow}>
                Enviar ahora
              </Button>
            )}
            {stepConfig.nextStep === "track" && (
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => {
                  handleClose();
                  navigate("/informes/documentos");
                }}
              >
                Ver en Informes
              </Button>
            )}
            {stepConfig.nextStep === "download" && onDownload && (
              <Button variant="success" size="sm" onClick={onDownload}>
                <FaDownload className="me-1" />
                Descargar
              </Button>
            )}
            <Button variant="outline-secondary" size="sm" onClick={handleClose}>
              Cerrar
            </Button>
          </div>

          {/* Barra de progreso */}
          {(progress > 0 || stepConfig.id === "completed") && (
            <div className="px-3 pb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Progreso del documento</span>
                <span>{stepConfig.id === "completed" ? 100 : progress}%</span>
              </div>
              <ProgressBar
                now={stepConfig.id === "completed" ? 100 : progress}
                variant={stepConfig.variant}
                style={{ height: "6px" }}
              />
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default DocumentFlowGuide;
