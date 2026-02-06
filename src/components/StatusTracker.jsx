import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Spinner, Badge } from "react-bootstrap";
import { getSubmissionStatus, getSignedPdfUrl } from "../services/docusealApiService";

const POLL_INTERVAL_MS = 10000;

const STATUS_LABELS = {
  pending: "Enviado - Esperando firma",
  sent: "Enviado - Esperando firma",
  awaiting: "Enviado - Esperando firma",
  opened: "Enviado - Esperando firma",
  completed: "Completado",
  completed_processing: "Firmado - Procesando",
  declined: "Rechazado",
  expired: "Expirado",
};

function getDisplayStatus(apiStatus) {
  if (!apiStatus) return "Enviado - Esperando firma";
  const lower = String(apiStatus).toLowerCase();
  if (lower === "completed") return "Completado";
  if (lower === "completed_processing" || lower === "processing") return "Firmado - Procesando";
  if (["sent", "awaiting", "opened", "pending"].includes(lower)) return "Enviado - Esperando firma";
  return STATUS_LABELS[lower] || apiStatus;
}

export default function StatusTracker({ submissionId, onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = async () => {
    if (!submissionId) return;
    try {
      setError(null);
      const data = await getSubmissionStatus(submissionId);
      setStatus(data.status ?? data.estado ?? data);
    } catch (err) {
      console.error("Error al obtener estado:", err);
      setError(err?.message || "Error al consultar el estado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    pollRef.current = setInterval(() => {
      fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [submissionId]);

  const isCompleted = status && String(status).toLowerCase() === "completed";

  const handleDownload = async () => {
    if (!submissionId) return;
    setDownloading(true);
    try {
      const url = await getSignedPdfUrl(submissionId);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error al descargar:", err);
      setError(err?.message || "No se pudo obtener el PDF firmado.");
    } finally {
      setDownloading(false);
    }
  };

  if (!submissionId) return null;

  return (
    <Card className="mt-3">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Estado de la firma</span>
        {onClose && (
          <Button variant="link" size="sm" className="p-0 text-secondary" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </Card.Header>
      <Card.Body>
        {loading && !status && (
          <div className="d-flex align-items-center">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Cargando estado...</span>
          </div>
        )}

        {error && (
          <div className="text-danger small mb-2">{error}</div>
        )}

        {status !== undefined && status !== null && (
          <>
            <div className="d-flex align-items-center mb-2">
              <Badge
                bg={
                  isCompleted
                    ? "success"
                    : String(status).toLowerCase() === "declined" || String(status).toLowerCase() === "expired"
                    ? "danger"
                    : "primary"
                }
              >
                {getDisplayStatus(status)}
              </Badge>
            </div>

            {isCompleted && (
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Descargando...
                  </>
                ) : (
                  "Descargar PDF firmado"
                )}
              </Button>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
