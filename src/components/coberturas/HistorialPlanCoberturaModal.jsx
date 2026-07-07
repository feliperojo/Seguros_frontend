import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Button,
  Table,
  Alert,
  Spinner,
  Form,
  Nav,
} from "react-bootstrap";
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

const formatPrecio = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
};

const HistorialPlanCoberturaModal = ({
  show,
  onClose,
  /** @type {{ coberturaId: number, memberIdx: number, memberName: string, parentesco?: string, hasPlanData?: boolean }[]} */
  members = [],
  initialCoberturaId = null,
  allowBulkArchive = false,
  readOnly = false,
}) => {
  const [selectedCoberturaId, setSelectedCoberturaId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showArchivarForm, setShowArchivarForm] = useState(false);
  const [fechaExpiracion, setFechaExpiracion] = useState("");
  const [nota, setNota] = useState("");
  const [selectedForArchive, setSelectedForArchive] = useState(() => new Set());

  const membersWithPlan = useMemo(
    () => members.filter((m) => m.hasPlanData !== false && m.coberturaId),
    [members]
  );

  const selectedMember = useMemo(
    () => members.find((m) => m.coberturaId === selectedCoberturaId) ?? null,
    [members, selectedCoberturaId]
  );

  const modalTitle = useMemo(() => {
    if (allowBulkArchive && members.length > 1) {
      return "Historial de plan — Grupo familiar";
    }
    return `Historial de plan${selectedMember?.memberName ? ` — ${selectedMember.memberName}` : ""}`;
  }, [allowBulkArchive, members.length, selectedMember]);

  const cargarHistorial = useCallback(async (coberturaId) => {
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
  }, []);

  useEffect(() => {
    if (!show) {
      setHistorial([]);
      setError("");
      setSuccess("");
      setShowArchivarForm(false);
      setSelectedCoberturaId(null);
      setSelectedForArchive(new Set());
      return;
    }

    const defaultId =
      initialCoberturaId ??
      members[0]?.coberturaId ??
      null;

    setSelectedCoberturaId(defaultId);
    setShowArchivarForm(false);
    setFechaExpiracion("");
    setNota("");
    setSuccess("");
    setError("");

    if (allowBulkArchive) {
      setSelectedForArchive(
        new Set(membersWithPlan.map((m) => m.coberturaId))
      );
    } else if (defaultId) {
      setSelectedForArchive(new Set([defaultId]));
    } else {
      setSelectedForArchive(new Set());
    }
  }, [show, initialCoberturaId, members, allowBulkArchive, membersWithPlan]);

  useEffect(() => {
    if (show && selectedCoberturaId) {
      cargarHistorial(selectedCoberturaId);
    }
  }, [show, selectedCoberturaId, cargarHistorial]);

  const toggleMemberSelection = (coberturaId) => {
    setSelectedForArchive((prev) => {
      const next = new Set(prev);
      if (next.has(coberturaId)) {
        next.delete(coberturaId);
      } else {
        next.add(coberturaId);
      }
      return next;
    });
  };

  const archivarCobertura = async (coberturaId) => {
    return archivarPlanActual(coberturaId, {
      vigente_hasta: fechaExpiracion,
      fecha_expiracion: fechaExpiracion,
      nota: nota.trim() || undefined,
      limpiar_campos: false,
    });
  };

  const handleArchivar = async (e) => {
    e.preventDefault();
    if (!fechaExpiracion) return;

    const targets = allowBulkArchive
      ? membersWithPlan.filter((m) => selectedForArchive.has(m.coberturaId))
      : selectedCoberturaId
        ? membersWithPlan.filter((m) => m.coberturaId === selectedCoberturaId)
        : [];

    if (targets.length === 0) {
      setError("Seleccione al menos un miembro con datos de plan para archivar.");
      return;
    }

    setArchiving(true);
    setError("");
    setSuccess("");

    const errores = [];
    let archivados = 0;

    try {
      for (const member of targets) {
        try {
          await archivarCobertura(member.coberturaId);
          archivados += 1;
        } catch (err) {
          errores.push(
            `${member.memberName}: ${err?.message || "Error al archivar"}`
          );
        }
      }

      if (archivados > 0) {
        setSuccess(
          archivados === 1
            ? "Plan archivado correctamente."
            : `${archivados} planes archivados correctamente.`
        );
        setShowArchivarForm(false);
        await cargarHistorial(selectedCoberturaId);
      }

      if (errores.length > 0) {
        setError(errores.join(" "));
      }
    } finally {
      setArchiving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{modalTitle}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {members.length > 1 && (
          <Nav variant="tabs" className="mb-3 flex-nowrap overflow-auto">
            {members.map((member) => (
              <Nav.Item key={member.coberturaId}>
                <Nav.Link
                  active={selectedCoberturaId === member.coberturaId}
                  onClick={() => setSelectedCoberturaId(member.coberturaId)}
                  style={{ cursor: "pointer" }}
                >
                  {member.memberName}
                  {member.parentesco ? (
                    <span className="text-muted small ms-1">
                      ({member.parentesco})
                    </span>
                  ) : null}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        )}

        {!readOnly && (
          <div className="d-flex justify-content-end mb-3">
            {!showArchivarForm ? (
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => setShowArchivarForm(true)}
              >
                <i className="fas fa-archive me-1" />
                {allowBulkArchive && members.length > 1
                  ? "Archivar planes"
                  : "Archivar plan actual"}
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
            <h6 className="mb-3">
              {allowBulkArchive && members.length > 1
                ? "Archivar planes del grupo"
                : "Archivar datos del plan vigente"}
            </h6>
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

            {allowBulkArchive && members.length > 1 && (
              <div className="mt-3">
                <Form.Label className="small mb-2 d-block">
                  Aplicar a los miembros seleccionados
                </Form.Label>
                <div className="d-flex flex-column gap-2">
                  {membersWithPlan.map((member) => (
                    <Form.Check
                      key={member.coberturaId}
                      type="checkbox"
                      id={`archivar-${member.coberturaId}`}
                      label={`${member.memberName}${member.parentesco ? ` (${member.parentesco})` : ""}`}
                      checked={selectedForArchive.has(member.coberturaId)}
                      onChange={() => toggleMemberSelection(member.coberturaId)}
                    />
                  ))}
                </div>
                {membersWithPlan.length === 0 && (
                  <p className="text-muted small mb-0">
                    Ningún miembro tiene datos de plan para archivar.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 d-flex justify-content-end gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={
                  archiving ||
                  !fechaExpiracion ||
                  (allowBulkArchive && members.length > 1
                    ? selectedForArchive.size === 0
                    : !selectedCoberturaId)
                }
              >
                {archiving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Archivando…
                  </>
                ) : allowBulkArchive && members.length > 1 ? (
                  `Confirmar archivado (${selectedForArchive.size})`
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
          <p className="text-muted mb-0">
            {selectedMember?.memberName
              ? `No hay planes archivados para ${selectedMember.memberName}.`
              : "No hay planes archivados para esta cobertura."}
          </p>
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
                  <th>Precio ($)</th>
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
                    <td>{formatPrecio(item.precio)}</td>
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
        <Button variant="secondary" onClick={handleClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HistorialPlanCoberturaModal;
