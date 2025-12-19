import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaMapMarkerAlt } from "react-icons/fa";

// Services
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
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
  "primer_nombre", "segundo_nombre", "apellidos", "fecha_nacimiento", "edad", "genero", "idioma",
  "telefono", "secundario", "whatsapp_num", "email", "nota",
  "direccion", "calle", "apto", "ciudad", "estado", "codigo_postal", "condado", "dir_correspondencia",
  "social", "status", "auscis", "tarjeta_numero", "fecha_emision", "fecha_expiracion", "categoria",
  "tipo_ingreso", "actividad_economica", "empleador", "telefono_empleador", "periodo_ingreso",
  "ingreso_por_periodo", "ingreso_anual", "nota_ingreso_ocasional", "periodo_ingreso_ocasional",
  "ingreso_por_periodo_ocasional", "whatsapp", "telegram", "texto_sms"
]);

const ROOT_FIELDS = new Set([
  "parentesco", "estado_cobertura", "codigo_poliza", "vigencia", "tipo",
  "fecha_activacion", "ano_cobertura", "elegibilidad",
  "compania_id", "plan", "metal", "red",
  "pagador_id", "tipo_pago", "dia_pago", "precio",
  "fecha_cancelacion", "fecha_retiro", "nota_retiro", "grupo", "nota_cancel"
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
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"
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
    fecha_activacion: m.fecha_activacion || "",
    vigencia: m.vigencia || "",
    cobertura_tipo: m.cobertura_tipo || "Plan de salud",
    ano_cobertura: m.ano_cobertura || new Date().getFullYear(),
    plan: m.plan ?? null,
    metal: m.metal ?? null,
    red: m.red ?? null,
    grupo: m.grupo || "",
    primer_nombre: primer,
    segundo_nombre: segundo,
    apellidos: apell,
    genero: m.genero || "",
    fecha_nacimiento: fecha,
    edad,
    idioma: m.idioma || "",
    ingreso_anual: m.ingreso_anual || "",
    nombreCompleto: nombre,
    nota: m.nota || "",
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
    "primer_nombre", "segundo_nombre", "apellidos", "fecha_nacimiento", "edad", "genero", "idioma",
    "telefono", "secundario", "whatsapp_num", "email", "nota",
    "direccion", "calle", "apto", "ciudad", "estado", "codigo_postal", "condado", "dir_correspondencia"
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

  const navigate = useNavigate();

  // Normalización y ordenamiento
  const normalized = useMemo(
    () => (familyMembers ?? []).map((m, i) => recomputeDerived(normalizeMember(m, i))),
    [familyMembers]
  );

  // Mantener miembro + índice original
const sortedWithIndex = useMemo(() => {
  return normalized
    .map((m, i) => ({ m, idx: i })) // idx = posición en familyMembers/normalized
    .sort((a, b) => {
      const pa = isTomador(a.m) ? 0 : 1;
      const pb = isTomador(b.m) ? 0 : 1;
      return pa - pb || a.idx - b.idx;
    });
}, [normalized]);

// Solo los miembros (para cosas que no necesitan el índice)
const sortedNormalized = useMemo(
  () => sortedWithIndex.map((x) => x.m),
  [sortedWithIndex]
);

  // Compañías y pagadores
  const { companies, loading: companiesLoading } = useCompanies();
  const payerOptions = useMemo(() => buildPayerOptions(normalized), [normalized]);
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

      const base = {
        fecha_retiro: null,
        ...payload,
        id: newId,
        ingreso_anual: ingreso,
        idioma,
        cliente: {
          ...(payload.cliente || {}),
          ingreso_anual: ingreso,
          idioma
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

    const current = getC(normalized[idx] || {});
    const patch = { [name]: v };

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
              idioma: c.idioma || ""
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

{sortedWithIndex.map(({ m, idx }) => {
  const itemId = `member-${m.id ?? idx}`;
  const leftRightWidth = 180;
  const c = getC(m);
  const onChange = onChangeFactory(idx); // ✅ idx = índice original en familyMembers
  const grupoValor = (m.grupo ?? "").toUpperCase();
        const badgeClass =
          grupoValor === "G1" ? "bg-primary" :
          grupoValor === "G2" ? "bg-success" :
          grupoValor === "G3" ? "bg-warning text-dark" :
          grupoValor === "G4" ? "bg-danger" :
          "bg-secondary";

        const clienteId = m?.cliente_id ?? m?.cliente?.id ?? null;

        return (
          <div className="card shadow-sm mb-3" key={itemId}>
            {/* Header */}
            <div className="card-header bg-white border-0 px-4 py-3">
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
                                    disabled={readOnly}
                                    style={{ textTransform: "capitalize" }}
                                  />
                                </Field>

                                <Field label="Segundo Nombre" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="segundo_nombre"
                                    value={c.segundo_nombre ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    style={{ textTransform: "capitalize" }}
                                  />
                                </Field>

                                <Field label="Apellidos" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="apellidos"
                                    value={c.apellidos ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    style={{ textTransform: "capitalize" }}
                                  />
                                </Field>

                                <Field label="Fecha de Nacimiento" className="col-md-4">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_nacimiento"
                                    value={normalizeDateForInput(c.fecha_nacimiento || "")}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                                    disabled={readOnly}
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
                                    disabled={readOnly}
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                  />
                                </Field>
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
                                    disabled={readOnly}
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
                                    disabled={readOnly}
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
                                    disabled={readOnly}
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
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field label="Fecha Emisión" className="col-md-3">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_emision"
                                    value={(c.fecha_emision || "").slice(0,10)}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field label="Fecha Expiración" className="col-md-3">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_expiracion"
                                    value={(c.fecha_expiracion || "").slice(0,10)}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field label="Categoría" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="categoria"
                                    value={c.categoria ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                                    readOnly={readOnly}
                                  />
                                </Field>

                                <Field label="Email" className="col-md-6">
                                  <input
                                    type="email"
                                    className="form-control form-control-sm"
                                    name="email"
                                    value={c.email ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                                    disabled={readOnly}
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
                              <AddressSection c={c} onChange={onChange} readOnly={readOnly} />
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
                                    disabled={readOnly}
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
                                    disabled={readOnly}
                                    placeholder="Ej: Comercio, Servicios, etc."
                                  />
                                </Field>

                                <Field label="Empleador" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="empleador"
                                    value={c.empleador ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    placeholder="Nombre de la empresa"
                                  />
                                </Field>

                                <Field label="Teléfono del Empleador" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="telefono_empleador"
                                    value={c.telefono_empleador ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field label="Período de Ingreso" className="col-md-4">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="periodo_ingreso"
                                    value={c.periodo_ingreso ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                                    value={c.ingreso_por_periodo ?? ""}
                                    onChange={onChange}
                                    onBlur={onBlurMoneyFactory(idx, "ingreso_por_periodo")}
                                    disabled={readOnly}
                                    placeholder="0.00"
                                  />
                                </Field>

                                <Field label="Ingreso Anual ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    inputMode="decimal"
                                    name="ingreso_anual"
                                    value={c.ingreso_anual ?? ""}
                                    onChange={onChange}
                                    onBlur={onBlurMoneyFactory(idx, "ingreso_anual")}
                                    disabled={readOnly}
                                    placeholder="0.00"
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
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field label="Período de Ingreso Ocasional" className="col-md-6">
                                  <select
                                    className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                                    name="periodo_ingreso_ocasional"
                                    value={c.periodo_ingreso_ocasional ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                                    disabled={readOnly}
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
                      <div className="row g-3">
                        <Field label="Código Póliza" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            type="text"
                            name="codigo_poliza"
                            value={m.codigo_poliza || ""}
                            onChange={onChange}
                            disabled={readOnly}
                            placeholder="ID Póliza"
                          />
                        </Field>

                        <Field label="Fecha de Activación" className="col-md-3">
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            name="fecha_activacion"
                            value={(m.fecha_activacion || "").slice(0, 10)}
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>

                        <Field label="Año de Cobertura" className="col-md-3">
                          <input
                            type="number"
                            min="2000"
                            max="2100"
                            className="form-control form-control-sm"
                            name="ano_cobertura"
                            value={m.ano_cobertura || ""}
                            onChange={onChange}
                            disabled={readOnly}
                            placeholder="aaaa"
                          />
                        </Field>

                        <Field label="Elegibilidad" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="elegibilidad"
                            value={m.elegibilidad || ""}
                            onChange={onChange}
                            disabled={readOnly}
                            placeholder="Elegibilidad"
                          />
                        </Field>
                      </div>

                      <div className="row g-3">
                        <Field label="Compañía" className="col-md-3">
                          <CompanySelect
                            companies={companies}
                            value={m.compania_id ?? m.compania?.id ?? ""}
                            onChange={onChange}
                            disabled={readOnly || companiesLoading}
                          />
                        </Field>

                        <Field label="Plan" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="plan"
                            value={m.plan || ""}
                            onChange={onChange}
                            disabled={readOnly}
                            placeholder="Nombre del plan"
                          />
                        </Field>

                        <Field label="Metal" className="col-md-3">
                          <select
                            className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                            name="metal"
                            value={m.metal || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          >
                            <option value="">Seleccione…</option>
                            <option value="BRONCE">BRONCE</option>
                            <option value="SILVER">SILVER</option>
                            <option value="GOLD">GOLD</option>
                            <option value="PLATINUM">PLATINUM</option>
                          </select>
                        </Field>

                        <Field label="Red" className="col-md-3">
                          <select
                            className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                            name="red"
                            value={m.red || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          >
                            <option value="">Seleccione…</option>
                            <option value="HMO">HMO</option>
                            <option value="EPO">EPO</option>
                            <option value="PPO">PPO</option>
                            <option value="POS">POS</option>
                          </select>
                        </Field>
                      </div>

                      <div className="row g-3">
                        <Field label="Cobertura" className="col-md-3">
                          <select
                            className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                            name="estado_cobertura"
                            value={m.estado_cobertura || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          >
                            <option value="">Seleccione…</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                            <option value="Medicare">Medicare</option>
                            <option value="Medicaid">Medicaid</option>
                          </select>
                        </Field>

                        <Field label="Pagador" className="col-md-3">
                          <PayerSelect
                            options={payerOptionsWithOther}
                            value={
                              m.pagador_id === undefined || m.pagador_id === null || m.pagador_id === ""
                                ? "OTRO"
                                : String(m.pagador_id)
                            }
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>

                        <Field label="Tipo de Pago" className="col-md-3">
                          <select
                            className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                            name="tipo_pago"
                            value={m.tipo_pago || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          >
                            <option value="">Seleccione…</option>
                            <option value="DEBITO AUTOMATICO">DEBITO AUTOMATICO</option>
                            <option value="CTE PAGA">CTE PAGA</option>
                            <option value="MES A MES">MES A MES</option>
                          </select>
                        </Field>

                        <Field label="Dia de Pago" className="col-md-3">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            name="dia_pago"
                            value={m.dia_pago || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>
                      </div>

                      <div className="row g-3">
                        <Field label="Precio ($)" className="col-md-3">
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            name="precio"
                            value={m.precio ?? ""}
                            onChange={onChange}
                            disabled={readOnly}
                            placeholder="0.00"
                          />
                        </Field>

                        <Field label="Fecha de Cancelación" className="col-md-3">
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            name="fecha_cancelacion"
                            value={(m.fecha_cancelacion || "").slice(0, 10)}
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>

                        <Field label="Fecha de Retiro" className="col-md-3">
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            name="fecha_retiro"
                            value={(m.fecha_retiro || "").slice(0, 10)}
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>

                        <Field label="Nota de Retiro" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="nota_retiro"
                            value={m.nota_retiro ?? m.nota_cancel ?? ""}
                            onChange={onChange}
                            disabled={readOnly}
                            placeholder="Notas…"
                          />
                        </Field>
                      </div>

                      <div className="row g-3">
                        <Field label="Grupo" className="col-md-3">
                          <select
                            className="form-select form-select-sm rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 transition-all duration-200 shadow-sm"
                            name="grupo"
                            value={m.grupo || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          >
                            <option value="">Seleccione…</option>
                            <option value="G1">G1</option>
                            <option value="G2">G2</option>
                            <option value="G3">G3</option>
                            <option value="G4">G4</option>
                          </select>
                        </Field>
                      </div>
                  </div>
                </AccordionItem>
              </div>
            </div>
          </div>
        );
      })}

      {/* Modales */}
      <MemberModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        editingMember={editingMember}
        defaultCoberturaTipo={defaultCoberturaTipo}
        canAdd={canAdd}
        readOnly={readOnly}
        isProspecto={isProspecto}
        onCreateLocal={onCreateLocal}
        onUpdateLocal={onUpdateLocal}
        onCreateRemote={onCreateMemberRemote}
        grupoFamiliarId={grupoFamiliarId}
        onCreateCoberturaDeClienteExistente={handleCreateCoberturaExistente}
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