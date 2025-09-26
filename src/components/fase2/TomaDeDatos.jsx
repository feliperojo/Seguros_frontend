import React, { useMemo, useState, useCallback } from "react";
import UserCoverageIcon from "../fase2/UserCoverageIcon";
import MemberModal from "./MemberModal";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import {  computeAnnual, sanitizeMoneyInput, formatMoney2} from "../../services/ingresos";
import CopiarDatosModal, { ADDRESS_FIELDS } from "./CopiarDatosModal";
import useCompanies from "../../hooks/useCompanies";
import { buildPayerOptions } from "../../utils/payers";
import CompanySelect from "../selects/CompanySelect";
import PayerSelect from "../selects/PayerSelect";
import { formatSSN, formatUSCIS, formatPhone334 } from "../../utils/formatters";



import { getCompanyNameById, getCompanyColor } from "../../services/companies"; // si vas a mostrar chips/colores


/* =================== Utils =================== */

// Capitaliza cada palabra (soporta acentos y guiones)
const toTitle = (s = "") =>
  s
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());

// Campos de nombre a capitalizar
const NAME_FIELDS = new Set(["primer_nombre", "segundo_nombre", "apellidos"]);

const fullName = (m) => {
  const c = m?.cliente ?? m ?? {};
  const composed = [c.primer_nombre?.trim(), c.segundo_nombre?.trim(), c.apellidos?.trim()]
    .filter(Boolean)
    .join(" ");
  return composed || c.nombre_completo || m?.nombreCompleto || "Sin nombre";
};

const Field = ({ label, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label small fw-semibold text-muted">{label}</label>
    {children}
  </div>
);



// Campos que pertenecen al objeto cliente (todas las secciones)
const CLIENTE_FIELDS = new Set([
  // principales
  "primer_nombre","segundo_nombre","apellidos","fecha_nacimiento","edad","genero","idioma",
  // contacto
  "telefono","secundario","whatsapp_num","email","nota",
  // dirección
  "direccion","calle","apto","ciudad","estado","codigo_postal","condado","dir_correspondencia",
  // migratorio
  "social","status","auscis","tarjeta_numero","fecha_emision","fecha_expiracion","categoria",
  // empleo/ingreso
  "tipo_ingreso","actividad_economica","empleador","telefono_empleador","periodo_ingreso",
  "ingreso_por_periodo","ingreso_anual","nota_ingreso_ocasional","periodo_ingreso_ocasional",
  "ingreso_por_periodo_ocasional",
  // toggles
  "whatsapp","telegram","texto_sms",
]);

// Campos del nivel raíz (cobertura/meta)
const ROOT_FIELDS = new Set([
  "parentesco", "estado_cobertura", "codigo_poliza", "vigencia", "tipo",
  "fecha_activacion", "ano_cobertura", "elegibilidad",
  "compania_id", "plan", "metal", "red",
  "pagador_id", "tipo_pago", "dia_pago", "precio",
  "fecha_cancelacion", "fecha_retiro", "nota_retiro", "grupo", "nota_cancel"
]);

const MONEY_FIELDS = new Set([
  "ingreso_por_periodo",
  "ingreso_anual",
  "ingreso_por_periodo_ocasional",
  "precio", // si quieres que precio también se formatee
]);

const PHONE_FIELDS = new Set(["telefono", "secundario", "whatsapp_num", "telefono_empleador"]);

// 👇 Duplicamos a la raíz TODOS los campos de cliente (así el mapper del padre siempre los ve)
const DUPLICATE_TO_ROOT = Array.from(CLIENTE_FIELDS);

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

/** Normaliza a { root..., cliente:{...} } */
const normalizeMember = (m, idx) => {
  if (m?.cliente && typeof m.cliente === "object") return m;

  const primerRaw  = m.primer_nombre || "";
  const segundoRaw = m.segundo_nombre || "";
  const apellRaw   = m.apellidos || "";
  const fecha   = m.fecha_nacimiento || "";
  const edad    = calcAge(fecha);
  const nombre  = m.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g," ").trim();
const primer  = toTitle(primerRaw);
const segundo = toTitle(segundoRaw);
const apell   = toTitle(apellRaw);
  return {
    id: m.id ?? idx + 1,
    cliente_id: m.cliente_id ?? m.id ?? null,
    cobertura_id: m.cobertura_id ?? null,
    parentesco: m.parentesco || m.tipo || "Tomador",
    tipo: m.tipo || m.parentesco || "Tomador",
    estado_cobertura: m.estado_cobertura || "Sí",
    codigo_poliza: m.codigo_poliza || "",
    vigencia: m.vigencia || "",
    cobertura_tipo: m.cobertura_tipo || "Plan de salud",
    ano_cobertura: m.ano_cobertura || new Date().getFullYear(),
    plan: m.plan ?? null,
    metal: m.metal ?? null,
    red: m.red ?? null,
    grupo: m.grupo || "", 
    

    // duplicados mínimos para cabecera
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

    // objeto cliente completo
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
    },
  };
};

