// src/components/PDFSignatureModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert, Row, Col } from "react-bootstrap";
import { FaDownload, FaFileSignature, FaPlus, FaTrash } from "react-icons/fa";
import { createSubmission } from "../services/SignatureService";
import { downloadBlob } from "../utils/pdfHelpers";
import useToast from "../hooks/useToast";

const PDFSignatureModal = ({
  show,
  onHide,
  pdfBlob,
  filename,
  defaultSignerName = "",
  defaultSignerEmail = "",
  clienteId = null,
  grupoFamiliarId = null,
}) => {
  const toast = useToast();
  const [step, setStep] = useState("options"); // 'options', 'signature-form', 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [redirectUrl, setRedirectUrl] = useState(null);
  const [signingUrl, setSigningUrl] = useState(null);
  
  // Lista dinámica de firmantes
  const [signers, setSigners] = useState([
    {
      email: defaultSignerEmail || "",
      name: defaultSignerName || "",
    },
  ]);

  // Campos opcionales
  const [metadata, setMetadata] = useState({
    subject: "",
    message: "",
  });

  // Resetear estado cuando se cierra el modal
  useEffect(() => {
    if (!show) {
      setStep("options");
      setError(null);
      setSubmissionId(null);
      setRedirectUrl(null);
      setSigningUrl(null);
      setSigners([
        {
          email: defaultSignerEmail || "",
          name: defaultSignerName || "",
        },
      ]);
      setMetadata({
        subject: "",
        message: "",
      });
    }
  }, [show, defaultSignerEmail, defaultSignerName]);

  // Descargar PDF directamente
  const handleDownload = () => {
    if (pdfBlob && filename) {
      downloadBlob(pdfBlob, filename);
      onHide();
    }
  };

  // Agregar nuevo firmante
  const handleAddSigner = () => {
    setSigners([
      ...signers,
      {
        email: "",
        name: "",
      },
    ]);
  };

  // Eliminar firmante
  const handleRemoveSigner = (index) => {
    if (signers.length > 1) {
      setSigners(signers.filter((_, i) => i !== index));
    }
  };

  // Actualizar datos de un firmante
  const handleSignerChange = (index, field, value) => {
    const updatedSigners = [...signers];
    updatedSigners[index] = {
      ...updatedSigners[index],
      [field]: value,
    };
    setSigners(updatedSigners);
  };

  // Actualizar metadata
  const handleMetadataChange = (field, value) => {
    setMetadata((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Validar formulario
  const validateForm = () => {
    // Validar que haya al menos un firmante
    if (signers.length === 0) {
      setError("Debe haber al menos un firmante");
      return false;
    }

    // Validar emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      if (!signer.email || !signer.email.trim()) {
        setError(`El email del firmante ${i + 1} es requerido`);
        return false;
      }
      if (!emailRegex.test(signer.email.trim())) {
        setError(`El email del firmante ${i + 1} no es válido`);
        return false;
      }
    }

    return true;
  };

  // Enviar a firma
  const handleSendToSignature = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar formulario
      if (!validateForm()) {
        setLoading(false);
        return;
      }

      // Preparar firmantes (solo email es requerido, name es opcional)
      const preparedSigners = signers.map((signer) => ({
        email: signer.email.trim(),
        ...(signer.name.trim() && { name: signer.name.trim() }),
      }));

      // Preparar metadata (solo incluir si tiene valores)
      const preparedMetadata = {};
      if (metadata.subject.trim()) {
        preparedMetadata.subject = metadata.subject.trim();
      }
      if (metadata.message.trim()) {
        preparedMetadata.message = metadata.message.trim();
      }

      // Enviar a firma
      const response = await createSubmission({
        pdfBlob,
        filename: filename || "documento.pdf",
        signers: preparedSigners,
        clienteId: clienteId || undefined,
        grupoFamiliarId: grupoFamiliarId || undefined,
        metadata: Object.keys(preparedMetadata).length > 0 ? preparedMetadata : undefined,
      });

      // Si es exitoso, mostrar mensaje de éxito
      if (response.submission_id) {
        setSubmissionId(response.submission_id);
        setRedirectUrl(response.redirect_url || null);
        setSigningUrl(response.signing_url || null);
        setStep("success");
        toast.showSuccess("Solicitud enviada exitosamente");
      } else {
        setError("No se recibió el ID de solicitud del servidor");
      }
    } catch (err) {
      console.error("Error al enviar a firma:", err);
      const errorMessage =
        err?.message ||
        err?.response?.data?.message ||
        "Error al enviar el documento a firma. Por favor, intenta nuevamente.";
      setError(errorMessage);
      toast.showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Abrir URL de firma en nueva pestaña
  const handleOpenSignature = () => {
    const url = signingUrl || redirectUrl;
    if (url) {
      window.open(url, "_blank");
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Acciones del Documento</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Paso 1: Opciones (Descargar / Enviar a firma) */}
        {step === "options" && (
          <div className="text-center py-4">
            <p className="mb-4">¿Qué deseas hacer con el documento?</p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <Button
                variant="outline-primary"
                size="lg"
                onClick={handleDownload}
                className="d-flex flex-column align-items-center justify-content-center"
                style={{ minWidth: "200px", minHeight: "120px" }}
              >
                <FaDownload className="mb-2" style={{ fontSize: "2rem" }} />
                <span>Descargar</span>
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setStep("signature-form")}
                className="d-flex flex-column align-items-center justify-content-center"
                style={{ minWidth: "200px", minHeight: "120px" }}
              >
                <FaFileSignature className="mb-2" style={{ fontSize: "2rem" }} />
                <span>Enviar a firma</span>
              </Button>
            </div>
          </div>
        )}

        {/* Paso 2: Formulario de firma */}
        {step === "signature-form" && (
          <div>
            <h5 className="mb-3">Enviar a firma</h5>
            {error && (
              <Alert variant="danger" className="mb-3" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <Form onSubmit={handleSendToSignature}>
              {/* Lista de firmantes */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Form.Label className="fw-bold mb-0">
                    Firmantes <span className="text-danger">*</span>
                  </Form.Label>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    type="button"
                    onClick={handleAddSigner}
                    disabled={loading}
                  >
                    <FaPlus className="me-1" />
                    Agregar firmante
                  </Button>
                </div>

                {signers.map((signer, index) => (
                  <div key={index} className="border rounded p-3 mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold">Firmante {index + 1}</span>
                      {signers.length > 1 && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          type="button"
                          onClick={() => handleRemoveSigner(index)}
                          disabled={loading}
                        >
                          <FaTrash />
                        </Button>
                      )}
                    </div>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Email <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="email"
                            value={signer.email}
                            onChange={(e) =>
                              handleSignerChange(index, "email", e.target.value)
                            }
                            required
                            disabled={loading}
                            placeholder="email@ejemplo.com"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Nombre (opcional)</Form.Label>
                          <Form.Control
                            type="text"
                            value={signer.name}
                            onChange={(e) =>
                              handleSignerChange(index, "name", e.target.value)
                            }
                            disabled={loading}
                            placeholder="Nombre completo"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>
                ))}
              </div>

              {/* Campos opcionales */}
              <Form.Group className="mb-3">
                <Form.Label>Asunto (opcional)</Form.Label>
                <Form.Control
                  type="text"
                  value={metadata.subject}
                  onChange={(e) => handleMetadataChange("subject", e.target.value)}
                  disabled={loading}
                  placeholder="Asunto del email"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Mensaje (opcional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={metadata.message}
                  onChange={(e) => handleMetadataChange("message", e.target.value)}
                  disabled={loading}
                  placeholder="Mensaje adicional para el firmante"
                />
              </Form.Group>

              <div className="d-flex gap-2 justify-content-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep("options");
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </div>
            </Form>
          </div>
        )}

        {/* Paso 3: Éxito */}
        {step === "success" && (
          <div className="text-center py-4">
            <div className="text-success mb-3" style={{ fontSize: "3rem" }}>
              <FaFileSignature />
            </div>
            <h5 className="mb-3">Solicitud enviada</h5>
            <p className="text-muted mb-3">
              El documento ha sido enviado exitosamente para firma.
            </p>
            {submissionId && (
              <p className="small text-muted mb-4">
                ID de solicitud: <code>{submissionId}</code>
              </p>
            )}
            {(signingUrl || redirectUrl) && (
              <Button variant="primary" size="lg" onClick={handleOpenSignature} className="me-2">
                Abrir firma
              </Button>
            )}
            <Button variant="outline-secondary" onClick={onHide}>
              Cerrar
            </Button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default PDFSignatureModal;