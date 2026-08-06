import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import {
  MOTIVOS_DESCARTE_GRUPO,
  buildDescartePayload,
} from "../../constants/motivosDescarteGrupo";

/**
 * Modal profesional para descartar un grupo familiar en etapa de prospecto.
 * Requiere motivo; la nota es obligatoria si el motivo es "Otro".
 */
export default function DescartarGrupoModal({
  show,
  onHide,
  onConfirm,
  loading = false,
}) {
  const [motivoCodigo, setMotivoCodigo] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setMotivoCodigo("");
    setNota("");
    setError("");
  }, [show]);

  const esOtro = motivoCodigo === "otro";
  const notaTrim = nota.trim();

  const handleConfirm = async () => {
    if (!motivoCodigo) {
      setError("Seleccione un motivo de descarte.");
      return;
    }
    if (esOtro && !notaTrim) {
      setError('Si elige "Otro", indique el detalle en la nota.');
      return;
    }

    setError("");
    const payload = buildDescartePayload({
      motivoCodigo,
      nota: notaTrim,
    });

    await onConfirm?.(payload);
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        if (loading) return;
        onHide?.();
      }}
      centered
      backdrop="static"
      size="md"
    >
      <Modal.Header closeButton={!loading}>
        <Modal.Title className="fs-5">Descartar grupo familiar</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-muted small mb-3">
          Esta acción cambiará el proceso a <strong>Descartado</strong>. Indique
          el motivo para dejar trazabilidad en el historial del grupo.
        </p>

        <Form.Group className="mb-3" controlId="motivo-descarte">
          <Form.Label className="fw-semibold">
            Motivo de descarte <span className="text-danger">*</span>
          </Form.Label>
          <div className="d-flex flex-column gap-2">
            {MOTIVOS_DESCARTE_GRUPO.map((motivo) => (
              <Form.Check
                key={motivo.value}
                type="radio"
                name="motivo-descarte"
                id={`motivo-${motivo.value}`}
                label={motivo.label}
                value={motivo.value}
                checked={motivoCodigo === motivo.value}
                disabled={loading}
                onChange={(e) => {
                  setMotivoCodigo(e.target.value);
                  setError("");
                }}
              />
            ))}
          </div>
        </Form.Group>

        <Form.Group className="mb-2" controlId="nota-descarte">
          <Form.Label className="fw-semibold">
            Nota{esOtro ? <span className="text-danger"> *</span> : " (opcional)"}
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={nota}
            disabled={loading}
            placeholder={
              esOtro
                ? "Describa el motivo del descarte…"
                : "Detalle adicional si lo considera útil…"
            }
            onChange={(e) => {
              setNota(e.target.value);
              setError("");
            }}
            maxLength={500}
          />
          <Form.Text muted>
            {nota.length}/500
            {esOtro ? " · Obligatoria para el motivo Otro" : ""}
          </Form.Text>
        </Form.Group>

        {error && (
          <Alert variant="danger" className="py-2 mb-0 mt-2">
            {error}
          </Alert>
        )}

        <Alert variant="warning" className="py-2 mb-0 mt-3 small">
          Al confirmar, el grupo quedará en estado Descartado y se registrará el
          motivo en el historial del proceso.
        </Alert>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="outline-secondary"
          disabled={loading}
          onClick={onHide}
        >
          Cancelar
        </Button>
        <Button
          variant="danger"
          disabled={loading || !motivoCodigo || (esOtro && !notaTrim)}
          onClick={handleConfirm}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Descartando…
            </>
          ) : (
            "Confirmar descarte"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
