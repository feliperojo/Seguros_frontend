import React, { useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import { getCoberturaId } from "../../utils/coberturas";
import {
  puedeAnularInscripcion,
  puedeAnularInscripcionCobertura,
} from "../../utils/coberturaAnulacion";
import DateInputWithCalendar from "../common/DateInputWithCalendar";

const MOTIVOS = [
  "El cliente indicó que no corresponde",
  "Error en la inscripción",
  "Documentación insuficiente",
  "OTRO",
];

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function CoberturaAnularButton({
  member,
  coverage = null,
  estadoActual,
  readOnly = false,
  onAnulada,
  className = "btn btn-outline-warning btn-sm me-2",
  productLabel = "",
  /** Dental MS: el tomador sí puede anular. Salud: no. */
  permitirTomador = false,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");

  const canAnular = coverage
    ? puedeAnularInscripcionCobertura(coverage, {
        estadoActual,
        readOnly,
        member,
        permitirTomador,
      })
    : puedeAnularInscripcion(member, { estadoActual, readOnly });

  if (!canAnular) {
    return null;
  }

  const nombre =
    member.nombreCompleto ||
    member?.cliente?.nombre_completo ||
    [member.primer_nombre, member.segundo_nombre, member.apellidos]
      .filter(Boolean)
      .join(" ") ||
    "este miembro";

  const reset = () => {
    setError("");
    setFecha(todayIso());
    setMotivo("");
    setNota("");
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    if (busy) return;
    setOpen(false);
  };

  const handleConfirm = async () => {
    const covId = coverage?.cobertura_id ?? getCoberturaId(member);
    if (!covId) {
      setError("No se encontró la cobertura a anular.");
      return;
    }
    if (!String(motivo || "").trim()) {
      setError("Indique el motivo de la anulación.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await GrupoFamiliarService.anularCobertura(covId, {
        fecha_anulacion: fecha || todayIso(),
        motivo_anulacion: motivo.trim(),
        nota_anulacion: nota.trim() || null,
      });
      const data = res?.data ?? res;
      onAnulada?.(member, {
        fecha_anulacion: data?.fecha_anulacion ?? fecha,
        motivo_anulacion: data?.motivo_anulacion ?? motivo.trim(),
        nota_anulacion: data?.nota_anulacion ?? (nota.trim() || null),
        activo: false,
        vigente: false,
        cobertura_definida: "Anulado",
        personas_cobertura: res?.personas_cobertura,
        personas_taxes: res?.personas_taxes,
      });
      setOpen(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No fue posible anular la inscripción.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        title="Anular inscripción pendiente de activación"
        onClick={handleOpen}
        disabled={busy}
      >
        <i className="fas fa-ban me-1" /> Anular
      </button>

      <Modal show={open} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Anular inscripción</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="mb-3">
            <strong>{nombre}</strong> nunca tuvo cobertura activa
            {productLabel ? ` (${productLabel})` : ""}. Se anulará la inscripción
            y <strong>no</strong> quedará como retiro.
          </p>
          <Form.Group className="mb-3">
            <Form.Label>Fecha de anulación</Form.Label>
            <DateInputWithCalendar
              size="sm"
              valueIso={fecha}
              minIso="1900-01-01"
              maxIso={todayIso()}
              onChangeIso={(iso) => setFecha(iso || todayIso())}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Motivo</Form.Label>
            <Form.Select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={busy}
            >
              <option value="">Seleccione…</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Nota (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              disabled={busy}
              placeholder="Detalle adicional"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={handleConfirm} disabled={busy}>
            {busy ? "Anulando…" : "Confirmar anulación"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
