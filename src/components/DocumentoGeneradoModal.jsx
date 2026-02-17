// src/components/DocumentoGeneradoModal.jsx
import React, { useState, useMemo } from "react";
import { Modal, Button, Spinner, Alert, Form, InputGroup } from "react-bootstrap";
import { FaDownload, FaFileSignature, FaCheckCircle, FaEnvelope, FaLink } from "react-icons/fa";
import { downloadBlob } from "../utils/pdfHelpers";
import { createSubmission } from "../services/SignatureService";
import DocuSealSignerModal from "./DocuSealSignerModal";
import DocumentFlowGuide from "./DocumentFlowGuide";
import useToast from "../hooks/useToast";
import logo from "../assets/tampa.jpg";

/**
 * Modal que se muestra después de generar un PDF con opciones para descargar o enviar a firmar
 * @param {boolean} show - Controla si el modal está visible
 * @param {Function} onHide - Función para cerrar el modal
 * @param {Blob} pdfBlob - Blob del PDF generado
 * @param {string} filename - Nombre del archivo PDF
 * @param {string} documentType - Tipo de documento: "AUTORIZACION" o "CONFIRMACION"
 * @param {Object} defaultSigner - Datos del firmante por defecto
 * @param {string} defaultSigner.email - Email del firmante
 * @param {string} defaultSigner.name - Nombre del firmante
 * @param {Object} metadata - Metadatos adicionales (cliente_id, grupo_familiar_id, etc.)
 */
