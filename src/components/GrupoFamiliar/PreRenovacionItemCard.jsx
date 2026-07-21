/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import apiRequest from "../../services/api";
import { fetchCompanies } from "../../services/companies";
import { buildDireccion } from "../../utils/direccion";
import {
  CLIENTE_FIELDS_PRINCIPALES,
  CLIENTE_FIELDS_MIGRATORIO,
  CLIENTE_FIELDS_DIRECCION,
  CLIENTE_FIELDS_CONTACTO,
  CLIENTE_FIELDS_EMPLEO,
} from "../../utils/clienteFieldGroups";

const TIPO_PAGO_OPTIONS = [
  { value: "DEBITO AUTOMATICO", label: "DEBITO AUTOMATICO" },
  { value: "CTE PAGA", label: "CTE PAGA" },
  { value: "MES A MES", label: "MES A MES" },
];

const MOTIVOS_RETIRO_NO_RENOVACION = [
  "CAMBIO DE AGENTE",
  "MS CANCELO POR FALTA DE DOCUMENTOS",
  "POR FALTA DE PAGO",
  "POR FALTA DE PAGO INICIAL",
  "TOMO MEDICAID",
  "TOMO MEDICARE",
  "TOMO SEGURO POR EL TRABAJO",
  "CLIENTE CANCELO",
  "CLIENTE SE MUDO A OTRO ESTADO",
  "OTRO",
];

const DIRECCION_FORMULA_FIELDS = new Set([
  "calle",
  "apto",
  "ciudad",
  "condado",
  "estado",
  "codigo_postal",
]);

const TEXT_FIELDS = [
  ["codigo_poliza", "Código de póliza", "text", "col-md-4"],
  ["policy_number", "Policy number", "text", "col-md-4"],
  ["plan", "Plan", "text", "col-md-3"],
  ["metal", "Metal", "text", "col-md-3"],
  ["red", "Red", "text", "col-md-3"],
  ["elegibilidad", "Elegibilidad", "text", "col-md-3"],
  ["grupo", "Grupo", "text", "col-md-3"],
  ["precio", "Precio", "number", "col-md-3"],
  ["dia_pago", "Día de pago", "number", "col-md-3"],
];

const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "No se pudo guardar el cambio.";

let companiesPromise;
const loadCompanies = () => {
  if (!companiesPromise) {
    companiesPromise = fetchCompanies().catch((error) => {
      companiesPromise = undefined;
      throw error;
    });
  }
  return companiesPromise;
};

