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
import CompanySelect from "../selects/CompanySelect";
import useCompanies from "../../hooks/useCompanies";
import {
  archivarPlanActual,
  crearHistorialPlan,
  fetchHistorialPlan,
} from "../../services/historialPlanCoberturaApi";

const EMPTY_MANUAL_FORM = {
  compania_id: "",
  plan: "",
  metal: "",
  red: "",
  policy_number: "",
  codigo_poliza: "",
  agente: "",
  precio: "",
  fecha_activacion: "",
  fecha_expiracion: "",
  nota: "",
};

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
  const [showCrearForm, setShowCrearForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [fechaExpiracion, setFechaExpiracion] = useState("");
  const [nota, setNota] = useState("");
  const [selectedForArchive, setSelectedForArchive] = useState(() => new Set());
  const { companies } = useCompanies();

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
      setShowCrearForm(false);
      setManualForm(EMPTY_MANUAL_FORM);
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
    setShowCrearForm(false);
    setManualForm(EMPTY_MANUAL_FORM);
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

  const updateManualField = (name, value) => {
    setManualForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCrearManual = async (e) => {
    e.preventDefault();
    if (!selectedCoberturaId) return;

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        compania_id: manualForm.compania_id || null,
        plan: manualForm.plan.trim() || null,
        metal: manualForm.metal || null,
        red: manualForm.red || null,
        policy_number: manualForm.policy_number.trim() || null,
        codigo_poliza: manualForm.codigo_poliza.trim() || null,
        agente: manualForm.agente.trim() || null,
        precio: manualForm.precio !== "" ? Number(manualForm.precio) : null,
        fecha_activacion: manualForm.fecha_activacion || null,
        fecha_expiracion: manualForm.fecha_expiracion || null,
        nota: manualForm.nota.trim() || null,
      };

      await crearHistorialPlan(selectedCoberturaId, payload);

      setSuccess("Registro de historial de plan creado correctamente.");
      setShowCrearForm(false);
      setManualForm(EMPTY_MANUAL_FORM);
      await cargarHistorial(selectedCoberturaId);
    } catch (err) {
      setError(err?.message || "No se pudo crear el registro de historial.");
    } finally {
      setCreating(false);
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
          <div className="d-flex justify-content-end gap-2 mb-3 flex-wrap">
            {!showArchivarForm && !showCrearForm ? (
              <>
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={() => {
                    setShowCrearForm(true);
                    setShowArchivarForm(false);
                  }}
                >
                  <i className="fas fa-plus me-1" />
                  Crear historial de plan
                </Button>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    setShowArchivarForm(true);
                    setShowCrearForm(false);
                  }}
                >
                  <i className="fas fa-archive me-1" />
                  {allowBulkArchive && members.length > 1
                    ? "Archivar planes"
                    : "Archivar plan actual"}
                </Button>
              </>
            ) : showCrearForm ? (
              <Button
                variant="link"
                size="sm"
                className="text-muted"
                onClick={() => setShowCrearForm(false)}
              >
                Cancelar creación
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

        {showCrearForm && !readOnly && (
          <Form onSubmit={handleCrearManual} className="border rounded p-3 mb-3 bg-light">
            <h6 className="mb-3">
              Crear registro manual de plan
              {selectedMember?.memberName ? ` — ${selectedMember.memberName}` : ""}
            </h6>
            <p className="text-muted small mb-3">
              Use esta opción para cargar planes anteriores que no se archivaron a tiempo.
              No modifica los datos vigentes de la cobertura.
            </p>
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label className="small mb-1">Compañía</Form.Label>
                <CompanySelect
                  companies={companies}
                  value={manualForm.compania_id}
                  onChange={(e) => updateManualField("compania_id", e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <Form.Label className="small mb-1">Plan</Form.Label>
                <Form.Control
                  size="sm"
                  value={manualForm.plan}
                  onChange={(e) => updateManualField("plan", e.target.value)}
                  placeholder="Nombre del plan"
                />
              </div>
              <div className="col-md-4">
                <Form.Label className="small mb-1">Agente</Form.Label>
                <Form.Control
                  size="sm"
                  value={manualForm.agente}
                  onChange={(e) => updateManualField("agente", e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Metal</Form.Label>
                <Form.Select
                  size="sm"
                  value={manualForm.metal}
                  onChange={(e) => updateManualField("metal", e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  <option value="BRONCE">BRONCE</option>
                  <option value="SILVER">SILVER</option>
                  <option value="GOLD">GOLD</option>
                  <option value="PLATINUM">PLATINUM</option>
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Red</Form.Label>
                <Form.Select
                  size="sm"
                  value={manualForm.red}
                  onChange={(e) => updateManualField("red", e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  <option value="HMO">HMO</option>
                  <option value="EPO">EPO</option>
                  <option value="PPO">PPO</option>
                  <option value="POS">POS</option>
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Número ID</Form.Label>
                <Form.Control
                  size="sm"
                  value={manualForm.policy_number}
                  onChange={(e) => updateManualField("policy_number", e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Código ID</Form.Label>
                <Form.Control
                  size="sm"
                  value={manualForm.codigo_poliza}
                  onChange={(e) => updateManualField("codigo_poliza", e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Precio ($)</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualForm.precio}
                  onChange={(e) => updateManualField("precio", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Fecha de activación</Form.Label>
                <DateInputWithCalendar
                  size="sm"
                  valueIso={manualForm.fecha_activacion}
                  onChangeIso={(value) => updateManualField("fecha_activacion", value)}
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small mb-1">Fecha de expiración</Form.Label>
                <DateInputWithCalendar
                  size="sm"
                  valueIso={manualForm.fecha_expiracion}
                  onChangeIso={(value) => updateManualField("fecha_expiracion", value)}
                />
              </div>
              <div className="col-md-12">
                <Form.Label className="small mb-1">Nota</Form.Label>
                <Form.Control
                  size="sm"
                  value={manualForm.nota}
                  onChange={(e) => updateManualField("nota", e.target.value)}
                  placeholder="Ej. Plan anterior OSCAR"
                />
              </div>
            </div>
            <div className="mt-3 d-flex justify-content-end">
              <Button
                type="submit"
                variant="success"
                size="sm"
                disabled={creating || !selectedCoberturaId}
              >
                {creating ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Guardando…
                  </>
                ) : (
                  "Guardar en historial"
                )}
              </Button>
            </div>
          </Form>
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
