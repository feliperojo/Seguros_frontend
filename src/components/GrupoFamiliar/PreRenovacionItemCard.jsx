/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import apiRequest from "../../services/api";
import useCompanies from "../../hooks/useCompanies";
import { filterCompaniesForProducto } from "../../services/companies";
import LanguageSelect from "../selects/LanguageSelect";
import MdyDashDateInput from "../common/MdyDashDateInput";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import TelefonosPro from "../fase2/TelefonosPro";
import { buildDireccion } from "../../utils/direccion";
import { buildNombreCompleto } from "../../utils/nombre";
import { formatDateForDisplay } from "../../utils/formatters";
import {
  resolveClienteTelefonos,
  toApiPhones,
} from "../../utils/phone-mappers";
import { toLegacyFields } from "../../utils/phones";
import {
  CLIENTE_FIELDS_PRINCIPALES,
  CLIENTE_FIELDS_MIGRATORIO,
  CLIENTE_FIELDS_DIRECCION,
  CLIENTE_FIELDS_CONTACTO,
  CLIENTE_PHONE_LEGACY_FIELDS,
} from "../../utils/clienteFieldGroups";
import {
  normalizeGeneroForSelect,
  normalizeStatusMigratorioForSelect,
} from "../../utils/clienteFieldNormalize";
import { STATUS_MIGRATORIO_OPTIONS } from "../../constants/statusMigratorio";
import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalCoberturaTipo,
} from "../../constants/coberturaTipos";
import { computeAnnual } from "../../services/ingresos";
import MediosPagoSection from "../MediosPagoSection";
import {
  hasBorradorClienteField,
  isBorradorClienteCleared,
  normalizeClienteBorradorValue,
} from "../../utils/preRenovacionCopy";

const TIPO_PAGO_OPTIONS = [
  "DEBITO AUTOMATICO",
  "CTE PAGA",
  "MES A MES",
];

/** Misma lista que TomaDeDatos (grupo familiar). */
const METAL_OPTIONS = ["BRONCE", "SILVER", "GOLD", "PLATINUM"];
const RED_OPTIONS = ["HMO", "EPO", "PPO", "POS"];
const GENERO_OPTIONS = ["Masculino", "Femenino", "Otro"];
const ESTADO_COBERTURA_OPTIONS = ["Sí", "No", "Medicare", "Medicaid"];

