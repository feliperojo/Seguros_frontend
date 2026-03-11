import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaMapMarkerAlt } from "react-icons/fa";

// Services
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import systemConfigService from "../../services/SystemConfigService";
import { computeAnnual, sanitizeMoneyInput, formatMoney2, parseMoney } from "../../services/ingresos";

// Components
import UserCoverageIcon from "../fase2/UserCoverageIcon";
import MemberModal from "./MemberModal";
import CopiarDatosModal, { ADDRESS_FIELDS } from "./CopiarDatosModal";
import ClienteExistenteModal from "../fase2/ClienteExistenteModal";
import CompanySelect from "../selects/CompanySelect";
import PayerSelect from "../selects/PayerSelect";
import LanguageSelect from "../selects/LanguageSelect";
import TelefonosPro from "./TelefonosPro";
import MediosPagoAccordionItem from "../MediosPagoAccordionItem";
import MediosPagoSection from "../MediosPagoSection";

// Hooks
import useCompanies from "../../hooks/useCompanies";

// Utils
import { formatSSN, formatUSCIS, formatPhone334, normalizeDateForInput } from "../../utils/formatters";
import { toLegacyFields } from "../../utils/phones";
import { inflatePhones } from "../../utils/phone-mappers";
import { getTypeColor } from "../../utils/parentescoColors";
import { buildPayerOptions } from "../../utils/payers";

/* =================== CONSTANTES =================== */
const NAME_FIELDS = new Set(["primer_nombre", "segundo_nombre", "apellidos"]);
const MONEY_FIELDS = new Set(["ingreso_por_periodo", "ingreso_anual", "ingreso_por_periodo_ocasional", "precio"]);
const PHONE_FIELDS = new Set(["telefono", "secundario", "whatsapp_num", "telefono_empleador"]);

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
  const c = m?.cliente ?? m ?? {};
  const composed = [c.primer_nombre?.trim(), c.segundo_nombre?.trim(), c.apellidos?.trim()]
    .filter(Boolean)
    .join(" ");
  return composed || c.nombre_completo || m?.nombreCompleto || "Sin nombre";
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
  [src.calle, src.apto, src.ciudad, src.estado, src.codigo_postal]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const yaEstaEnElGrupo = (clienteId, members) =>
  members.some((m) => m.cliente_id === clienteId || m?.cliente?.id === clienteId);

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;

/* =================== UTILIDADES DE FECHA =================== */
// Convierte YYYY-MM-DD a mm/dd/yyyy (formato visual)
const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return "";
  const normalized = normalizeDateForInput(dateStr);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const [year, month, day] = normalized.split("-");
  return `${month}/${day}/${year}`;
};