// para crear cobertura con cliente existente
const yaEstaEnElGrupo = (clienteId, members) =>
  members.some((m) => m.cliente_id === clienteId || m?.cliente?.id === clienteId);



// ===== Helpers Dirección =====
const buildDireccion = (src) =>
  [src.calle, src.apto, src.ciudad, src.estado, src.codigo_postal]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();


const AddressSection = ({ c, onChange, readOnly }) => {
  const [copyDir, setCopyDir] = React.useState(false);

  // Cuando cambie un campo de dirección:
  const handleAddressChange = (e) => {
    // 1) Propagar cambio del campo original
    onChange(e);

    // 2) Calcular 'direccion' con el valor nuevo
    const { name, value } = e.target;
    const next = {
      ...c,
      [name]: value,
    };
    const direccionConcatenada = buildDireccion(next);

    // 3) Enviar un evento sintético para actualizar 'direccion'
    onChange({
      target: { name: "direccion", value: direccionConcatenada, type: "text" },
    });

    // 4) Si el toggle está activo, sincronizar dir_correspondencia también
    if (copyDir) {
      onChange({
        target: {
          name: "dir_correspondencia",
          value: direccionConcatenada,
          type: "text",
        },
      });
    }
  };

  const handleCopyToggle = (e) => {
    const checked = !!e.target.checked;
    setCopyDir(checked);
    if (checked) {
      const direccionConcatenada = buildDireccion(c);
      onChange({
        target: {
          name: "dir_correspondencia",
          value: direccionConcatenada,
          type: "text",
        },
      });
    }
  };

  const direccionVisual = c.direccion || buildDireccion(c) || "";

  return (
    <>
      <div className="row g-3">
        <Field label="Dirección de Residencia" className="col-12">
          <input
            className="form-control form-control-sm"
            name="direccion"
            value={direccionVisual}
            onChange={onChange}
            disabled={readOnly}
            placeholder="Dirección completa (auto)"
          />
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
    </>
  );
};


