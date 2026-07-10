import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";   
import UserCoverageIcon from "./UserCoverageIcon";
import MemberModal from "./MemberModal";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import {
  sanitizeMoneyInput,
  formatMoney2,
  formatMoneyDisplay,
  parseMoney,
} from "../../services/ingresos";
import { deriveCounts } from "../../utils/groupCounters";
import useLanguages from "../../hooks/useLanguages";
import ClienteExistenteModal from "./ClienteExistenteModal";
import { getTypeColor } from "../../utils/parentescoColors";
import { normalizeDateForInput } from "../../utils/formatters";
import { mergeClientePreferNonEmpty, unwrapClienteFromApi } from "../../utils/mergeClientePreferNonEmpty";
import {
  buildMemberFromClienteExistente,
  extractCoberturaFromCreateResponse,
} from "../../utils/buildMemberFromClienteExistente";
import { normalizeGeneroForSelect } from "../../utils/clienteFieldNormalize";
import TelefonosPro from "./TelefonosPro";
import { resolveClienteTelefonos } from "../../utils/phone-mappers";

import CoberturaDeleteButton from "../fase2/CoberturaDeleteButton";
import MdyDashDateInput from "../common/MdyDashDateInput";


/* ---------- Helpers de UI ---------- */

const isTomador = (m = {}) => {
  const v1 = String(m.tipo || "").toLowerCase();
  const v2 = String(m.parentesco || "").toLowerCase();
  return v1 === "tomador" || v2 === "tomador";
};


/* ---------- Helpers de datos ---------- */
const calcAge = (iso) => {
  if (!iso) return "";
  const b = new Date(iso);
  if (isNaN(b)) return "";
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
};

const buildFullName = (p = "", s = "", a = "") =>
  [p?.trim(), s?.trim(), a?.trim()].filter(Boolean).join(" ");

const getMemberDisplayName = (m = {}) => {
  const direct =
    m.nombreCompleto ||
    m.nombre_completo ||
    buildFullName(m.primer_nombre, m.segundo_nombre, m.apellidos);
  if (direct) return direct;

  const c = m.cliente || {};
  return (
    c.nombre_completo ||
    buildFullName(c.primer_nombre, c.segundo_nombre, c.apellidos) ||
    "Sin nombre"
  );
};
const toTitle = (s = "") =>
  s
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());

    const handleName = (field, onChange) => (e) => {
      const raw = e?.target?.value ?? "";
    
      // Mientras el usuario está componiendo (ej. ´ + a -> á), no normalices
      if (e?.nativeEvent?.isComposing) {
        onChange({ [field]: raw });
        return;
      }
    
      // Normalizamos: todo a minúscula + primera en mayúscula por palabra
      // Preservamos los espacios tal como los ingresa el usuario
      const normalized = normalizeNameWithSpaces(raw || "");
    
      onChange({ [field]: normalized });
    };
    

    // Normaliza nombres preservando espacios simples
    // Normaliza múltiples espacios consecutivos a uno solo, pero preserva espacios al inicio/final si el usuario los ingresa
    const normalizeNameWithSpaces = (s = "") => {
      if (!s) return "";
      
      // Primero normalizar múltiples espacios a uno solo (pero preservar espacios al inicio/final temporalmente)
      const withSingleSpaces = s.replace(/\s{2,}/g, " ");
      
      // Convertir a minúscula y capitalizar primera letra de cada palabra
      // Preservar los espacios tal como están
      return withSingleSpaces
        .toLowerCase()
        .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());
    };

    const tidy = (s = "") => s.replace(/\s+/g, " ").trim();

// Opciones de parentesco/tipo para edición rápida en la card
const PARENTESCO_OPTIONS = [
  { value: "Tomador", label: "Tomador" },
  { value: "Conyuge", label: "Cónyuge" },
  { value: "Hijo/a", label: "Hijo/a" },
  { value: "Hermano", label: "Hermano" },
  { value: "Padre", label: "Padre" },
  { value: "Madre", label: "Madre" },
  { value: "Nieto", label: "Nieto" },
  { value: "Abuelo/a", label: "Abuelo/a" },
  { value: "Suegro/a", label: "Suegro/a" },
  { value: "Tio/a", label: "Tio/a" },
  { value: "Sobrino/a", label: "Sobrino/a" }
];


