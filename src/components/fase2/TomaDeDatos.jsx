import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaExclamationTriangle, FaMapMarkerAlt, FaQuestionCircle } from "react-icons/fa";
import { OverlayTrigger, Tooltip } from "react-bootstrap";

// Services
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import systemConfigService from "../../services/SystemConfigService";
import { computeAnnual, sanitizeMoneyInput, formatMoney2, parseMoney } from "../../services/ingresos";

// Components
import UserCoverageIcon from "../fase2/UserCoverageIcon";
import MdyDashDateInput from "../common/MdyDashDateInput";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import MemberModal from "./MemberModal";
import CopiarDatosModal, { ADDRESS_FIELDS } from "./CopiarDatosModal";
import { formatDisplayName } from "../../utils/names";
import ClienteExistenteModal from "../fase2/ClienteExistenteModal";
import CompanySelect from "../selects/CompanySelect";
import PayerSelect from "../selects/PayerSelect";
import LanguageSelect from "../selects/LanguageSelect";
import TelefonosPro from "./TelefonosPro";
import MediosPagoAccordionItem from "../MediosPagoAccordionItem";
import MediosPagoSection from "../MediosPagoSection";
import HistorialPlanCoberturaModal from "../coberturas/HistorialPlanCoberturaModal";

// Hooks
import { deriveCounts } from "../../utils/groupCounters";
import useCompanies from "../../hooks/useCompanies";

// Utils
import {
  formatSSN,
  formatUSCIS,
  formatPhone334,
  normalizeDateForInput,
} from "../../utils/formatters";
import {
  mergeClientePreferNonEmpty,
  unwrapClienteFromApi,
} from "../../utils/mergeClientePreferNonEmpty";
import {
  buildMemberFromClienteExistente,
  extractCoberturaFromCreateResponse,
} from "../../utils/buildMemberFromClienteExistente";
import { toLegacyFields } from "../../utils/phones";
import { resolveClienteTelefonos } from "../../utils/phone-mappers";
import { getTypeColor } from "../../utils/parentescoColors";
import { buildPayerOptions } from "../../utils/payers";
import {
  normalizeGeneroForSelect,
  normalizeStatusMigratorioForSelect,
} from "../../utils/clienteFieldNormalize";
import { STATUS_MIGRATORIO_OPTIONS } from "../../constants/statusMigratorio";
import {
  vigenteDesdeEstadoCobertura,
  isMedicareOrMedicaidEstado,
  clearedCoverageFieldsForMedicareMedicaid,
  isFechaActivacionPendiente,
  soloPermiteCopiarDireccion,
} from "../../utils/estadoPoliza";

/* =================== CONSTANTES =================== */
const NAME_FIELDS = new Set(["primer_nombre", "segundo_nombre", "apellidos"]);
const MONEY_FIELDS = new Set([
  "ingreso_por_periodo",
  "ingreso_anual",
  "ingreso_por_periodo_ocasional",
  "ingreso_ocasional_anual",
  "precio",
]);
const PHONE_FIELDS = new Set(["telefono", "secundario", "whatsapp_num", "telefono_empleador"]);

// Opciones de parentesco/tipo disponibles para los miembros
const PARENTESCO_OPTIONS = [
  { value: "Tomador", tipo: "Tomador", label: "Tomador" },
  { value: "Conyuge", tipo: "Conyuge", label: "Cónyuge" },
  { value: "Hijo/a", tipo: "Hijo/a", label: "Hijo/a" },
  { value: "Hermano", tipo: "Hermano", label: "Hermano" },
  { value: "Padre", tipo: "Padre", label: "Padre" },
  { value: "Madre", tipo: "Madre", label: "Madre" },
  { value: "Nieto", tipo: "Nieto", label: "Nieto" },
  { value: "Abuelo/a", tipo: "Abuelo/a", label: "Abuelo/a" },
  { value: "Suegro/a", tipo: "Suegro/a", label: "Suegro/a" },
  { value: "Tio/a", tipo: "Tio/a", label: "Tio/a" },
  { value: "Sobrino/a", tipo: "Sobrino/a", label: "Sobrino/a" }
];

const CLIENTE_FIELDS = new Set([
  "primer_nombre",
  "segundo_nombre",
  "apellidos",
  "fecha_nacimiento",
  "edad",
  "genero",
  "idioma",
  "pais_origen",
  // Campos antropométricos
  "peso",
  "altura",
  "pulgadas",
  "telefono",
  "secundario",
  "whatsapp_num",
  "email",
  "nota",
  "direccion",
  "calle",
  "apto",
  "ciudad",
  "estado",
  "codigo_postal",
  "condado",
  "dir_correspondencia",
  "social",
  "status",
  "auscis",
  "tarjeta_numero",
  "fecha_emision",
  "fecha_expiracion",
  "categoria",
  "tipo_ingreso",
  "actividad_economica",
  "empleador",
  "telefono_empleador",
  "periodo_ingreso",
  "ingreso_por_periodo",
  "ingreso_anual",
  "nota_ingreso_ocasional",
  "periodo_ingreso_ocasional",
  "ingreso_por_periodo_ocasional",
  "ingreso_ocasional_anual",
  "whatsapp",
  "telegram",
  "texto_sms"
]);

const ROOT_FIELDS = new Set([
  "parentesco",
  "estado_cobertura",
  "codigo_poliza",
  "policy_number",
  "vigencia",
  "tipo",
  "fecha_activacion",
  "ano_cobertura",
  "elegibilidad",
  "compania_id",
  "agente",
  "plan",
  "metal",
  "red",
  "pagador_id",
  "tipo_pago",
  "dia_pago",
  "precio",
  "fecha_cancelacion",
  "fecha_retiro",
  "nota_retiro",
  "grupo",
  "nota_cancel",
]);

const DUPLICATE_TO_ROOT = Array.from(CLIENTE_FIELDS);

/* =================== UTILIDADES =================== */
const isTomador = (m = {}) => {
  const v1 = String(m.tipo || "").toLowerCase();
  const v2 = String(m.parentesco || "").toLowerCase();
  return v1 === "tomador" || v2 === "tomador";
};

const toTitle = (s = "") =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());

const fullName = (m) => {
  const c = m?.cliente ? m.cliente : m;
  const composed = [c.primer_nombre?.trim(), c.segundo_nombre?.trim(), c.apellidos?.trim()]
    .filter(Boolean)
    .join(" ");
  const raw = composed || c.nombre_completo || m?.nombreCompleto || m?.nombre_completo || "";
  if (!raw) return "Sin nombre";
  return formatDisplayName(raw);
};

const calcAge = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
};

const getC = (m) => (m?.cliente ? m.cliente : m);

const buildDireccion = (src) =>
  [src.calle, src.apto, src.ciudad, src.condado, src.estado, src.codigo_postal]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const yaEstaEnElGrupo = (clienteId, members) =>
  members.some((m) => m.cliente_id === clienteId || m?.cliente?.id === clienteId);

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;