/* ======================================================= */
const TomaDeDatos = ({
  familyMembers,
  setFamilyMembers,
  canAdd = false,
  readOnly = false,
  isProspecto = false,
  defaultCoberturaTipo = "Plan de salud",
  onCreateMemberRemote,   // alta remota para NUEVO
  onBlockedAddClick,
  grupoFamiliarId,
}) => {
  const [openModal, setOpenModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  
// 1) normalizados (primero)
const normalized = useMemo(
  () => (familyMembers ?? []).map(normalizeMember),
  [familyMembers]
);

// 2) compañías (puede ir antes o después, no depende de normalized)
const { companies, loading: companiesLoading } = useCompanies();

// 3) opciones de pagadores (derivado de normalized)
const payerOptions = useMemo(
  () => buildPayerOptions(normalized),
  [normalized]
);

  const [openCopy, setOpenCopy] = useState(false);

const duplicateToRootFromCliente = (m, cliente) => {
  // duplica a raíz los campos de cliente que ya usas en tu mapper/UX
  const dupe = {};
  [
    "primer_nombre","segundo_nombre","apellidos","fecha_nacimiento","edad","genero","idioma",
    "telefono","secundario","whatsapp_num","email","nota",
    "direccion","calle","apto","ciudad","estado","codigo_postal","condado","dir_correspondencia",
  ].forEach(k => { if (k in cliente) dupe[k] = cliente[k]; });

  // nombreCompleto derivado
  const nombreCompleto =
    cliente.nombre_completo ||
    [cliente.primer_nombre, cliente.segundo_nombre, cliente.apellidos].filter(Boolean).join(" ");
  if (nombreCompleto) dupe.nombreCompleto = nombreCompleto;

  return { ...m, ...dupe };
};

const applyCopySelection = ({ sourceId, fieldKeys, copyAddress, targetIds }) => {
  const src = (familyMembers || []).find(
    m => (m.id ?? m.cliente_id) === sourceId
  );
  if (!src) return;

  setFamilyMembers(prev =>
    (prev || []).map(m => {
      const mid = m.id ?? m.cliente_id;
      if (!targetIds.includes(mid)) return m;

      let next = { ...m };

      // 1) Campos raíz (cobertura)
      fieldKeys.forEach(k => {
        // por seguridad, no pises IDs ni campos inexistentes
        if (k in src) next[k] = src[k];
      });

      // 2) Bloque Dirección (cliente)
      if (copyAddress) {
        const srcCli = src.cliente || {};
        const dstCliBase = next.cliente && typeof next.cliente === "object" ? next.cliente : {};
        const newCli = { ...dstCliBase };
        ADDRESS_FIELDS.forEach(k => {
          if (k in srcCli) newCli[k] = srcCli[k];
          else if (k in src) newCli[k] = src[k]; // por si algunos vienen en raíz
        });
        next.cliente = newCli;
        next = duplicateToRootFromCliente(next, newCli);
      }

      return next;
    })
  );
};

  /* ---------- CRUD local (modal: solo AÑADIR) ---------- */
  const onCreateLocal = useCallback(
    (payload) => {
      const newId = (familyMembers?.length ? Math.max(...familyMembers.map(m => m.id || 0)) : 0) + 1;
      setFamilyMembers((prev) => [...(prev ?? []), normalizeMember({ ...payload, id: newId }, newId - 1)]);
    },
    [familyMembers, setFamilyMembers]
  );

  const onUpdateLocal = useCallback(
    (id, payload) => {
      setFamilyMembers((prev) =>
        (prev ?? []).map((m) => (m.id === id ? normalizeMember({ ...payload, id }, 0) : m))
      );
    },
    [setFamilyMembers]
  );

  /* ---------- UI ---------- */
  const handleAdd = () => {
    if (!canAdd) return onBlockedAddClick?.();
    setEditingMember(null);
    setOpenModal(true);
  };

  /* ---------- Patchers (edición en local para “Guardar” global) ---------- */
  const patchRoot = (idx, patch) => {
    setFamilyMembers((prev) =>
      (prev ?? []).map((m, i) => (i === idx ? { ...m, ...patch } : m))
    );
  };

  // ❗Clave: además de actualizar cliente, duplicamos TODOS los campos a la raíz
  const patchCliente = (idx, patch) => {
    setFamilyMembers((prev) =>
      (prev ?? []).map((m, i) => {
        if (i !== idx) return m;

        const base = m?.cliente && typeof m.cliente === "object" ? m.cliente : {};
        const nextCliente = { ...base, ...patch };

        // Derivados
        if ("fecha_nacimiento" in patch)
          nextCliente.edad = calcAge(patch.fecha_nacimiento);

        // Duplicados hacia la raíz para que el mapper del padre los tome
        const dupe = {};
        DUPLICATE_TO_ROOT.forEach((k) => {
          if (k in nextCliente) dupe[k] = nextCliente[k];
        });

        // nombreCompleto raíz derivado
        const nombreCompleto =
          nextCliente.nombre_completo ||
          [nextCliente.primer_nombre, nextCliente.segundo_nombre, nextCliente.apellidos]
            .filter(Boolean)
            .join(" ");
        if (nombreCompleto) dupe.nombreCompleto = nombreCompleto;

        return { ...m, ...dupe, cliente: nextCliente };
      })
    );
  };

  const onChangeFactory = (idx) => (e) => {
    const { name, value, type, checked } = e.target;
    let v = type === "checkbox" ? !!checked : value;
  
    // ⬇️ Máscaras
    if (name === "social") v = formatSSN(v);       // 3-2-4
    if (name === "auscis") v = formatUSCIS(v);     // A + 3-3-3
    if (PHONE_FIELDS.has(name)) v = formatPhone334(v); // Teléfono
  
    // dinero
    if (MONEY_FIELDS.has(name)) v = sanitizeMoneyInput(v);
  
    // capitalización de nombres
    if (NAME_FIELDS.has(name)) v = toTitle(v);
  
    const current = getC(normalized[idx] || {});
    const patch = { [name]: v };
  
    // cálculo ingreso anual (igual que ya tenías)
    if (name === "ingreso_por_periodo" || name === "periodo_ingreso") {
      const periodo = name === "periodo_ingreso" ? v : (current.periodo_ingreso ?? "");
      const per     = name === "ingreso_por_periodo" ? v : (current.ingreso_por_periodo ?? "");
      patch.ingreso_anual = formatMoney2(computeAnnual(periodo, per));
    }
  
    if (CLIENTE_FIELDS.has(name)) return patchCliente(idx, patch);
    if (ROOT_FIELDS.has(name))   return patchRoot(idx, patch);
    return patchCliente(idx, patch);
  };
  
  
  
  const onBlurMoneyFactory = (idx, fieldName, isCliente = true) => () => {
    const cur = getC(normalized[idx] || {});
    const val = cur?.[fieldName];
    const formatted = formatMoney2(val);
    const patch = { [fieldName]: formatted };
  
    // si salimos de ingreso_por_periodo, recalcula anual otra vez para “ajustar” los 2 decimales
    if (fieldName === "ingreso_por_periodo") {
      patch.ingreso_anual = formatMoney2(
        computeAnnual(cur.periodo_ingreso ?? "", formatted)
      );
    }
    return isCliente ? patchCliente(idx, patch) : patchRoot(idx, patch);
  };
  

  const toggleClienteBool = (idx, key) => (e) => patchCliente(idx, { [key]: !!e.target.checked });

  /* ---------- Crear cobertura para CLIENTE EXISTENTE ---------- */
  const handleCreateCoberturaExistente = useCallback(
    async (payload, clienteSeleccionado) => {
      if (!grupoFamiliarId || !payload?.cliente_id) return;
      if (yaEstaEnElGrupo(payload.cliente_id, normalized)) return;

      const res = await GrupoFamiliarService.createCoberturaSimple({
        grupo_familiar_id: grupoFamiliarId,
        cliente_id: payload.cliente_id,
        parentesco: payload.tipo,
        cobertura_tipo: payload.cobertura_tipo,
        estado_cobertura: payload.estado_cobertura,
      });

      if (res?.miembro?.cliente || res?.miembro) {
        setFamilyMembers((prev) => [...(prev ?? []), normalizeMember(res.miembro, (prev?.length ?? 0))]);
      } else {
        const c = clienteSeleccionado || {};
        const aggi = normalizeMember(
          {
            ...payload,
            cliente: {
              id: c.id,
              primer_nombre: c.primer_nombre,
              segundo_nombre: c.segundo_nombre,
              apellidos: c.apellidos,
              nombre_completo:
                c.nombre_completo ||
                [c.primer_nombre, c.segundo_nombre, c.apellidos].filter(Boolean).join(" "),
              genero: c.genero || "",
              fecha_nacimiento: c.fecha_nacimiento || "",
              idioma: c.idioma || "",
            },
            cliente_id: c.id,
          },
          (familyMembers?.length ?? 0)
        );
        setFamilyMembers((prev) => [...(prev ?? []), aggi]);
      }
      return res;
    },
    [grupoFamiliarId, normalized, setFamilyMembers, familyMembers?.length]
  );

  /* ============================ Render ============================ */
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
      <button
        className="btn btn-outline-secondary btn-sm"
        type="button"
        onClick={() => setOpenCopy(true)}
        title="Copiar datos entre miembros"
      >
        <i className="fas fa-copy me-1" /> Copiar
      </button>
    </div>
  </div>
)}


      {normalized.map((m, idx) => {
        const itemId = `member-${m.id ?? idx}`;
        const leftRightWidth = 180;
        const c = getC(m);
        const onChange = onChangeFactory(idx);
        const grupoValor = (m.grupo ?? "").toUpperCase();
        const badgeClass =
          grupoValor === "G1" ? "bg-primary" :
          grupoValor === "G2" ? "bg-success" :
          grupoValor === "G3" ? "bg-warning text-dark" :
          grupoValor === "G4" ? "bg-danger" :
          "bg-secondary";
        return (
          <div className="card shadow-sm mb-3" key={itemId}>
            {/* Header */}
            <div className="card-header bg-white border-0 px-4 py-3">
              <div className="d-flex align-items-center position-relative" style={{ minHeight: 64 }}>
                <div className="d-flex flex-column justify-content-center align-items-start me-3" style={{ width: leftRightWidth }}>
                  <span className="fw-semibold" style={{ color: "#0d6efd" }}>
                    {m.tipo || "Miembro"}
                  </span>
                  <div className="mt-2">
                    <UserCoverageIcon status={m.estado_cobertura} size={50} />
                  </div>
                </div>

                <div className="flex-grow-1 text-center">
                  <span className="fw-semibold text-dark">{fullName(m)}</span>
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
            <div className="card-body p-0">
              <div className="accordion accordion-flush" id={`accordion-${itemId}`}>
                {/* Datos Cliente */}
                <div className="accordion-item">
                  <h2 className="accordion-header" id={`cliente-${itemId}`}>
                    <button
                      className="accordion-button collapsed py-3 px-4"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#collapse-cliente-${itemId}`}
                      aria-expanded="false"
                      aria-controls={`collapse-cliente-${itemId}`}
                    >
                      <i className="fas fa-user me-2 text-muted" />
                      <span className="fw-semibold">Datos Cliente</span>
                    </button>
                  </h2>

                  <div
                    id={`collapse-cliente-${itemId}`}
                    className="accordion-collapse collapse"
                    aria-labelledby={`cliente-${itemId}`}
                    data-bs-parent={`#accordion-${itemId}`}
                  >
                    <div className="accordion-body px-4 py-4">
                      <div className="accordion" id={`sub-accordion-${itemId}`}>
                        {/* Principales */}
                        <div className="accordion-item">
                          <h2 className="accordion-header" id={`datos-principales-${itemId}`}>
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target={`#collapse-principales-${itemId}`}
                              aria-expanded="false"
                              aria-controls={`collapse-principales-${itemId}`}
                            >
                              Datos Principales
                            </button>
                          </h2>
                          <div
                            id={`collapse-principales-${itemId}`}
                            className="accordion-collapse collapse"
                            aria-labelledby={`datos-principales-${itemId}`}
                            data-bs-parent={`#sub-accordion-${itemId}`}
                          >
                            <div className="accordion-body">
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
                                    value={(c.fecha_nacimiento || "").slice(0,10)}
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
                                    className="form-select form-select-sm"
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
                                  <select
                                    className="form-select form-select-sm"
                                    name="idioma"
                                    value={c.idioma ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="Español">Español</option>
                                    <option value="Inglés">Inglés</option>
                                    <option value="Otro">Otro</option>
                                  </select>
                                </Field>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Estatus migratorio */}
                        <div className="accordion-item">
                          <h2 className="accordion-header" id={`estatus-${itemId}`}>
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target={`#collapse-estatus-${itemId}`}
                              aria-expanded="false"
                              aria-controls={`collapse-estatus-${itemId}`}
                            >
                              Estatus migratorio
                            </button>
                          </h2>
                          <div
                            id={`collapse-estatus-${itemId}`}
                            className="accordion-collapse collapse"
                            aria-labelledby={`estatus-${itemId}`}
                            data-bs-parent={`#sub-accordion-${itemId}`}
                          >
                            <div className="accordion-body">
                              <div className="row g-3">
                              <Field label="Social" className="col-md-6">
                                <input
                                  className="form-control form-control-sm"
                                  name="social"
                                  value={c.social ?? ""}
                                  onChange={onChange}
                                  disabled={readOnly}
                                  inputMode="numeric"
                                  maxLength={11}            // 123-45-6789
                                  
                                />
                              </Field>

                                <Field label="Status" className="col-md-6">
                                  <select
                                    className="form-select form-select-sm"
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
                                      maxLength={12}            // A123-456-789  (use 13 if you show A-123-456-789)
                                      
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
                          </div>
                        </div>

                        {/* Contacto */}
                        <div className="accordion-item">
                          <h2 className="accordion-header" id={`datos-contacto-${itemId}`}>
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target={`#collapse-contacto-${itemId}`}
                              aria-expanded="false"
                              aria-controls={`collapse-contacto-${itemId}`}
                            >
                              Datos de Contacto
                            </button>
                          </h2>
                          <div
                            id={`collapse-contacto-${itemId}`}
                            className="accordion-collapse collapse"
                            aria-labelledby={`datos-contacto-${itemId}`}
                            data-bs-parent={`#sub-accordion-${itemId}`}
                          >
                            <div className="accordion-body">
                              <div className="row g-3">
                              <Field label="Teléfono" className="col-md-4">
                                    <input
                                      className="form-control form-control-sm"
                                      name="telefono"
                                      value={c.telefono ?? ""}
                                      onChange={onChange}
                                      disabled={readOnly}
                                      inputMode="numeric"
                                      maxLength={12}               
                                    
                                    />
                                  </Field>

                                  <Field label="Tel. Secundario" className="col-md-4">
                                    <input
                                      className="form-control form-control-sm"
                                      name="secundario"
                                      value={c.secundario ?? ""}
                                      onChange={onChange}
                                      disabled={readOnly}
                                      inputMode="numeric"
                                      maxLength={12}
                                      
                                    />
                                  </Field>

                                  <Field label="WhatsApp" className="col-md-4">
                                    <input
                                      className="form-control form-control-sm"
                                      name="whatsapp_num"
                                      value={c.whatsapp_num ?? ""}
                                      onChange={onChange}
                                      disabled={readOnly}
                                      inputMode="numeric"
                                      maxLength={12}
                                      
                                    />
                                  </Field>

                                  {/* Empleador */}
                                  <Field label="Teléfono del Empleador" className="col-md-6">
                                    <input
                                      className="form-control form-control-sm"
                                      name="telefono_empleador"
                                      value={c.telefono_empleador ?? ""}
                                      onChange={onChange}
                                      disabled={readOnly}
                                      inputMode="numeric"
                                      maxLength={12}
                                      
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

                                <div className="col-12">
                                  <div className="small fw-semibold text-muted mb-1">Servicios de Mensajería</div>

                                  <div className="form-check form-check-inline">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`svc-wa-${itemId}`}
                                      checked={!!c.whatsapp}
                                      onChange={toggleClienteBool(idx, "whatsapp")}
                                      disabled={readOnly}
                                    />
                                    <label className="form-check-label" htmlFor={`svc-wa-${itemId}`}>WhatsApp</label>
                                  </div>

                                  <div className="form-check form-check-inline">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`svc-tg-${itemId}`}
                                      checked={!!c.telegram}
                                      onChange={toggleClienteBool(idx, "telegram")}
                                      disabled={readOnly}
                                    />
                                    <label className="form-check-label" htmlFor={`svc-tg-${itemId}`}>Telegram</label>
                                  </div>

                                  <div className="form-check form-check-inline">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`svc-sms-${itemId}`}
                                      checked={!!c.texto_sms}
                                      onChange={toggleClienteBool(idx, "texto_sms")}
                                      disabled={readOnly}
                                    />
                                    <label className="form-check-label" htmlFor={`svc-sms-${itemId}`}>Texto SMS</label>
                                  </div>
                                </div>

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
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Dirección */}
                        <div className="accordion-item">
                          <h2 className="accordion-header" id={`direccion-${itemId}`}>
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target={`#collapse-direccion-${itemId}`}
                              aria-expanded="false"
                              aria-controls={`collapse-direccion-${itemId}`}
                            >
                              Dirección
                            </button>
                          </h2>
                          <div
                            id={`collapse-direccion-${itemId}`}
                            className="accordion-collapse collapse"
                            aria-labelledby={`direccion-${itemId}`}
                            data-bs-parent={`#sub-accordion-${itemId}`}
                          >
