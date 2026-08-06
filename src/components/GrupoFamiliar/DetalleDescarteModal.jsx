import React from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { labelMotivoDescarte } from "../../constants/motivosDescarteGrupo";

function parseMetadata(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatFecha(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}

/**
 * Modal de solo lectura: motivo y nota del último descarte del GF.
 */
export default function DetalleDescarteModal({
  show,
  onHide,
  loading = false,
  registro = null,
  error = null,
}) {
  const meta = parseMetadata(registro?.metadata);
  const motivoLabel =
    meta?.motivo_label ||
    labelMotivoDescarte(meta?.motivo_codigo) ||
    null;
  const nota = (meta?.nota || "").trim();
  const motivoTexto = (registro?.motivo || "").trim();

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">Detalle del descarte</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Cargando…
          </div>
        ) : error ? (
          <Alert variant="danger" className="mb-0">
            {error}
          </Alert>
        ) : !registro ? (
          <Alert variant="secondary" className="mb-0">
            No hay registro de descarte para este grupo.
          </Alert>
        ) : (
          <>
            <div className="mb-3">
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                Motivo
              </div>
              <div className="fs-6">
                {motivoLabel || motivoTexto || "Sin motivo registrado"}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                Nota
              </div>
              <div className="fs-6" style={{ whiteSpace: "pre-wrap" }}>
                {nota || (
                  <span className="text-muted">Sin nota adicional</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-muted small text-uppercase fw-semibold mb-1">
                Fecha
              </div>
              <div>{formatFecha(registro.created_at)}</div>
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