const PreRenovacionItemCard = ({
  item,
  anioDestino,
  onItemUpdated,
  onItemRemoved,
  attemptedConsolidar = false,
  onSaveStateChange,
}) => {
  const [renovar, setRenovar] = useState(Boolean(item?.renovar ?? true));
  const [datos, setDatos] = useState(() => ({
    ...(item?.datos_borrador || {}),
    cliente: { ...(item?.datos_borrador?.cliente || {}) },
  }));
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [contactoAbierto, setContactoAbierto] = useState(false);
  const [estadosGuardado, setEstadosGuardado] = useState({});
  const [errores, setErrores] = useState({});
  const [bloqueado, setBloqueado] = useState(false);
  const [mensajeBloqueo, setMensajeBloqueo] = useState("");

  const timersRef = useRef({});
  const pendientesRef = useRef({});
  const mountedRef = useRef(true);

  useEffect(() => {
    const timers = timersRef.current;
    const pendientes = pendientesRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      Object.values(timers).forEach(clearTimeout);

      // Si el modal se cierra antes de vencer el debounce, persiste los cambios
      // pendientes en segundo plano para que "Cerrar" no pierda lo digitado.
      Object.values(pendientes).forEach(({ cambios, bodyDirecto }) => {
        const body = bodyDirecto
          ? cambios
          : { datos_borrador: cambios };
        apiRequest(`/pre-renovacion/items/${item.id}`, "PUT", body).catch(() => {});
      });
    };
  }, [item.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadCompanies();
        if (active) setCompanies(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error al cargar compañías", error);
        if (active) setCompanies([]);
      } finally {
        if (active) setCompaniesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const hayPendiente = Object.values(estadosGuardado).some(
      (estado) =>
        estado === "pendiente" ||
        estado === "guardando" ||
        estado === "error"
    );
    onSaveStateChange?.(item.id, hayPendiente);
  }, [estadosGuardado, item.id, onSaveStateChange]);

  const guardarCambio = async (cambios, key, bodyDirecto = false) => {
    delete pendientesRef.current[key];
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
      delete timersRef.current[key];
    }

    setEstadosGuardado((prev) => ({ ...prev, [key]: "guardando" }));
    setErrores((prev) => ({ ...prev, [key]: "" }));

    try {
      const response = await apiRequest(
        `/pre-renovacion/items/${item.id}`,
        "PUT",
        bodyDirecto ? cambios : { datos_borrador: cambios }
      );
      const actualizado = response?.data ?? response;

      if (mountedRef.current) {
        if (bodyDirecto && Object.prototype.hasOwnProperty.call(actualizado, "renovar")) {
          setRenovar(Boolean(actualizado.renovar));
        }
        setEstadosGuardado((prev) => ({ ...prev, [key]: "guardado" }));
        onItemUpdated?.(actualizado);
      }
    } catch (error) {
      if (!mountedRef.current) return;

      if (error?.response?.status === 409) {
        setBloqueado(true);
        setMensajeBloqueo(
          "Esta pre-renovación ya fue consolidada, no se puede seguir editando."
        );
      }
      setEstadosGuardado((prev) => ({ ...prev, [key]: "error" }));
      setErrores((prev) => ({ ...prev, [key]: getErrorMessage(error) }));
      pendientesRef.current[key] = { cambios, bodyDirecto };
    }
  };

  const programarGuardado = (cambios, key, bodyDirecto = false) => {
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    pendientesRef.current[key] = { cambios, bodyDirecto };
    setEstadosGuardado((prev) => ({ ...prev, [key]: "pendiente" }));
    setErrores((prev) => ({ ...prev, [key]: "" }));
    timersRef.current[key] = setTimeout(
      () => guardarCambio(cambios, key, bodyDirecto),
      600
    );
  };

  const guardarPendienteAhora = (key) => {
    const pendiente = pendientesRef.current[key];
    if (pendiente) {
      guardarCambio(pendiente.cambios, key, pendiente.bodyDirecto);
    }
  };

  const cambiarDato = (field, value, inmediato = false) => {
    setDatos((prev) => ({ ...prev, [field]: value }));
    const cambios = { [field]: value };
    if (inmediato) {
      guardarCambio(cambios, field);
    } else {
      programarGuardado(cambios, field);
    }
  };

  const cambiarCliente = (field, value, inmediato = false) => {
    setDatos((prev) => ({
      ...prev,
      cliente: { ...(prev.cliente || {}), [field]: value },
    }));
    const cambios = { cliente: { [field]: value } };
    const key = `cliente.${field}`;
    if (inmediato) {
      guardarCambio(cambios, key);
    } else {
      programarGuardado(cambios, key);
    }
  };

  const cambiarRenovar = (checked) => {
    setRenovar(checked);
    guardarCambio({ renovar: checked }, "renovar", true);
  };

  const retry = (key) => {
    const pendiente = pendientesRef.current[key];
    if (pendiente) guardarCambio(pendiente.cambios, key, pendiente.bodyDirecto);
  };

  const renderEstado = (key) => {
    const estado = estadosGuardado[key] || "limpio";
    if (estado === "limpio") return null;
    if (estado === "pendiente") {
      return <span className="text-muted small">Pendiente…</span>;
    }
    if (estado === "guardando") {
      return <span className="text-primary small">Guardando…</span>;
    }
    if (estado === "guardado") {
      return <span className="text-success small">✓ Guardado</span>;
    }
    return (
      <button
        type="button"
        className="btn btn-link btn-sm text-danger p-0"
        onClick={() => retry(key)}
        disabled={bloqueado}
      >
        ⚠ {errores[key] || "Error al guardar"} — reintentar
      </button>
    );
  };

  const esMiembroNuevo = item?.tipo_item === "miembro_nuevo";
  const cobertura = item?.cobertura || {};
  const clienteActual = cobertura?.cliente || {};
  const nombre = esMiembroNuevo
    ? datos.cliente?.nombre_completo ||
      item?.datos_borrador?.cliente?.nombre_completo ||
      `Miembro nuevo #${item?.id || "?"}`
    : clienteActual.nombre_completo ||
      [clienteActual.primer_nombre, clienteActual.apellidos]
        .filter(Boolean)
        .join(" ") ||
      `Cobertura #${item?.cobertura_id || "?"}`;
  const requiereRetiro = !esMiembroNuevo && !renovar && Boolean(cobertura.activo);
  const mostrarPoliza = esMiembroNuevo || renovar;
  const codigoInvalido =
    attemptedConsolidar &&
    mostrarPoliza &&
    !String(datos.codigo_poliza ?? "").trim();
  const retiroFechaInvalida =
    attemptedConsolidar &&
    requiereRetiro &&
    !String(datos.fecha_retiro ?? "").trim();
  const retiroMotivoInvalido =
    attemptedConsolidar &&
    requiereRetiro &&
    !String(datos.motivo_retiro ?? "").trim();
  const disabled = bloqueado;

  const handleQuitarMiembroNuevo = async () => {
    if (disabled) return;
    setEstadosGuardado((prev) => ({ ...prev, quitar: "guardando" }));
    try {
      await apiRequest(`/pre-renovacion/items/${item.id}`, "DELETE");
      onItemRemoved?.(item.id);
    } catch (error) {
      if (error?.response?.status === 409) {
        setBloqueado(true);
        setMensajeBloqueo(
          "Esta pre-renovación ya fue consolidada, no se puede seguir editando."
        );
      }
      setEstadosGuardado((prev) => ({ ...prev, quitar: "error" }));
      setErrores((prev) => ({ ...prev, quitar: getErrorMessage(error) }));
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <div className="fw-semibold">{nombre}</div>
            {esMiembroNuevo ? (
              <span className="badge bg-info text-white">
                Miembro nuevo para {anioDestino}
              </span>
            ) : (
              <div className="small text-muted">
                Póliza actual: <strong>{cobertura.codigo_poliza || "—"}</strong>
                {" · "}
                Plan: <strong>{cobertura.plan || "—"}</strong>
              </div>
            )}
          </div>
          <div className="text-end">
            {esMiembroNuevo ? (
              <div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleQuitarMiembroNuevo}
                  disabled={disabled || estadosGuardado.quitar === "guardando"}
                >
                  🗑 Quitar de este borrador
                </button>
                {renderEstado("quitar")}
              </div>
            ) : (
              <>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`pre-renovar-${item.id}`}
                    checked={renovar}
                    onChange={(e) => cambiarRenovar(e.target.checked)}
                    disabled={disabled}
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`pre-renovar-${item.id}`}
                  >
                    Renovar a este miembro
                  </label>
                </div>
                {renderEstado("renovar")}
              </>
            )}
          </div>
        </div>
      </div>

      {mensajeBloqueo && (
        <div className="alert alert-warning rounded-0 mb-0 py-2">
          {mensajeBloqueo}
        </div>
      )}

      {!esMiembroNuevo && renovar && !cobertura.activo && (
        <div className="alert alert-warning rounded-0 mb-0 py-2">
          <strong>⚠ Esta cobertura ya no está activa</strong> — probablemente fue
          cancelada o retirada después de agregarse a este borrador. Revisa si
          corresponde desmarcar &quot;Renovar a este miembro&quot;.
        </div>
      )}

      {requiereRetiro && (
        <div className="card-body border-bottom">
          <p className="small text-muted mb-3">
            Este miembro no se renovará. Prepara los datos obligatorios del retiro.
          </p>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">
                Fecha de retiro <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className={`form-control form-control-sm${
                  retiroFechaInvalida ? " is-invalid" : ""
                }`}
                value={toDateInput(datos.fecha_retiro)}
                onChange={(e) => cambiarDato("fecha_retiro", e.target.value, true)}
                disabled={disabled}
              />
              {renderEstado("fecha_retiro")}
            </div>
            <div className="col-md-8">
              <label className="form-label form-label-sm mb-1">
                Motivo de retiro <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select form-select-sm${
                  retiroMotivoInvalido ? " is-invalid" : ""
                }`}
                value={datos.motivo_retiro || ""}
                onChange={(e) => cambiarDato("motivo_retiro", e.target.value, true)}
                disabled={disabled}
              >
                <option value="">Seleccione…</option>
                {MOTIVOS_RETIRO_NO_RENOVACION.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {motivo}
                  </option>
                ))}
              </select>
              {renderEstado("motivo_retiro")}
            </div>
          </div>
        </div>
      )}

      {mostrarPoliza && (
        <div className="card-body border-bottom">
          <p className="small text-muted mb-3">
            Datos de la póliza para {anioDestino}
          </p>
          <div className="row g-2">
            {TEXT_FIELDS.map(([field, label, type, col]) => (
              <div className={col} key={field}>
                <label className="form-label form-label-sm mb-1">
                  {label}
                  {field === "codigo_poliza" && (
                    <span className="text-danger"> *</span>
                  )}
                </label>
                <input
                  type={type}
                  step={field === "precio" ? "0.01" : undefined}
                  min={type === "number" ? "0" : undefined}
                  className={`form-control form-control-sm${
                    field === "codigo_poliza" && codigoInvalido
                      ? " is-invalid"
                      : ""
                  }`}
                  value={datos[field] ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const value =
                      type === "number"
                        ? raw === ""
                          ? null
                          : Number(raw)
                        : raw;
                    cambiarDato(field, value);
                  }}
                  onBlur={() => guardarPendienteAhora(field)}
                  disabled={disabled}
                />
                {field === "codigo_poliza" && codigoInvalido && (
                  <div className="invalid-feedback">Obligatoria para consolidar.</div>
                )}
                {renderEstado(field)}
              </div>
            ))}

            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">Compañía</label>
              <select
                className="form-select form-select-sm"
                value={datos.compania_id ?? ""}
                onChange={(e) =>
                  cambiarDato(
                    "compania_id",
                    e.target.value ? Number(e.target.value) : null,
                    true
                  )
                }
                disabled={disabled || companiesLoading}
              >
                <option value="">
                  {companiesLoading ? "Cargando…" : "Seleccione…"}
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.nombre}
                  </option>
                ))}
              </select>
              {renderEstado("compania_id")}
            </div>

            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">
                Fecha de activación
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={toDateInput(datos.fecha_activacion)}
                onChange={(e) =>
                  cambiarDato("fecha_activacion", e.target.value, true)
                }
                disabled={disabled}
              />
              {renderEstado("fecha_activacion")}
            </div>

            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">Tipo de pago</label>
              <select
                className="form-select form-select-sm"
                value={datos.tipo_pago || ""}
                onChange={(e) =>
                  cambiarDato("tipo_pago", e.target.value || null, true)
                }
                disabled={disabled}
              >
                <option value="">Seleccione…</option>
                {TIPO_PAGO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {renderEstado("tipo_pago")}
            </div>
          </div>
        </div>
      )}

      <div className="card-body">
        <button
          type="button"
          className="btn btn-link p-0 text-decoration-none"
          onClick={() => setContactoAbierto((prev) => !prev)}
          aria-expanded={contactoAbierto}
        >
          <i
            className={`fas fa-chevron-${contactoAbierto ? "up" : "down"} me-2`}
            aria-hidden="true"
          />
          Datos de contacto para {anioDestino} (opcional)
        </button>

        {contactoAbierto && (
          <div className="mt-2">
            <div className="text-muted small fw-semibold mb-2">Datos principales</div>
            <div className="row g-2 mb-3">
              {CLIENTE_FIELDS_PRINCIPALES.map(([field, label, type]) => {
                const actual = clienteActual[field];
                const help =
                  actual !== null && actual !== undefined && actual !== ""
                    ? `Actual: ${actual}`
                    : "Sin valor actual";
                const key = `cliente.${field}`;
                return (
                  <div className="col-md-4" key={field}>
                    <label className="form-label form-label-sm mb-1">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      className="form-control form-control-sm"
                      value={
                        type === "date"
                          ? toDateInput(datos.cliente?.[field])
                          : (datos.cliente?.[field] ?? "")
                      }
                      placeholder={String(actual ?? "")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        cambiarCliente(
                          field,
                          type === "number"
                            ? raw === ""
                              ? null
                              : Number(raw)
                            : raw
                        );
                      }}
                      onBlur={() => guardarPendienteAhora(key)}
                      disabled={disabled}
                    />
                    <div className="form-text">{help}</div>
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Estatus migratorio</div>
            <div className="row g-2 mb-3">
              {CLIENTE_FIELDS_MIGRATORIO.map(([field, label, type]) => {
                const actual = clienteActual[field];
                const help =
                  actual !== null && actual !== undefined && actual !== ""
                    ? `Actual: ${actual}`
                    : "Sin valor actual";
                const key = `cliente.${field}`;
                return (
                  <div className="col-md-4" key={field}>
                    <label className="form-label form-label-sm mb-1">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      className="form-control form-control-sm"
                      value={
                        type === "date"
                          ? toDateInput(datos.cliente?.[field])
                          : (datos.cliente?.[field] ?? "")
                      }
                      placeholder={String(actual ?? "")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        cambiarCliente(
                          field,
                          type === "number"
                            ? raw === ""
                              ? null
                              : Number(raw)
                            : raw
                        );
                      }}
                      onBlur={() => guardarPendienteAhora(key)}
                      disabled={disabled}
                    />
                    <div className="form-text">{help}</div>
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Dirección</div>
            <div className="row g-2 mb-3">
              {CLIENTE_FIELDS_DIRECCION.map(([field, label, type]) => {
                const actual = clienteActual[field];
                const key = `cliente.${field}`;
                const esDireccionCalculada = field === "direccion";
                const help = esDireccionCalculada
                  ? "Se calcula automáticamente"
                  : actual !== null && actual !== undefined && actual !== ""
                    ? `Actual: ${actual}`
                    : "Sin valor actual";
                return (
                  <div className="col-md-4" key={field}>
                    <label className="form-label form-label-sm mb-1">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      className="form-control form-control-sm"
                      value={datos.cliente?.[field] ?? ""}
                      placeholder={String(actual ?? "")}
                      onChange={(e) => {
                        if (esDireccionCalculada) return;
                        const raw = e.target.value;
                        const value =
                          type === "number"
                            ? raw === ""
                              ? null
                              : Number(raw)
                            : raw;
                        cambiarCliente(field, value);
                        if (DIRECCION_FORMULA_FIELDS.has(field)) {
                          const siguienteCliente = {
                            ...(datos.cliente || {}),
                            [field]: value,
                          };
                          const direccionCalculada =
                            buildDireccion(siguienteCliente);
                          cambiarCliente("direccion", direccionCalculada);
                        }
                      }}
                      onBlur={() => {
                        if (esDireccionCalculada) return;
                        guardarPendienteAhora(key);
                        if (DIRECCION_FORMULA_FIELDS.has(field)) {
                          guardarPendienteAhora("cliente.direccion");
                        }
                      }}
                      disabled={disabled || esDireccionCalculada}
                      readOnly={esDireccionCalculada}
                    />
                    <div className="form-text">{help}</div>
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Datos de contacto</div>
            <div className="row g-2 mb-3">
              {CLIENTE_FIELDS_CONTACTO.map(([field, label, type]) => {
                const actual = clienteActual[field];
                const key = `cliente.${field}`;

                if (type === "checkbox") {
                  const help =
                    actual === true || actual === 1 || actual === "1"
                      ? "Actual: Sí"
                      : actual === false || actual === 0 || actual === "0"
                        ? "Actual: No"
                        : "Sin valor actual";
                  return (
                    <div className="col-md-4" key={field}>
                      <div className="form-check mt-4">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`pre-cliente-${item.id}-${field}`}
                          checked={Boolean(datos.cliente?.[field])}
                          onChange={(e) =>
                            cambiarCliente(field, e.target.checked, true)
                          }
                          disabled={disabled}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`pre-cliente-${item.id}-${field}`}
                        >
                          {label}
                        </label>
                      </div>
                      <div className="form-text">{help}</div>
                      {renderEstado(key)}
                    </div>
                  );
                }

                const help =
                  actual !== null && actual !== undefined && actual !== ""
                    ? `Actual: ${actual}`
                    : "Sin valor actual";
                return (
                  <div className="col-md-4" key={field}>
                    <label className="form-label form-label-sm mb-1">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      className="form-control form-control-sm"
                      value={datos.cliente?.[field] ?? ""}
                      placeholder={String(actual ?? "")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        cambiarCliente(
                          field,
                          type === "number"
                            ? raw === ""
                              ? null
                              : Number(raw)
                            : raw
                        );
                      }}
                      onBlur={() => guardarPendienteAhora(key)}
                      disabled={disabled}
                    />
                    <div className="form-text">{help}</div>
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Empleo e ingreso</div>
            <div className="row g-2">
              {CLIENTE_FIELDS_EMPLEO.map(([field, label, type]) => {
                const actual = clienteActual[field];
                const help =
                  actual !== null && actual !== undefined && actual !== ""
                    ? `Actual: ${actual}`
                    : "Sin valor actual";
                const key = `cliente.${field}`;
                return (
                  <div className="col-md-4" key={field}>
                    <label className="form-label form-label-sm mb-1">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "0.01" : undefined}
                      className="form-control form-control-sm"
                      value={datos.cliente?.[field] ?? ""}
                      placeholder={String(actual ?? "")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        cambiarCliente(
                          field,
                          type === "number"
                            ? raw === ""
                              ? null
                              : Number(raw)
                            : raw
                        );
                      }}
                      onBlur={() => guardarPendienteAhora(key)}
                      disabled={disabled}
                    />
                    <div className="form-text">{help}</div>
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreRenovacionItemCard;