/* =================== COMPONENTE ACORDEÓN =================== */
const AccordionItem = ({ id, title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const renderChildren = () => {
    if (typeof children === "function") {
      return children(isOpen);
    }
    return children;
  };

  return (
    <div className="border rounded mb-2 bg-white">
      <button
        type="button"
        id={`accordion-btn-${id}`}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-100 border-0 px-3 py-2 d-flex align-items-center justify-content-between text-start ${
          isOpen ? "bg-primary bg-opacity-10 text-primary" : "bg-light text-body"
        }`}
        aria-expanded={isOpen}
        aria-controls={`accordion-panel-${id}`}
      >
        <div className="d-flex align-items-center gap-2">
          {icon && (
            <span className={isOpen ? "text-primary" : "text-secondary"}>{icon}</span>
          )}
          <span className={`small ${isOpen ? "fw-semibold" : "fw-medium"}`}>{title}</span>
        </div>
        <i
          className="fas fa-chevron-down small text-secondary"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {isOpen && (
        <div id={`accordion-panel-${id}`} className="px-3 pt-2 pb-3 border-top">
          {renderChildren()}
        </div>
      )}
    </div>
  );
};

/* =================== NORMALIZACIÓN =================== */
const clienteTieneNombreVisible = (c) => {
  if (!c || typeof c !== "object") return false;
  return !!(
    String(c.nombre_completo || "").trim() ||
    String(c.primer_nombre || c.nombre || "").trim() ||
    String(c.apellidos || c.apellido || "").trim()
  );
};

/** Hidrata cliente anidado (teléfonos, status, género) para TelefonosPro y selects */
const hydrateClienteForMember = (cli = {}, m = {}) => {
  const merged = { ...m, ...cli, telefonos: cli.telefonos ?? m.telefonos };
  const telefonos = resolveClienteTelefonos(merged, "us");
  const legacy = toLegacyFields(telefonos);

  return {
    ...cli,
    ...legacy,
    genero: normalizeGeneroForSelect(cli.genero ?? m.genero ?? ""),
    status: normalizeStatusMigratorioForSelect(cli.status ?? m.status ?? ""),
    telefonos,
    whatsapp: cli.whatsapp ?? m.whatsapp ?? false,
    telegram: cli.telegram ?? m.telegram ?? false,
    texto_sms: cli.texto_sms ?? m.texto_sms ?? false,
  };
};

const normalizeMember = (m, idx) => {
  if (m?.cliente && typeof m.cliente === "object" && clienteTieneNombreVisible(m.cliente)) {
    const cliente = hydrateClienteForMember(m.cliente, m);
    const primer = formatDisplayName(cliente.primer_nombre || m.primer_nombre || "");
    const segundo = formatDisplayName(cliente.segundo_nombre || m.segundo_nombre || "");
    const apell = formatDisplayName(cliente.apellidos || m.apellidos || "");
    const nombreCompleto = formatDisplayName(
      cliente.nombre_completo ||
        m.nombre_completo ||
        m.nombreCompleto ||
        [primer, segundo, apell].filter(Boolean).join(" ")
    );
    const clienteFormateado = {
      ...cliente,
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombre_completo: nombreCompleto,
    };
    return {
      ...m,
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombreCompleto,
      nombre_completo: nombreCompleto,
      activo: m.activo !== undefined && m.activo !== null ? m.activo : true,
      fecha_retiro: m.fecha_retiro ?? null,
      telefono: m.telefono || clienteFormateado.telefono,
      secundario: m.secundario || clienteFormateado.secundario,
      whatsapp_num: m.whatsapp_num || clienteFormateado.whatsapp_num,
      genero: normalizeGeneroForSelect(m.genero || clienteFormateado.genero),
      status: normalizeStatusMigratorioForSelect(m.status || clienteFormateado.status),
      whatsapp: m.whatsapp ?? clienteFormateado.whatsapp,
      telegram: m.telegram ?? clienteFormateado.telegram,
      texto_sms: m.texto_sms ?? clienteFormateado.texto_sms,
      cliente: clienteFormateado,
    };
  }

  const primerRaw = m.primer_nombre || "";
  const segundoRaw = m.segundo_nombre || "";
  const apellRaw = m.apellidos || "";
  const fecha = m.fecha_nacimiento || "";
  const edad = calcAge(fecha);
  const primer = toTitle(primerRaw);
  const segundo = toTitle(segundoRaw);
  const apell = toTitle(apellRaw);
  const nombre = formatDisplayName(
    m.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g, " ").trim()
  );

  return {
    id: m.id ?? idx + 1,
    cliente_id: m.cliente_id ?? m.id ?? null,
    cobertura_id: m.cobertura_id ?? null,
    parentesco: m.parentesco || m.tipo || "Tomador",
    tipo: m.tipo || m.parentesco || "Tomador",
    estado_cobertura: m.estado_cobertura || "Sí",
    activo: m.activo !== undefined && m.activo !== null ? m.activo : true,
    fecha_retiro: m.fecha_retiro ?? null,
    codigo_poliza: m.codigo_poliza || "",
    policy_number: m.policy_number || "",
    fecha_activacion: m.fecha_activacion || "",
    vigencia: m.vigencia || "",
    cobertura_tipo: m.cobertura_tipo || "Plan de salud",
    ano_cobertura: m.ano_cobertura || new Date().getFullYear(),
    plan: m.plan ?? null,
    metal: m.metal ?? null,
    red: m.red ?? null,
    grupo: m.grupo || "",
    compania_id: m.compania_id ?? null,
    agente: m.agente || "",
    primer_nombre: primer,
    segundo_nombre: segundo,
    apellidos: apell,
    genero: normalizeGeneroForSelect(m.genero || m?.cliente?.genero || ""),
    fecha_nacimiento: fecha,
    edad,
    idioma: m.idioma || "",
    pais_origen: m.pais_origen || "",
    status: normalizeStatusMigratorioForSelect(m.status || m?.cliente?.status || ""),
    peso: m.peso || m?.cliente?.peso || "",
    altura: m.altura || m?.cliente?.altura || "",
    pulgadas: m.pulgadas || m?.cliente?.pulgadas || "",
    ingreso_anual: m.ingreso_anual || "",
    nombreCompleto: nombre,
    nota: m.nota || "",
    whatsapp: !!m.whatsapp,
    telegram: !!m.telegram,
    texto_sms: !!m.texto_sms,
    cliente: {
      id: m.cliente_id ?? m.id ?? null,
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombre_completo: nombre,
      genero: normalizeGeneroForSelect(m.genero || m?.cliente?.genero || ""),
      fecha_nacimiento: fecha,
      edad,
      idioma: m.idioma || "",
      pais_origen: m.pais_origen || "",
      peso: m.peso || m?.cliente?.peso || "",
      altura: m.altura || m?.cliente?.altura || "",
      pulgadas: m.pulgadas || m?.cliente?.pulgadas || "",
      telefono: m.telefono || "",
      secundario: m.secundario || "",
      whatsapp_num: m.whatsapp_num || "",
      email: m.email || "",
      nota: m.nota || "",
      direccion: m.direccion || "",
      calle: m.calle || "",
      apto: m.apto || "",
      ciudad: m.ciudad || "",
      estado: m.estado || "",
      codigo_postal: m.codigo_postal || "",
      condado: m.condado || "",
      dir_correspondencia: m.dir_correspondencia || "",
      social: m.social || "",
      status: normalizeStatusMigratorioForSelect(m.status || m?.cliente?.status || ""),
      auscis: m.auscis || "",
      tarjeta_numero: m.tarjeta_numero || "",
      fecha_emision: m.fecha_emision || "",
      fecha_expiracion: m.fecha_expiracion || "",
      categoria: m.categoria || "",
      tipo_ingreso: m.tipo_ingreso || "",
      actividad_economica: m.actividad_economica || "",
      empleador: m.empleador || "",
      telefono_empleador: m.telefono_empleador || "",
      periodo_ingreso: m.periodo_ingreso || "",
      ingreso_por_periodo: m.ingreso_por_periodo || "",
      ingreso_anual: m.ingreso_anual || "",
      nota_ingreso_ocasional: m.nota_ingreso_ocasional || "",
      periodo_ingreso_ocasional: m.periodo_ingreso_ocasional || "",
      ingreso_por_periodo_ocasional: m.ingreso_por_periodo_ocasional || "",
      ingreso_ocasional_anual: m.ingreso_ocasional_anual || "",
      whatsapp: !!m.whatsapp,
      telegram: !!m.telegram,
      texto_sms: !!m.texto_sms,
      telefonos: resolveClienteTelefonos(
        { ...m, ...(m.cliente || {}) },
        "us"
      ),
    }
  };
};

const recomputeDerived = (m) => {
  const fecha = (m.fecha_nacimiento ?? m?.cliente?.fecha_nacimiento ?? "") || "";
  const edad = calcAge(fecha);
  const nombre = fullName(m);

  return {
    ...m,
    edad,
    nombreCompleto: nombre,
    nombre_completo: nombre,
    cliente: {
      ...(m.cliente || {}),
      edad,
      nombre_completo: (m?.cliente?.nombre_completo && toTitle(m?.cliente?.nombre_completo)) || nombre
    }
  };
};

const duplicateToRootFromCliente = (m, cliente) => {
  const dupe = {};
  [
    "primer_nombre",
    "segundo_nombre",
    "apellidos",
    "fecha_nacimiento",
    "edad",
    "genero",
    "idioma",
    "pais_origen",
    // Campos antropométricos
    "peso",
    "altura",
    "pulgadas",
    "telefono",
    "secundario",
    "whatsapp_num",
    "email",
    "nota",
    "direccion",
    "calle",
    "apto",
    "ciudad",
    "estado",
    "codigo_postal",
    "condado",
    "dir_correspondencia"
  ].forEach(k => {
    if (k in cliente) dupe[k] = cliente[k];
  });

  const nombreCompleto =
    cliente.nombre_completo ||
    [cliente.primer_nombre, cliente.segundo_nombre, cliente.apellidos].filter(Boolean).join(" ");
  if (nombreCompleto) dupe.nombreCompleto = nombreCompleto;

  return { ...m, ...dupe };
};

/* =================== COMPONENTES AUXILIARES =================== */

/** Claves alineadas con Configurador → coverage_fields_by_tipo */
const COVERAGE_CONFIG_FIELD_KEYS = [
  "codigo_poliza",
  "policy_number",
  "fecha_activacion",
  "ano_cobertura",
  "elegibilidad",
  "compania_id",
  "agente",
  "plan",
  "metal",
  "red",
  "estado_cobertura",
  "pagador_id",
  "tipo_pago",
  "dia_pago",
  "precio",
  "grupo",
];

/** Claves alineadas con Configurador → client_fields_by_tipo */
const CLIENT_CONFIG_FIELD_KEYS = ["peso", "altura", "pulgadas"];

const countVisibleConfigFields = (keys, shouldShow) =>
  keys.filter((key) => shouldShow(key)).length;

/** Misma lógica que Configurador: sin config → todos; con config → respetar enabledFields (incluso []). */
const resolveEnabledFields = (configByTipo, tipo, allKeys) => {
  const entry = configByTipo?.[tipo];
  if (!entry || !Array.isArray(entry.enabledFields)) {
    return null;
  }
  return entry.enabledFields;
};

const shouldShowConfiguredField = (enabledFields, fieldKey) => {
  if (enabledFields === null) return true;
  return enabledFields.includes(fieldKey);
};

/** Grid que reparte columnas según cuántos campos estén visibles (configurador). */
const ConfigurableFieldsGrid = ({ children, minWidth = 220, className = "" }) => (
  <div
    className={`tomadedatos-config-fields ${className}`.trim()}
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
      gap: "0.75rem",
      width: "100%",
    }}
  >
    {children}
  </div>
);

const Field = ({ label, labelHint, labelWarning, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
      <span>{label}</span>
      {labelHint ? (
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip>{labelHint}</Tooltip>}
        >
          <span
            className="text-primary"
            style={{ cursor: "help", lineHeight: 1 }}
            role="img"
            aria-label="Ayuda"
          >
            <FaQuestionCircle size={12} />
          </span>
        </OverlayTrigger>
      ) : null}
      {labelWarning ? (
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip>{labelWarning}</Tooltip>}
        >
          <span
            className="text-warning"
            style={{ cursor: "help", lineHeight: 1 }}
            role="img"
            aria-label="Advertencia"
          >
            <FaExclamationTriangle size={12} />
          </span>
        </OverlayTrigger>
      ) : null}
    </label>
    {children}
  </div>
);

/** Campo dentro de ConfigurableFieldsGrid (sin columnas Bootstrap fijas por defecto). */
const ConfigField = ({ className = "", ...props }) => (
  <Field className={className} {...props} />
);

const AddressSection = ({ c, onChange, readOnly }) => {
  const [copyDir, setCopyDir] = useState(false);

  const handleAddressChange = (e) => {
    onChange(e);

    const { name, value } = e.target;
    const next = { ...c, [name]: value };
    const direccionConcatenada = buildDireccion(next);

    onChange({
      target: { name: "direccion", value: direccionConcatenada, type: "text" }
    });

    if (copyDir) {
      onChange({
        target: { name: "dir_correspondencia", value: direccionConcatenada, type: "text" }
      });
    }
  };

  const handleCopyToggle = (e) => {
    const checked = !!e.target.checked;
    setCopyDir(checked);
    if (checked) {
      const direccionConcatenada = buildDireccion(c);
      onChange({
        target: { name: "dir_correspondencia", value: direccionConcatenada, type: "text" }
      });
    }
  };

  const direccionVisual = c.direccion || buildDireccion(c) || "";
  const openMap = () => window.open("https://www.unitedstateszipcodes.org/", "_blank");

  return (
    <div className="row g-3">
      <Field label="Dirección de Residencia" className="col-10">
        <div className="d-flex align-items-center position-relative">
          <input
            className="form-control form-control-sm pe-5"
            name="direccion"
            value={direccionVisual}
            onChange={onChange}
            disabled={readOnly}
            placeholder="Dirección completa (auto)"
          />
          <FaMapMarkerAlt
            className="text-primary fs-5 position-absolute"
            style={{
              right: "10px",
              cursor: readOnly ? "not-allowed" : "pointer",
              opacity: readOnly ? 0.5 : 1
            }}
            onClick={!readOnly ? openMap : undefined}
            title="Abrir mapa / ZIP codes"
          />
        </div>
      </Field>

      <Field label="Calle" className="col-md-4">
        <input
          className="form-control form-control-sm"
          name="calle"
          value={c.calle ?? ""}
          onChange={handleAddressChange}
          disabled={readOnly}
        />
      </Field>

      <Field label="APT" className="col-md-2">
        <input
          className="form-control form-control-sm"
          name="apto"
          value={c.apto ?? ""}
          onChange={handleAddressChange}
          disabled={readOnly}
        />
      </Field>

      <Field label="Ciudad" className="col-md-3">
        <input
          className="form-control form-control-sm"
          name="ciudad"
          value={c.ciudad ?? ""}
          onChange={handleAddressChange}
          disabled={readOnly}
        />
      </Field>

      <Field label="Estado" className="col-md-3">
        <input
          className="form-control form-control-sm"
          name="estado"
          value={c.estado ?? ""}
          onChange={handleAddressChange}
          disabled={readOnly}
        />
      </Field>

      <Field label="Código Postal" className="col-md-3">
        <input
          className="form-control form-control-sm"
          name="codigo_postal"
          value={c.codigo_postal ?? ""}
          onChange={handleAddressChange}
          disabled={readOnly}
        />
      </Field>

      <Field label="Condado" className="col-md-3">
        <input
          className="form-control form-control-sm"
          name="condado"
          value={c.condado ?? ""}
          onChange={onChange}
          disabled={readOnly}
        />
      </Field>

      <Field label="Dirección de Correspondencia" className="col-md-9">
        <input
          className="form-control form-control-sm"
          name="dir_correspondencia"
          value={c.dir_correspondencia ?? ""}
          onChange={onChange}
          disabled={readOnly}
        />
      </Field>

      <div className="col-md-3 d-flex align-items-center">
        <div className="form-check mt-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="copy-dir-toggle"
            checked={copyDir}
            onChange={handleCopyToggle}
            disabled={readOnly}
          />
          <label className="form-check-label" htmlFor="copy-dir-toggle">
            Copiar Dirección
          </label>
        </div>
      </div>
    </div>
  );
};

/* =================== COMPONENTE PRINCIPAL =================== */
const TomaDeDatos = ({
  familyMembers,
  setFamilyMembers,
  canAdd = false,
  readOnly = false,
  estadoActual,
  isProspecto = false,
  defaultCoberturaTipo = "Plan de salud",
  onCreateMemberRemote,
  onBlockedAddClick,
  grupoFamiliarId,
  onDerivedCounts,
}) => {
  const [openModal, setOpenModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [openExistente, setOpenExistente] = useState(false);
  const [openCopy, setOpenCopy] = useState(false);
  const [historialPlanModal, setHistorialPlanModal] = useState({
    open: false,
    members: [],
    initialCoberturaId: null,
    allowBulkArchive: false,
  });
  // Estado para mantener valores visuales temporales de dinero (formato con miles)
  const [moneyDisplay, setMoneyDisplay] = useState({});
  // Estado para controlar la visualización de miembros retirados
  const [showRetirados, setShowRetirados] = useState(false);
  // Config visual de campos de cobertura por tipo de producto (system_config.coverage_fields_by_tipo)
  const [coverageFieldConfig, setCoverageFieldConfig] = useState(null);
  // Config visual de campos extra del cliente (peso/altura) por tipo de producto (system_config.client_fields_by_tipo)
  const [clientFieldConfig, setClientFieldConfig] = useState(null);
  const [loadingCoverageFieldConfig, setLoadingCoverageFieldConfig] =
    useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!Array.isArray(familyMembers)) return;
    onDerivedCounts?.(deriveCounts(familyMembers));
  }, [familyMembers, onDerivedCounts]);

  // Cargar configuración de campos de cobertura y datos de cliente (solo visual) desde system_config
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        setLoadingCoverageFieldConfig(true);
        const [coverageValue, clientValue] = await Promise.all([
          systemConfigService
            .get("coverage_fields_by_tipo")
            .catch(() => null),
          systemConfigService
            .get("client_fields_by_tipo")
            .catch(() => null),
        ]);

        if (!cancelled) {
          // El API puede devolver { value: { "Tipo": { enabledFields: [...] } } } o directamente el objeto por tipo
          if (coverageValue && typeof coverageValue === "object") {
            const coverageByTipo = coverageValue.value !== undefined ? coverageValue.value : coverageValue;
            setCoverageFieldConfig(typeof coverageByTipo === "object" && coverageByTipo !== null ? coverageByTipo : coverageValue);
          }
          if (clientValue && typeof clientValue === "object") {
            const clientByTipo = clientValue.value !== undefined ? clientValue.value : clientValue;
            setClientFieldConfig(typeof clientByTipo === "object" && clientByTipo !== null ? clientByTipo : clientValue);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error(
            "Error cargando configuración de campos de cobertura/datos cliente",
            err
          );
        }
        if (!cancelled) {
          setCoverageFieldConfig(null);
          setClientFieldConfig(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingCoverageFieldConfig(false);
        }
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  // Normalización y ordenamiento
  const normalized = useMemo(
    () => (familyMembers ?? []).map((m, i) => recomputeDerived(normalizeMember(m, i))),
    [familyMembers]
  );

  // Separar miembros activos e inactivos y mantener índice original
  const { activeMembers, inactiveMembers } = useMemo(() => {
    const active = [];
    const inactive = [];
    
    normalized.forEach((m, originalIdx) => {
      const memberWithIdx = { m, idx: originalIdx };
      if (m.activo === false) {
        inactive.push(memberWithIdx);
      } else {
        active.push(memberWithIdx);
      }
    });
    
    // Función de ordenamiento: tomador primero
    const sortMembers = (arr) => {
      return arr.sort((a, b) => {
        const pa = isTomador(a.m) ? 0 : 1;
        const pb = isTomador(b.m) ? 0 : 1;
        return pa - pb || a.idx - b.idx;
      });
    };
    
    return {
      activeMembers: sortMembers(active),
      inactiveMembers: sortMembers(inactive)
    };
  }, [normalized]);
  
  // Mantener miembro + índice original para compatibilidad (solo activos)
  const sortedWithIndex = useMemo(() => activeMembers, [activeMembers]);

// Solo los miembros (para cosas que no necesitan el índice)
const sortedNormalized = useMemo(
  () => sortedWithIndex.map((x) => x.m),
  [sortedWithIndex]
);

// Array de miembros activos sin índices (para payerOptions y otras utilidades)
const activeNormalized = useMemo(
  () => normalized.filter(m => m.activo !== false),
  [normalized]
);

  // Compañías y pagadores
  const { companies, loading: companiesLoading } = useCompanies();
  const payerOptions = useMemo(() => buildPayerOptions(activeNormalized), [activeNormalized]);
  const payerOptionsWithOther = useMemo(
    () => [...(payerOptions || []), { value: "OTRO", label: "Otro (externo)" }],
    [payerOptions]
  );

  /* =================== HANDLERS =================== */
  const onCreateLocal = useCallback(
    (payload) => {
      const newId = (familyMembers?.length ? Math.max(...familyMembers.map(m => m.id || 0)) : 0) + 1;
      const ingreso = payload.ingreso_anual ?? payload.ingresoAnual ?? payload?.cliente?.ingreso_anual ?? 0;
      const idioma = payload.idioma ?? payload?.cliente?.idioma ?? "";
      const paisOrigen = payload.pais_origen ?? payload?.cliente?.pais_origen ?? "";

      const base = {
        fecha_retiro: null,
        activo: true,
        ...payload,
        id: newId,
        ingreso_anual: ingreso,
        idioma,
        pais_origen: paisOrigen,
        cliente: {
          ...(payload.cliente || {}),
          ingreso_anual: ingreso,
          idioma,
          pais_origen: paisOrigen
        }
      };

      const normalized = normalizeMember(base, newId - 1);
      const withDerived = recomputeDerived(normalized);
      setFamilyMembers(prev => [...(prev ?? []), withDerived]);
      setOpenModal(false);
    },
    [familyMembers, setFamilyMembers]
  );

  const onUpdateLocal = useCallback(
    (id, payload) => {
      setFamilyMembers(prev =>
        (prev ?? []).map(m => {
          if ((m.id ?? null) !== id) return m;
          const merged = { ...m, ...payload, id };
          return recomputeDerived(merged);
        })
      );
    },
    [setFamilyMembers]
  );

  const handleAdd = () => {
    if (!canAdd) return onBlockedAddClick?.();
    setEditingMember(null);
    setOpenModal(true);
  };

  const patchRoot = (idx, patch) => {
    setFamilyMembers(prev =>
      (prev ?? []).map((m, i) => (i === idx ? { ...m, ...patch } : m))
    );
  };

  const patchCliente = (idx, patch) => {
    setFamilyMembers(prev =>
      (prev ?? []).map((m, i) => {
        if (i !== idx) return m;

        const base = m?.cliente && typeof m.cliente === "object" ? m.cliente : {};
        let nextCliente = { ...base, ...patch };
        const dupe = {};

        // Teléfonos
        if (Array.isArray(patch.telefonos)) {
          const cleaned = (patch.telefonos || []).map((t, j) => ({
            id: t.id ?? `ph-${j}`,
            tipo: (t.tipo || "Móvil").trim(),
            numero: formatPhone334 ? formatPhone334(t.numero ?? "") : (t.numero ?? ""),
            principal: !!t.principal,
            iso: String(t.iso || "").toLowerCase(),
            indicativo: String(t.indicativo || "").replace(/\D+/g, "")
          }));
          nextCliente.telefonos = cleaned;

          const legacy = toLegacyFields(cleaned);
          dupe.telefono = legacy.telefono;
          dupe.secundario = legacy.secundario;
          dupe.whatsapp_num = legacy.whatsapp_num;
          dupe.principal = legacy.principal;
        }

        // Edad
        if ("fecha_nacimiento" in patch) {
          nextCliente.edad = calcAge(patch.fecha_nacimiento);
        }

        // Nombre completo
        const nombreCompleto = [nextCliente.primer_nombre, nextCliente.segundo_nombre, nextCliente.apellidos]
          .map(toTitle)
          .filter(Boolean)
          .join(" ");
        if (nombreCompleto) {
          nextCliente.nombre_completo = nombreCompleto;
        }

        // Idioma
        if ("idioma" in patch) {
          nextCliente.idioma = patch.idioma ?? "";
        }

        // País de Origen
        if ("pais_origen" in patch) {
          nextCliente.pais_origen = patch.pais_origen ?? "";
        }

        // Duplicar a raíz
        DUPLICATE_TO_ROOT.forEach(k => {
          if (k in nextCliente) dupe[k] = nextCliente[k];
        });
        if (nombreCompleto) {
          dupe.nombreCompleto = nombreCompleto;
          dupe.nombre_completo = nombreCompleto;
        }

        const merged = { ...m, ...dupe, cliente: nextCliente };
        return recomputeDerived(merged);
      })
    );
  };

  const onChangeFactory = (idx) => (e) => {
    const { name, value, type, checked } = e.target;
    let v = type === "checkbox" ? !!checked : value;

    // Pagador especial
    if (name === "pagador_id") {
      const vv = value === "OTRO" || value === "" || value == null
        ? null
        : Number.isNaN(Number(value)) ? null : Number(value);
      return patchRoot(idx, { pagador_id: vv });
    }

    // Máscaras
    if (name === "social") v = formatSSN(v);
    if (name === "auscis") v = formatUSCIS(v);
    if (PHONE_FIELDS.has(name)) v = formatPhone334(v);

    // Dinero
    if (MONEY_FIELDS.has(name)) v = sanitizeMoneyInput(v);

    // Capitalización
    if (NAME_FIELDS.has(name)) v = toTitle(v);

    if (name === "fecha_nacimiento" && v) {
      v = normalizeDateForInput(v);
    }

    const current = getC(normalized[idx] || {});
    const patch = { [name]: v };

    if (name === "estado_cobertura") {
      const vigente = vigenteDesdeEstadoCobertura(v);
      if (vigente !== null) {
        patch.vigente = vigente;
      }

      if (isMedicareOrMedicaidEstado(v)) {
        Object.assign(patch, clearedCoverageFieldsForMedicareMedicaid());
        const precioKey = `${idx}-precio`;
        setMoneyDisplay((prev) => {
          if (prev[precioKey] === undefined) return prev;
          const next = { ...prev };
          delete next[precioKey];
          return next;
        });
      }
    }

    // ⚠️ NO limpiar campos protegidos automáticamente cuando cambia estado_cobertura
    // Estos campos (fecha_cancelacion, fecha_retiro, nota_cancel, nota_retiro, activo, vigente)
    // solo deben ser modificados mediante modales de renovación/reactivación
    // La limpieza automática podría causar que se reseteen valores establecidos por esos modales

    // Cálculo ingreso anual
    if (name === "ingreso_por_periodo" || name === "periodo_ingreso") {
      const periodo = name === "periodo_ingreso" ? v : (current.periodo_ingreso ?? "");
      const perRaw = name === "ingreso_por_periodo" ? v : (current.ingreso_por_periodo ?? "");
      const perDollars = (parseMoney(String(perRaw)) || 0) / 100;
      patch.ingreso_anual = formatMoney2(computeAnnual(periodo, perDollars));
    }

    if (name === "ingreso_por_periodo_ocasional" || name === "periodo_ingreso_ocasional") {
      const periodo =
        name === "periodo_ingreso_ocasional" ? v : (current.periodo_ingreso_ocasional ?? "");
      const perRaw =
        name === "ingreso_por_periodo_ocasional"
          ? v
          : (current.ingreso_por_periodo_ocasional ?? "");
      const perParsed = parseMoney(String(perRaw)) || 0;
      patch.ingreso_ocasional_anual = formatMoney2(computeAnnual(periodo, perParsed));
    }

    if (CLIENTE_FIELDS.has(name)) return patchCliente(idx, patch);
    if (ROOT_FIELDS.has(name)) return patchRoot(idx, patch);
    return patchCliente(idx, patch);
  };

  // Obtener el valor visual formateado para campos de dinero
  const getMoneyDisplayValue = (idx, fieldName, value) => {
    const key = `${idx}-${fieldName}`;
    // Si hay un valor visual temporal (el usuario está escribiendo), usarlo
    if (moneyDisplay[key] !== undefined) {
      return moneyDisplay[key];
    }
    // De lo contrario, formatear el valor con separadores de miles
    if (!value || value === "") return "";
    return formatMoney2(value);
  };

  // Handler para onChange de campos de dinero
  const moneyChangeFactory = (idx, fieldName, isCliente = true) => (e) => {
    const { value } = e.target;
    const key = `${idx}-${fieldName}`;
    
    // Permitir que el usuario escriba sin formato
    // Guardar el valor visual temporalmente
    setMoneyDisplay(prev => ({ ...prev, [key]: value }));
    
    // Parsear el valor y guardarlo internamente (sin formato)
    const parsed = parseMoney(value);
    const patch = { [fieldName]: parsed === 0 ? "" : String(parsed) };
    
    // Si es ingreso_por_periodo, calcular ingreso_anual
    if (fieldName === "ingreso_por_periodo") {
      const cur = getC(normalized[idx] || {});
      const periodo = cur.periodo_ingreso ?? "";
      const annual = computeAnnual(periodo, parsed);
      patch.ingreso_anual = annual === 0 ? "" : String(annual);
    }

    if (fieldName === "ingreso_por_periodo_ocasional") {
      const cur = getC(normalized[idx] || {});
      const periodo = cur.periodo_ingreso_ocasional ?? "";
      const annual = computeAnnual(periodo, parsed);
      patch.ingreso_ocasional_anual = annual === 0 ? "" : String(annual);
    }
    
    // Aplicar el cambio
    if (isCliente) {
      patchCliente(idx, patch);
    } else {
      patchRoot(idx, patch);
    }
  };

  // Handler para onBlur de campos de dinero
  const moneyBlurFactory = (idx, fieldName, isCliente = true) => () => {
    const key = `${idx}-${fieldName}`;
    const cur = getC(normalized[idx] || {});
    const val = cur?.[fieldName];
    
    // Limpiar el valor visual temporal
    setMoneyDisplay(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    
    // Formatear y guardar
    const formatted = formatMoney2(val);
    const patch = { [fieldName]: formatted };
    
    // Si es ingreso_por_periodo, calcular ingreso_anual
    if (fieldName === "ingreso_por_periodo") {
      const periodo = cur.periodo_ingreso ?? "";
      const parsed = parseMoney(formatted);
      patch.ingreso_anual = formatMoney2(computeAnnual(periodo, parsed));
    }

    if (fieldName === "ingreso_por_periodo_ocasional") {
      const periodo = cur.periodo_ingreso_ocasional ?? "";
      const parsed = parseMoney(formatted);
      patch.ingreso_ocasional_anual = formatMoney2(computeAnnual(periodo, parsed));
    }
    
    // Aplicar el cambio
    if (isCliente) {
      patchCliente(idx, patch);
    } else {
      patchRoot(idx, patch);
    }
  };

  const onBlurMoneyFactory = (idx, fieldName, isCliente = true) => () => {
    const cur = getC(normalized[idx] || {});
    const val = cur?.[fieldName];
    const formatted = formatMoney2(val);
    const patch = { [fieldName]: formatted };

    if (fieldName === "ingreso_por_periodo") {
      patch.ingreso_anual = formatMoney2(
        computeAnnual(cur.periodo_ingreso ?? "", formatted)
      );
    }

    if (fieldName === "ingreso_por_periodo_ocasional") {
      patch.ingreso_ocasional_anual = formatMoney2(
        computeAnnual(cur.periodo_ingreso_ocasional ?? "", formatted)
      );
    }
    return isCliente ? patchCliente(idx, patch) : patchRoot(idx, patch);
  };

  const applyCopySelection = ({ sourceId, fieldKeys, copyAddress, targetIds }) => {
    const src = (familyMembers || []).find(m => (m.id ?? m.cliente_id) === sourceId);
    if (!src) return;

    setFamilyMembers(prev =>
      (prev || []).map(m => {
        const mid = m.id ?? m.cliente_id;
        if (!targetIds.includes(mid)) return m;

        let next = { ...m };
        const soloDireccion = soloPermiteCopiarDireccion(m.estado_cobertura);

        // No / Medicare / Medicaid: no reciben datos de cobertura, solo dirección.
        if (!soloDireccion) {
          fieldKeys.forEach(k => {
            if (k in src) next[k] = src[k];
          });
        }

        if (copyAddress) {
          const srcCli = src.cliente || {};
          const dstCliBase = next.cliente && typeof next.cliente === "object" ? next.cliente : {};
          const newCli = { ...dstCliBase };
          ADDRESS_FIELDS.forEach(k => {
            if (k in srcCli) newCli[k] = srcCli[k];
            else if (k in src) newCli[k] = src[k];
          });
          next.cliente = newCli;
          next = duplicateToRootFromCliente(next, newCli);
        }

        return next;
      })
    );
  };

  const handleCreateCoberturaExistente = useCallback(
    async (payload, clienteSeleccionado) => {
      if (!grupoFamiliarId || !payload?.cliente_id) return;
      if (yaEstaEnElGrupo(payload.cliente_id, normalized)) return;

      const clienteSelRaw =
        unwrapClienteFromApi(clienteSeleccionado) ?? clienteSeleccionado ?? {};
      const clienteSel = {
        ...clienteSelRaw,
        id: clienteSelRaw.id ?? payload.cliente_id,
      };

      // 🔍 Validar si el cliente ya tiene una cobertura activa/vigente
      // para el mismo tipo de producto en OTRO grupo familiar (lógica centralizada en el service)
      try {
        const conflicto = await GrupoFamiliarService.findActiveCoverageConflict(
          payload.cliente_id,
          payload.cobertura_tipo,
          grupoFamiliarId
        );

        if (conflicto) {
          const nombreCliente =
            conflicto.cliente?.nombre_completo ??
            clienteSel?.nombre_completo ??
            "Este cliente";

          const descripcionCobertura = [
            conflicto.cobertura_tipo,
            conflicto.compania?.nombre,
            conflicto.codigo_poliza || conflicto.policy_number
          ]
            .filter(Boolean)
            .join(" - ");

          const grupoTexto = conflicto.grupo_familiar_id
            ? `Grupo familiar #${conflicto.grupo_familiar_id}`
            : null;

          const mensajeDetalle = descripcionCobertura
            ? `Cobertura: ${descripcionCobertura}${grupoTexto ? ` (${grupoTexto})` : ""}`
            : `Cobertura activa/vigente para el mismo producto${grupoTexto ? ` en ${grupoTexto}` : ""}.`;

          if (window?.Swal) {
            window.Swal.fire({
              icon: "warning",
              title: "Cobertura vigente existente",
              html: `
                <p>${nombreCliente} ya pertenece a un grupo familiar con una cobertura <b>activa y vigente</b> para este mismo producto.</p>
                <p style="margin-top:8px;"><small>${mensajeDetalle}</small></p>
                <p style="margin-top:12px;">Debe realizar el <b>retiro o cancelación</b> de la cobertura actual antes de poder agregarlo a este nuevo grupo.</p>
              `,
              confirmButtonText: "Entendido"
            });
          } else {
            window.alert(
              `${nombreCliente} ya pertenece a un grupo familiar con una cobertura activa y vigente para este mismo producto.\n\n` +
              `${mensajeDetalle}\n\n` +
              `Debe retirar o cancelar la cobertura actual antes de agregarlo a este nuevo grupo.`
            );
          }

          return;
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("Error validando coberturas activas del cliente:", e);
        }
      }

      const res = await GrupoFamiliarService.createCoberturaSimple({
        grupo_familiar_id: grupoFamiliarId,
        cliente_id: payload.cliente_id,
        parentesco: payload.tipo,
        cobertura_tipo: payload.cobertura_tipo,
        estado_cobertura: payload.estado_cobertura
      });

      const coberturaCreada = extractCoberturaFromCreateResponse(res);
      const cliOverlay =
        res?.miembro?.cliente && typeof res.miembro.cliente === "object"
          ? res.miembro.cliente
          : {};

      const base = buildMemberFromClienteExistente({
        clienteRaw: mergeClientePreferNonEmpty(clienteSel, cliOverlay),
        cobertura: coberturaCreada,
        payload,
      });

      const merged = normalizeMember(
        duplicateToRootFromCliente(base, base.cliente),
        familyMembers?.length ?? 0
      );

      setFamilyMembers((prev) => {
        const next = [...(prev ?? []), merged];
        onDerivedCounts?.(deriveCounts(next));
        return next;
      });

      if (res?.personas_taxes != null || res?.personas_cobertura != null) {
        onDerivedCounts?.({
          taxes: res.personas_taxes,
          cobertura: res.personas_cobertura,
        });
      }

      return res;
    },
    [grupoFamiliarId, normalized, setFamilyMembers, familyMembers?.length, onDerivedCounts]
  );

  const memberHasPlanData = useCallback((member = {}) => {
    return [member.compania_id, member.plan, member.codigo_poliza, member.policy_number].some(
      (value) => value != null && String(value).trim() !== ""
    );
  }, []);

  const buildHistorialPlanContext = useCallback(
    (openedMember, openedIdx) => {
      const fromTomador = isTomador(openedMember);
      const sourceMembers = fromTomador
        ? normalized.filter((member) => member.cobertura_id && member.activo !== false)
        : [openedMember];

      const members = sourceMembers
        .filter((member) => member.cobertura_id)
        .map((member) => {
          const memberIdx = normalized.findIndex(
            (item) => item.cobertura_id === member.cobertura_id
          );

          return {
            coberturaId: member.cobertura_id,
            memberIdx: memberIdx >= 0 ? memberIdx : openedIdx,
            memberName:
              member.nombreCompleto ||
              member.nombre_completo ||
              member?.cliente?.nombre_completo ||
              "Miembro",
            parentesco: member.parentesco || member.tipo || "",
            hasPlanData: memberHasPlanData(member),
          };
        });

      return {
        members,
        initialCoberturaId: openedMember.cobertura_id,
        allowBulkArchive: fromTomador && members.length > 1,
      };
    },
    [normalized, memberHasPlanData]
  );

  /* =================== RENDER =================== */
  // Función helper para renderizar una card de miembro
  const renderMemberCard = ({ m, idx }) => {
    const itemId = `member-${m.id ?? idx}`;
    const leftRightWidth = 180;
    const c = getC(m);
    const onChange = onChangeFactory(idx); // ✅ idx = índice original en familyMembers
    const grupoValor = (m.grupo ?? "").toUpperCase();
    const badgeClass =
      grupoValor === "G1"
        ? "bg-primary"
        : grupoValor === "G2"
        ? "bg-success"
        : grupoValor === "G3"
        ? "bg-warning text-dark"
        : grupoValor === "G4"
        ? "bg-danger"
        : "bg-secondary";

    const ingresoPrincipalAnual = parseMoney(c.ingreso_anual ?? m.ingreso_anual ?? 0);
    const ingresoOcasionalAnualStored = parseMoney(
      c.ingreso_ocasional_anual ?? m.ingreso_ocasional_anual ?? ""
    );
    const ingresoOcasionalAnual =
      ingresoOcasionalAnualStored ||
      computeAnnual(
        c.periodo_ingreso_ocasional ?? m.periodo_ingreso_ocasional ?? "",
        c.ingreso_por_periodo_ocasional ?? m.ingreso_por_periodo_ocasional ?? ""
      ) ||
      parseMoney(
        c.ingreso_ocasional ?? m.ingreso_ocasional ?? c.ingreso_por_periodo_ocasional ?? m.ingreso_por_periodo_ocasional ?? 0
      );
    const ingresoTotalAnual = ingresoPrincipalAnual + ingresoOcasionalAnual;
    const ingresoTotalLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(ingresoTotalAnual || 0);

    const clienteId = m?.cliente_id ?? m?.cliente?.id ?? null;
    
    // Detectar si la cobertura está inactiva
    const isInactive = m.activo === false;
    // Si está inactiva, bloquear todos los campos
    const isReadOnly = readOnly || isInactive;
    const currentState = (estadoActual || "").toUpperCase();
    const canEditParentesco =
      !isReadOnly &&
      currentState !== "TERMINADO" &&
      currentState !== "GRUPO_FAMILIAR";
    
    // Detectar si es Medicare o Medicaid para mostrar solo campos específicos
    const isMedicareOrMedicaid = isMedicareOrMedicaidEstado(m.estado_cobertura);

    // Tipo de producto (cobertura_tipo) para controlar visibilidad de campos
    const coberturaTipo =
      m.cobertura_tipo || defaultCoberturaTipo || "Plan de salud";

    // Config visual de campos de cobertura por tipo (system_config.coverage_fields_by_tipo).
    // enabledFields = lista de campos a MOSTRAR para ese tipo.
    const visibleCoverageFields = resolveEnabledFields(
      coverageFieldConfig,
      coberturaTipo,
      COVERAGE_CONFIG_FIELD_KEYS
    );

    const shouldShowCoverageField = (fieldKey) =>
      shouldShowConfiguredField(visibleCoverageFields, fieldKey);

    const visibleClientFields = resolveEnabledFields(
      clientFieldConfig,
      coberturaTipo,
      CLIENT_CONFIG_FIELD_KEYS
    );

    const shouldShowClientField = (fieldKey) =>
      shouldShowConfiguredField(visibleClientFields, fieldKey);

    const visibleCoverageFieldCount = countVisibleConfigFields(
      COVERAGE_CONFIG_FIELD_KEYS,
      shouldShowCoverageField
    );
    const hasConfigurableClientFields = countVisibleConfigFields(
      CLIENT_CONFIG_FIELD_KEYS,
      shouldShowClientField
    ) > 0;

        return (
          <div 
            className={`card shadow-sm mb-3 overflow-visible ${isInactive ? 'border-warning' : ''}`} 
            key={itemId}
            style={isInactive ? { 
              border: '2px solid #ffc107',
              position: 'relative'
            } : {}}
          >
            {/* Indicador de alerta para coberturas inactivas */}
            {isInactive && (
              <div 
                className="position-absolute top-0 start-0 bg-warning text-dark px-3 py-2 rounded-bottom-end shadow-sm"
                style={{ zIndex: 10, borderBottom: '2px solid #ff9800', borderRight: '2px solid #ff9800' }}
              >
                <i className="fas fa-exclamation-triangle me-2"></i>
                <small className="fw-bold">Retirado del Grupo Familiar</small>
              </div>
            )}
            {/* Header */}
            <div className={`card-header border-0 px-4 py-3 bg-white`}>
              <div className="d-flex align-items-center position-relative" style={{ minHeight: 64 }}>
                <div className="d-flex flex-column justify-content-center align-items-start me-3" style={{ width: leftRightWidth }}>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge bg-${getTypeColor(m.tipo)}`}>
                      {m.tipo || "Miembro"}
                    </span>
                    {canEditParentesco && (
                      <select
                        className="form-select form-select-sm"
                        value={m.tipo || "Tomador"}
                        onChange={(e) => {
                          const nuevoTipo = e.target.value;
                          patchRoot(idx, {
                            tipo: nuevoTipo,
                            parentesco: nuevoTipo
                          });
                        }}
                      >
                        {PARENTESCO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="mt-2">
                  <UserCoverageIcon
  status={m.estado_cobertura}
  fechaRetiro={m.fecha_retiro}
  fechaCancelacion={m.fecha_cancelacion}
  fechaActivacion={m.fecha_activacion}   // 👈 NUEVO
  size={50}
/>


                  </div>
                </div>

                <div className="flex-grow-1 text-center">
                  {clienteId ? (
                    <span
                      role="button"
                      className="fw-semibold text-primary text-decoration-none"
                      style={{ cursor: 'pointer' }}
                      title={`Abrir ficha del cliente #${clienteId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(CLIENTE_FICHA_PATH(clienteId));
                      }}
                    >
                      {fullName(m)}
                    </span>
                  ) : (
                    <span className="fw-semibold text-dark">{fullName(m)}</span>
                  )}
                </div>

                <div
                  className="d-flex align-items-center justify-content-end ms-3"
                  style={{ width: leftRightWidth }}
                >
                  <div className="text-start me-3">
                    <div className="small">
                      <span className="text-muted">Edad: </span>
                      <span className="fw-semibold text-muted">
                        {c.edad ?? m.edad ?? "N/A"}
                      </span>
                    </div>
                    <div className="small text-muted">
                      Género: {normalizeGeneroForSelect(c.genero ?? m.genero ?? "") || "—"}
                    </div>
                    <div className="small">
                      Grupo:{" "}
                      <span className={`badge ${badgeClass}`}>
                        {grupoValor || "—"}
                      </span>
                    </div>
                    <div className="small text-muted mt-1">
                      Ingreso total:{" "}
                      <span className="fw-semibold text-muted">{ingresoTotalLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acordeones */}
            <div className="card-body px-4 pt-3 pb-4">
              <div className="d-flex flex-column gap-2">
                {/* Datos Cliente */}
                <AccordionItem
                  id={`cliente-${itemId}`}
                  title="Datos Cliente"
                  icon={<i className="fas fa-user" />}
                >
                  <div className="d-flex flex-column gap-2">
                    {/* Principales */}
                    <AccordionItem
                      id={`datos-principales-${itemId}`}
                      title="Datos Principales"
                    >
                      <div>
                              <div className="row g-3">
                                <Field label="Primer Nombre" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="primer_nombre"
                                    value={c.primer_nombre ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    style={{ textTransform: "capitalize" }}
                                  />
                                </Field>

                                <Field label="Segundo Nombre" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="segundo_nombre"
                                    value={c.segundo_nombre ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    style={{ textTransform: "capitalize" }}
                                  />
                                </Field>

                                <Field label="Apellidos" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="apellidos"
                                    value={c.apellidos ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    style={{ textTransform: "capitalize" }}
                                  />
                                </Field>

                                <Field label="Fecha de Nacimiento" className="col-md-4">
                                  <MdyDashDateInput
                                    size="sm"
                                    allowManualEntry
                                    valueIso={normalizeDateForInput(c.fecha_nacimiento || "")}
                                    minIso="1900-01-01"
                                    maxIso="2099-12-31"
                                    disabled={isReadOnly}
                                    onChangeIso={(iso) =>
                                      onChangeFactory(idx)({
                                        target: {
                                          name: "fecha_nacimiento",
                                          value: iso,
                                          type: "date",
                                        },
                                      })
                                    }
                                  />
                                </Field>

                                <Field label="Edad" className="col-md-2">
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    name="edad"
                                    value={c.edad ?? ""}
                                    readOnly
                                  />
                                </Field>

                                <Field label="Género" className="col-md-3">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="genero"
                                    value={normalizeGeneroForSelect(c.genero ?? m.genero ?? "")}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Femenino">Femenino</option>
                                    <option value="Otro">Otro</option>
                                  </select>
                                </Field>

                                <Field label="Idioma" className="col-md-3">
                                  <LanguageSelect
                                    name="idioma"
                                    value={c.idioma ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                  />
                                </Field>

                                <Field label="País de Origen" className="col-md-3">
                                  <input
                                    className="form-control form-control-sm"
                                    name="pais_origen"
                                    value={c.pais_origen ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    style={{ textTransform: "capitalize" }}
                                    placeholder="País de origen"
                                  />
                                </Field>
                              </div>

                              {hasConfigurableClientFields && (
                                <ConfigurableFieldsGrid className="mt-3">
                                {shouldShowClientField("peso") && (
                                  <ConfigField label="Peso (lb)">
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      name="peso"
                                      value={c.peso ?? ""}
                                      onChange={onChange}
                                      disabled={isReadOnly}
                                      min="0"
                                      step="0.1"
                                    />
                                  </ConfigField>
                                )}

                                {shouldShowClientField("altura") && (
                                  <ConfigField label="Altura (pies)">
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      name="altura"
                                      value={c.altura ?? ""}
                                      onChange={onChange}
                                      disabled={isReadOnly}
                                      min="0"
                                      step="0.01"
                                    />
                                  </ConfigField>
                                )}

                                {shouldShowClientField("pulgadas") && (
                                  <ConfigField label="Altura (pulgadas)">
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      name="pulgadas"
                                      value={c.pulgadas ?? ""}
                                      onChange={onChange}
                                      disabled={isReadOnly}
                                      min="0"
                                      step="0.1"
                                    />
                                  </ConfigField>
                                )}
                                </ConfigurableFieldsGrid>
                              )}
                      </div>
                    </AccordionItem>

                    {/* Estatus migratorio */}
                    <AccordionItem
                      id={`estatus-${itemId}`}
                      title="Estatus migratorio"
                    >
                      <div>
                              <div className="row g-3">
                                <Field label="Social" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="social"
                                    value={c.social ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    inputMode="numeric"
                                    maxLength={11}
                                  />
                                </Field>

                                <Field label="Status" className="col-md-6">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="status"
                                    value={normalizeStatusMigratorioForSelect(c.status ?? m.status ?? "")}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    {STATUS_MIGRATORIO_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                </Field>

                                <Field label="A/USCIS" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="auscis"
                                    value={c.auscis ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    inputMode="numeric"
                                    maxLength={12}
                                  />
                                </Field>

                                <Field label="Tarjeta #" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="tarjeta_numero"
                                    value={c.tarjeta_numero ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  />
                                </Field>

                                <Field label="Fecha Emisión" className="col-md-3">
                                  <DateInputWithCalendar
                                    size="sm"
                                    valueIso={(c.fecha_emision || "").slice(0, 10)}
                                    minIso="1900-01-01"
                                    maxIso="2099-12-31"
                                    disabled={isReadOnly}
                                    onChangeIso={(iso) =>
                                      onChangeFactory(idx)({
                                        target: {
                                          name: "fecha_emision",
                                          value: iso,
                                          type: "date",
                                        },
                                      })
                                    }
                                  />
                                </Field>

                                <Field label="Fecha Expiración" className="col-md-3">
                                  <DateInputWithCalendar
                                    size="sm"
                                    valueIso={(c.fecha_expiracion || "").slice(0, 10)}
                                    minIso="1900-01-01"
                                    maxIso="2099-12-31"
                                    disabled={isReadOnly}
                                    onChangeIso={(iso) =>
                                      onChangeFactory(idx)({
                                        target: {
                                          name: "fecha_expiracion",
                                          value: iso,
                                          type: "date",
                                        },
                                      })
                                    }
                                  />
                                </Field>

                                <Field label="Categoría" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="categoria"
                                    value={c.categoria ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  />
                                </Field>
                              </div>
                      </div>
                    </AccordionItem>

                    {/* Contacto */}
                    <AccordionItem
                      id={`datos-contacto-${itemId}`}
                      title="Datos de Contacto"
                    >
                      <div>
                              <div className="row g-3">
                                <Field label="Teléfonos" className="col-12">
                                  <TelefonosPro
                                    value={resolveClienteTelefonos(c, "us")}
                                    onChange={(arr) => patchCliente(idx, { telefonos: arr })}
                                    readOnly={isReadOnly}
                                  />
                                </Field>

                                <div className="col-12">
                                  <label className="form-label small fw-semibold text-muted mb-2">
                                    Medio de Comunicación Principal
                                  </label>
                                  <div className="d-flex flex-wrap gap-3">
                                    <div className="form-check">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`whatsapp-${itemId}`}
                                        name="whatsapp"
                                        checked={!!(c.whatsapp ?? m.whatsapp ?? false)}
                                        onChange={onChange}
                                        disabled={isReadOnly}
                                      />
                                      <label className="form-check-label" htmlFor={`whatsapp-${itemId}`}>
                                        <i className="fab fa-whatsapp text-success me-1" />
                                        WhatsApp
                                      </label>
                                    </div>
                                    <div className="form-check">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`telegram-${itemId}`}
                                        name="telegram"
                                        checked={!!(c.telegram ?? m.telegram ?? false)}
                                        onChange={onChange}
                                        disabled={isReadOnly}
                                      />
                                      <label className="form-check-label" htmlFor={`telegram-${itemId}`}>
                                        <i className="fab fa-telegram text-info me-1" />
                                        Telegram
                                      </label>
                                    </div>
                                    <div className="form-check">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`texto-sms-${itemId}`}
                                        name="texto_sms"
                                        checked={!!(c.texto_sms ?? m.texto_sms ?? false)}
                                        onChange={onChange}
                                        disabled={isReadOnly}
                                      />
                                      <label className="form-check-label" htmlFor={`texto-sms-${itemId}`}>
                                        <i className="fas fa-sms text-primary me-1" />
                                        SMS
                                      </label>
                                    </div>
                                  </div>
                                </div>

                                <Field label="Email" className="col-md-6">
                                  <input
                                    type="email"
                                    className="form-control form-control-sm"
                                    name="email"
                                    value={c.email ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    placeholder="correo@dominio.com"
                                  />
                                </Field>

                                <Field label="Nota" className="col-12">
                                  <textarea
                                    rows={3}
                                    className="form-control form-control-sm"
                                    name="nota"
                                    value={c.nota ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  />
                                </Field>
                              </div>
                      </div>
                    </AccordionItem>

                    {/* Dirección */}
                    <AccordionItem
                      id={`direccion-${itemId}`}
                      title="Dirección"
                    >
                      <div>
                              <AddressSection c={c} onChange={onChange} readOnly={isReadOnly} />
                      </div>
                    </AccordionItem>

                    {/* Empleo e Ingreso */}
                    <AccordionItem
                      id={`empleo-ingreso-${itemId}`}
                      title="Datos de Empleo e Ingreso"
                    >
                      <div>
                              <div className="row g-3">
                                <Field label="Tipo de Ingreso" className="col-md-6">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="tipo_ingreso"
                                    value={c.tipo_ingreso ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="W2">W2</option>
                                    <option value="1099">1099</option>
                                    <option value="SOCIAL SECURITY">SOCIAL SECURITY</option>
                                    <option value="SELF EMPLOYMENT">SELF EMPLOYMENT</option>
                                    <option value="SUPPORT">SUPPORT</option>
                                    <option value="ALIMONY">ALIMONY</option>
                                  </select>
                                </Field>

                                <Field label="Actividad Económica" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="actividad_economica"
                                    value={c.actividad_economica ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    placeholder="Ej: Comercio, Servicios, etc."
                                  />
                                </Field>

                                <Field label="Empleador" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="empleador"
                                    value={c.empleador ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                    placeholder="Nombre de la empresa"
                                  />
                                </Field>

                                <Field label="Teléfono del Empleador" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="telefono_empleador"
                                    value={c.telefono_empleador ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  />
                                </Field>

                                <Field label="Período de Ingreso" className="col-md-4">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="periodo_ingreso"
                                    value={c.periodo_ingreso ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="HOUR">HOUR</option>
                                    <option value="WEEKLY P.TIME">WEEKLY P.TIME</option>
                                    <option value="WEEKLY">WEEKLY</option>
                                    <option value="BIWEEKLY">BIWEEKLY</option>
                                    <option value="MONTHLY">MONTHLY</option>
                                    <option value="ANNUAL">ANNUAL</option>
                                  </select>
                                </Field>

                                <Field label="Ingreso por Período ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    inputMode="decimal"
                                    name="ingreso_por_periodo"
                                    value={getMoneyDisplayValue(idx, "ingreso_por_periodo", c.ingreso_por_periodo)}
                                    onChange={moneyChangeFactory(idx, "ingreso_por_periodo")}
                                    onBlur={moneyBlurFactory(idx, "ingreso_por_periodo")}
                                    disabled={isReadOnly}
                                    placeholder="0,00"
                                  />
                                </Field>

                                <Field label="Ingreso Anual ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    inputMode="decimal"
                                    name="ingreso_anual"
                                    value={getMoneyDisplayValue(idx, "ingreso_anual", c.ingreso_anual)}
                                    onChange={moneyChangeFactory(idx, "ingreso_anual")}
                                    onBlur={moneyBlurFactory(idx, "ingreso_anual")}
                                    disabled={isReadOnly}
                                    placeholder="0,00"
                                  />
                                </Field>

                                <Field label="Nota" className="col-12">
                                  <textarea
                                    rows={3}
                                    className="form-control form-control-sm"
                                    name="nota_ingreso_ocasional"
                                    value={c.nota_ingreso_ocasional ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  />
                                </Field>

                                <Field label="Período de Ingreso Ocasional" className="col-md-4">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="periodo_ingreso_ocasional"
                                    value={c.periodo_ingreso_ocasional ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="HOUR">HOUR</option>
                                    <option value="WEEKLY P.TIME">WEEKLY P.TIME</option>
                                    <option value="WEEKLY">WEEKLY</option>
                                    <option value="BIWEEKLY">BIWEEKLY</option>
                                    <option value="MONTHLY">MONTHLY</option>
                                    <option value="ANNUAL">ANNUAL</option>
                                  </select>
                                </Field>

                                <Field label="Ingreso por Período ocasional ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    inputMode="decimal"
                                    name="ingreso_por_periodo_ocasional"
                                    value={getMoneyDisplayValue(idx, "ingreso_por_periodo_ocasional", c.ingreso_por_periodo_ocasional)}
                                    onChange={moneyChangeFactory(idx, "ingreso_por_periodo_ocasional")}
                                    onBlur={moneyBlurFactory(idx, "ingreso_por_periodo_ocasional")}
                                    disabled={isReadOnly}
                                    placeholder="0,00"
                                  />
                                </Field>

                                <Field label="Ingreso ocasional anual ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    inputMode="decimal"
                                    name="ingreso_ocasional_anual"
                                    value={getMoneyDisplayValue(idx, "ingreso_ocasional_anual", c.ingreso_ocasional_anual)}
                                    onChange={moneyChangeFactory(idx, "ingreso_ocasional_anual")}
                                    onBlur={moneyBlurFactory(idx, "ingreso_ocasional_anual")}
                                    disabled={isReadOnly}
                                    placeholder="0,00"
                                  />
                                </Field>
                              </div>
                      </div>
                    </AccordionItem>

                    {/* Medios de Pago */}
                    <AccordionItem
                      id={`medios-pago-${itemId}`}
                      title="Medios de Pago"
                    >
                      {(isOpen) => (
                        <MediosPagoSection 
                          clienteId={m.cliente_id || m?.cliente?.id || m.id} 
                          isOpen={isOpen}
                        />
                      )}
                    </AccordionItem>
                  </div>
                </AccordionItem>

                {/* Datos Cobertura */}
                <AccordionItem
                  id={`cobertura-${itemId}`}
                  title="Datos Cobertura"
                  icon={<i className="fas fa-shield-alt" />}
                >
                  <div>
                      {m.cobertura_id && (
                        <div className="d-flex justify-content-end mb-2">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() =>
                              setHistorialPlanModal({
                                open: true,
                                ...buildHistorialPlanContext(m, idx),
                              })
                            }
                          >
                            <i className="fas fa-history me-1" />
                            Historial de plan
                          </button>
                        </div>
                      )}
                      {/* Si es Medicare o Medicaid, mostrar solo Elegibilidad, Cobertura y Grupo */}
                      {isMedicareOrMedicaid ? (
                        <ConfigurableFieldsGrid minWidth={200}>
                            <ConfigField label="Cobertura">
                              <select
                                className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                name="estado_cobertura"
                                value={m.estado_cobertura || ""}
                                onChange={onChange}
                                disabled={isReadOnly}
                              >
                                <option value="">Seleccione…</option>
                                <option value="Sí">Sí</option>
                                <option value="No">No</option>
                                <option value="Medicare">Medicare</option>
                                <option value="Medicaid">Medicaid</option>
                              </select>
                            </ConfigField>

                            <ConfigField label="Elegibilidad">
                              <input
                                className="form-control form-control-sm"
                                name="elegibilidad"
                                value={m.elegibilidad || ""}
                                onChange={onChange}
                                disabled={isReadOnly}
                                placeholder="Elegibilidad"
                              />
                            </ConfigField>

                            <ConfigField label="Grupo">
                              <select
                                className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                name="grupo"
                                value={m.grupo || ""}
                                onChange={onChange}
                                disabled={isReadOnly}
                              >
                                <option value="">Seleccione…</option>
                                <option value="G1">G1</option>
                                <option value="G2">G2</option>
                                <option value="G3">G3</option>
                                <option value="G4">G4</option>
                              </select>
                            </ConfigField>
                        </ConfigurableFieldsGrid>
                      ) : visibleCoverageFieldCount === 0 ? (
                        <p className="text-muted small mb-0">
                          No hay campos de cobertura habilitados para{" "}
                          <span className="fw-semibold">{coberturaTipo}</span>.
                          Configúralos en el administrador de campos por tipo de producto.
                        </p>
                      ) : (
                        <ConfigurableFieldsGrid>
                            {shouldShowCoverageField("codigo_poliza") && (
                              <ConfigField
                                label="Numero ID"
                                labelHint="Se debe colocar el número de póliza + los 2 dígitos de miembro."
                              >
                                <input
                                  className="form-control form-control-sm"
                                  type="text"
                                  name="codigo_poliza"
                                  value={m.codigo_poliza || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Codigo de Poliza"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("fecha_activacion") && (
                              <ConfigField
                                label="Fecha de Activación"
                                labelWarning={
                                  isFechaActivacionPendiente(m.fecha_activacion)
                                    ? "Este plan aún no está activo: la fecha de activación es posterior a hoy."
                                    : null
                                }
                              >
                                <DateInputWithCalendar
                                  size="sm"
                                  highlightWarning={isFechaActivacionPendiente(m.fecha_activacion)}
                                  valueIso={(m.fecha_activacion || "").slice(0, 10)}
                                  minIso="1900-01-01"
                                  maxIso="2099-12-31"
                                  disabled={isReadOnly}
                                  onChangeIso={(iso) =>
                                    onChangeFactory(idx)({
                                      target: {
                                        name: "fecha_activacion",
                                        value: iso,
                                        type: "date",
                                      },
                                    })
                                  }
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("ano_cobertura") && (
                              <ConfigField
                                label="Año de Cobertura"
                              >
                                <input
                                  type="number"
                                  min="2000"
                                  max="2100"
                                  className="form-control form-control-sm"
                                  name="ano_cobertura"
                                  value={m.ano_cobertura || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="aaaa"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("elegibilidad") && (
                              <ConfigField label="Elegibilidad">
                                <input
                                  className="form-control form-control-sm"
                                  name="elegibilidad"
                                  value={m.elegibilidad || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Elegibilidad"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("compania_id") && (
                              <ConfigField label="Compañía">
                                <CompanySelect
                                  companies={companies}
                                  value={m.compania_id ?? m.compania?.id ?? ""}
                                  onChange={onChange}
                                  disabled={isReadOnly || companiesLoading}
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("policy_number") && (
                              <ConfigField
                                label="Codigo de ID"
                                labelHint="Es el número de póliza principal sin dígitos finales."
                              >
                                <input
                                  className="form-control form-control-sm"
                                  type="text"
                                  name="policy_number"
                                  value={m.policy_number || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Codigo de ID"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("agente") && (
                              <ConfigField label="Agente">
                                <input
                                  className="form-control form-control-sm"
                                  type="text"
                                  name="agente"
                                  value={m.agente || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Ingrese el agente"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("plan") && (
                              <ConfigField label="Plan">
                                <input
                                  className="form-control form-control-sm"
                                  name="plan"
                                  value={m.plan || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Nombre del plan"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("metal") && (
                              <ConfigField label="Metal">
                                <select
                                  className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                  name="metal"
                                  value={m.metal || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                >
                                  <option value="">Seleccione…</option>
                                  <option value="BRONCE">BRONCE</option>
                                  <option value="SILVER">SILVER</option>
                                  <option value="GOLD">GOLD</option>
                                  <option value="PLATINUM">PLATINUM</option>
                                </select>
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("red") && (
                              <ConfigField label="Red">
                                <select
                                  className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                  name="red"
                                  value={m.red || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                >
                                  <option value="">Seleccione…</option>
                                  <option value="HMO">HMO</option>
                                  <option value="EPO">EPO</option>
                                  <option value="PPO">PPO</option>
                                  <option value="POS">POS</option>
                                </select>
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("estado_cobertura") && (
                              <ConfigField label="Cobertura">
                                <select
                                  className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duración-200 shadow-sm"
                                  name="estado_cobertura"
                                  value={m.estado_cobertura || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                >
                                  <option value="">Seleccione…</option>
                                  <option value="Sí">Sí</option>
                                  <option value="No">No</option>
                                  <option value="Medicare">Medicare</option>
                                  <option value="Medicaid">Medicaid</option>
                                </select>
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("pagador_id") && (
                              <ConfigField label="Pagador">
                                <PayerSelect
                                  options={payerOptionsWithOther}
                                  value={
                                    m.pagador_id === undefined ||
                                    m.pagador_id === null ||
                                    m.pagador_id === ""
                                      ? "OTRO"
                                      : String(m.pagador_id)
                                  }
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("tipo_pago") && (
                              <ConfigField label="Tipo de Pago">
                                <select
                                  className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                  name="tipo_pago"
                                  value={m.tipo_pago || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                >
                                  <option value="">Seleccione…</option>
                                  <option value="DEBITO AUTOMATICO">
                                    DEBITO AUTOMATICO
                                  </option>
                                  <option value="CTE PAGA">CTE PAGA</option>
                                  <option value="MES A MES">MES A MES</option>
                                </select>
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("dia_pago") && (
                              <ConfigField label="Dia de Pago">
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  name="dia_pago"
                                  value={m.dia_pago || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("precio") && (
                              <ConfigField label="Precio ($)">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control form-control-sm"
                                  name="precio"
                                  value={m.precio ?? ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="0.00"
                                />
                              </ConfigField>
                            )}

                            {m.fecha_cancelacion && (
                              <>
                                <ConfigField label="Fecha de Cancelación">
                                  <MdyDashDateInput
                                    size="sm"
                                    valueIso={(m.fecha_cancelacion || "").slice(0, 10)}
                                    disabled
                                    title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                    onChangeIso={() => {}}
                                  />
                                </ConfigField>
                                <ConfigField label="Vigente">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300"
                                    name="vigente"
                                    value={m.vigente === true || m.vigente === "true" || m.vigente === 1 ? "true" : "false"}
                                    disabled={true}
                                    title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                  >
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </select>
                                </ConfigField>
                              </>
                            )}

                            {m.fecha_retiro && (
                              <>
                                <ConfigField label="Fecha de Retiro">
                                  <MdyDashDateInput
                                    size="sm"
                                    valueIso={(m.fecha_retiro || "").slice(0, 10)}
                                    disabled
                                    title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                    onChangeIso={() => {}}
                                  />
                                </ConfigField>
                                <ConfigField label="Activo">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300"
                                    name="activo"
                                    value={m.activo === true || m.activo === "true" || m.activo === 1 ? "true" : "false"}
                                    disabled={true}
                                    title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                  >
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </select>
                                </ConfigField>
                              </>
                            )}

                            {(m.nota_retiro || m.nota_cancel) && (
                              <ConfigField label="Nota de Retiro">
                                <input
                                  className="form-control form-control-sm"
                                  name="nota_retiro"
                                  value={m.nota_retiro ?? m.nota_cancel ?? ""}
                                  onChange={onChange}
                                  disabled={true}
                                  title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                />
                              </ConfigField>
                            )}

                            {shouldShowCoverageField("grupo") && (
                              <ConfigField label="Grupo">
                                <select
                                  className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                  name="grupo"
                                  value={m.grupo || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                >
                                  <option value="">Seleccione…</option>
                                  <option value="G1">G1</option>
                                  <option value="G2">G2</option>
                                  <option value="G3">G3</option>
                                  <option value="G4">G4</option>
                                </select>
                              </ConfigField>
                            )}
                        </ConfigurableFieldsGrid>
                      )}
                  </div>
                </AccordionItem>
              </div>
            </div>
          </div>
        );
  };

  return (
    <div className="container-fluid p-0">
      {!readOnly && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0"><i className="fas fa-users me-2" /> Miembros</h5>
          <div className="btn-group">
            {canAdd ? (
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>Añadir</button>
            ) : (
              <button className="btn btn-primary btn-sm" disabled onClick={() => onBlockedAddClick?.()}>Añadir</button>
            )}
            <button className="btn btn-outline-primary btn-sm" onClick={() => setOpenExistente(true)}>
              <i className="fas fa-users me-1" /> Miembros existentes
            </button>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setOpenCopy(true)}>
              <i className="fas fa-copy me-1" /> Copiar
            </button>
          </div>
        </div>
      )}

      {/* Miembros Activos */}
      {activeMembers.map(({ m, idx }) => renderMemberCard({ m, idx }))}

      {/* Sección de Miembros Retirados */}
      {inactiveMembers.length > 0 && (
        <div className="mt-4 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0 text-muted">
                <i className="fas fa-users-slash me-2"></i>
                Miembros Retirados ({inactiveMembers.length})
              </h6>
            </div>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="show-retirados"
                checked={showRetirados}
                onChange={(e) => setShowRetirados(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="show-retirados">
                {showRetirados ? 'Ocultar' : 'Mostrar'} retirados
              </label>
            </div>
          </div>
          
          {showRetirados && (
            <div className="border-top pt-3">
              {inactiveMembers.map(({ m, idx }) => renderMemberCard({ m, idx }))}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      <MemberModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        editingMember={editingMember}
        defaultCoberturaTipo={defaultCoberturaTipo}
        readOnly={readOnly}
        isProspecto={isProspecto}
        onCreateLocal={onCreateLocal}
        onUpdateLocal={onUpdateLocal}
        onCreateRemote={onCreateMemberRemote}
        onRequestExistingClientModal={() => {
          setOpenModal(false);
          setOpenExistente(true);
        }}
      />

      <CopiarDatosModal
        open={openCopy}
        onClose={() => setOpenCopy(false)}
        members={sortedNormalized}
        onApply={applyCopySelection}
      />

      <ClienteExistenteModal
        open={openExistente}
        onClose={() => setOpenExistente(false)}
        grupoFamiliarId={grupoFamiliarId}
        onCreateCoberturaDeClienteExistente={handleCreateCoberturaExistente}
        defaultCoberturaTipo={defaultCoberturaTipo}
      />

      <HistorialPlanCoberturaModal
        show={historialPlanModal.open}
        onClose={() =>
          setHistorialPlanModal({
            open: false,
            members: [],
            initialCoberturaId: null,
            allowBulkArchive: false,
          })
        }
        members={historialPlanModal.members}
        initialCoberturaId={historialPlanModal.initialCoberturaId}
        allowBulkArchive={historialPlanModal.allowBulkArchive}
        readOnly={readOnly}
      />
    </div>
  );
};

export default TomaDeDatos;