const getMemberEdad = (m = {}) =>
  m.edad ?? calcAge(m.fecha_nacimiento || m.cliente?.fecha_nacimiento);

const getMemberGenero = (m = {}) =>
  normalizeGeneroForSelect(m.genero || m.cliente?.genero || "");

const yaEstaEnElGrupo = (clienteId, members = []) =>
  members.some((m) => m.cliente_id === clienteId || m?.cliente?.id === clienteId);

const mapClienteToMember = (
  c,
  tipoSel,
  coberturaTipo = "Plan de salud",
  estadoCobertura = "Sí"
) => {
  const primer  = toTitle(c.primer_nombre || c.nombre || "");
const segundo = toTitle(c.segundo_nombre || "");
const apell   = toTitle(c.apellidos || c.apellido || "");

  const fecha = c.fecha_nacimiento || c.fechaNacimiento || "";
  const nombreCompleto =
    c.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g, " ").trim();
  const edad = calcAge(fecha);
  const genero = normalizeGeneroForSelect(c.genero || "") || "Masculino";

  return {
    id: c.id || `temp-${Date.now()}-${Math.random()}`, // Asegurar ID único
    primer_nombre: primer,
    segundo_nombre: segundo,
    apellidos: apell,
    nombreCompleto,
    genero,
    edad,
    fecha_nacimiento: fecha,
    fecha_retiro: null,
    parentesco: tipoSel,
    tipo: tipoSel,
    estado_cobertura: estadoCobertura,
    cobertura_tipo: coberturaTipo,
    origen: "existente", 
    cobertura_id: null, 
    cliente_id: c.id,
    idioma: c.idioma || "",
    pais_origen: c.pais_origen || "",
    ingreso_anual: c.ingreso_anual || 0,
    nota: c.nota || "",
    cliente: {
      id: c.id,
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombre_completo: nombreCompleto,
      genero,
      fecha_nacimiento: fecha,
      edad,
      telefono: c.telefono || "",
      idioma: c.idioma || "",
      pais_origen: c.pais_origen || "",
      ingreso_anual: c.ingreso_anual || 0,
      nota: c.nota || "",
    },
  };
};

/* ---------- Ruta a ficha ---------- */
const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;   // ✅ NUEVO