<div className="accordion-body">
  <AddressSection c={c} onChange={onChange} readOnly={readOnly} idBase={itemId} />
</div>



                              
                          </div>
                        </div>

                        {/* Empleo e Ingreso */}
                        <div className="accordion-item">
                          <h2 className="accordion-header" id={`empleo-ingreso-${itemId}`}>
                            <button
                              className="accordion-button collapsed"
                              type="button"
                              data-bs-toggle="collapse"
                              data-bs-target={`#collapse-empleo-ingreso-${itemId}`}
                              aria-expanded="false"
                              aria-controls={`collapse-empleo-ingreso-${itemId}`}
                            >
                              Datos de Empleo e Ingreso
                            </button>
                          </h2>
                          <div
                            id={`collapse-empleo-ingreso-${itemId}`}
                            className="accordion-collapse collapse"
                            aria-labelledby={`empleo-ingreso-${itemId}`}
                            data-bs-parent={`#sub-accordion-${itemId}`}
                          >
                            <div className="accordion-body">
                              <div className="row g-3">
                                <Field label="Tipo de Ingreso" className="col-md-6">
                                  <select
                                    className="form-select form-select-sm"
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
                                    className="form-select form-select-sm"
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
                                        inputMode="decimal"           // teclado numérico en móvil
                                        name="ingreso_por_periodo"
                                        value={c.ingreso_por_periodo ?? ""}
                                        onChange={onChange}
                                        onBlur={onBlurMoneyFactory(idx, "ingreso_por_periodo")} // ← formatea 2 decimales
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
                                        disabled={readOnly}      // o readOnly={!readOnly} si no quieres permitir edición manual
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
                                    className="form-select form-select-sm"
                                    name="periodo_ingreso_ocasional"
                                    value={c.periodo_ingreso_ocasional ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  >
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
                          </div>
                        </div>
                        {/* Fin sub-acordeones */}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Datos Cobertura */}
                {/* Datos Cobertura */}
