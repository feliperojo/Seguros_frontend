import React, { useState } from "react";
import { Form, Button, ProgressBar, Spinner, Alert } from "react-bootstrap";
import useToast from "../hooks/useToast";
import { CONTRACT_TYPES } from "../utils/pdfTemplate";
import { generatePDF } from "../services/pdfService";
import {
  createTemplate,
  sendForSignature,
} from "../services/docusealApiService";
import StatusTracker from "./StatusTracker";

const MAX_RETRIES = 2;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GeneratePDFForm() {
  const toast = useToast();
  const [formData, setFormData] = useState({
    nombreCompleto: "",
    email: "",
    telefono: "",
    tipoContrato: CONTRACT_TYPES[0]?.value || "servicios",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submissionId, setSubmissionId] = useState(null);
  const [lastEmailSent, setLastEmailSent] = useState(null);

  const validate = () => {
    const next = {};
    if (!formData.nombreCompleto?.trim()) {
      next.nombreCompleto = "El nombre completo es requerido.";
    }
    if (!formData.email?.trim()) {
      next.email = "El email es requerido.";
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      next.email = "El formato del email no es válido.";
    }
    if (!formData.telefono?.trim()) {
      next.telefono = "El teléfono es requerido.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const sendToBackend = async (retryCount = 0) => {
    setProgress(10);

    let pdfBase64;
    try {
      pdfBase64 = await generatePDF({
        nombreCompleto: formData.nombreCompleto.trim(),
        email: formData.email.trim(),
        telefono: formData.telefono.trim(),
        tipoContrato: formData.tipoContrato,
      });
    } catch (err) {
      console.error("Error al generar PDF:", err);
      toast.showError("No se pudo generar el PDF. Revise los datos e intente de nuevo.");
      setProgress(0);
      setLoading(false);
      throw err;
    }

    setProgress(40);

    let templateId;
    try {
      const name = `Contrato - ${formData.nombreCompleto.trim()}`;
      const res = await createTemplate(name, pdfBase64);
      templateId = res.template_id;
    } catch (err) {
      console.error("Error al crear template:", err);
      const msg = err?.message || "Error al crear el template en el servidor.";
      toast.showError(msg);
      setProgress(0);
      setLoading(false);
      throw err;
    }

    setProgress(70);

    try {
      const sendRes = await sendForSignature({
        template_id: templateId,
        client_email: formData.email.trim(),
        client_data: {
          nombre: formData.nombreCompleto.trim(),
          email: formData.email.trim(),
          telefono: formData.telefono.trim(),
        },
      });

      setProgress(100);

      const id = sendRes.submission_id ?? sendRes.submissionId ?? sendRes.id;
      if (id) {
        setSubmissionId(String(id));
        setLastEmailSent(formData.email.trim());
        toast.showSuccess(`Contrato enviado a ${formData.email.trim()} para firma.`);
      } else {
        toast.showSuccess("Contrato enviado para firma.");
      }
    } catch (err) {
      console.error("Error al enviar para firma:", err);
      if (retryCount < MAX_RETRIES) {
        toast.showWarning(`Reintentando envío (${retryCount + 1}/${MAX_RETRIES})...`);
        return sendToBackend(retryCount + 1);
      }
      const msg = err?.message || "Error al enviar el contrato para firma.";
      toast.showError(msg);
      setProgress(0);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const confirmed = window.confirm(
      "¿Desea generar el contrato y enviarlo para firma al correo indicado?"
    );
    if (!confirmed) return;

    setLoading(true);
    setProgress(0);
    setErrors({});

    try {
      await sendToBackend();
    } catch {
      // Errores ya mostrados por toast
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="GeneratePDFForm">
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Nombre completo <span className="text-danger">*</span></Form.Label>
          <Form.Control
            type="text"
            value={formData.nombreCompleto}
            onChange={(e) => handleChange("nombreCompleto", e.target.value)}
            isInvalid={!!errors.nombreCompleto}
            placeholder="Ej. Juan Pérez"
            disabled={loading}
          />
          <Form.Control.Feedback type="invalid">{errors.nombreCompleto}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Email <span className="text-danger">*</span></Form.Label>
          <Form.Control
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            isInvalid={!!errors.email}
            placeholder="correo@ejemplo.com"
            disabled={loading}
          />
          <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Teléfono <span className="text-danger">*</span></Form.Label>
          <Form.Control
            type="tel"
            value={formData.telefono}
            onChange={(e) => handleChange("telefono", e.target.value)}
            isInvalid={!!errors.telefono}
            placeholder="Ej. +1 234 567 8900"
            disabled={loading}
          />
          <Form.Control.Feedback type="invalid">{errors.telefono}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Tipo de contrato</Form.Label>
          <Form.Select
            value={formData.tipoContrato}
            onChange={(e) => handleChange("tipoContrato", e.target.value)}
            disabled={loading}
          >
            {CONTRACT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {loading && (
          <div className="mb-3">
            <ProgressBar now={progress} label={`${progress}%`} />
            <div className="d-flex align-items-center mt-2 text-muted">
              <Spinner animation="border" size="sm" className="me-2" />
              <span>Generando y enviando contrato...</span>
            </div>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Procesando...
            </>
          ) : (
            "Generar y Enviar para Firma"
          )}
        </Button>
      </Form>

      {lastEmailSent && (
        <Alert variant="success" className="mt-3 mb-0">
          Contrato enviado a <strong>{lastEmailSent}</strong> para firma.
        </Alert>
      )}

      {submissionId && (
        <StatusTracker
          submissionId={submissionId}
          onClose={() => {
            setSubmissionId(null);
            setLastEmailSent(null);
          }}
        />
      )}
    </div>
  );
}
