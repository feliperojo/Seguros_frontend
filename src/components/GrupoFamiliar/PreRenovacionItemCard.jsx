/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import apiRequest from "../../services/api";
import useCompanies from "../../hooks/useCompanies";
import { filterCompaniesForProducto, resolveProductoKeyFromCoberturaTipo } from "../../services/companies";
import LanguageSelect from "../selects/LanguageSelect";
import MdyDashDateInput from "../common/MdyDashDateInput";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import TelefonosPro from "../fase2/TelefonosPro";
import { buildDireccion } from "../../utils/direccion";
import { buildNombreCompleto } from "../../utils/nombre";
import { formatDateForDisplay, formatDateMMDDYYYY } from "../../utils/formatters";
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
import {
  isItemAltaEnLote,
  isItemProductoNuevo,
} from "../../utils/preRenovacionDental";
import {
  resolveEnabledFields,
  shouldShowConfiguredField,
} from "../../utils/coverageFieldConfig";
import {
  COBERTURA_DEFINIDA,
} from "../../utils/coberturaDefinida";
import { computeAnnual } from "../../services/ingresos";
import MediosPagoSection from "../MediosPagoSection";
import {
  hasBorradorClienteField,
  isBorradorClienteCleared,
  normalizeClienteBorradorValue,
} from "../../utils/preRenovacionCopy";
import "../../styles/PreRenovacionModal.css";

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
const PARENTESCO_OPTIONS = [
  "Tomador",
  "Conyuge",
  "Hijo/a",
  "Hermano",
  "Padre",
  "Madre",
  "Nieto",
  "Abuelo/a",
  "Suegro/a",
  "Tio/a",
  "Sobrino/a",
];

const MOTIVO_RETIRO_NO_RENOVACION = "NO RENOVACION";
const MOTIVO_RETIRO_TRASLADO = "TRASLADO A OTRO GRUPO FAMILIAR";

const motivoRetiroAutomatico = (motivoActual) => {
  const actual = String(motivoActual ?? "").trim();
  if (actual === MOTIVO_RETIRO_TRASLADO) return MOTIVO_RETIRO_TRASLADO;
  return MOTIVO_RETIRO_NO_RENOVACION;
};

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