const MOTIVOS_RETIRO_NO_RENOVACION = [
  "CAMBIO DE AGENTE",
  "MS CANCELO POR FALTA DE DOCUMENTOS",
  "TOMO MEDICAID",
  "TOMO MEDICARE (65 AÑOS)",
  "TOMO SEGURO POR EMPLEADOR/OTRO",
  "CLIENTE CANCELO POR PRECIO",
  "SE MUDO A OTRO ESTADO/PAIS",
  "YA NO NECESITA EL SEGURO",
  "SE CANCELO POR FALTA DE PAGO (MORA)",
  "NO REALIZO EL PAGO INICIAL",
  "TAXES POR SEPARADO",
  "TAXES EN OTRO GF",
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

const NOMBRE_FORMULA_FIELDS = new Set([
  "primer_nombre",
  "segundo_nombre",
  "apellidos",
]);

/** Misma lista que TomaDeDatos / EditClienteModal. */
const TIPO_INGRESO_OPTIONS = [
  "W2",
  "1099",
  "SOCIAL SECURITY",
  "SELF EMPLOYMENT",
  "SUPPORT",
  "ALIMONY",
];

const PERIODO_INGRESO_OPTIONS = [
  "HOUR",
  "WEEKLY P.TIME",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "ANNUAL",
];

/** Alias legacy (p. ej. MENSUAL) → clave de PERIOD_FACTOR. */
const normalizePeriodoIngreso = (periodo) => {
  const p = String(periodo || "").trim().toUpperCase();
  const aliases = {
    MENSUAL: "MONTHLY",
    ANUAL: "ANNUAL",
    ANUALMENTE: "ANNUAL",
    SEMANAL: "WEEKLY",
    QUINCENAL: "BIWEEKLY",
    HORA: "HOUR",
  };
  return aliases[p] || p;
};

const toAnnualMoney = (periodo, ingresoPorPeriodo) => {
  const anual = computeAnnual(
    normalizePeriodoIngreso(periodo),
    ingresoPorPeriodo
  );
  return anual ? Number(anual.toFixed(2)) : null;
};

/** Campos de póliza de texto libre (metal/red van como select aparte). */
const TEXT_FIELDS = [
  ["codigo_poliza", "Código de póliza", "text", "col-md-4"],
  ["policy_number", "Policy number", "text", "col-md-4"],
  ["plan", "Plan", "text", "col-md-3"],
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

/** Incluye el valor actual si no está en el catálogo, para no perder datos existentes. */
const optionsWithCurrent = (options, current) => {
  const list = [...options];
  const raw = current == null ? "" : String(current).trim();
  if (!raw) return list;
  const exists = list.some(
    (opt) => String(opt).toLowerCase() === raw.toLowerCase()
  );
  if (!exists) list.push(raw);
  return list;
};

const PreRenovacionItemCard = ({
  item,
  anioDestino,
  onItemUpdated,
  onItemRemoved,
  attemptedConsolidar = false,
  onSaveStateChange,
  edicionBloqueada = false,
  pagadorOptions = [],
  alertaDentalSinSalud = false,
  alertaCascadaSalud = false,
}) => {
  const [renovar, setRenovar] = useState(Boolean(item?.renovar ?? true));
  const [datos, setDatos] = useState(() => ({
    ...(item?.datos_borrador || {}),
    cliente: { ...(item?.datos_borrador?.cliente || {}) },
  }));
  const { companies: allCompanies, loading: companiesLoading } = useCompanies();
  const [contactoAbierto, setContactoAbierto] = useState(false);
  const [copiarDir, setCopiarDir] = useState(false);
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
    const normalized =
      typeof value === "string" ? normalizeClienteBorradorValue(value) : value;
    setDatos((prev) => ({
      ...prev,
      cliente: { ...(prev.cliente || {}), [field]: normalized },
    }));
    const cambios = { cliente: { [field]: normalized } };
    const key = `cliente.${field}`;
    if (inmediato) {
      guardarCambio(cambios, key);
    } else {
      programarGuardado(cambios, key);
    }
  };

  const cambiarClienteCampos = (campos, key, inmediato = false) => {
    const normalized = Object.fromEntries(
      Object.entries(campos).map(([k, v]) => [
        k,
        typeof v === "string" ? normalizeClienteBorradorValue(v) : v,
      ])
    );
    setDatos((prev) => ({
      ...prev,
      cliente: { ...(prev.cliente || {}), ...normalized },
    }));
    const cambios = { cliente: { ...normalized } };
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
  const coberturaTipo =
    datos?.cobertura_tipo ?? cobertura?.cobertura_tipo ?? null;
  const esDental = isDentalCoberturaTipo(coberturaTipo);
  const companies = useMemo(
    () =>
      filterCompaniesForProducto(
        allCompanies,
        esDental ? "dental_ms" : null,
        {
          includeId: datos?.compania_id ?? cobertura?.compania_id,
          soloActivas: esDental,
        }
      ),
    [
      allCompanies,
      esDental,
      datos?.compania_id,
      cobertura?.compania_id,
    ]
  );
  const etiquetaProducto = esDental ? COBERTURA_TIPO_DENTAL_MS : "Salud MS";
  const iconoProducto = esDental ? "fas fa-tooth" : "fas fa-shield-alt";
  // Renovación normal: referencia en vivo = cobertura.cliente
  // Miembro nuevo de cliente existente: referencia en vivo = cliente_existente (BD)
  // Fallback: snapshot guardado en el borrador
  const clienteActual = esMiembroNuevo
    ? item?.cliente_existente || item?.datos_borrador?.cliente || {}
    : cobertura?.cliente || {};

  const resolverDireccionCliente = (overrides = {}) => {
    const base = {
      calle: datos.cliente?.calle ?? clienteActual.calle,
      apto: datos.cliente?.apto ?? clienteActual.apto,
      ciudad: datos.cliente?.ciudad ?? clienteActual.ciudad,
      condado: datos.cliente?.condado ?? clienteActual.condado,
      estado: datos.cliente?.estado ?? clienteActual.estado,
      codigo_postal: datos.cliente?.codigo_postal ?? clienteActual.codigo_postal,
      ...overrides,
    };
    return (
      buildDireccion(base) ||
      datos.cliente?.direccion ||
      clienteActual.direccion ||
      ""
    );
  };

  const clienteIdMediosPago =
    cobertura?.cliente_id ??
    cobertura?.cliente?.id ??
    clienteActual?.id ??
    item?.datos_borrador?.cliente_id_existente ??
    item?.cliente_existente?.id ??
    null;

  const direccionClienteMediosPago = resolverDireccionCliente();

  const draftCliente = datos.cliente || {};
  const hasDraftTelefonos = Array.isArray(draftCliente.telefonos);
  const hasDraftLegacyPhone =
    draftCliente.telefono != null ||
    draftCliente.secundario != null ||
    draftCliente.whatsapp_num != null;
  const telefonosValue = resolveClienteTelefonos(
    {
      ...clienteActual,
      ...draftCliente,
      // Preferir array del borrador; si solo hay legacy en borrador, forzar
      // reconstrucción desde esos campos (no ignorarlos por el array actual).
      telefonos: hasDraftTelefonos
        ? draftCliente.telefonos
        : hasDraftLegacyPhone
          ? null
          : clienteActual.telefonos,
    },
    "us"
  );

  const nombre = esMiembroNuevo
    ? datos.cliente?.nombre_completo ||
      item?.cliente_existente?.nombre_completo ||
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
  const disabled = bloqueado || edicionBloqueada;

  const limpiarClienteParaRenovacion = (field) => {
    cambiarCliente(field, null, true);
  };

  const renderClienteBorradorHint = (field, actual, { skipClear = false } = {}) => {
    if (isBorradorClienteCleared(draftCliente, field)) {
      return (
        <div className="form-text text-warning-emphasis">
          Se dejará vacío al consolidar.
        </div>
      );
    }

    const hasActual =
      actual !== null && actual !== undefined && actual !== "";

    if (!hasBorradorClienteField(draftCliente, field) && hasActual && !skipClear) {
      return (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="form-text mb-0">Actual: {String(actual)}</span>
          {!disabled && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 align-baseline"
              onClick={() => limpiarClienteParaRenovacion(field)}
            >
              Quitar para renovación
            </button>
          )}
        </div>
      );
    }

    if (hasActual) {
      return <div className="form-text">Actual: {String(actual)}</div>;
    }

    return <div className="form-text">Sin valor actual</div>;
  };

  const renderClienteSelectField = (field, label, options, normalizeFn) => {
    const actual = clienteActual[field];
    const key = `cliente.${field}`;
    const rawValue = datos.cliente?.[field];
    const selectValue = normalizeFn
      ? normalizeFn(rawValue)
      : rawValue == null
        ? ""
        : String(rawValue);
    const optionsList = optionsWithCurrent(options, selectValue || rawValue);

    return (
      <div className="col-md-4" key={field}>
        <label className="form-label form-label-sm mb-1">{label}</label>
        <select
          className="form-select form-select-sm"
          value={selectValue}
          onChange={(e) => cambiarCliente(field, e.target.value || null, true)}
          disabled={disabled}
        >
          <option value="">Seleccione…</option>
          {optionsList.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {renderClienteBorradorHint(field, actual)}
        {renderEstado(key)}
      </div>
    );
  };

  const renderClienteTextField = (field, label, type) => {
    const actual = clienteActual[field];
    const esNombreCalculado = field === "nombre_completo";
    const key = `cliente.${field}`;

    if (type === "date") {
      const actualFmt =
        actual !== null && actual !== undefined && actual !== ""
          ? formatDateForDisplay(actual)
          : null;
      const actualDisplay =
        actualFmt && actualFmt !== "-" ? actualFmt : actual;
      const valueIso = toDateInput(datos.cliente?.[field]);
      const DateComponent =
        field === "fecha_nacimiento" ? MdyDashDateInput : DateInputWithCalendar;
      return (
        <div className="col-md-4" key={field}>
          <label className="form-label form-label-sm mb-1">{label}</label>
          <DateComponent
            size="sm"
            allowManualEntry={field === "fecha_nacimiento" ? true : undefined}
            valueIso={valueIso}
            minIso="1900-01-01"
            maxIso="2099-12-31"
            disabled={disabled}
            onChangeIso={(iso) => cambiarCliente(field, iso || null, true)}
          />
          {esNombreCalculado ? (
            <div className="form-text">Se calcula automáticamente</div>
          ) : (
            renderClienteBorradorHint(field, actualDisplay)
          )}
          {renderEstado(key)}
        </div>
      );
    }

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
            if (esNombreCalculado) return;
            const raw = e.target.value;
            const value =
              type === "number"
                ? raw === ""
                  ? null
                  : Number(raw)
                : raw;
            cambiarCliente(field, value);
            if (NOMBRE_FORMULA_FIELDS.has(field)) {
              const siguienteCliente = {
                primer_nombre:
                  datos.cliente?.primer_nombre ?? clienteActual.primer_nombre,
                segundo_nombre:
                  datos.cliente?.segundo_nombre ?? clienteActual.segundo_nombre,
                apellidos: datos.cliente?.apellidos ?? clienteActual.apellidos,
                [field]: value,
              };
              const nombreCalculado = buildNombreCompleto(siguienteCliente);
              cambiarCliente("nombre_completo", nombreCalculado);
            }
          }}
          onBlur={() => {
            if (esNombreCalculado) return;
            guardarPendienteAhora(key);
            if (NOMBRE_FORMULA_FIELDS.has(field)) {
              guardarPendienteAhora("cliente.nombre_completo");
            }
          }}
          disabled={disabled || esNombreCalculado}
          readOnly={esNombreCalculado}
        />
        {esNombreCalculado ? (
          <div className="form-text">Se calcula automáticamente</div>
        ) : (
          renderClienteBorradorHint(field, actual)
        )}
        {renderEstado(key)}
      </div>
    );
  };

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
    <div
      className={`card shadow-sm${esDental ? " border-info" : ""}`}
      style={esDental ? { borderLeftWidth: "4px" } : undefined}
    >
      <div className="card-header bg-light">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <div className="fw-semibold">{nombre}</div>
              <span
                className={`badge ${esDental ? "bg-info" : "bg-primary"}`}
                title={
                  esDental ? "Producto Dental MS" : "Producto Salud MS"
                }
              >
                <i className={`${iconoProducto} me-1`} aria-hidden="true" />
                {etiquetaProducto}
              </span>
            </div>
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
                  🗑 Quitar de esta pre-renovación
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
                    Renovar esta cobertura
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

      {alertaDentalSinSalud && renovar && (
        <div className="alert alert-danger rounded-0 mb-0 py-2">
          <strong>Dental no se puede renovar sin salud.</strong> La cobertura
          de Salud MS de este miembro está marcada para no renovar. Desmarca
          Dental o marca Salud para renovar.
        </div>
      )}

      {alertaCascadaSalud && !renovar && (
        <div className="alert alert-warning rounded-0 mb-0 py-2">
          <strong>Cascada:</strong> al no renovar Salud MS, Dental MS activo
          del mismo miembro se retirará automáticamente al consolidar.
        </div>
      )}

      {!esMiembroNuevo && renovar && !cobertura.activo && (
        <div className="alert alert-warning rounded-0 mb-0 py-2">
          <strong>⚠ Esta cobertura ya no está activa</strong> — probablemente fue
          cancelada o retirada después de agregarse a esta pre-renovación. Revisa si
          corresponde desmarcar &quot;Renovar esta cobertura&quot;.
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
              <DateInputWithCalendar
                size="sm"
                valueIso={toDateInput(datos.fecha_retiro)}
                minIso="1900-01-01"
                maxIso="2099-12-31"
                disabled={disabled}
                className={retiroFechaInvalida ? "is-invalid" : ""}
                onChangeIso={(iso) =>
                  cambiarDato("fecha_retiro", iso || null, true)
                }
              />
              {retiroFechaInvalida && (
                <div className="invalid-feedback d-block">
                  Obligatoria para consolidar.
                </div>
              )}
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
            {TEXT_FIELDS.filter(([field]) =>
              esDental ? field !== "grupo" : true
            ).map(([field, label, type, col]) => (
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

            {!esDental && (
              <>
                <div className="col-md-3">
                  <label className="form-label form-label-sm mb-1">Metal</label>
                  <select
                    className="form-select form-select-sm"
                    value={datos.metal || ""}
                    onChange={(e) =>
                      cambiarDato("metal", e.target.value || null, true)
                    }
                    disabled={disabled}
                  >
                    <option value="">Seleccione…</option>
                    {optionsWithCurrent(METAL_OPTIONS, datos.metal).map(
                      (opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      )
                    )}
                  </select>
                  {renderEstado("metal")}
                </div>

                <div className="col-md-3">
                  <label className="form-label form-label-sm mb-1">Red</label>
                  <select
                    className="form-select form-select-sm"
                    value={datos.red || ""}
                    onChange={(e) =>
                      cambiarDato("red", e.target.value || null, true)
                    }
                    disabled={disabled}
                  >
                    <option value="">Seleccione…</option>
                    {optionsWithCurrent(RED_OPTIONS, datos.red).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {renderEstado("red")}
                </div>
              </>
            )}

            {esDental && (
              <>
                <div className="col-md-4">
                  <label className="form-label form-label-sm mb-1">Agente</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={datos.agente ?? ""}
                    onChange={(e) => cambiarDato("agente", e.target.value)}
                    onBlur={() => guardarPendienteAhora("agente")}
                    disabled={disabled}
                    placeholder="Nombre del agente o broker"
                  />
                  {renderEstado("agente")}
                </div>
                <div className="col-md-4">
                  <label className="form-label form-label-sm mb-1">Pagador</label>
                  <select
                    className="form-select form-select-sm"
                    value={
                      datos.pagador_id != null && datos.pagador_id !== ""
                        ? String(datos.pagador_id)
                        : ""
                    }
                    onChange={(e) =>
                      cambiarDato(
                        "pagador_id",
                        e.target.value ? Number(e.target.value) : null,
                        true
                      )
                    }
                    disabled={disabled}
                  >
                    <option value="">Seleccione…</option>
                    {pagadorOptions.map((opt) => (
                      <option key={opt.id} value={String(opt.id)}>
                        {opt.nombre}
                      </option>
                    ))}
                  </select>
                  {renderEstado("pagador_id")}
                </div>
              </>
            )}

            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">Compañía</label>
              <select
                className="form-select form-select-sm"
                value={
                  datos.compania_id != null && datos.compania_id !== ""
                    ? String(datos.compania_id)
                    : ""
                }
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
                  {companiesLoading
                    ? "Cargando…"
                    : companies.length === 0
                      ? "Sin compañías disponibles"
                      : "Seleccione…"}
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
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
              <DateInputWithCalendar
                size="sm"
                valueIso={toDateInput(datos.fecha_activacion)}
                minIso="1900-01-01"
                maxIso="2099-12-31"
                disabled={disabled}
                onChangeIso={(iso) =>
                  cambiarDato("fecha_activacion", iso || null, true)
                }
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
                {optionsWithCurrent(TIPO_PAGO_OPTIONS, datos.tipo_pago).map(
                  (opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  )
                )}
              </select>
              {renderEstado("tipo_pago")}
            </div>

            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">Cobertura</label>
              <select
                className="form-select form-select-sm"
                value={datos.estado_cobertura ?? "Sí"}
                onChange={(e) =>
                  cambiarDato("estado_cobertura", e.target.value || null, true)
                }
                disabled={disabled}
              >
                <option value="">Seleccione…</option>
                {optionsWithCurrent(
                  ESTADO_COBERTURA_OPTIONS,
                  datos.estado_cobertura ?? "Sí"
                ).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {renderEstado("estado_cobertura")}
            </div>

            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">
                Año de cobertura
              </label>
              <input
                type="number"
                min="2000"
                max="2100"
                className="form-control form-control-sm"
                value={
                  datos.ano_cobertura != null && datos.ano_cobertura !== ""
                    ? datos.ano_cobertura
                    : anioDestino
                }
                placeholder={String(anioDestino)}
                onChange={(e) => {
                  const raw = e.target.value;
                  cambiarDato(
                    "ano_cobertura",
                    raw === "" ? null : Number(raw)
                  );
                }}
                onBlur={() => guardarPendienteAhora("ano_cobertura")}
                disabled={disabled}
              />
              {renderEstado("ano_cobertura")}
            </div>
          </div>
        </div>
      )}

      {!esDental && (
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
                if (field === "genero") {
                  return renderClienteSelectField(
                    field,
                    label,
                    GENERO_OPTIONS,
                    normalizeGeneroForSelect
                  );
                }
                return renderClienteTextField(field, label, type);
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Estatus migratorio</div>
            <div className="row g-2 mb-3">
              {CLIENTE_FIELDS_MIGRATORIO.map(([field, label, type]) => {
                if (field === "status") {
                  return renderClienteSelectField(
                    field,
                    label,
                    STATUS_MIGRATORIO_OPTIONS,
                    normalizeStatusMigratorioForSelect
                  );
                }
                return renderClienteTextField(field, label, type);
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Dirección</div>
            <div className="row g-2 mb-3">
              {CLIENTE_FIELDS_DIRECCION.map(([field, label, type]) => {
                const actual = clienteActual[field];
                const key = `cliente.${field}`;
                const esDireccionCalculada = field === "direccion";

                if (field === "dir_correspondencia") {
                  return (
                    <div className="col-12" key={field}>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-9">
                          <label className="form-label form-label-sm mb-1">
                            {label}
                          </label>
                          <input
                            type={type}
                            className="form-control form-control-sm"
                            value={datos.cliente?.[field] ?? ""}
                            placeholder={String(actual ?? "")}
                            onChange={(e) =>
                              cambiarCliente(field, e.target.value)
                            }
                            onBlur={() => guardarPendienteAhora(key)}
                            disabled={disabled}
                          />
                          {renderClienteBorradorHint(field, actual)}
                          {renderEstado(key)}
                        </div>
                        <div className="col-md-3 d-flex align-items-center pb-4">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`pre-copy-dir-${item.id}`}
                              checked={copiarDir}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCopiarDir(checked);
                                if (checked) {
                                  cambiarCliente(
                                    "dir_correspondencia",
                                    resolverDireccionCliente(),
                                    true
                                  );
                                }
                              }}
                              disabled={disabled}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`pre-copy-dir-${item.id}`}
                            >
                              Copiar Dirección
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

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
                          const direccionCalculada = resolverDireccionCliente({
                            [field]: value,
                          });
                          cambiarCliente("direccion", direccionCalculada);
                          if (copiarDir) {
                            cambiarCliente(
                              "dir_correspondencia",
                              direccionCalculada
                            );
                          }
                        }
                      }}
                      onBlur={() => {
                        if (esDireccionCalculada) return;
                        guardarPendienteAhora(key);
                        if (DIRECCION_FORMULA_FIELDS.has(field)) {
                          guardarPendienteAhora("cliente.direccion");
                          if (copiarDir) {
                            guardarPendienteAhora("cliente.dir_correspondencia");
                          }
                        }
                      }}
                      disabled={disabled || esDireccionCalculada}
                      readOnly={esDireccionCalculada}
                    />
                    {esDireccionCalculada ? (
                      <div className="form-text">Se calcula automáticamente</div>
                    ) : (
                      renderClienteBorradorHint(field, actual)
                    )}
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Datos de contacto</div>
            <div className="row g-2 mb-3">
              <div className="col-12">
                <label className="form-label form-label-sm mb-1">Teléfonos</label>
                <TelefonosPro
                  value={telefonosValue}
                  onChange={(arr) => {
                    const cleaned = toApiPhones(arr);
                    const legacy = toLegacyFields(cleaned);
                    cambiarClienteCampos(
                      {
                        telefonos: cleaned,
                        telefono: legacy.telefono || null,
                        secundario: legacy.secundario || null,
                        whatsapp_num: legacy.whatsapp_num || null,
                      },
                      "cliente.telefonos"
                    );
                  }}
                  readOnly={disabled}
                />
                <div className="form-text">
                  {Array.isArray(clienteActual.telefonos) &&
                  clienteActual.telefonos.length > 0
                    ? `Actual: ${clienteActual.telefonos.length} teléfono(s)`
                    : clienteActual.telefono
                      ? `Actual: ${clienteActual.telefono}`
                      : "Sin valor actual"}
                </div>
                {renderEstado("cliente.telefonos")}
              </div>

              {CLIENTE_FIELDS_CONTACTO.map(([field, label, type]) => {
                if (CLIENTE_PHONE_LEGACY_FIELDS.has(field)) return null;

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

                if (field === "idioma") {
                  return (
                    <div className="col-md-4" key={field}>
                      <label className="form-label form-label-sm mb-1">
                        {label}
                      </label>
                      <LanguageSelect
                        name="idioma"
                        value={datos.cliente?.[field] ?? ""}
                        onChange={(e) =>
                          cambiarCliente(field, e.target.value || null, true)
                        }
                        disabled={disabled}
                        className="form-select form-select-sm"
                        placeholder="Seleccione…"
                      />
                      {renderClienteBorradorHint(field, actual)}
                      {renderEstado(key)}
                    </div>
                  );
                }

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
                    {renderClienteBorradorHint(field, actual)}
                    {renderEstado(key)}
                  </div>
                );
              })}
            </div>

            <div className="text-muted small fw-semibold mb-2">Empleo e ingreso</div>
            <div className="row g-2">
              {(() => {
                const valorEmpleo = (field) => {
                  if (hasBorradorClienteField(draftCliente, field)) {
                    const v = draftCliente[field];
                    return v === null || v === undefined ? "" : v;
                  }
                  return clienteActual[field] ?? "";
                };
                const moneyValue = (field) => {
                  const v = datos.cliente?.[field];
                  if (v === null || v === undefined) return "";
                  return v;
                };

                return (
                  <>
                    <div className="col-md-6">
                      <label className="form-label form-label-sm mb-1">
                        Tipo de ingreso
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={datos.cliente?.tipo_ingreso ?? ""}
                        onChange={(e) =>
                          cambiarCliente(
                            "tipo_ingreso",
                            e.target.value || null,
                            true
                          )
                        }
                        disabled={disabled}
                      >
                        <option value="">Seleccione…</option>
                        {optionsWithCurrent(
                          TIPO_INGRESO_OPTIONS,
                          datos.cliente?.tipo_ingreso || clienteActual.tipo_ingreso
                        ).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">{renderClienteBorradorHint("tipo_ingreso", clienteActual.tipo_ingreso)}</div>
                      {renderEstado("cliente.tipo_ingreso")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label form-label-sm mb-1">
                        Actividad económica
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={datos.cliente?.actividad_economica ?? ""}
                        placeholder={String(clienteActual.actividad_economica ?? "")}
                        onChange={(e) =>
                          cambiarCliente("actividad_economica", e.target.value)
                        }
                        onBlur={() =>
                          guardarPendienteAhora("cliente.actividad_economica")
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "actividad_economica",
                          clienteActual.actividad_economica
                        )}
                      </div>
                      {renderEstado("cliente.actividad_economica")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label form-label-sm mb-1">
                        Empleador
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={datos.cliente?.empleador ?? ""}
                        placeholder={
                          String(clienteActual.empleador ?? "") ||
                          "Nombre de la empresa"
                        }
                        onChange={(e) =>
                          cambiarCliente("empleador", e.target.value)
                        }
                        onBlur={() => guardarPendienteAhora("cliente.empleador")}
                        disabled={disabled}
                      />
                      <div className="form-text">{renderClienteBorradorHint("empleador", clienteActual.empleador)}</div>
                      {renderEstado("cliente.empleador")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label form-label-sm mb-1">
                        Teléfono del empleador
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={datos.cliente?.telefono_empleador ?? ""}
                        placeholder={String(
                          clienteActual.telefono_empleador ?? ""
                        )}
                        onChange={(e) =>
                          cambiarCliente("telefono_empleador", e.target.value)
                        }
                        onBlur={() =>
                          guardarPendienteAhora("cliente.telefono_empleador")
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "telefono_empleador",
                          clienteActual.telefono_empleador
                        )}
                      </div>
                      {renderEstado("cliente.telefono_empleador")}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label form-label-sm mb-1">
                        Periodo de ingreso
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={datos.cliente?.periodo_ingreso ?? ""}
                        onChange={(e) => {
                          const value = e.target.value || null;
                          const anual = toAnnualMoney(
                            value,
                            valorEmpleo("ingreso_por_periodo")
                          );
                          cambiarClienteCampos(
                            {
                              periodo_ingreso: value,
                              ingreso_anual: anual,
                            },
                            "cliente.periodo_ingreso",
                            true
                          );
                        }}
                        disabled={disabled}
                      >
                        <option value="">Seleccione…</option>
                        {optionsWithCurrent(
                          PERIODO_INGRESO_OPTIONS,
                          datos.cliente?.periodo_ingreso ||
                            clienteActual.periodo_ingreso
                        ).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "periodo_ingreso",
                          clienteActual.periodo_ingreso
                        )}
                      </div>
                      {renderEstado("cliente.periodo_ingreso")}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label form-label-sm mb-1">
                        Ingreso por periodo ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className="form-control form-control-sm"
                        value={moneyValue("ingreso_por_periodo")}
                        placeholder={String(
                          clienteActual.ingreso_por_periodo ?? ""
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === "" ? null : Number(raw);
                          const anual = toAnnualMoney(
                            valorEmpleo("periodo_ingreso"),
                            value
                          );
                          cambiarClienteCampos(
                            {
                              ingreso_por_periodo: value,
                              ingreso_anual: anual,
                            },
                            "cliente.ingreso_por_periodo"
                          );
                        }}
                        onBlur={() =>
                          guardarPendienteAhora("cliente.ingreso_por_periodo")
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "ingreso_por_periodo",
                          clienteActual.ingreso_por_periodo
                        )}
                      </div>
                      {renderEstado("cliente.ingreso_por_periodo")}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label form-label-sm mb-1">
                        Ingreso anual ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className="form-control form-control-sm"
                        value={moneyValue("ingreso_anual")}
                        placeholder={String(clienteActual.ingreso_anual ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          cambiarCliente(
                            "ingreso_anual",
                            raw === "" ? null : Number(raw)
                          );
                        }}
                        onBlur={() =>
                          guardarPendienteAhora("cliente.ingreso_anual")
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "ingreso_anual",
                          clienteActual.ingreso_anual
                        )}
                      </div>
                      {renderEstado("cliente.ingreso_anual")}
                    </div>

                    <div className="col-12">
                      <label className="form-label form-label-sm mb-1">
                        Nota de ingreso ocasional
                      </label>
                      <textarea
                        rows={2}
                        className="form-control form-control-sm"
                        value={datos.cliente?.nota_ingreso_ocasional ?? ""}
                        placeholder={String(
                          clienteActual.nota_ingreso_ocasional ?? ""
                        )}
                        onChange={(e) =>
                          cambiarCliente(
                            "nota_ingreso_ocasional",
                            e.target.value
                          )
                        }
                        onBlur={() =>
                          guardarPendienteAhora("cliente.nota_ingreso_ocasional")
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "nota_ingreso_ocasional",
                          clienteActual.nota_ingreso_ocasional
                        )}
                      </div>
                      {renderEstado("cliente.nota_ingreso_ocasional")}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label form-label-sm mb-1">
                        Periodo de ingreso ocasional
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={datos.cliente?.periodo_ingreso_ocasional ?? ""}
                        onChange={(e) => {
                          const value = e.target.value || null;
                          const anual = toAnnualMoney(
                            value,
                            valorEmpleo("ingreso_por_periodo_ocasional")
                          );
                          cambiarClienteCampos(
                            {
                              periodo_ingreso_ocasional: value,
                              ingreso_ocasional_anual: anual,
                            },
                            "cliente.periodo_ingreso_ocasional",
                            true
                          );
                        }}
                        disabled={disabled}
                      >
                        <option value="">Seleccione…</option>
                        {optionsWithCurrent(
                          PERIODO_INGRESO_OPTIONS,
                          datos.cliente?.periodo_ingreso_ocasional ||
                            clienteActual.periodo_ingreso_ocasional
                        ).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "periodo_ingreso_ocasional",
                          clienteActual.periodo_ingreso_ocasional
                        )}
                      </div>
                      {renderEstado("cliente.periodo_ingreso_ocasional")}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label form-label-sm mb-1">
                        Ingreso por periodo ocasional ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className="form-control form-control-sm"
                        value={moneyValue("ingreso_por_periodo_ocasional")}
                        placeholder={String(
                          clienteActual.ingreso_por_periodo_ocasional ?? ""
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === "" ? null : Number(raw);
                          const anual = toAnnualMoney(
                            valorEmpleo("periodo_ingreso_ocasional"),
                            value
                          );
                          cambiarClienteCampos(
                            {
                              ingreso_por_periodo_ocasional: value,
                              ingreso_ocasional_anual: anual,
                            },
                            "cliente.ingreso_por_periodo_ocasional"
                          );
                        }}
                        onBlur={() =>
                          guardarPendienteAhora(
                            "cliente.ingreso_por_periodo_ocasional"
                          )
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "ingreso_por_periodo_ocasional",
                          clienteActual.ingreso_por_periodo_ocasional
                        )}
                      </div>
                      {renderEstado("cliente.ingreso_por_periodo_ocasional")}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label form-label-sm mb-1">
                        Ingreso ocasional anual ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className="form-control form-control-sm"
                        value={moneyValue("ingreso_ocasional_anual")}
                        placeholder={String(
                          clienteActual.ingreso_ocasional_anual ?? ""
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          cambiarCliente(
                            "ingreso_ocasional_anual",
                            raw === "" ? null : Number(raw)
                          );
                        }}
                        onBlur={() =>
                          guardarPendienteAhora("cliente.ingreso_ocasional_anual")
                        }
                        disabled={disabled}
                      />
                      <div className="form-text">
                        {renderClienteBorradorHint(
                          "ingreso_ocasional_anual",
                          clienteActual.ingreso_ocasional_anual
                        )}
                      </div>
                      {renderEstado("cliente.ingreso_ocasional_anual")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label form-label-sm mb-1">
                        Empresa
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={datos.cliente?.empresa ?? ""}
                        placeholder={String(clienteActual.empresa ?? "")}
                        onChange={(e) =>
                          cambiarCliente("empresa", e.target.value)
                        }
                        onBlur={() => guardarPendienteAhora("cliente.empresa")}
                        disabled={disabled}
                      />
                      <div className="form-text">{renderClienteBorradorHint("empresa", clienteActual.empresa)}</div>
                      {renderEstado("cliente.empresa")}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="border-top mt-4 pt-1">
              {clienteIdMediosPago ? (
                <MediosPagoSection
                  clienteId={clienteIdMediosPago}
                  isOpen={contactoAbierto}
                  clienteDireccion={direccionClienteMediosPago}
                />
              ) : (
                <>
                  <div className="text-muted small fw-semibold mb-2">
                    Medios de pago
                  </div>
                  <div className="text-muted small">
                    Este miembro aún no tiene un cliente vinculado en el sistema.
                    Los medios de pago se podrán administrar después de consolidar
                    o al vincular un cliente existente.
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default PreRenovacionItemCard;
