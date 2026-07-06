import React, { useCallback, useEffect, useState } from "react";
import { Modal, Button, Table, Alert, Spinner, Form } from "react-bootstrap";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import {
  archivarPlanActual,
  fetchHistorialPlan,
} from "../../services/historialPlanCoberturaApi";

const formatDate = (value) => {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${m}/${d}/${y}`;
};

const HistorialPlanCoberturaModal = ({
  show,
  onClose,
  coberturaId,
  memberName = "",
  readOnly = false,
  onArchived,
}) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showArchivarForm, setShowArchivarForm] = useState(false);
  const [fechaExpiracion, setFechaExpiracion] = useState("");
  const [nota, setNota] = useState("");

  const cargarHistorial = useCallback(async () => {
    if (!coberturaId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetchHistorialPlan(coberturaId);
      setHistorial(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "No se pudo cargar el historial de plan.");
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  }, [coberturaId]);

  useEffect(() => {
    if (show && coberturaId) {
      cargarHistorial();
      setShowArchivarForm(false);
      setFechaExpiracion("");
      setNota("");
      setSuccess("");
      setError("");
    } else if (!show) {
      setHistorial([]);
      setError("");
      setSuccess("");
      setShowArchivarForm(false);
    }
  }, [show, coberturaId, cargarHistorial]);

  const handleArchivar = async (e) => {
    e.preventDefault();
    if (!coberturaId || !fechaExpiracion) return;

    setArchiving(true);
    setError("");
    setSuccess("");
    try {
      const res = await archivarPlanActual(coberturaId, {
        vigente_hasta: fechaExpiracion,
        fecha_expiracion: fechaExpiracion,
        nota: nota.trim() || undefined,
      });

      setSuccess(res?.message || "Plan archivado correctamente.");
      setShowArchivarForm(false);
      setFechaExpiracion("");
      setNota("");

      if (res?.data?.cobertura && onArchived) {
        onArchived(res.data.cobertura);
      }

      await cargarHistorial();
    } catch (err) {
      setError(err?.message || "No se pudo archivar el plan.");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          Historial de plan
          {memberName ? ` — ${memberName}` : ""}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {!readOnly && (
          <div className="d-flex justify-content-end mb-3">
            {!showArchivarForm ? (
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => setShowArchivarForm(true)}
              >
                <i className="fas fa-archive me-1" />
                Archivar plan actual
              </Button>
            ) : (
              <Button
                variant="link"
                size="sm"
                className="text-muted"
                onClick={() => setShowArchivarForm(false)}
              >
                Cancelar archivado
              </Button>
            )}
          </div>
        )}

        {showArchivarForm && !readOnly && (
          <Form onSubmit={handleArchivar} className="border rounded p-3 mb-3 bg-light">
            <h6 className="mb-3">Archivar datos del plan vigente</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label className="small mb-1">Fecha de expiración *</Form.Label>
                <DateInputWithCalendar
                  size="sm"
                  valueIso={fechaExpiracion}
                  onChangeIso={setFechaExpiracion}
                />
              </div>
              <div className="col-md-6">
                <Form.Label className="small mb-1">Nota</Form.Label>
                <Form.Control
                  size="sm"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. Cambio de compañía"
                />
              </div>
            </div>
            <div className="mt-3 d-flex justify-content-end gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={archiving || !fechaExpiracion}
              >
                {archiving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Archivando…
                  </>
                ) : (
                  "Confirmar archivado"
                )}
              </Button>
            </div>
          </Form>
        )}

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Cargando historial…
          </div>
        ) : historial.length === 0 ? (
          <p className="text-muted mb-0">No hay planes archivados para esta cobertura.</p>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Compañía</th>
                  <th>Plan</th>
                  <th>Metal</th>
                  <th>Red</th>
                  <th>Número ID</th>
                  <th>Código ID</th>
                  <th>Agente</th>
                  <th>Activación</th>
                  <th>Expiración</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((item) => (
                  <tr key={item.id}>
                    <td>{item.compania?.nombre || "—"}</td>
                    <td>{item.plan || "—"}</td>
                    <td>{item.metal || "—"}</td>
                    <td>{item.red || "—"}</td>
                    <td>{item.policy_number || item.codigo_poliza || "—"}</td>
                    <td>{item.codigo_poliza || "—"}</td>
                    <td>{item.agente || "—"}</td>
                    <td>{formatDate(item.fecha_activacion)}</td>
                    <td>{formatDate(item.fecha_expiracion)}</td>
                    <td>{item.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HistorialPlanCoberturaModal;
