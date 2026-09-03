import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Button,
  Table,
  Alert,
  Spinner,
  Form,
  Nav,
  Badge,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import CompanySelect from "../selects/CompanySelect";
import useCompanies from "../../hooks/useCompanies";
import {
  archivarPlanActual,
  crearHistorialPlan,
  fetchHistorialPlan,
} from "../../services/historialPlanCoberturaApi";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import "../../styles/HistorialPlanCoberturaModal.css";

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

const ANIO_ACTUAL = new Date().getFullYear();

/** Año del registro según fecha de activación (fallback: expiración / created_at). */
const getAnioHistorial = (item) => {
  const raw =
    item?.fecha_activacion ||
    item?.fecha_expiracion ||
    item?.created_at ||
    "";
  const s = String(raw).slice(0, 10);
  const year = Number(s.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
};

const HistorialPlanCoberturaModal = ({
  show,
  onClose,
  /** @type {{ coberturaId: number, memberIdx: number, memberName: string, parentesco?: string, hasPlanData?: boolean, esAnulada?: boolean }[]} */
  members = [],
  initialCoberturaId = null,
  allowBulkArchive = false,
  readOnly = false,
  /** "salud" | "dental" — dental no muestra Metal/Red ni Código ID */
  product = "salud",
  /** Solo Dental MS: actualiza la ficha al reabrir una inscripción anulada. */
  onReabierta = null,
}) => {
  const esDental = product === "dental";
  const [selectedCoberturaId, setSelectedCoberturaId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [anioSeleccionado, setAnioSeleccionado] = useState(ANIO_ACTUAL);
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
  const [esAnulacion, setEsAnulacion] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
  const [selectedForArchive, setSelectedForArchive] = useState(() => new Set());
  const { companies } = useCompanies({
    producto: esDental ? "dental_ms" : null,
    includeId: manualForm.compania_id,
    soloActivas: Boolean(esDental),
  });

  const membersWithPlan = useMemo(
    () => members.filter((m) => m.hasPlanData !== false && m.coberturaId),
    [members]
  );

  const selectedMember = useMemo(
    () => members.find((m) => m.coberturaId === selectedCoberturaId) ?? null,
    [members, selectedCoberturaId]
  );

  const esDentalAnulada = Boolean(esDental && selectedMember?.esAnulada);
  const tieneSnapshotAnulacion = useMemo(
    () => historial.some((item) => Boolean(item?.es_anulacion)),
    [historial]
  );
  const puedeReabrirDental =
    esDentalAnulada &&
    !readOnly &&
    (tieneSnapshotAnulacion || selectedMember?.hasPlanData === false);
  const formEsAnulacion = esDentalAnulada || esAnulacion;

  const aniosDisponibles = useMemo(() => {
    const years = new Set();
    historial.forEach((item) => {
      const year = getAnioHistorial(item);
      if (year != null) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [historial]);

  const historialFiltrado = useMemo(() => {
    if (!anioSeleccionado) return historial;
    return historial.filter((item) => getAnioHistorial(item) === anioSeleccionado);
  }, [historial, anioSeleccionado]);

  const modalTitle = useMemo(() => {
    const base = esDental ? "Historial de plan dental" : "Historial de plan";
    if (allowBulkArchive && members.length > 1) {
      return `${base} — Grupo familiar`;
    }
    return `${base}${selectedMember?.memberName ? ` — ${selectedMember.memberName}` : ""}`;
  }, [allowBulkArchive, esDental, members.length, selectedMember]);

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
      setAnioSeleccionado(ANIO_ACTUAL);
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
    setAnioSeleccionado(ANIO_ACTUAL);
    setShowArchivarForm(false);
    setShowCrearForm(false);
    setManualForm(EMPTY_MANUAL_FORM);
    setFechaExpiracion("");
    setNota("");
    setEsAnulacion(false);
    setReabriendo(false);
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

  // Al cargar historial: año actual si hay datos; si no, el más reciente disponible.
  useEffect(() => {
    if (aniosDisponibles.length === 0) {
      setAnioSeleccionado(ANIO_ACTUAL);
      return;
    }
    if (aniosDisponibles.includes(ANIO_ACTUAL)) {
      setAnioSeleccionado(ANIO_ACTUAL);
      return;
    }
    setAnioSeleccionado((prev) =>
      aniosDisponibles.includes(prev) ? prev : aniosDisponibles[0]
    );
  }, [aniosDisponibles]);

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
    const forzarAnulacion = esDentalAnulada;
    const payload = {
      es_anulacion: forzarAnulacion || esAnulacion,
      nota: nota.trim() || undefined,
      limpiar_campos: false,
    };

    if (!payload.es_anulacion) {
      payload.vigente_hasta = fechaExpiracion;
      payload.fecha_expiracion = fechaExpiracion;
    }

    return archivarPlanActual(coberturaId, payload);
  };

  const handleArchivar = async (e) => {
    e.preventDefault();
    const archivarComoAnulacion = esDentalAnulada || esAnulacion;
    if (!archivarComoAnulacion && !fechaExpiracion) return;

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
            ? esAnulacion || esDentalAnulada
              ? "Plan archivado por anulación correctamente."
              : "Plan archivado correctamente."
            : esAnulacion || esDentalAnulada
              ? `${archivados} planes archivados por anulación correctamente.`
              : `${archivados} planes archivados correctamente.`
        );
        setShowArchivarForm(false);
        setEsAnulacion(false);
        setFechaExpiracion("");
        setNota("");
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
        metal: esDental ? null : manualForm.metal || null,
        red: esDental ? null : manualForm.red || null,
        policy_number: manualForm.policy_number.trim() || null,
        codigo_poliza: esDental ? null : manualForm.codigo_poliza.trim() || null,
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

  const handleReabrirDental = async () => {
    if (!selectedCoberturaId || !puedeReabrirDental) return;

    setReabriendo(true);
    setError("");
    setSuccess("");
    try {
      const res = await GrupoFamiliarService.reabrirAnulacionDental(
        selectedCoberturaId
      );
      const data = res?.data ?? res;
      setSuccess(
        res?.message || "Inscripción Dental MS reabierta correctamente."
      );
      onReabierta?.(selectedMember, data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "No fue posible reabrir la inscripción Dental MS."
      );
    } finally {
      setReabriendo(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
      <Modal
        show={show}
        onHide={handleClose}
        size="xl"
        centered
        scrollable
        dialogClassName="hp-modal"
        contentClassName="hp-modal__content"
      >
      <Modal.Header closeButton className="hp-modal__header">
        <div className="hp-modal__header-main">
          <div className="hp-modal__header-icon" aria-hidden="true">
            <i className={esDental ? "fas fa-tooth" : "fas fa-history"} />
          </div>
          <div>
            <Modal.Title className="hp-modal__title">{modalTitle}</Modal.Title>
            <p className="hp-modal__subtitle">
              {esDental
                ? "Planes archivados y vigentes de Dental MS"
                : "Planes archivados y vigentes de la cobertura de salud"}
            </p>
            <span
              className={`hp-badge-producto ${
                esDental ? "hp-badge-producto--dental" : "hp-badge-producto--salud"
              }`}
            >
              {esDental ? "Dental MS" : "Salud MS"}
            </span>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="hp-modal__body">
        {error && (
          <Alert variant="danger" className="hp-alert">
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="hp-alert">
            {success}
          </Alert>
        )}

        {esDentalAnulada && !readOnly && !loading && (
          <Alert
            variant={puedeReabrirDental ? "success" : "warning"}
            className="hp-alert"
          >
            {puedeReabrirDental ? (
              <>
                El plan anulado ya está en el historial. Puede{" "}
                <strong>reabrir la inscripción Dental MS</strong> sobre esta
                misma cobertura.
              </>
            ) : (
              <>
                Esta inscripción Dental MS está anulada. Archive el plan por
                anulación para habilitar <strong>Reabrir inscripción</strong>.
                No cree una cobertura nueva.
              </>
            )}
          </Alert>
        )}

        {members.length > 1 && (
          <Nav variant="tabs" className="hp-tabs flex-nowrap overflow-auto">
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
          <div className="hp-toolbar">
            {!showArchivarForm && !showCrearForm ? (
              <>
                <Button
                  variant="outline-success"
                  size="sm"
                  className="hp-btn-create"
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
                  className="hp-btn-archive"
                  onClick={() => {
                    setShowArchivarForm(true);
                    setShowCrearForm(false);
                    setEsAnulacion(esDentalAnulada);
                    setFechaExpiracion("");
                    setNota("");
                  }}
                >
                  <i className="fas fa-archive me-1" />
                  {esDentalAnulada
                    ? "Archivar plan anulado"
                    : allowBulkArchive && members.length > 1
                      ? "Archivar planes"
                      : "Archivar plan actual"}
                </Button>
                {puedeReabrirDental && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleReabrirDental}
                    disabled={reabriendo}
                  >
                    {reabriendo ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Reabriendo…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-redo me-1" />
                        Reabrir inscripción
                      </>
                    )}
                  </Button>
                )}
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
                onClick={() => {
                  setShowArchivarForm(false);
                  setEsAnulacion(false);
                  setFechaExpiracion("");
                  setNota("");
                }}
              >
                Cancelar archivado
              </Button>
            )}
          </div>
        )}

        {showCrearForm && !readOnly && (
          <Form onSubmit={handleCrearManual} className="hp-panel">
            <div className="hp-panel__title">
              Crear registro manual de plan
              {selectedMember?.memberName ? ` — ${selectedMember.memberName}` : ""}
            </div>
            <p className="hp-panel__hint">
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
              {!esDental && (
                <>
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
                </>
              )}
              <div className="col-md-3">
                <Form.Label className="small mb-1">Número ID</Form.Label>
                <Form.Control
                  size="sm"
                  value={manualForm.policy_number}
                  onChange={(e) => updateManualField("policy_number", e.target.value)}
                />
              </div>
              {!esDental && (
                <div className="col-md-3">
                  <Form.Label className="small mb-1">Código ID</Form.Label>
                  <Form.Control
                    size="sm"
                    value={manualForm.codigo_poliza}
                    onChange={(e) => updateManualField("codigo_poliza", e.target.value)}
                  />
                </div>
              )}
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
                className="hp-btn-submit hp-btn-submit--success"
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
          <Form onSubmit={handleArchivar} className="hp-panel">
            <div className="hp-panel__title">
              {allowBulkArchive && members.length > 1
                ? "Archivar planes del grupo"
                : "Archivar datos del plan vigente"}
            </div>
            <div className="row g-3">
              <div className="col-12">
                <Form.Check
                  type="checkbox"
                  id="archivar-es-anulacion"
                  label="Archivar por anulación (sin fecha de expiración)"
                  checked={formEsAnulacion}
                  disabled={esDentalAnulada}
                  onChange={(e) => {
                    if (esDentalAnulada) return;
                    const checked = e.target.checked;
                    setEsAnulacion(checked);
                    if (checked) setFechaExpiracion("");
                  }}
                />
                <Form.Text className="text-muted d-block">
                  {esDentalAnulada
                    ? "Obligatorio: esta cobertura Dental MS está anulada. El archivo queda sin fecha de expiración."
                    : "Marque esta opción cuando el plan se archiva porque la cobertura fue anulada. En ese caso no aplica fecha de expiración."}
                </Form.Text>
              </div>
              {!formEsAnulacion && (
                <div className="col-md-6">
                  <Form.Label className="small mb-1">Fecha de expiración *</Form.Label>
                  <DateInputWithCalendar
                    size="sm"
                    valueIso={fechaExpiracion}
                    onChangeIso={setFechaExpiracion}
                  />
                </div>
              )}
              <div className={formEsAnulacion ? "col-md-12" : "col-md-6"}>
                <Form.Label className="small mb-1">Nota</Form.Label>
                <Form.Control
                  size="sm"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder={
                    formEsAnulacion
                      ? "Ej. Cobertura anulada"
                      : "Ej. Cambio de compañía"
                  }
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
                className="hp-btn-submit"
                disabled={
                  archiving ||
                  (!formEsAnulacion && !fechaExpiracion) ||
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
          <div className="hp-loading">
            <Spinner animation="border" size="sm" className="me-2" />
            Cargando historial…
          </div>
        ) : historial.length === 0 ? (
          <div className="hp-empty">
            {selectedMember?.memberName
              ? `No hay planes archivados para ${selectedMember.memberName}.`
              : "No hay planes archivados para esta cobertura."}
          </div>
        ) : (
          <>
            <div className="hp-filter-bar">
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="small mb-0 text-nowrap">Año</Form.Label>
                <Form.Select
                  size="sm"
                  style={{ width: "auto", minWidth: "7rem" }}
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                >
                  {aniosDisponibles.map((year) => (
                    <option key={year} value={year}>
                      {year}
                      {year === ANIO_ACTUAL ? " (actual)" : ""}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <span className="hp-chip">
                {historialFiltrado.length} registro
                {historialFiltrado.length !== 1 ? "s" : ""} en {anioSeleccionado}
                {aniosDisponibles.length > 1
                  ? ` · ${aniosDisponibles.length} años`
                  : ""}
              </span>
            </div>

            {historialFiltrado.length === 0 ? (
              <div className="hp-empty">
                No hay historial de plan para el año {anioSeleccionado}.
                {aniosDisponibles.length > 0
                  ? " Seleccione otro año para ver registros anteriores."
                  : ""}
              </div>
            ) : (
              <div className="hp-table-wrap table-responsive">
                <Table hover size="sm" className="hp-table">
                  <thead>
                    <tr>
                      <th style={{ width: "1%" }}>Origen</th>
                      <th>Compañía</th>
                      <th>Plan</th>
                      {!esDental && <th>Metal</th>}
                      {!esDental && <th>Red</th>}
                      <th>Número ID</th>
                      {!esDental && <th>Código ID</th>}
                      <th>Agente</th>
                      <th>Precio ($)</th>
                      <th>Activación</th>
                      <th>Expiración</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialFiltrado.map((item) => (
                      <tr key={item.id}>
                        <td className="text-center align-middle">
                          {item.es_anulacion ? (
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip id={`anulacion-${item.id}`}>
                                  Archivado por anulación · sin fecha de expiración
                                </Tooltip>
                              }
                            >
                              <Badge bg="danger" pill className="user-select-none">
                                Anulado
                              </Badge>
                            </OverlayTrigger>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>{item.compania?.nombre || "—"}</td>
                        <td>{item.plan || "—"}</td>
                        {!esDental && <td>{item.metal || "—"}</td>}
                        {!esDental && <td>{item.red || "—"}</td>}
                        <td>
                          {esDental
                            ? item.policy_number || "—"
                            : item.policy_number || item.codigo_poliza || "—"}
                        </td>
                        {!esDental && <td>{item.codigo_poliza || "—"}</td>}
                        <td>{item.agente || "—"}</td>
                        <td>{formatPrecio(item.precio)}</td>
                        <td>{formatDate(item.fecha_activacion)}</td>
                        <td>
                          {item.es_anulacion
                            ? "No aplica"
                            : formatDate(item.fecha_expiracion)}
                        </td>
                        <td>{item.nota || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="hp-modal__footer">
        <Button variant="secondary" className="hp-btn-close" onClick={handleClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default HistorialPlanCoberturaModal;