<div className="accordion-item">
  <h2 className="accordion-header" id={`cobertura-${itemId}`}>
    <button
      className="accordion-button collapsed py-3 px-4"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target={`#collapse-cobertura-${itemId}`}
      aria-expanded="false"
      aria-controls={`collapse-cobertura-${itemId}`}
    >
      <i className="fas fa-shield-alt me-2 text-muted" />
      <span className="fw-semibold">Datos Cobertura</span>
    </button>
  </h2>

  <div
    id={`collapse-cobertura-${itemId}`}
    className="accordion-collapse collapse"
    aria-labelledby={`cobertura-${itemId}`}
    data-bs-parent={`#accordion-${itemId}`}
  >
    <div className="accordion-body px-4 py-4">

      {/* Row 1 */}
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

      {/* Row 2 */}
      <div className="row g-3">
      <Field label="Compañía" className="col-md-3">
        <CompanySelect
          companies={companies}
          value={m.compania_id ?? m.compania?.id ?? ""}
          onChange={onChange}                    // <-- works with onChangeFactory(e)
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
            className="form-select form-select-sm"
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
            className="form-select form-select-sm"
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

      {/* Row 3 */}
      <div className="row g-3">
        <Field label="Cobertura" className="col-md-3">
          <select
            className="form-select form-select-sm"
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
                options={payerOptions}
                value={m.pagador_id ?? ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </Field>


        <Field label="Tipo de Pago" className="col-md-3">
          <select
            className="form-select form-select-sm"
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

      {/* Row 4 */}
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
            className="form-select form-select-sm"
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
  </div>
</div>

              </div>
            </div>
          </div>
        );
      })}

      {/* Modal único: SOLO para añadir */}
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
  members={normalized}          // usa los normalizados para tener root+cliente
  onApply={applyCopySelection}
/>

    </div>
  );
};

export default TomaDeDatos;
