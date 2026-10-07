import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Button,
  Alert,
  Spinner,
  Form,
  Nav,
} from "react-bootstrap";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import CompanySelect from "../selects/CompanySelect";
import useCompanies from "../../hooks/useCompanies";
import {
  anularYRecuperarPlanes,
  archivarPlanActual,
  crearHistorialPlan,
  fetchHistorialPlan,
} from "../../services/historialPlanCoberturaApi";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import HistorialPlanCoberturaTabla from "./HistorialPlanCoberturaTabla";
import {
  esPlanRecuperable,
  getAnioEfectivoRegistroPlan,
  getAnioHistorialPlan,
} from "../../utils/historialPlanCobertura";
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

const ANIO_ACTUAL = new Date().getFullYear();

const textoFecha = (valor) => (valor ? String(valor).slice(0, 10) : "—");

const textoPrecio = (valor) => {
  if (valor == null || valor === "") return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? `$${numero.toFixed(2)}` : "—";
};

const textoPoliza = (item) =>
  item?.policy_number || item?.codigo_poliza || "—";

const etiquetaPlanArchivado = (item, producto) =>
  [
    item?.compania?.nombre || "Sin compañía",
    item?.plan || "Sin plan",
    producto || "—",
    getAnioEfectivoRegistroPlan(item) ?? "—",
    textoFecha(item?.fecha_activacion),
    textoPoliza(item),
    textoPrecio(item?.precio),
  ].join(" · ");

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
  /** Actualiza en la ficha solo los campos de plan restaurados. */
  onPlanesRecuperados = null,
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
  const [recuperarPlan, setRecuperarPlan] = useState(false);
  const [seleccionesRecuperacion, setSeleccionesRecuperacion] = useState({});
  const [planesPorCobertura, setPlanesPorCobertura] = useState({});
  const [requiereRecarga, setRequiereRecarga] = useState(false);
  const planesRef = useRef({});
  const { companies } = useCompanies({
    producto: esDental ? "dental_ms" : "salud",
    includeId: manualForm.compania_id,
    soloActivas: true,
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
      const year = getAnioHistorialPlan(item);
      if (year != null) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [historial]);

  const historialFiltrado = useMemo(() => {
    if (!anioSeleccionado) return historial;
    return historial.filter((item) => getAnioHistorialPlan(item) === anioSeleccionado);
  }, [historial, anioSeleccionado]);

  const modalTitle = useMemo(() => {
    const base = esDental ? "Archivo de plan dental" : "Archivo de plan";
    if (allowBulkArchive && members.length > 1) {
      return `${base} — Grupo familiar`;
    }
    return `${base}${selectedMember?.memberName ? ` — ${selectedMember.memberName}` : ""}`;
  }, [allowBulkArchive, esDental, members.length, selectedMember]);

  const guardarEntradaPlanes = useCallback((coberturaId, entrada) => {
    planesRef.current = { ...planesRef.current, [coberturaId]: entrada };
    setPlanesPorCobertura(planesRef.current);
  }, []);

  const cargarPlanesCobertura = useCallback(
    async (coberturaId, { forzar = false } = {}) => {
      if (!coberturaId) return null;
      const actual = planesRef.current[coberturaId];
      if (!forzar && (actual?.estado === "loading" || actual?.estado === "ok")) {
        return actual;
      }

      guardarEntradaPlanes(coberturaId, {
        estado: "loading",
        registros: [],
        meta: actual?.meta ?? null,
        error: "",
      });

      try {
        const res = await fetchHistorialPlan(coberturaId);
        const entrada = {
          estado: "ok",
          registros: Array.isArray(res?.data) ? res.data : [],
          meta: res?.meta ?? null,
          error: "",
        };
        guardarEntradaPlanes(coberturaId, entrada);
        return entrada;
      } catch (err) {
        const entrada = {
          estado: "error",
          registros: [],
          meta: null,
          error: err?.message || "No se pudo cargar el historial.",
        };
        guardarEntradaPlanes(coberturaId, entrada);
        throw err;
      }
    },
    [guardarEntradaPlanes]
  );

  const cargarHistorial = useCallback(
    async (coberturaId) => {
      if (!coberturaId) return;

      setLoading(true);
      setError("");
      try {
        const entrada = await cargarPlanesCobertura(coberturaId, { forzar: true });
        setHistorial(entrada?.registros || []);
      } catch (err) {
        setError(err?.message || "No se pudo cargar el historial de plan.");
        setHistorial([]);
      } finally {
        setLoading(false);
      }
    },
    [cargarPlanesCobertura]
  );

  const limpiarRecuperacion = useCallback(() => {
    setRecuperarPlan(false);
    setSeleccionesRecuperacion({});
    setRequiereRecarga(false);
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
      planesRef.current = {};
      setPlanesPorCobertura({});
      setRecuperarPlan(false);
      setSeleccionesRecuperacion({});
      setRequiereRecarga(false);
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
    setRecuperarPlan(false);
    setSeleccionesRecuperacion({});
    setRequiereRecarga(false);
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

  const miembrosArchivo = useMemo(() => {
    if (allowBulkArchive) {
      return membersWithPlan.filter((member) =>
        selectedForArchive.has(member.coberturaId)
      );
    }
    if (!selectedCoberturaId) return [];
    return membersWithPlan.filter(
      (member) => member.coberturaId === selectedCoberturaId
    );
  }, [allowBulkArchive, membersWithPlan, selectedCoberturaId, selectedForArchive]);

  const nombreCompania = useCallback(
    (id) => {
      if (id == null || id === "") return "Sin compañía";
      return (
        companies.find((company) => String(company.id) === String(id))?.nombre ||
        "Sin compañía"
      );
    },
    [companies]
  );

  const planesRecuperablesDe = useCallback((member) => {
    const entrada = planesPorCobertura[member.coberturaId];
    const anio = Number(String(entrada?.meta?.ano_cobertura ?? "").trim());
    return (entrada?.registros || []).filter((item) =>
      esPlanRecuperable(item, { coberturaId: member.coberturaId, anio })
    );
  }, [planesPorCobertura]);

  const productoDe = useCallback(
    (member) =>
      planesPorCobertura[member.coberturaId]?.meta?.cobertura_tipo ||
      member.planActual?.cobertura_tipo ||
      (esDental ? "Dental MS" : "Salud"),
    [esDental, planesPorCobertura]
  );

  useEffect(() => {
    if (!show || !showArchivarForm || !formEsAnulacion || !recuperarPlan) return;
    miembrosArchivo.forEach((member) => {
      cargarPlanesCobertura(member.coberturaId);
    });
  }, [
    show,
    showArchivarForm,
    formEsAnulacion,
    recuperarPlan,
    miembrosArchivo,
    cargarPlanesCobertura,
  ]);

  const bloqueoRecuperacion = useMemo(() => {
    if (!recuperarPlan) return "";
    if (requiereRecarga) {
      return "La cobertura cambió. Recargue el historial antes de continuar.";
    }
    if (miembrosArchivo.length === 0) {
      return "Seleccione al menos un miembro con datos de plan para anular.";
    }

    const faltantes = [];
    miembrosArchivo.forEach((member) => {
      const entrada = planesPorCobertura[member.coberturaId];
      if (!entrada || entrada.estado === "loading") {
        faltantes.push(`${member.memberName}: todavía se están cargando sus planes archivados.`);
        return;
      }
      if (entrada.estado === "error") {
        faltantes.push(`${member.memberName}: ${entrada.error || "no se pudo cargar el historial."}`);
        return;
      }
      if (!entrada.meta?.updated_at || !entrada.meta?.version) {
        faltantes.push(
          `${member.memberName}: no se pudo verificar la versión de la cobertura. Recargue antes de continuar.`
        );
        return;
      }
      const opciones = planesRecuperablesDe(member);
      if (opciones.length === 0) {
        faltantes.push(
          `${member.memberName}: no hay un plan archivado recuperable para esta cobertura.`
        );
        return;
      }
      const elegido = seleccionesRecuperacion[member.coberturaId];
      if (!opciones.some((item) => String(item.id) === String(elegido))) {
        faltantes.push(`${member.memberName}: seleccione el plan que desea recuperar.`);
      }
    });

    return faltantes.join(" ");
  }, [
    miembrosArchivo,
    planesPorCobertura,
    planesRecuperablesDe,
    recuperarPlan,
    requiereRecarga,
    seleccionesRecuperacion,
  ]);

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

    if (archivarComoAnulacion && recuperarPlan) {
      if (bloqueoRecuperacion) {
        setError(bloqueoRecuperacion);
        return;
      }

      setArchiving(true);
      setError("");
      setSuccess("");
      try {
        const res = await anularYRecuperarPlanes({
          nota: nota.trim() || undefined,
          miembros: targets.map((member) => ({
            cobertura_id: member.coberturaId,
            historial_plan_id: Number(seleccionesRecuperacion[member.coberturaId]),
            updated_at: planesPorCobertura[member.coberturaId]?.meta?.updated_at,
            version: planesPorCobertura[member.coberturaId]?.meta?.version,
          })),
        });
        setSuccess(
          res?.message || "Plan anulado y plan anterior recuperado correctamente."
        );
        setShowArchivarForm(false);
        setEsAnulacion(false);
        setFechaExpiracion("");
        setNota("");
        limpiarRecuperacion();
        planesRef.current = {};
        setPlanesPorCobertura({});
        onPlanesRecuperados?.(res?.data?.miembros || []);
        await cargarHistorial(selectedCoberturaId);
      } catch (err) {
        const message = err?.message || "No se pudo anular y recuperar el plan.";
        setError(message);
        if (message.includes("Recargue antes de continuar")) {
          setRequiereRecarga(true);
        }
      } finally {
        setArchiving(false);
      }
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
                    limpiarRecuperacion();
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
                  limpiarRecuperacion();
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
                    if (!checked) limpiarRecuperacion();
                  }}
                />
                <Form.Text className="text-muted d-block">
                  {esDentalAnulada
                    ? "Obligatorio: esta cobertura Dental MS está anulada. El archivo queda sin fecha de expiración."
                    : "Marque esta opción cuando el plan se archiva porque la cobertura fue anulada. En ese caso no aplica fecha de expiración."}
                </Form.Text>
                {formEsAnulacion && (
                  <Form.Check
                    className="mt-2"
                    type="checkbox"
                    id="recuperar-plan-archivado"
                    label="Recuperar un plan archivado"
                    checked={recuperarPlan}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRecuperarPlan(checked);
                      setRequiereRecarga(false);
                      if (!checked) setSeleccionesRecuperacion({});
                    }}
                  />
                )}
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

            {formEsAnulacion && recuperarPlan && (
              <div className="hp-recuperar">
                <div className="hp-panel__title">Planes por miembro</div>
                <p className="hp-panel__hint mb-2">
                  Elija el plan archivado de cada cobertura. No se selecciona
                  ninguno automáticamente.
                </p>
                {miembrosArchivo.map((member) => {
                  const entrada = planesPorCobertura[member.coberturaId];
                  const opciones = planesRecuperablesDe(member);
                  const producto = productoDe(member);
                  const elegido = opciones.find(
                    (item) =>
                      String(item.id) ===
                      String(seleccionesRecuperacion[member.coberturaId] || "")
                  );
                  const actual = member.planActual || {};
                  return (
                    <div className="hp-recuperar__miembro" key={member.coberturaId}>
                      <div className="fw-semibold small mb-1">
                        {member.memberName}
                        {member.parentesco ? ` (${member.parentesco})` : ""}
                      </div>
                      {entrada?.estado === "loading" && (
                        <p className="text-muted small mb-2">Cargando planes archivados…</p>
                      )}
                      {entrada?.estado === "error" && (
                        <p className="text-danger small mb-2">{entrada.error}</p>
                      )}
                      {entrada?.estado === "ok" && opciones.length === 0 && (
                        <p className="text-danger small mb-2">
                          No hay un plan archivado recuperable para esta cobertura.
                          La confirmación queda bloqueada.
                        </p>
                      )}
                      {opciones.length > 0 && (
                        <Form.Select
                          size="sm"
                          aria-label={`Plan archivado de ${member.memberName}`}
                          value={seleccionesRecuperacion[member.coberturaId] || ""}
                          onChange={(e) =>
                            setSeleccionesRecuperacion((prev) => ({
                              ...prev,
                              [member.coberturaId]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Seleccione el plan a recuperar</option>
                          {opciones.map((item) => (
                            <option key={item.id} value={item.id}>
                              {etiquetaPlanArchivado(item, producto)}
                            </option>
                          ))}
                        </Form.Select>
                      )}
                      <div className="hp-recuperar__resumen">
                        <div>
                          <span>Se anulará</span>
                          <strong>
                            {[
                              nombreCompania(actual.compania_id),
                              actual.plan || "Sin plan",
                              producto,
                              actual.ano_cobertura || "—",
                              textoFecha(actual.fecha_activacion),
                              textoPoliza(actual),
                              textoPrecio(actual.precio),
                            ].join(" · ")}
                          </strong>
                        </div>
                        <div>
                          <span>Se recuperará</span>
                          <strong>
                            {elegido
                              ? etiquetaPlanArchivado(elegido, producto)
                              : "Seleccione el plan a recuperar"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {requiereRecarga && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        setRequiereRecarga(false);
                        setSeleccionesRecuperacion({});
                        planesRef.current = {};
                        setPlanesPorCobertura({});
                        miembrosArchivo.forEach((member) => {
                          cargarPlanesCobertura(member.coberturaId, { forzar: true })
                            .then((entrada) => {
                              if (member.coberturaId === selectedCoberturaId) {
                                setHistorial(entrada?.registros || []);
                              }
                            })
                            .catch(() => {});
                        });
                      }}
                    >
                      Recargar historial
                    </Button>
                  </div>
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
                    : !selectedCoberturaId) ||
                  (formEsAnulacion && recuperarPlan && Boolean(bloqueoRecuperacion))
                }
              >
                {archiving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {formEsAnulacion && recuperarPlan
                      ? "Anulando y recuperando…"
                      : "Archivando…"}
                  </>
                ) : formEsAnulacion && recuperarPlan ? (
                  "Anular y recuperar plan"
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
              <HistorialPlanCoberturaTabla
                items={historialFiltrado}
                esDental={esDental}
              />
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