/* ---------- Subcomponente: Acordeón editable por miembro ---------- */
const MemberAccordionForm = ({ member, readOnly, onChange }) => {
  // Estado para controlar si el acordeón está abierto o cerrado
  const [isOpen, setIsOpen] = useState(false);
  
  const [moneyStr, setMoneyStr] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  
  // Hidrata la máscara cuando cambie el valor real del miembro
  useEffect(() => {
    if (isEditing) return;
    const v = member?.ingreso_anual;
    console.log(
      "[ACC useEffect] miembro",
      member?.id,
      "ingreso_anual crudo desde state =",
      v
    );
    if (v === null || v === undefined || v === "") {
      setMoneyStr("");
    } else {
      setMoneyStr(formatMoney2(v)); // ej: 202588 -> "202.588,00"
    }
  }, [member?.ingreso_anual, isEditing]);

  const handle = (field) => (e) => {
    const value = e?.target?.value ?? e;
    onChange({ [field]: value });
  };
  const channelIdBase = member.id ?? member.cliente_id ?? member?.cliente?.id ?? "tmp";
  const getCommValue = (field) => !!(member?.[field] ?? member?.cliente?.[field] ?? false);
  const handleCommChange = (field) => (e) => {
    const checked = !!e?.target?.checked;
    onChange({
      [field]: checked,
      cliente: {
        ...(member.cliente || {}),
        [field]: checked,
      },
    });
  };

  const handleMoneyChange = (e) => {
    const raw = sanitizeMoneyInput(e.target.value);
    const sanitized = raw; // Ya está sanitizado
    setMoneyStr(sanitized);
    console.log(
      "[ACC handleMoneyChange] miembro",
      member?.id,
      "raw input=",
      e.target.value,
      "sanitized=",
      sanitized
    );
  };

  // Al entrar: modo edición (sin miles, separador único)
  const handleMoneyFocus = () => {
    setIsEditing(true);
    setMoneyStr((s) => {
      const sanitized = sanitizeMoneyInput(s);
      console.log(
        "[ACC handleMoneyFocus] miembro",
        member?.id,
        "moneyStr antes=",
        s,
        "después sanitize=",
        sanitized
      );
      return sanitized;
    });
  };

  // Al salir: commit al padre + formateo bonito
  const handleMoneyBlur = () => {
    const num = parseMoney(moneyStr);
    onChange({ ingreso_anual: Number.isFinite(num) ? num : 0 });
    setMoneyStr((s) => {
      const formatted = s ? formatMoney2(s) : "";
      console.log(
        "[ACC handleMoneyBlur] miembro",
        member?.id,
        "moneyStr formateado final=",
        formatted
      );
      return formatted;
    });
    setIsEditing(false);
  };

  const fechaBase = normalizeDateForInput(
    member.fecha_nacimiento || member?.cliente?.fecha_nacimiento || ""
  );

  // Normaliza teléfonos desde distintas fuentes del miembro/cliente
  const telefonosValue = resolveClienteTelefonos(
    {
      ...(member.cliente || {}),
      ...member,
      telefonos:
        (Array.isArray(member.telefonos) && member.telefonos.length > 0
          ? member.telefonos
          : member.cliente?.telefonos) ?? null,
    },
    "us"
  );

  const { languages = [] } = useLanguages();
  const resolveIdiomaName = (v) => {
    const normalize = (s) => (s ?? "").toString().trim().toLowerCase();
    const vv = normalize(v);
    if (!vv) return "";
    const found = languages.find(
      (l) => normalize(l.code) === vv || normalize(l.name) === vv
    );
    return found?.name ?? v; // si no lo encuentra, muestra lo que venga
  };

  return (
    <div className="mt-2">
      {/* Header del acordeón */}
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
        <span className={`text-sm ${isOpen ? "font-semibold" : "font-medium"}`}>
          Datos del {member.tipo || "Miembro"}
        </span>
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

      {/* Contenido del acordeón */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primer Nombre
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed capitalize"
                value={member.primer_nombre || ""}
                disabled={readOnly}
                onChange={handleName("primer_nombre", onChange)}
                style={{ textTransform: "capitalize" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Segundo nombre
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed capitalize"
                value={member.segundo_nombre || ""}
                disabled={readOnly}
                onChange={handleName("segundo_nombre", onChange)}
                style={{ textTransform: "capitalize" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellidos
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed capitalize"
                value={member.apellidos || ""}
                disabled={readOnly}
                onChange={handleName("apellidos", onChange)}
                style={{ textTransform: "capitalize" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Idioma
              </label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={resolveIdiomaName(member.idioma ?? member?.cliente?.idioma ?? "")}
                disabled={readOnly}
                onChange={(e) => {
                  const selectedName = e.target.value;
                  const lang = languages.find(l => l.name === selectedName);
                  onChange({
                    idioma: lang?.name ?? selectedName,
                    cliente: {
                      ...(member.cliente || {}),
                      idioma: lang?.name ?? selectedName, // mantén ambos sincronizados
                    },
                  });
                }}
              >
                <option value="">Seleccione</option>
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.name}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                País de Origen
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed capitalize"
                value={member.pais_origen ?? member?.cliente?.pais_origen ?? ""}
                disabled={readOnly}
                onChange={(e) => {
                  onChange({
                    pais_origen: e.target.value,
                    cliente: {
                      ...(member.cliente || {}),
                      pais_origen: e.target.value,
                    },
                  });
                }}
                style={{ textTransform: "capitalize" }}
                placeholder="País de origen"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento
              </label>
              <MdyDashDateInput
                className="shadow-sm"
                valueIso={fechaBase}
                minIso="1900-01-01"
                maxIso="2099-12-31"
                disabled={readOnly}
                onChangeIso={(iso) =>
                  handle("fecha_nacimiento")({ target: { value: iso } })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Edad
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed shadow-sm"
                disabled
                value={member.edad ?? ""}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Género
              </label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={normalizeGeneroForSelect(member.genero || member?.cliente?.genero || "")}
                disabled={readOnly}
                onChange={handle("genero")}
              >
                <option value="">Seleccione</option>
                <option>Masculino</option>
                <option>Femenino</option>
                <option>Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ingreso Anual
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                inputMode="decimal"
                value={
                  readOnly
                    ? formatMoneyDisplay(member.ingreso_anual ?? 0)
                    : moneyStr
                }
                disabled={readOnly}
                onChange={handleMoneyChange}
                onBlur={handleMoneyBlur}
                onFocus={handleMoneyFocus}
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Está en Cobertura?
              </label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={member.estado_cobertura || ""}
                disabled={readOnly}
                onChange={handle("estado_cobertura")}
              >
                <option value="Sí">Sí</option>
                <option value="No">No</option>
                <option value="Medicare">Medicare</option>
                <option value="Medicaid">Medicaid</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfonos
              </label>
              <TelefonosPro
                value={telefonosValue}
                onChange={(arr) => {
                  const safe = Array.isArray(arr) ? arr : [];
                  onChange({
                    telefonos: safe,
                    cliente: {
                      ...(member.cliente || {}),
                      telefonos: safe,
                    },
                  });
                }}
                readOnly={readOnly}
                fallbackIso="us"
                addLabel="Agregar teléfono"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medio de Comunicación Principal
              </label>
              <div className="d-flex flex-wrap gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`whatsapp-${channelIdBase}`}
                    checked={getCommValue("whatsapp")}
                    onChange={handleCommChange("whatsapp")}
                    disabled={readOnly}
                  />
                  <label className="form-check-label" htmlFor={`whatsapp-${channelIdBase}`}>
                    <i className="fab fa-whatsapp text-success me-1" />
                    WhatsApp
                  </label>
                </div>

                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`telegram-${channelIdBase}`}
                    checked={getCommValue("telegram")}
                    onChange={handleCommChange("telegram")}
                    disabled={readOnly}
                  />
                  <label className="form-check-label" htmlFor={`telegram-${channelIdBase}`}>
                    <i className="fab fa-telegram text-info me-1" />
                    Telegram
                  </label>
                </div>

                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`texto-sms-${channelIdBase}`}
                    checked={getCommValue("texto_sms")}
                    onChange={handleCommChange("texto_sms")}
                    disabled={readOnly}
                  />
                  <label className="form-check-label" htmlFor={`texto-sms-${channelIdBase}`}>
                    <i className="fas fa-sms text-primary me-1" />
                    SMS
                  </label>
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nota
              </label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-y min-h-[80px]"
                value={member.nota || ""}
                disabled={readOnly}
                onChange={handle("nota")}
                rows={3}
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Los cambios se guardarán con el botón <strong>Guardar</strong> del formulario principal.
          </div>
        </div>
      </div>
    </div>
  );
};


  


/* ======================= Componente principal ======================= */
const ProspectoDatos = ({
  familyMembers,
  setFamilyMembers,
  readOnly,
  canAdd = false,
  estadoActual,
  isProspecto = false,
  defaultCoberturaTipo = "Plan de salud",
  onCreateMemberRemote, 
  onBlockedAddClick,
  grupoFamiliarId,
  onDerivedCounts,
  onCreateCoberturaDeClienteExistente,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [openExistente, setOpenExistente] = useState(false);
  /* ---- Mutadores locales con recálculo de derivados ---- */
  const recomputeDerived = (m) => {
    const fecha =  (m.fecha_nacimiento ?? m?.cliente?.fecha_nacimiento ?? "") || "";
    const edad = calcAge(fecha);
    const nombre = 
    [toTitle(m.primer_nombre), toTitle(m.segundo_nombre), toTitle(m.apellidos)]
      .filter(Boolean)
      .join(" ") ||
    m.nombre_completo ||
    m?.cliente?.nombre_completo ||
    "Sin nombre";
  
    return { ...m, edad, nombreCompleto: nombre };
  };

  const updateMemberLocal = (id, patch) => {
    setFamilyMembers((prev) =>
      prev.map((m) => (m.id === id ? recomputeDerived({ ...m, ...patch }) : m))
    );
  };

  /* ---- Añadir miembro (abre modal) ---- */
  const handleAdd = () => {
    if (!canAdd) {
      onBlockedAddClick && onBlockedAddClick();
      return;
    }
    setModalOpen(true);
  };

    // Recalcular y notificar al padre los contadores derivados
    useEffect(() => {
        const { taxes, cobertura } = deriveCounts(familyMembers);
       onDerivedCounts?.({ taxes, cobertura });
   }, [familyMembers]);
  
     // Crear local: garantizar fecha_retiro = null por defecto
     const createLocal = async (payload) => {
      console.log("[createLocal] payload recibido desde Modal =", payload);
    
      const newId = familyMembers.length
        ? Math.max(...familyMembers.map((m) => m.id || 0)) + 1
        : 1;
    
      const rawIngreso =
        payload.ingreso_anual ??
        payload.ingresoAnual ??
        payload?.cliente?.ingreso_anual ??
        0;
    
      const normalizedIngreso =
        typeof rawIngreso === "number" ? rawIngreso : parseMoney(rawIngreso);
    
      console.log(
        "[createLocal] rawIngreso=",
        rawIngreso,
        "-> normalizedIngreso=",
        normalizedIngreso
      );
    
      const idioma = payload.idioma ?? payload?.cliente?.idioma ?? "";
      const paisOrigen = payload.pais_origen ?? payload?.cliente?.pais_origen ?? "";
    
      const merged = recomputeDerived({
        fecha_retiro: null,
        ...payload,
        ingreso_anual: normalizedIngreso,
        idioma,
        pais_origen: paisOrigen,
        cliente: {
          ...(payload.cliente || {}),
          ingreso_anual: normalizedIngreso,
          idioma,
          pais_origen: paisOrigen,
        },
        id: newId,
      });
    
      console.log("[createLocal] merged final para state =", merged);
    
      setFamilyMembers((prev) => [...prev, merged]);
      setModalOpen(false);
    };
    
    
  const updateLocal = async (id, payload) => {
    console.log("[updateLocal] id =", id, "payload recibido desde Modal =", payload);
    setFamilyMembers((prev) =>
      prev.map((m) => (m.id === id ? recomputeDerived({ ...payload, id }) : m))
    );
  };

  const removeMemberLocal = (memberId) =>
    setFamilyMembers(prev => prev.filter(m => m.id !== memberId));
  

  const createRemote = async (payload) => {
    if (typeof onCreateMemberRemote === "function") {
      await onCreateMemberRemote(payload);
    } else {
      throw new Error("No hay handler remoto configurado.");
    }
  };

  // Crear cobertura para CLIENTE EXISTENTE (cuando hay grupoFamiliarId) o agregar localmente (cuando no hay)
  const handleCreateCoberturaExistente = async (payload, clienteSeleccionado) => {
    if (!payload?.cliente_id) return;
    const clienteSelRaw =
      unwrapClienteFromApi(clienteSeleccionado) ?? clienteSeleccionado ?? {};
    const clienteSel = {
      ...clienteSelRaw,
      id: clienteSelRaw.id ?? payload.cliente_id,
    };
    if (!clienteSel.id) return;
    if (yaEstaEnElGrupo(payload.cliente_id, familyMembers)) return;

    // 🔍 Validación centralizada: evitar duplicar coberturas activas/vigentes
    if (grupoFamiliarId) {
      try {
        const conflicto = await GrupoFamiliarService.findActiveCoverageConflict(
          payload.cliente_id,
          payload.cobertura_tipo || defaultCoberturaTipo,
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
            conflicto.codigo_poliza || conflicto.policy_number,
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
              confirmButtonText: "Entendido",
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
          console.error("Error validando coberturas activas del cliente (prospecto):", e);
        }
      }
    }

    // Si NO hay grupoFamiliarId, agregar localmente (modo creación)
    if (!grupoFamiliarId) {
      // Si hay un handler externo, usarlo
      if (onCreateCoberturaDeClienteExistente) {
        await onCreateCoberturaDeClienteExistente(payload, clienteSel);
        return;
      }
      // Si no, agregar localmente
      const mLocal = mapClienteToMember(
        clienteSel,
        payload.tipo,
        payload.cobertura_tipo || defaultCoberturaTipo,
        payload.estado_cobertura || "Sí"
      );
      setFamilyMembers((prev) => [...prev, recomputeDerived(mLocal)]);
      return;
    }

    const res = await GrupoFamiliarService.createCoberturaSimple({
      grupo_familiar_id: grupoFamiliarId,
      cliente_id: payload.cliente_id,
      parentesco: payload.tipo,
      cobertura_tipo: payload.cobertura_tipo,
      estado_cobertura: payload.estado_cobertura,
    });

    const coberturaCreada = extractCoberturaFromCreateResponse(res);
    const cliOverlay =
      res?.miembro?.cliente && typeof res.miembro.cliente === "object"
        ? res.miembro.cliente
        : {};

    const merged = recomputeDerived(
      buildMemberFromClienteExistente({
        clienteRaw: mergeClientePreferNonEmpty(clienteSel, cliOverlay),
        cobertura: coberturaCreada,
        payload,
      })
    );

    setFamilyMembers((prev) => [...prev, merged]);

    if (res?.personas_taxes != null || res?.personas_cobertura != null) {
      onDerivedCounts?.({
        taxes: res.personas_taxes,
        cobertura: res.personas_cobertura,
      });
    }

    return res;
  };
  // Render: Tomador primero, resto en su orden original
const sortedMembers = familyMembers
.map((m, i) => ({ m, i }))                   // guardamos índice original
.sort((a, b) => {
  const pa = isTomador(a.m) ? 0 : 1;
  const pb = isTomador(b.m) ? 0 : 1;
  return pa - pb || a.i - b.i;               // estable
})
.map(x => x.m);


  /* --------------------------- Render --------------------------- */
  return (
    <>
      <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="fas fa-users me-2" />
                    Añadir Miembros
                  </h5>

                  {!readOnly && (
                    <div className="d-flex gap-2">
                      {/* Botón “Añadir” (NUEVO cliente) */}
                      {canAdd ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleAdd}
                          title="Crear un nuevo cliente y agregarlo"
                        >
                          Nuevo Miembro
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled
                          title={
                            (estadoActual || "").toUpperCase() === "PROSPECTO"
                              ? "Cambia el estado del grupo (distinto de Prospecto) para añadir miembros."
                              : "Activa el modo edición para añadir miembros."
                          }
                          onClick={() => onBlockedAddClick && onBlockedAddClick()}
                        >
                          Nuevo Miembro
                        </button>
                      )}

                      {/* Botón “Clientes existentes” */}
                      {canAdd ? (
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setOpenExistente(true)}
                          title="Buscar un cliente existente y agregarlo"
                        >
                          <i className="fas fa-users me-1" />
                          Miembros existentes
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          disabled
                          title={
                            (estadoActual || "").toUpperCase() === "PROSPECTO"
                              ? "Cambia el estado del grupo (distinto de Prospecto) para añadir miembros."
                              : "Activa el modo edición para añadir miembros."
                          }
                          onClick={() => onBlockedAddClick && onBlockedAddClick()}
                        >
                          <i className="fas fa-users me-1" />
                          Clientes existentes
                        </button>
                      )}
                    </div>
                  )}
                </div>


        <div className="card-body">
          {familyMembers.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="fas fa-users fa-3x mb-3 opacity-50" />
              <p>No hay miembros agregados. Haz clic en "Añadir" para comenzar.</p>
            </div>
          ) : (
            <div className="row">
                           {sortedMembers.map((member, index) => {
                const clienteId = member?.cliente_id ?? member?.cliente?.id ?? null; // ✅ NUEVO
                const nombre = getMemberDisplayName(member);
                const isExisting = member.origen === "existente";
                // Usar una key más robusta: cliente_id + id + índice como fallback
                const uniqueKey = member.cliente_id 
                  ? `cliente-${member.cliente_id}-${member.id || index}` 
                  : member.id 
                    ? `member-${member.id}` 
                    : `temp-${index}`;
                const currentState = (estadoActual || "").toUpperCase();
                const canEditParentesco =
                  !readOnly &&
                  currentState !== "TERMINADO" &&
                  currentState !== "GRUPO_FAMILIAR";

                return (
                  <div key={uniqueKey} className="col-md-12 mb-3">
                  <div className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge bg-${getTypeColor(member.tipo)}`}>
                            {member.tipo}
                          </span>
                          {canEditParentesco && (
                            <select
                              className="form-select form-select-sm"
                              value={member.tipo || "Tomador"}
                              onChange={(e) => {
                                const nuevoTipo = e.target.value;
                                updateMemberLocal(member.id, {
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
                        <CoberturaDeleteButton
    member={member}
    readOnly={readOnly}
    service={GrupoFamiliarService}     // 👈 usa el service con DELETE correcto
    removeLocal={removeMemberLocal}    // 👈 limpia el estado
    // allowDeleteTomador={false} // opcional
    // onDeleted={(m) => console.log("Eliminado:", m)}
  />

                      </div>

                      <div className="d-flex align-items-center">
                        <div
                          className="me-3 d-flex align-items-center justify-content-center"
                          style={{ width: 50 }}
                        >
                          <UserCoverageIcon status={member.estado_cobertura} size={50} />
                        </div>

                        <div className="flex-grow-1 text-center">
                          {/* ✅ NUEVO: nombre clickeable si hay clienteId */}
                          {clienteId ? (
                            <Link
                              to={CLIENTE_FICHA_PATH(clienteId)}
                              className="text-decoration-none"
                              title={`Abrir ficha del cliente #${clienteId}`}
                              // target="_blank"
                              // rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()} // no interferir con otros handlers
                            >
                              <h6 className="mb-1 text-primary">{nombre}</h6>
                            </Link>
                          ) : (
                            <h6 className="mb-1">{nombre}</h6>
                          )}
                        </div>

                        <div className="text-end" style={{ minWidth: 180 }}>
                          <small className="text-muted d-block">
                            Edad: {getMemberEdad(member) || ""}
                          </small>
                          <small className="text-muted d-block">
                            Género: {getMemberGenero(member) || ""}
                          </small>
                          <small className="text-muted d-block">
                            Cobertura: {member.estado_cobertura}
                          </small>
                        </div>
                      </div>

                   {/* ✅ Si NO es cliente existente, mostramos el acordeón normal */}
         {/* Siempre mostramos el formulario, sin importar el origen */}
<MemberAccordionForm
  member={member}
  readOnly={readOnly}
  onChange={(patch) => updateMemberLocal(member.id, patch)}
/>

        </div>
      </div>
    </div>
  );
})}
          </div>
        )}
      </div>
    </div>

      {/* Modal SOLO para añadir nuevo miembro */}
      <MemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingMember={null}
        defaultCoberturaTipo={defaultCoberturaTipo}
        canAdd={canAdd}
        readOnly={readOnly}
        isProspecto={isProspecto}
        onCreateLocal={createLocal}
        onUpdateLocal={updateLocal}
        onCreateRemote={createRemote}
        onRequestExistingClientModal={() => {
          setModalOpen(false);
          setOpenExistente(true);
        }}
      />

       {/* Modal EXISTENTE */}
   <ClienteExistenteModal
   open={openExistente}
   onClose={()=>setOpenExistente(false)}
   grupoFamiliarId={grupoFamiliarId}
   onCreateCoberturaDeClienteExistente={handleCreateCoberturaExistente}
   defaultCoberturaTipo={defaultCoberturaTipo}
 />
    </>
  );
};

export default ProspectoDatos;