const DocumentoGeneradoModal = ({
  show,
  onHide,
  pdfBlob,
  filename,
  documentType = "AUTORIZACION",
  defaultSigner = { email: "", name: "" },
  metadata = {},
  documentLanguage = "es", // "es" o "en" para ajustar textos del correo
}) => {
  const toast = useToast();
  const [step, setStep] = useState("options"); // 'options', 'signature-form', 'confirmation', 'signing'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estado para firma
  const [embedSrc, setEmbedSrc] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [showSignerModal, setShowSignerModal] = useState(false);

  // Confirmación tras envío: datos del backend (signingLink = embedSrc)
  const [confirmationData, setConfirmationData] = useState(null); // { recipientEmail, emailSent, status }
  const [copyButtonText, setCopyButtonText] = useState("📋 Copiar Link");

  // Formulario de firma
  const [signers, setSigners] = useState([
    {
      email: defaultSigner.email || "",
      name: defaultSigner.name || "",
      order: 1, // 1-indexed según validación del backend
    },
  ]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const emailInitializedRef = React.useRef(false);

  // Guía de flujo: paso actual y visibilidad
  const [flowGuideStep, setFlowGuideStep] = useState(null);
  const [flowGuideVisible, setFlowGuideVisible] = useState(true);

  // Datos para la guía (nombre del doc, firmantes, progreso)
  const flowGuideData = useMemo(() => ({
    name: filename || "Documento",
    signers: signers?.length ?? 0,
    progress: flowGuideStep === "sent" ? 50 : flowGuideStep === "completed" ? 100 : flowGuideStep === "template_created" ? 25 : 0,
  }), [filename, signers?.length, flowGuideStep]);

  // Resetear estado cuando se cierra el modal
  React.useEffect(() => {
    if (!show) {
      setStep("options");
      setError(null);
      setEmbedSrc(null);
      setSubmissionId(null);
      setShowSignerModal(false);
      setConfirmationData(null);
      setCopyButtonText("📋 Copiar Link");
      setFlowGuideStep(null);
      setFlowGuideVisible(true);
      setSigners([
        {
          email: defaultSigner.email || "",
          name: defaultSigner.name || "",
          order: 1, // 1-indexed según validación del backend
        },
      ]);
      setEmailSubject("");
      setEmailBody("");
      emailInitializedRef.current = false; // Resetear flag de inicialización
    }
  }, [show, defaultSigner.email, defaultSigner.name]);

  // Mostrar guía "plantilla creada" cuando se abre el modal en paso opciones
  React.useEffect(() => {
    if (show && step === "options" && pdfBlob) {
      setFlowGuideStep("template_created");
    }
  }, [show, step, pdfBlob]);

  // Inicializar asunto y cuerpo del email con texto profesional (sin logo, texto plano para el back)
  React.useEffect(() => {
    if (show && step === "signature-form" && !emailInitializedRef.current) {
      const isEnglish = documentLanguage === "en";
      const signerName =
        signers[0]?.name?.trim() ||
        defaultSigner?.name?.trim() ||
        (isEnglish ? "Client" : "cliente");

      const docTypeName = documentType === "CONFIRMACION"
        ? isEnglish
          ? "Data Confirmation"
          : "Confirmación de Datos"
        : isEnglish
          ? "Authorization to Manage Information"
          : "Autorización de Manejo de Información";

      const subject = documentType === "CONFIRMACION"
        ? (isEnglish
          ? "Signature Request – Data Confirmation"
          : "Solicitud de firma – Confirmación de Datos")
        : (isEnglish
          ? "Signature Request – Authorization to Manage Information"
          : "Solicitud de firma – Autorización de Manejo de Información");

      setEmailSubject(subject);

      // Texto específico para Confirmación de Datos (diferente al de Autorización)
      const confirmacionBodyEs = `Estimado/a ${signerName},

Esperamos que se encuentre muy bien.

Por medio de este mensaje, le solicitamos amablemente su firma electrónica en el documento titulado "Confirmación de Datos", el cual hemos preparado para usted.

Este documento tiene como objetivo validar que la información registrada sea correcta, esté actualizada y refleje fielmente sus datos actuales, lo cual nos permite continuar con el proceso de manera adecuada.

Por favor, revise el documento y proceda con la firma siguiendo las instrucciones que encontrará en el enlace de DocuSeal.

Si tiene alguna pregunta o requiere realizar alguna corrección antes de firmar, no dude en contactarnos. Con gusto lo asistiremos.

Gracias por su tiempo y colaboración.

Cordialmente,
Equipo de Tampa Seguros`;

      const confirmacionBodyEn = `Dear ${signerName},

We hope you are doing well.

We kindly request your electronic signature on the document titled "Data Confirmation", which has been prepared for you.

This document is intended to confirm that the information on file is accurate, up to date, and correctly reflects your current details, allowing us to proceed with the process properly.

Please review the document and complete the electronic signature by following the instructions provided through the DocuSeal link.

If you have any questions or need to request corrections before signing, please do not hesitate to contact us. We will be happy to assist you.

Thank you for your time and cooperation.

Sincerely,
Tampa Seguros Team`;

      const autorizacionBodyEs = `Estimado/a ${signerName},

Esperamos que se encuentre muy bien.

Por medio de este mensaje, le solicitamos amablemente su firma electrónica en el documento titulado "${docTypeName}", el cual hemos preparado para usted.

Este documento es necesario para poder continuar con el proceso y nos autoriza a gestionar su información de manera segura y conforme a la normativa vigente.

Por favor, revise el documento y proceda con la firma siguiendo las instrucciones que encontrará en el enlace de DocuSeal.

Si tiene alguna pregunta o requiere asistencia durante el proceso, no dude en contactarnos. Con gusto lo apoyaremos.

Gracias por su tiempo y colaboración.

Cordialmente,
Equipo de Tampa Seguros`;

      const autorizacionBodyEn = `Dear ${signerName},

We hope you are doing well.

We kindly request your electronic signature on the document titled "${docTypeName}", which has been prepared for you.

This document is required to continue with the process and authorizes us to securely manage your information in accordance with applicable regulations.

Please review the document and complete the electronic signature by following the instructions provided through the DocuSeal link.

If you have any questions or need assistance, please do not hesitate to contact us. We will be happy to help.

Thank you for your time and cooperation.

Sincerely,
Tampa Seguros Team`;

      const professionalBody = documentType === "CONFIRMACION"
        ? (isEnglish ? confirmacionBodyEn : confirmacionBodyEs)
        : (isEnglish ? autorizacionBodyEn : autorizacionBodyEs);

      setEmailBody(professionalBody);
      emailInitializedRef.current = true;
    }
  }, [show, step, signers, defaultSigner?.name, documentType, documentLanguage]);

  // Descargar PDF directamente
  const handleDownload = () => {
    if (pdfBlob && filename) {
      downloadBlob(pdfBlob, filename);
      toast.showSuccess("Documento descargado. Puedes enviarlo a firmar más tarde desde Informes.");
      onHide();
    }
  };

  // Validar formulario de firma
  const validateForm = () => {
    if (signers.length === 0) {
      setError("Debe haber al menos un firmante");
      return false;
    }

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
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setFlowGuideStep("sending");

    try {
      const response = await createSubmission({
        pdfBlob,
        filename,
        documentType,
        signers: signers.map((s, idx) => ({
          email: s.email.trim(),
          name: s.name.trim() || undefined,
          order: s.order !== undefined ? s.order : idx + 1, // 1-indexed según validación del backend
        })),
        metadata,
        emailSubject: emailSubject.trim() || undefined,
        emailBody: emailBody.trim() || undefined,
        language: documentLanguage || "es", // Enviar idioma al backend para coordenadas
      });

      // Normalizar respuesta: nuevo formato { signingLink, submissionId, recipientEmail, emailSent, status } o legacy { embed_src, submission_id }
      const data = response?.data ?? response;
      const success = response?.success !== false && (data?.success !== false);
      if (!success) {
        setError(data?.error ?? data?.message ?? response?.message ?? "Error al enviar el documento.");
        setFlowGuideStep("template_created");
        setLoading(false);
        return;
      }

      const signingLink = response?.signingLink ?? data?.signingLink ?? response?.embed_src ?? data?.embed_src;
      const submissionIdFromResponse = response?.submissionId ?? data?.submissionId ?? response?.submission_id ?? data?.submission_id ?? response?.id ?? data?.id;
      const recipientEmail = response?.recipientEmail ?? data?.recipientEmail ?? signers[0]?.email ?? "";
      const emailSent = response?.emailSent ?? data?.emailSent ?? true;
      const status = response?.status ?? data?.status ?? "pending";

      if (signingLink) {
        setEmbedSrc(signingLink);
        setSubmissionId(submissionIdFromResponse || null);
        setConfirmationData({ recipientEmail, emailSent, status });
        setStep("confirmation");
        setFlowGuideStep("sent");
        toast.showSuccess(
          "Documento generado y enviado. Puedes compartir el link de firma o abrirlo desde aquí."
        );
      } else {
        setFlowGuideStep("template_created");
        throw new Error("No se recibió link de firma (signingLink/embed_src) en la respuesta del servidor.");
      }
    } catch (err) {
      console.error("Error al enviar a firma:", err);
      setFlowGuideStep("template_created");
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

  // Actualizar datos de un firmante
  const handleSignerChange = (index, field, value) => {
    const updatedSigners = [...signers];
    updatedSigners[index] = {
      ...updatedSigners[index],
      [field]: value,
    };
    setSigners(updatedSigners);
  };

  // Agregar nuevo firmante
  const handleAddSigner = () => {
    setSigners([
      ...signers,
      {
        email: "",
        name: "",
        order: signers.length + 1, // 1-indexed según validación del backend
      },
    ]);
  };

  // Eliminar firmante
  const handleRemoveSigner = (index) => {
    if (signers.length > 1) {
      setSigners(signers.filter((_, i) => i !== index));
    }
  };

  // Arma mensaje listo para WhatsApp (estilo del correo) con el link de firma
  const getWhatsAppMessage = () => {
    const link = embedSrc || "";
    const signerName = signers[0]?.name?.trim() || confirmationData?.recipientEmail || "Estimado/a";
    const docTypeName = documentType === "CONFIRMACION"
      ? "Confirmación de Datos"
      : "Autorización Manejo de Información";

    return `Hola ${signerName},

Te enviamos el enlace para firmar el documento "${docTypeName}".

Por favor revisa el documento y procede con la firma siguiendo las instrucciones del enlace. Si tienes alguna duda, estamos para ayudarte.

Link de firma:
${link}

Saludos,
Tampa Seguros`;
  };

  // Copiar mensaje para WhatsApp (incluye link) al portapapeles
  const copyToClipboard = async () => {
    const link = embedSrc || "";
    if (!link) {
      toast.showWarning("No hay link disponible para copiar.");
      return;
    }
    const textToCopy = getWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyButtonText("✓ Copiado");
      toast.showSuccess("Mensaje listo para WhatsApp copiado");
      setTimeout(() => setCopyButtonText("📋 Copiar Link"), 2000);
    } catch {
      try {
        const input = document.createElement("input");
        input.value = textToCopy;
        input.setAttribute("readonly", "");
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopyButtonText("✓ Copiado");
        toast.showSuccess("Mensaje copiado");
        setTimeout(() => setCopyButtonText("📋 Copiar Link"), 2000);
      } catch {
        toast.showError("No se pudo copiar.");
      }
    }
  };

  // Abrir modal de firma desde la pantalla de confirmación
  const handleViewDocument = () => {
    if (embedSrc) setShowSignerModal(true);
  };

  if (!show) return null;

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg">
        <Modal.Header closeButton>
          <div className="d-flex align-items-center gap-3">
            <img src={logo} alt="Tampa Seguros" className="document-modal-logo" />
            <Modal.Title className="mb-0">Documento Generado</Modal.Title>
          </div>
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
                  <span>Enviar a firmar</span>
                </Button>
              </div>
            </div>
          )}

          {/* Paso 2: Formulario de firma */}
          {step === "signature-form" && (
            <div>
              <h5 className="mb-3">Enviar a firma</h5>
              {error && (
                <Alert 
                  variant="danger" 
                  className="mb-3" 
                  dismissible 
                  onClose={() => setError(null)}
                >
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
                      <i className="bi bi-plus-circle me-1"></i>
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
                            <i className="bi bi-trash"></i>
                          </Button>
                        )}
                      </div>
                      <div className="row">
                        <div className="col-md-6">
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
                        </div>
                        <div className="col-md-6">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campos opcionales */}
                <Form.Group className="mb-3">
                  <Form.Label>Asunto del email (opcional)</Form.Label>
                  <Form.Control
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={loading}
                    placeholder="Asunto del email"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Mensaje del email (opcional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
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
                      "Enviar a firmar"
                    )}
                  </Button>
                </div>
              </Form>
            </div>
          )}

          {/* Paso 3: Confirmación de envío — link de firma y opción de ver documento */}
          {step === "confirmation" && (
            <div className="document-confirmation">
              <div className="confirmation-header d-flex align-items-center gap-2 mb-3">
                <FaCheckCircle className="text-success" size={28} />
                <h5 className="mb-0 fw-semibold">Documento generado y enviado</h5>
              </div>

              {confirmationData?.emailSent !== false && confirmationData?.recipientEmail && (
                <div className="email-status d-flex align-items-center gap-2 mb-3 p-2 bg-light rounded">
                  <FaEnvelope className="text-primary" />
                  <span>Email enviado a: <strong>{confirmationData.recipientEmail}</strong></span>
                </div>
              )}

              <div className="link-container mb-3">
                <Form.Label className="fw-semibold small text-muted mb-1">
                  <FaLink className="me-1" /> Link para compartir
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={embedSrc || ""}
                    readOnly
                    className="font-monospace small"
                  />
                  <Button
                    variant="outline-primary"
                    onClick={copyToClipboard}
                    className="text-nowrap"
                  >
                    {copyButtonText}
                  </Button>
                </InputGroup>
                <Form.Text className="small text-muted">
                  Al copiar se guarda un mensaje listo para enviar por WhatsApp (incluye el link de firma).
                </Form.Text>
              </div>

              {confirmationData?.status && (
                <div className="status mb-3 p-2 rounded bg-warning bg-opacity-10">
                  <span className="small">Estado: </span>
                  <strong>{(confirmationData.status === "pending" ? "Pendiente de firma" : confirmationData.status)}</strong>
                </div>
              )}

              <div className="actions d-flex gap-2 justify-content-end flex-wrap">
                <Button variant="primary" onClick={handleViewDocument}>
                  Ver documento
                </Button>
                <Button variant="secondary" onClick={onHide}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal de firma embebida: solo se renderiza cuando embedSrc está disponible */}
      {showSignerModal && embedSrc && (
        <DocuSealSignerModal
          open={showSignerModal}
          onClose={() => {
            setShowSignerModal(false);
            onHide();
          }}
          embedSrc={embedSrc}
          submissionId={submissionId}
          onComplete={(data) => {
            setFlowGuideStep("completed");
            toast.showSuccess(
              "Documento firmado correctamente. Puedes descargarlo desde Informes > Documentos enviados."
            );
            setShowSignerModal(false);
            onHide();
          }}
        />
      )}

      {/* Guía de flujo: qué pasó y siguiente paso */}
      {show && flowGuideStep && (
        <DocumentFlowGuide
          currentStep={flowGuideStep}
          documentData={flowGuideData}
          visible={flowGuideVisible}
          onClose={() => setFlowGuideVisible(false)}
          onSendNow={() => {
            setStep("signature-form");
            setError(null);
          }}
        />
      )}
    </>
  );
};

export default DocumentoGeneradoModal;