/** Cierre fiscal del año origen: siempre 31 de diciembre. */
const fechaRetiroCierreAnioOrigen = (anioOrigen, anioDestino) => {
  const origen = Number(anioOrigen) || Number(anioDestino) - 1;
  return `${origen}-12-31`;
};

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
  anioOrigen,
  onItemUpdated,
  onItemRemoved,
  attemptedConsolidar = false,
  onSaveStateChange,
  edicionBloqueada = false,
  pagadorOptions = [],
  alertaDentalSinSalud = false,
  alertaCascadaSalud = false,
  coverageFieldConfig = null,
}) => {
  const [renovar, setRenovar] = useState(Boolean(item?.renovar ?? true));
  const [datos, setDatos] = useState(() => {
    const borrador = item?.datos_borrador || {};
    return {
      ...borrador,
      // Lotes antiguos pueden no tener parentesco en el JSON; usar el de la cobertura.
      parentesco:
        borrador.parentesco ?? item?.cobertura?.parentesco ?? "",
      cliente: { ...(borrador.cliente || {}) },
    };
  });
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
    // checked = true → renovar; false → retirar miembro (no renovar)
    setRenovar(checked);
    if (!checked) {
      const cierre = fechaRetiroCierreAnioOrigen(anioOrigen, anioDestino);
      const definida = COBERTURA_DEFINIDA.TERMINADO;
      const motivo = motivoRetiroAutomatico(datos.motivo_retiro);
      setDatos((prev) => ({
        ...prev,
        fecha_retiro: cierre,
        cobertura_definida: definida,
        motivo_retiro: motivoRetiroAutomatico(prev.motivo_retiro),
      }));
      guardarCambio({ renovar: false }, "renovar", true);
      guardarCambio(
        {
          fecha_retiro: cierre,
          cobertura_definida: definida,
          motivo_retiro: motivo,
        },
        "fecha_retiro"
      );
      return;
    }
    guardarCambio({ renovar: true }, "renovar", true);
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

  const esProductoNuevo = isItemProductoNuevo(item);
  const esAltaEnLote = isItemAltaEnLote(item);
  const cobertura = item?.cobertura || {};
  const coberturaTipo =
    datos?.cobertura_tipo ?? cobertura?.cobertura_tipo ?? null;
  const esDental = isDentalCoberturaTipo(coberturaTipo);
  const visibleCoverageFields = resolveEnabledFields(
    coverageFieldConfig,
    esDental ? COBERTURA_TIPO_DENTAL_MS : coberturaTipo
  );
  const showCoverageField = (fieldKey) =>
    shouldShowConfiguredField(visibleCoverageFields, fieldKey);
  const productoCompania = resolveProductoKeyFromCoberturaTipo(coberturaTipo);
  const companies = useMemo(
    () =>
      filterCompaniesForProducto(allCompanies, productoCompania, {
        includeId: datos?.compania_id ?? cobertura?.compania_id,
        soloActivas: true,
      }),
    [
      allCompanies,
      productoCompania,
      datos?.compania_id,
      cobertura?.compania_id,
    ]
  );
  const etiquetaProducto = esDental ? COBERTURA_TIPO_DENTAL_MS : "Salud MS";
  const iconoProducto = esDental ? "fas fa-tooth" : "fas fa-shield-alt";
  // Renovación normal: referencia en vivo = cobertura.cliente
  // Miembro nuevo de cliente existente: referencia en vivo = cliente_existente (BD)
  // Fallback: snapshot guardado en el borrador
  const clienteActual = esAltaEnLote
    ? item?.cliente_existente || item?.datos_borrador?.cliente || {}
    : cobertura?.cliente || {};

  const pickParteDireccion = (field, overrides = {}) => {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) {
      const v = overrides[field];
      return v == null ? "" : v;
    }
    const draft = datos.cliente || {};
    if (isBorradorClienteCleared(draft, field)) return "";
    if (hasBorradorClienteField(draft, field)) {
      return draft[field] ?? "";
    }
    return clienteActual[field] ?? "";
  };

  const resolverDireccionCliente = (overrides = {}) => {
    const base = {
      calle: pickParteDireccion("calle", overrides),
      apto: pickParteDireccion("apto", overrides),
      ciudad: pickParteDireccion("ciudad", overrides),
      condado: pickParteDireccion("condado", overrides),
      estado: pickParteDireccion("estado", overrides),
      codigo_postal: pickParteDireccion("codigo_postal", overrides),
    };
    const armada = buildDireccion(base);
    if (armada) return armada;
    const draft = datos.cliente || {};
    if (isBorradorClienteCleared(draft, "direccion")) return "";
    if (hasBorradorClienteField(draft, "direccion")) {
      return draft.direccion || "";
    }
    return clienteActual.direccion || "";
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

  const nombre = esAltaEnLote
    ? datos.cliente?.nombre_completo ||
      item?.cliente_existente?.nombre_completo ||
      item?.datos_borrador?.cliente?.nombre_completo ||
      (esProductoNuevo
        ? `Dental MS #${item?.id || "?"}`
        : `Miembro nuevo #${item?.id || "?"}`)
    : clienteActual.nombre_completo ||
      [clienteActual.primer_nombre, clienteActual.apellidos]
        .filter(Boolean)
        .join(" ") ||
      `Cobertura #${item?.cobertura_id || "?"}`;
  const requiereRetiro =
    !esAltaEnLote && !renovar && Boolean(cobertura.activo);
  const fechaRetiroCierre = fechaRetiroCierreAnioOrigen(anioOrigen, anioDestino);
  const mostrarPoliza = esAltaEnLote || renovar;
  const retiroMotivoInvalido =
    attemptedConsolidar &&
    requiereRetiro &&
    !String(datos.motivo_retiro ?? "").trim();
  const disabled = bloqueado || edicionBloqueada;
  const campoClienteVacio = (field) =>
    isBorradorClienteCleared(draftCliente, field);

  // Retiro automático: fecha 31/12, estado Terminado, motivo NO RENOVACION
  // (o TRASLADO si el sistema ya lo marcó).
  useEffect(() => {
    if (disabled || !requiereRetiro) return;
    const motivoEsperado = motivoRetiroAutomatico(datos.motivo_retiro);
    const fechaOk = toDateInput(datos.fecha_retiro) === fechaRetiroCierre;
    const estadoOk = datos.cobertura_definida === COBERTURA_DEFINIDA.TERMINADO;
    const motivoOk = String(datos.motivo_retiro ?? "").trim() === motivoEsperado;
    if (fechaOk && estadoOk && motivoOk) return;

    const patch = {
      fecha_retiro: fechaRetiroCierre,
      cobertura_definida: COBERTURA_DEFINIDA.TERMINADO,
      motivo_retiro: motivoEsperado,
    };
    setDatos((prev) => ({ ...prev, ...patch }));
    guardarCambio(patch, "fecha_retiro");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alinear defaults de retiro
  }, [
    requiereRetiro,
    fechaRetiroCierre,
    disabled,
    datos.fecha_retiro,
    datos.cobertura_definida,
    datos.motivo_retiro,
  ]);

  const placeholderActual = (field, actual, fallback = "") => {
    if (campoClienteVacio(field)) return "";
    if (actual != null && actual !== "") return String(actual);
    return fallback;
  };

  const classInputCliente = (field, extra = "") =>
    ["form-control", "form-control-sm", campoClienteVacio(field) ? "pr-field--cleared" : "", extra]
      .filter(Boolean)
      .join(" ");

  const classSelectCliente = (field, extra = "") =>
    ["form-select", "form-select-sm", campoClienteVacio(field) ? "pr-field--cleared" : "", extra]
      .filter(Boolean)
      .join(" ");

  const aplicarCampoCliente = (field, value) => {
    if (DIRECCION_FORMULA_FIELDS.has(field)) {
      const direccionCalculada = resolverDireccionCliente({ [field]: value });
      const campos = { [field]: value, direccion: direccionCalculada };
      if (copiarDir) campos.dir_correspondencia = direccionCalculada;
      cambiarClienteCampos(campos, `cliente.${field}`, true);
      return;
    }
    if (NOMBRE_FORMULA_FIELDS.has(field)) {
      const pickNombre = (f) => {
        if (f === field) return value == null ? "" : value;
        if (isBorradorClienteCleared(draftCliente, f)) return "";
        if (hasBorradorClienteField(draftCliente, f)) {
          return draftCliente[f] ?? "";
        }
        return clienteActual[f] ?? "";
      };
      cambiarClienteCampos(
        {
          [field]: value,
          nombre_completo: buildNombreCompleto({
            primer_nombre: pickNombre("primer_nombre"),
            segundo_nombre: pickNombre("segundo_nombre"),
            apellidos: pickNombre("apellidos"),
          }),
        },
        `cliente.${field}`,
        true
      );
      return;
    }
    cambiarCliente(field, value, true);
  };

  const limpiarClienteParaRenovacion = (field) => {
    aplicarCampoCliente(field, null);
  };

  const restaurarClienteParaRenovacion = (field, actual) => {
    const value = actual === undefined || actual === "" ? null : actual;
    aplicarCampoCliente(field, value);
  };

  const renderClienteBorradorHint = (field, actual, { skipClear = false } = {}) => {
    if (campoClienteVacio(field)) {
      return (
        <div className="pr-field-hint pr-field-hint--cleared">
          <span>Se dejará vacío al consolidar.</span>
          {!disabled && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={() => restaurarClienteParaRenovacion(field, actual)}
            >
              Restaurar
            </button>
          )}
        </div>
      );
    }

    const hasActual =
      actual !== null && actual !== undefined && actual !== "";

    if (!hasBorradorClienteField(draftCliente, field) && hasActual && !skipClear) {
      return (
        <div className="pr-field-hint">
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
          className={classSelectCliente(field)}
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
            className={campoClienteVacio(field) ? "pr-field--cleared" : ""}
            placeholder={campoClienteVacio(field) ? "" : undefined}
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
          className={classInputCliente(field)}
          value={datos.cliente?.[field] ?? ""}
          placeholder={placeholderActual(field, actual)}
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

  const handleQuitarAltaEnLote = async () => {
    if (disabled) return;
    setEstadosGuardado((prev) => ({ ...prev, quitar: "guardando" }));
    try {
      const response = await apiRequest(
        `/pre-renovacion/items/${item.id}`,
        "DELETE"
      );
      const deletedIds = Array.isArray(response?.deleted_ids)
        ? response.deleted_ids
        : [item.id];
      onItemRemoved?.(deletedIds);
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
      className={`pr-item${esDental ? " pr-item--dental" : ""}${
        !esAltaEnLote && !renovar ? " pr-item--no-renovar" : ""
      }`}
    >
      {!esAltaEnLote && !renovar && (
        <div className="pr-item__no-renovar-banner">
          <i className="fas fa-exclamation-triangle me-2" aria-hidden="true" />
          No se renovará · Fecha de expiración (cierre fiscal):{" "}
          <strong>{formatDateMMDDYYYY(fechaRetiroCierre)}</strong>
        </div>
      )}
      <div className="pr-item__header">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <div className="pr-item__name">{nombre}</div>
              <span
                className={`badge pr-item__badge ${esDental ? "bg-info" : "bg-primary"}`}
                title={
                  esDental ? "Producto Dental MS" : "Producto Salud MS"
                }
              >
                <i className={`${iconoProducto} me-1`} aria-hidden="true" />
                {etiquetaProducto}
              </span>
              {!esAltaEnLote && !renovar && (
                <span className="badge bg-warning text-dark pr-item__badge">
                  No renovará
                </span>
              )}
            </div>
            {esAltaEnLote ? (
              <span className="badge bg-info text-white">
                {esProductoNuevo
                  ? `Dental MS nuevo para ${anioDestino}`
                  : `Miembro nuevo para ${anioDestino}`}
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
            {esAltaEnLote ? (
              <div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleQuitarAltaEnLote}
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
                    id={`pre-retirar-${item.id}`}
                    checked={!renovar}
                    onChange={(e) => cambiarRenovar(!e.target.checked)}
                    disabled={disabled}
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`pre-retirar-${item.id}`}
                  >
                    Retirar miembro
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

      {alertaDentalSinSalud && (renovar || esProductoNuevo) && (
        <div className="alert alert-danger rounded-0 mb-0 py-2">
          <strong>Dental no se puede renovar sin salud.</strong>{" "}
          {esProductoNuevo
            ? "Quita este Dental MS o marca Salud MS de este miembro para renovar."
            : "La cobertura de Salud MS de este miembro está marcada para no renovar. Desmarca Dental o marca Salud para renovar."}
        </div>
      )}

      {alertaCascadaSalud && !renovar && (
        <div className="alert alert-warning rounded-0 mb-0 py-2">
          <strong>Cascada:</strong> al no renovar Salud MS, Dental MS activo
          del mismo miembro se retirará automáticamente al consolidar.
        </div>
      )}

      {!esAltaEnLote && renovar && !cobertura.activo && (
        <div className="alert alert-warning rounded-0 mb-0 py-2">
          <strong>⚠ Esta cobertura ya no está activa</strong> — probablemente fue
          cancelada o retirada después de agregarse a esta pre-renovación. Revisa si
          corresponde marcar &quot;Retirar miembro&quot;.
        </div>
      )}

      {requiereRetiro && datos.motivo_retiro === MOTIVO_RETIRO_TRASLADO && (
        <div className="alert alert-info rounded-0 mb-0 py-2">
          Este miembro ya está reservado en otro grupo para el año destino.
          Aquí se cierra el año en curso; no se genera póliza nueva en este
          grupo.
        </div>
      )}

      {requiereRetiro && retiroMotivoInvalido && (
        <div className="px-3 py-2 border-bottom text-danger small">
          Falta confirmar el retiro para poder consolidar.
        </div>
      )}
      {requiereRetiro &&
        estadosGuardado.fecha_retiro &&
        estadosGuardado.fecha_retiro !== "limpio" && (
          <div className="px-3 py-1">{renderEstado("fecha_retiro")}</div>
        )}

      {mostrarPoliza && (
        <div className="pr-item__body border-bottom">
          <p className="pr-item__section-title">
            Datos de la póliza para {anioDestino}
          </p>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label form-label-sm mb-1">Parentesco</label>
              <select
                className="form-select form-select-sm"
                value={datos.parentesco || ""}
                onChange={(e) =>
                  cambiarDato("parentesco", e.target.value || null, true)
                }
                disabled={disabled}
              >
                <option value="">Seleccione…</option>
                {optionsWithCurrent(
                  PARENTESCO_OPTIONS,
                  datos.parentesco
                ).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "Conyuge" ? "Cónyuge" : opt}
                  </option>
                ))}
              </select>
              {renderEstado("parentesco")}
            </div>

            {TEXT_FIELDS.filter(([field]) => {
              if (esDental && field === "grupo") return false;
              return showCoverageField(field);
            }).map(([field, label, type, col]) => (
              <div className={col} key={field}>
                <label className="form-label form-label-sm mb-1">
                  {label}
                </label>
                <input
                  type={type}
                  step={field === "precio" ? "0.01" : undefined}
                  min={type === "number" ? "0" : undefined}
                  className="form-control form-control-sm"
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
                {renderEstado(field)}
              </div>
            ))}

            {!esDental && showCoverageField("metal") && (
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
            )}

            {!esDental && showCoverageField("red") && (
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
            )}

            {esDental && showCoverageField("agente") && (
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
            )}
            {esDental && showCoverageField("pagador_id") && (
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
            )}

            {showCoverageField("compania_id") && (
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
            )}

            {showCoverageField("fecha_activacion") && (
            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">
                Fecha de activación
              </label>
              <DateInputWithCalendar
                size="sm"
                valueIso={toDateInput(datos.fecha_activacion)}
                minIso={`${anioDestino}-01-01`}
                maxIso={`${anioDestino}-12-31`}
                disabled={disabled}
                onChangeIso={(iso) =>
                  cambiarDato("fecha_activacion", iso || null, true)
                }
              />
              {renderEstado("fecha_activacion")}
              <div className="form-text">Debe pertenecer a {anioDestino}.</div>
            </div>
            )}

            {showCoverageField("tipo_pago") && (
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
            )}

            {showCoverageField("estado_cobertura") && (
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
            )}

            {showCoverageField("ano_cobertura") && (
            <div className="col-md-4">
              <label className="form-label form-label-sm mb-1">
                Año de cobertura
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={anioDestino}
                readOnly
                disabled
                title="El año de cobertura lo fija la consolidación al año destino"
              />
              <div className="form-text">
                Fijo al año destino {anioDestino} al consolidar.
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {!esDental && (
      <div className="pr-item__body">
        <button
          type="button"
          className="btn btn-link p-0 text-decoration-none pr-toggle-contacto"
          onClick={() => setContactoAbierto((prev) => !prev)}
          aria-expanded={contactoAbierto}
        >
          <i
            className={`fas fa-chevron-${contactoAbierto ? "up" : "down"} me-2`}
            aria-hidden="true"
          />
          Información del cliente
        </button>

        {contactoAbierto && (
          <div className="mt-2">
            <div className="pr-item__section-title">Datos principales</div>
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

            <div className="pr-item__section-title">Estatus migratorio</div>
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

            <div className="pr-item__section-title">Dirección</div>
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
                            className={classInputCliente(field)}
                            value={datos.cliente?.[field] ?? ""}
                            placeholder={placeholderActual(field, actual)}
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
                      className={classInputCliente(field)}
                      value={
                        esDireccionCalculada
                          ? resolverDireccionCliente()
                          : (datos.cliente?.[field] ?? "")
                      }
                      placeholder={
                        esDireccionCalculada
                          ? ""
                          : placeholderActual(field, actual)
                      }
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

            <div className="pr-item__section-title">Datos de contacto</div>
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
                        className={classSelectCliente(field)}
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
                      className={classInputCliente(field)}
                      value={datos.cliente?.[field] ?? ""}
                      placeholder={placeholderActual(field, actual)}
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

            <div className="pr-item__section-title">Empleo e ingreso</div>
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
                        className={classSelectCliente("tipo_ingreso")}
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
                        className={classInputCliente("actividad_economica")}
                        value={datos.cliente?.actividad_economica ?? ""}
                        placeholder={placeholderActual(
                          "actividad_economica",
                          clienteActual.actividad_economica
                        )}
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
                        className={classInputCliente("empleador")}
                        value={datos.cliente?.empleador ?? ""}
                        placeholder={placeholderActual(
                          "empleador",
                          clienteActual.empleador,
                          "Nombre de la empresa"
                        )}
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
                        className={classInputCliente("telefono_empleador")}
                        value={datos.cliente?.telefono_empleador ?? ""}
                        placeholder={placeholderActual(
                          "telefono_empleador",
                          clienteActual.telefono_empleador
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
                        className={classSelectCliente("periodo_ingreso")}
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
                        className={classInputCliente("ingreso_por_periodo")}
                        value={moneyValue("ingreso_por_periodo")}
                        placeholder={placeholderActual(
                          "ingreso_por_periodo",
                          clienteActual.ingreso_por_periodo
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
                        className={classInputCliente("ingreso_anual")}
                        value={moneyValue("ingreso_anual")}
                        placeholder={placeholderActual(
                          "ingreso_anual",
                          clienteActual.ingreso_anual
                        )}
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
                        className={classInputCliente("nota_ingreso_ocasional")}
                        value={datos.cliente?.nota_ingreso_ocasional ?? ""}
                        placeholder={placeholderActual(
                          "nota_ingreso_ocasional",
                          clienteActual.nota_ingreso_ocasional
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
                        className={classSelectCliente("periodo_ingreso_ocasional")}
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
                        className={classInputCliente("ingreso_por_periodo_ocasional")}
                        value={moneyValue("ingreso_por_periodo_ocasional")}
                        placeholder={placeholderActual(
                          "ingreso_por_periodo_ocasional",
                          clienteActual.ingreso_por_periodo_ocasional
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
                        className={classInputCliente("ingreso_ocasional_anual")}
                        value={moneyValue("ingreso_ocasional_anual")}
                        placeholder={placeholderActual(
                          "ingreso_ocasional_anual",
                          clienteActual.ingreso_ocasional_anual
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
                        className={classInputCliente("empresa")}
                        value={datos.cliente?.empresa ?? ""}
                        placeholder={placeholderActual(
                          "empresa",
                          clienteActual.empresa
                        )}
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
                  <div className="pr-item__section-title">
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