// Convierte mm/dd/yyyy (formato visual) a YYYY-MM-DD (formato interno)
const parseDateFromDisplay = (displayStr) => {
  if (!displayStr) return "";
  // Eliminar espacios y caracteres no numéricos excepto /
  const cleaned = displayStr.trim().replace(/[^\d\/]/g, "");
  // Intentar parsear mm/dd/yyyy o mm/dd/yy
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length === 3) {
    let [month, day, year] = parts;
    // Si el año tiene 2 dígitos, asumir 2000-2099
    if (year.length === 2) {
      year = `20${year}`;
    }
    // Validar y formatear
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
      return `${year}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    }
  }
  // Si no se puede parsear, intentar normalizar como YYYY-MM-DD
  return normalizeDateForInput(displayStr);
};

// Formatea el input mientras el usuario escribe (mm/dd/yyyy)
const formatDateInput = (value) => {
  // Eliminar todo excepto números
  const digits = value.replace(/\D/g, "");
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  // Limitar a 8 dígitos (mm/dd/yyyy)
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

/* =================== COMPONENTE ACORDEÓN TAILWIND =================== */
const AccordionItem = ({ id, title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Pasar isOpen a los hijos si es una función
  const renderChildren = () => {
    if (typeof children === 'function') {
      return children(isOpen);
    }
    return children;
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:ring-offset-1 rounded-lg transition-all duration-200 shadow-sm ${
          isOpen 
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200" 
            : "bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-800 border border-gray-200"
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className={`text-base ${isOpen ? "text-blue-500" : "text-gray-500"}`}>{icon}</span>}
          <span className={`text-sm ${isOpen ? "font-semibold" : "font-medium"}`}>{title}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-all duration-200 ${
            isOpen ? "transform rotate-180 text-blue-500" : "text-gray-500"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen
            ? "max-h-none opacity-100 mt-2 overflow-visible"
            : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="px-4 py-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          {renderChildren()}
        </div>
      </div>
    </div>
  );
};

/* =================== NORMALIZACIÓN =================== */
const normalizeMember = (m, idx) => {
  if (m?.cliente && typeof m.cliente === "object") return m;

  const primerRaw = m.primer_nombre || "";
  const segundoRaw = m.segundo_nombre || "";
  const apellRaw = m.apellidos || "";
  const fecha = m.fecha_nacimiento || "";
  const edad = calcAge(fecha);
  const primer = toTitle(primerRaw);
  const segundo = toTitle(segundoRaw);
  const apell = toTitle(apellRaw);
  const nombre = m.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g, " ").trim();

  return {
    id: m.id ?? idx + 1,
    cliente_id: m.cliente_id ?? m.id ?? null,
    cobertura_id: m.cobertura_id ?? null,
    parentesco: m.parentesco || m.tipo || "Tomador",
    tipo: m.tipo || m.parentesco || "Tomador",
    estado_cobertura: m.estado_cobertura || "Sí",
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
    genero: m.genero || "",
    fecha_nacimiento: fecha,
    edad,
    idioma: m.idioma || "",
    pais_origen: m.pais_origen || "",
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
      genero: m.genero || "",
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
      status: m.status || "",
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
      whatsapp: !!m.whatsapp,
      telegram: !!m.telegram,
      texto_sms: !!m.texto_sms,
      telefonos: inflatePhones(m?.cliente?.telefonos || [], "co")
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
const Field = ({ label, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label small fw-semibold text-muted">{label}</label>
    {children}
  </div>
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
  isProspecto = false,
  defaultCoberturaTipo = "Plan de salud",
  onCreateMemberRemote,
  onBlockedAddClick,
  grupoFamiliarId
}) => {
  const [openModal, setOpenModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [openExistente, setOpenExistente] = useState(false);
  const [openCopy, setOpenCopy] = useState(false);
  // Estado para mantener valores visuales temporales de fecha de nacimiento (formato mm/dd/yyyy)
  const [fechaNacimientoDisplay, setFechaNacimientoDisplay] = useState({});
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

    // Normalizar fecha de nacimiento para asegurar formato YYYY-MM-DD
    // Si viene en formato visual mm/dd/yyyy, convertirlo
    if (name === "fecha_nacimiento" && v) {
      if (v.includes("/")) {
        // Es formato visual, convertir a interno
        v = parseDateFromDisplay(v) || "";
      } else {
        // Ya está en formato interno o necesita normalización
        v = normalizeDateForInput(v);
      }
    }

    const current = getC(normalized[idx] || {});
    const patch = { [name]: v };

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

    if (CLIENTE_FIELDS.has(name)) return patchCliente(idx, patch);
    if (ROOT_FIELDS.has(name)) return patchRoot(idx, patch);
    return patchCliente(idx, patch);
  };

  // Handler especial para fecha de nacimiento con formato visual mm/dd/yyyy
  // El usuario ve y escribe en formato mm/dd/yyyy, pero guardamos internamente en YYYY-MM-DD
  const fechaNacimientoChangeFactory = (idx) => (e) => {
    const { value } = e.target;
    // Formatear mientras el usuario escribe (mm/dd/yyyy)
    const formatted = formatDateInput(value);
    
    // Guardar el valor visual temporalmente para que el usuario vea lo que está escribiendo
    setFechaNacimientoDisplay(prev => ({ ...prev, [idx]: formatted }));
    
    // Intentar convertir a formato interno si el formato visual es válido
    const internalFormat = parseDateFromDisplay(formatted);
    
    // Solo guardar si podemos convertir a formato interno válido
    if (internalFormat) {
      const syntheticEvent = {
        target: {
          name: "fecha_nacimiento",
          value: internalFormat,
          type: "text"
        }
      };
      onChangeFactory(idx)(syntheticEvent);
    }
  };

  // Handler para cuando el usuario termina de escribir (onBlur)
  // Asegura que siempre guardamos en formato interno YYYY-MM-DD
  const fechaNacimientoBlurFactory = (idx) => (e) => {
    const { value } = e.target;
    // Convertir formato visual mm/dd/yyyy a formato interno YYYY-MM-DD
    const internalFormat = parseDateFromDisplay(value);
    
    // Limpiar el valor visual temporal
    setFechaNacimientoDisplay(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    
    // Si el formato es válido, guardar en formato interno
    if (internalFormat) {
      const syntheticEvent = {
        target: {
          name: "fecha_nacimiento",
          value: internalFormat,
          type: "text"
        }
      };
      onChangeFactory(idx)(syntheticEvent);
    } else if (value.trim() === "") {
      // Si está vacío, limpiar
      const syntheticEvent = {
        target: {
          name: "fecha_nacimiento",
          value: "",
          type: "text"
        }
      };
      onChangeFactory(idx)(syntheticEvent);
    }
  };

  // Obtener el valor visual para mostrar en el input
  const getFechaNacimientoDisplayValue = (idx, fechaNacimiento) => {
    // Si hay un valor visual temporal (el usuario está escribiendo), usarlo
    if (fechaNacimientoDisplay[idx] !== undefined) {
      return fechaNacimientoDisplay[idx];
    }
    // De lo contrario, convertir el formato interno a visual
    return formatDateForDisplay(fechaNacimiento || "");
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

        fieldKeys.forEach(k => {
          if (k in src) next[k] = src[k];
        });

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
            clienteSeleccionado?.nombre_completo ??
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

      if (res?.miembro?.cliente || res?.miembro) {
        const mSrv = res.miembro;
        const coberturaId = mSrv.cobertura_id ?? mSrv?.cobertura?.id ?? res?.cobertura?.id ?? res?.id ?? null;

        const merged = normalizeMember(
          {
            ...mSrv,
            tipo: mSrv.tipo || payload.tipo,
            parentesco: mSrv.parentesco || payload.tipo,
            estado_cobertura: mSrv.estado_cobertura || payload.estado_cobertura,
            cobertura_tipo: mSrv.cobertura_tipo || payload.cobertura_tipo,
            cobertura_id: coberturaId,
            _remote_created: true
          },
          (familyMembers?.length ?? 0)
        );
        setFamilyMembers(prev => [...(prev ?? []), merged]);
      } else {
        const c = clienteSeleccionado || {};
        const nombreCompleto = c.nombre_completo ||
          [c.primer_nombre, c.segundo_nombre, c.apellidos].filter(Boolean).join(" ");
        const local = normalizeMember(
          {
            cliente_id: c.id,
            cobertura_id: null,
            tipo: payload.tipo,
            parentesco: payload.tipo,
            estado_cobertura: payload.estado_cobertura,
            cobertura_tipo: payload.cobertura_tipo,
            cliente: {
              id: c.id,
              primer_nombre: c.primer_nombre,
              segundo_nombre: c.segundo_nombre,
              apellidos: c.apellidos,
              nombre_completo: nombreCompleto,
              genero: c.genero || "",
              fecha_nacimiento: c.fecha_nacimiento || "",
              idioma: c.idioma || "",
              pais_origen: c.pais_origen || ""
            },
            _remote_created: true
          },
          (familyMembers?.length ?? 0)
        );
        setFamilyMembers(prev => [...(prev ?? []), local]);
      }

      return res;
    },
    [grupoFamiliarId, normalized, setFamilyMembers, familyMembers?.length]
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

    const clienteId = m?.cliente_id ?? m?.cliente?.id ?? null;
    
    // Detectar si la cobertura está inactiva
    const isInactive = m.activo === false;
    // Si está inactiva, bloquear todos los campos
    const isReadOnly = readOnly || isInactive;
    
    // Detectar si es Medicare o Medicaid para mostrar solo campos específicos
    const isMedicareOrMedicaid =
      m.estado_cobertura === "Medicare" || m.estado_cobertura === "Medicaid";

    // Tipo de producto (cobertura_tipo) para controlar visibilidad de campos
    const coberturaTipo =
      m.cobertura_tipo || defaultCoberturaTipo || "Plan de salud";

    // Config visual de campos de cobertura por tipo (system_config.coverage_fields_by_tipo).
    // enabledFields = lista de campos a OCULTAR para ese tipo (los que están en la lista no se muestran).
    const cfgCoberturaPorTipo =
      coverageFieldConfig && coverageFieldConfig[coberturaTipo];
    const hiddenCoverageFields =
      cfgCoberturaPorTipo && Array.isArray(cfgCoberturaPorTipo.enabledFields)
        ? cfgCoberturaPorTipo.enabledFields
        : null; // null → sin config: mostrar todos los campos de cobertura

    const shouldShowCoverageField = (fieldKey) => {
      if (!hiddenCoverageFields) return true;
      return !hiddenCoverageFields.includes(fieldKey);
    };

    // Config visual de campos del cliente por tipo (system_config.client_fields_by_tipo).
    // enabledFields = lista de campos a OCULTAR para ese tipo (los que están en la lista no se muestran).
    const cfgClientePorTipo =
      clientFieldConfig && clientFieldConfig[coberturaTipo];
    const hiddenClientFields =
      cfgClientePorTipo && Array.isArray(cfgClientePorTipo.enabledFields)
        ? cfgClientePorTipo.enabledFields
        : null; // null → sin config: mostrar todos los campos de cliente

    const shouldShowClientField = (fieldKey) => {
      if (!hiddenClientFields) return true;
      return !hiddenClientFields.includes(fieldKey);
    };

        return (
          <div 
            className={`card shadow-sm mb-3 ${isInactive ? 'border-warning' : ''}`} 
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
                  <span className={`badge bg-${getTypeColor(m.tipo)}`}>
                    {m.tipo || "Miembro"}
                  </span>
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
                      Género: {c.genero ?? m.genero ?? "—"}
                    </div>
                    <div className="small">
                      Grupo:{" "}
                      <span className={`badge ${badgeClass}`}>
                        {grupoValor || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acordeones */}
            <div className="card-body p-4">
              <div className="space-y-2">
                {/* Datos Cliente */}
                <AccordionItem
                  id={`cliente-${itemId}`}
                  title="Datos Cliente"
                  icon={<i className="fas fa-user" />}
                >
                  <div className="space-y-2">
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
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    name="fecha_nacimiento"
                                    value={getFechaNacimientoDisplayValue(idx, c.fecha_nacimiento)}
                                    onChange={fechaNacimientoChangeFactory(idx)}
                                    onBlur={fechaNacimientoBlurFactory(idx)}
                                    disabled={isReadOnly}
                                    placeholder="mm/dd/yyyy"
                                    maxLength={10}
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
                                    value={c.genero ?? ""}
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
                                
                                {shouldShowClientField("peso") && (
                                  <Field label="Peso (lb)" className="col-md-2">
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
                                  </Field>
                                )}

                                {shouldShowClientField("altura") && (
                                  <Field label="Altura (pies)" className="col-md-2">
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
                                  </Field>
                                )}

                                {shouldShowClientField("pulgadas") && (
                                  <Field label="Altura (pulgadas)" className="col-md-2">
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
                                  </Field>
                                )}
                              </div>
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
                                    value={c.status ?? ""}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="P. TRABAJO">P. TRABAJO</option>
                                    <option value="RESIDENTE">RESIDENTE</option>
                                    <option value="CIUDADANO">CIUDADANO</option>
                                    <option value="I-862">I-862</option>
                                    <option value="I-797">I-797</option>
                                    <option value="I-589 ASILUM">I-589 ASILUM</option>
                                    <option value="ESTUDIANTE">ESTUDIANTE</option>
                                    <option value="VISA E2">VISA E2</option>
                                    <option value="VISA K1">VISA K1</option>
                                    <option value="VISA J">VISA J</option>
                                    <option value="I-94">I-94</option>
                                    <option value="TPS">TPS</option>
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
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_emision"
                                    value={(c.fecha_emision || "").slice(0,10)}
                                    onChange={onChange}
                                    disabled={isReadOnly}
                                  />
                                </Field>

                                <Field label="Fecha Expiración" className="col-md-3">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_expiracion"
                                    value={(c.fecha_expiracion || "").slice(0,10)}
                                    onChange={onChange}
                                    disabled={isReadOnly}
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
                                    value={Array.isArray(c.telefonos) ? c.telefonos : []}
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

                                <div className="col-12">
                                  <div className="small fw-semibold text-muted mt-2">Ingreso Ocasional</div>
                                </div>

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

                                <Field label="Período de Ingreso Ocasional" className="col-md-6">
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

                                <Field label="Ingreso por Período ocasional ($)" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    inputMode="decimal"
                                    name="ingreso_por_periodo_ocasional"
                                    value={c.ingreso_por_periodo_ocasional ?? ""}
                                    onChange={onChange}
                                    onBlur={onBlurMoneyFactory(idx, "ingreso_por_periodo_ocasional")}
                                    disabled={isReadOnly}
                                    placeholder="0.00"
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
                      {/* Si es Medicare o Medicaid, mostrar solo Elegibilidad, Cobertura y Grupo */}
                      {isMedicareOrMedicaid ? (
                        <>
                          <div className="row g-3">
                            <Field label="Cobertura" className="col-md-4">
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
                            </Field>

                            <Field label="Elegibilidad" className="col-md-4">
                              <input
                                className="form-control form-control-sm"
                                name="elegibilidad"
                                value={m.elegibilidad || ""}
                                onChange={onChange}
                                disabled={isReadOnly}
                                placeholder="Elegibilidad"
                              />
                            </Field>

                            <Field label="Grupo" className="col-md-4">
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
                            </Field>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Campos normales cuando NO es Medicare/Medicaid */}
                          <div className="row g-3">
                            {shouldShowCoverageField("codigo_poliza") && (
                              <Field label="Numero ID" className="col-md-3">
                                <input
                                  className="form-control form-control-sm"
                                  type="text"
                                  name="codigo_poliza"
                                  value={m.codigo_poliza || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Codigo de Poliza"
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("fecha_activacion") && (
                              <Field
                                label="Fecha de Activación"
                                className="col-md-3"
                              >
                                <input
                                  type="date"
                                  className="form-control form-control-sm"
                                  name="fecha_activacion"
                                  value={(m.fecha_activacion || "").slice(
                                    0,
                                    10
                                  )}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("ano_cobertura") && (
                              <Field
                                label="Año de Cobertura"
                                className="col-md-3"
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
                              </Field>
                            )}

                            {shouldShowCoverageField("elegibilidad") && (
                              <Field label="Elegibilidad" className="col-md-3">
                                <input
                                  className="form-control form-control-sm"
                                  name="elegibilidad"
                                  value={m.elegibilidad || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Elegibilidad"
                                />
                              </Field>
                            )}
                          </div>

                          <div className="row g-3">
                            {shouldShowCoverageField("compania_id") && (
                              <Field label="Compañía" className="col-md-3">
                                <CompanySelect
                                  companies={companies}
                                  value={m.compania_id ?? m.compania?.id ?? ""}
                                  onChange={onChange}
                                  disabled={isReadOnly || companiesLoading}
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("policy_number") && (
                              <Field label="Codigo de ID" className="col-md-3">
                                <input
                                  className="form-control form-control-sm"
                                  type="text"
                                  name="policy_number"
                                  value={m.policy_number || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Codigo de ID"
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("agente") && (
                              <Field label="Agente" className="col-md-3">
                                <input
                                  className="form-control form-control-sm"
                                  type="text"
                                  name="agente"
                                  value={m.agente || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Ingrese el agente"
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("plan") && (
                              <Field label="Plan" className="col-md-3">
                                <input
                                  className="form-control form-control-sm"
                                  name="plan"
                                  value={m.plan || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                  placeholder="Nombre del plan"
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("metal") && (
                              <Field label="Metal" className="col-md-3">
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
                              </Field>
                            )}
                          </div>

                          <div className="row g-3">
                            {shouldShowCoverageField("red") && (
                              <Field label="Red" className="col-md-3">
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
                              </Field>
                            )}

                            {shouldShowCoverageField("estado_cobertura") && (
                              <Field label="Cobertura" className="col-md-3">
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
                              </Field>
                            )}

                            {shouldShowCoverageField("pagador_id") && (
                              <Field label="Pagador" className="col-md-3">
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
                              </Field>
                            )}

                            {shouldShowCoverageField("tipo_pago") && (
                              <Field label="Tipo de Pago" className="col-md-3">
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
                              </Field>
                            )}
                          </div>

                          <div className="row g-3">
                            {shouldShowCoverageField("dia_pago") && (
                              <Field label="Dia de Pago" className="col-md-3">
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  name="dia_pago"
                                  value={m.dia_pago || ""}
                                  onChange={onChange}
                                  disabled={isReadOnly}
                                />
                              </Field>
                            )}

                            {shouldShowCoverageField("precio") && (
                              <Field label="Precio ($)" className="col-md-3">
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
                              </Field>
                            )}

                            {m.fecha_cancelacion && (
                              <>
                                <Field label="Fecha de Cancelación" className="col-md-3">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_cancelacion"
                                    value={(m.fecha_cancelacion || "").slice(0, 10)}
                                    onChange={onChange}
                                    disabled={true}
                                    title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                  />
                                </Field>
                                <Field label="Vigente" className="col-md-3">
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
                                </Field>
                              </>
                            )}

                            {m.fecha_retiro && (
                              <>
                                <Field label="Fecha de Retiro" className="col-md-3">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_retiro"
                                    value={(m.fecha_retiro || "").slice(0, 10)}
                                    onChange={onChange}
                                    disabled={true}
                                    title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                  />
                                </Field>
                                <Field label="Activo" className="col-md-3">
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
                                </Field>
                              </>
                            )}

                            {(m.nota_retiro || m.nota_cancel) && (
                              <Field label="Nota de Retiro" className="col-md-3">
                                <input
                                  className="form-control form-control-sm"
                                  name="nota_retiro"
                                  value={m.nota_retiro ?? m.nota_cancel ?? ""}
                                  onChange={onChange}
                                  disabled={true}
                                  title="Este campo solo puede ser modificado por procesos automáticos de renovación"
                                />
                              </Field>
                            )}
                          </div>

                          <div className="row g-3">
                            {shouldShowCoverageField("grupo") && (
                              <Field label="Grupo" className="col-md-3">
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
                              </Field>
                            )}
                          </div>
                        </>
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
    </div>
  );
};

export default TomaDeDatos;