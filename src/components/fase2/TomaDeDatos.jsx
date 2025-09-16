import React, { useMemo, useState, useCallback } from "react";
import UserCoverageIcon from "../fase2/UserCoverageIcon";
import MemberModal from "./MemberModal";
import apiRequest from "../../services/api"; 
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

// --- util: nombre completo (cliente anidado o plano)
const fullName = (m) => {
  const c = m?.cliente ?? m ?? {};
  const composed = [c.primer_nombre?.trim(), c.segundo_nombre?.trim(), c.apellidos?.trim()]
    .filter(Boolean)
    .join(" ");
  return composed || c.nombre_completo || m?.nombreCompleto || "Sin nombre";
};

// --- util: campo + etiqueta
const Field = ({ label, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label small fw-semibold text-muted">{label}</label>
    {children}
  </div>
);

// --- mapeos: dónde se guardan los campos
const CLIENTE_FIELDS = new Set([
  // datos principales
  "primer_nombre", "segundo_nombre", "apellidos", "fecha_nacimiento", "edad", "genero", "idioma",
  // contacto
  "telefono", "secundario", "whatsapp_num", "email", "nota",
  "dir_correspondencia",
  // dirección
  "direccion", "calle", "apto", "ciudad", "estado", "codigo_postal", "condado",
  // migratorio
  "social", "status", "auscis", "tarjeta_numero", "fecha_emision", "fecha_expiracion", "categoria",
  // empleo/ingreso
  "tipo_ingreso", "actividad_economica", "empleador", "telefono_empleador",
  "periodo_ingreso", "ingreso_por_periodo", "ingreso_anual",
  "nota_ingreso_ocasional", "periodo_ingreso_ocasional", "ingreso_por_periodo_ocasional",
  // toggles de mensajería
  "whatsapp", "telegram", "texto_sms",
]);

const ROOT_FIELDS = new Set([
  "parentesco", "estado_cobertura", "codigo_poliza", "vigencia", "tipo"
]);

// --- helpers
const getC = (m) => (m?.cliente ? m.cliente : m);

// edad derivada
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

// mapea cliente API → card que tu UI entiende (plano + anidado)
const mapClienteToMember = (c, tipoSel, coberturaTipo = "Plan de salud", estadoCobertura = "Sí") => {
  const primer  = c.primer_nombre || c.nombre || "";
  const segundo = c.segundo_nombre || "";
  const apell   = c.apellidos || c.apellido || "";
  const fecha   = c.fecha_nacimiento || c.fechaNacimiento || "";
  const nombreCompleto = c.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g, " ").trim();
  const edad = calcAge(fecha);
  const genero = c.genero || "Masculino";

  return {
    // plano (fallback)
    primer_nombre: primer,
    segundo_nombre: segundo,
    apellidos: apell,
    nombreCompleto,
    genero,
    edad,
    fecha_nacimiento: fecha,
    // cobertura/meta
    parentesco: tipoSel,
    tipo: tipoSel,
    estado_cobertura: estadoCobertura,
    cobertura_tipo: coberturaTipo,
    cliente_id: c.id,
    // anidado (lo que la card prefiere)
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
    },
  };
};

// evita duplicados en el grupo
const yaEstaEnElGrupo = (clienteId, members) =>
  members.some(m => m.cliente_id === clienteId || m?.cliente?.id === clienteId);

const TomaDeDatos = ({
  familyMembers,
  setFamilyMembers,
  onSaveCobertura,                  // lo mantengo tal cual lo usas abajo
  // props homogeneizados
  canAdd = false,
  readOnly = false,
  isProspecto = false,
  defaultCoberturaTipo = "Plan de salud",
  onCreateMemberRemote,             // alta remota en edición (para NUEVO)
  onBlockedAddClick,
  // ⬇️ NUEVO: pásame el id del grupo
  grupoFamiliarId,
}) => {
  const [openModal, setOpenModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const members = useMemo(() => familyMembers ?? [], [familyMembers]);

  // --- CRUD local que consume MemberModal
  const onCreateLocal = useCallback((payload) => {
    const newId = members.length ? Math.max(...members.map(m => m.id || 0)) + 1 : 1;
    setFamilyMembers(prev => [...prev, { ...payload, id: newId }]);
  }, [members, setFamilyMembers]);

  const onUpdateLocal = useCallback((id, payload) => {
    setFamilyMembers(prev => prev.map(m => (m.id === id ? { ...payload, id } : m)));
  }, [setFamilyMembers]);

  // --- UI acciones
  const handleAdd = () => {
    if (!canAdd) { onBlockedAddClick?.(); return; }
    setEditingMember(null);
    setOpenModal(true);
  };
  const handleEdit = (m) => { setEditingMember(m); setOpenModal(true); };

  // --- patchers
  const patchRoot = (idx, patch) => {
    setFamilyMembers(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const patchCliente = (idx, patch) => {
    setFamilyMembers(prev =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        const base = m?.cliente && typeof m.cliente === "object" ? m.cliente : {};
        return { ...m, cliente: { ...base, ...patch } };
      })
    );
  };

  // --- único onChange para inputs/selects
  const onChangeFactory = (idx) => (e) => {
    const { name, value, type, checked } = e.target;

    // toggles (checkbox)
    if (["checkbox"].includes(type)) {
      if (CLIENTE_FIELDS.has(name)) return patchCliente(idx, { [name]: !!checked });
      if (ROOT_FIELDS.has(name))   return patchRoot(idx,     { [name]: !!checked });
      return patchCliente(idx, { [name]: !!checked });
    }

    // valores normales
    if (CLIENTE_FIELDS.has(name)) {
      const patch = { [name]: value };
      if (name === "fecha_nacimiento") patch.edad = calcAge(value);
      return patchCliente(idx, patch);
    }
    if (ROOT_FIELDS.has(name)) return patchRoot(idx, { [name]: value });
    return patchCliente(idx, { [name]: value });
  };

  // --- toggles de mensajería
  const toggleClienteBool = (idx, key) => (e) => patchCliente(idx, { [key]: !!e.target.checked });

  // =============== NUEVO: crear cobertura con cliente existente (BACKEND) ===============
  const handleCreateCoberturaExistente = useCallback(
     async (payload, clienteSeleccionado) => {
    if (!grupoFamiliarId) {
      console.error("Falta grupoFamiliarId");
      return;
    }
    if (!payload?.cliente_id) {
      console.error("cliente_id inválido");
      return;
    }
    if (yaEstaEnElGrupo(payload.cliente_id, members)) {
      // opcional: toast.warn("Ese cliente ya está en este grupo");
      return;
    }

    // 1) Crea la cobertura en backend (usa el servicio centralizado)

   const res = await GrupoFamiliarService.createCoberturaSimple({
     grupo_familiar_id: grupoFamiliarId,
     cliente_id: payload.cliente_id,
     parentesco: payload.tipo,                     // o payload.parentesco
     cobertura_tipo: payload.cobertura_tipo,       // respeta la convención del backend
     estado_cobertura: payload.estado_cobertura,   // "Sí", "No", "Medicare", etc.
   });

    // 2) Normaliza la respuesta: si el backend devuelve el miembro listo → úsalo
    if (res?.miembro?.cliente || res?.miembro) {
      setFamilyMembers(prev => [
        ...prev,
        {
          ...res.miembro,
          tipo: res.miembro.tipo || payload.tipo,
          parentesco: res.miembro.parentesco || payload.tipo,
          estado_cobertura: res.miembro.estado_cobertura || payload.estado_cobertura,
          cobertura_tipo: res.miembro.cobertura_tipo || payload.cobertura_tipo,
        },
      ]);
    } else {
      // 3) Fallback: compón la card con el cliente seleccionado
      const miembroLocal = mapClienteToMember(
        clienteSeleccionado,
        payload.tipo,
        payload.cobertura_tipo,
        payload.estado_cobertura
      );
      setFamilyMembers(prev => [...prev, miembroLocal]);
    }

    return res;
  },
  [grupoFamiliarId, members, setFamilyMembers]
);

  // =======================================================================================

  return (
    <div className="container-fluid p-0">
      {/* Header con botón Añadir */}
      {!readOnly && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0"><i className="fas fa-users me-2" /> Miembros</h5>
          {canAdd ? (
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>Añadir</button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              disabled
              title="Activa Edición o cambia de estado para añadir miembros."
              onClick={() => onBlockedAddClick?.()}
            >
              Añadir
            </button>
          )}
        </div>
      )}

      {members.map((m, idx) => {
        const itemId = `member-${m.id ?? idx}`;
        const leftRightWidth = 180;
        const c = getC(m);
        const onChange = onChangeFactory(idx);

        return (
          <div className="card shadow-sm mb-3" key={itemId}>
            {/* Header de la card */}
            <div className="card-header bg-white border-0 px-4 py-3">
              <div className="d-flex align-items-center position-relative" style={{ minHeight: 64 }}>
                {/* IZQUIERDA: rol + icono */}
                <div className="d-flex flex-column justify-content-center align-items-start me-3" style={{ width: leftRightWidth }}>
                  <span className="fw-semibold" style={{ color: "#0d6efd" }}>
                    {m.tipo || "Miembro"}
                  </span>
                  <div className="mt-2">
                    <UserCoverageIcon status={m.estado_cobertura} size={50} />
                  </div>
                </div>

                {/* CENTRO: nombre */}
                <div className="flex-grow-1 text-center">
                  <span className="fw-semibold text-dark">{fullName(m)}</span>
                </div>

                {/* DERECHA: edad / género + botón editar */}
                <div className="d-flex align-items-center justify-content-end ms-3" style={{ width: leftRightWidth }}>
                  <div className="text-start me-3">
                    <div className="small">
                      <span className="text-muted">Edad: </span>
                      <span className="fw-semibold text-muted">{c.edad ?? m.edad ?? "N/A"}</span>
                    </div>
                    <div className="small text-muted">Género: {c.genero ?? m.genero ?? "—"}</div>
                  </div>
                  {!readOnly && (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => handleEdit(m)}>
                      <i className="fas fa-edit" />
                    </button>
                  )}
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
                      <div className="d-flex align-items-center">
                        <i className="fas fa-user me-2 text-muted" />
                        <span className="fw-semibold">Datos Cliente</span>
                      </div>
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
                                  />
                                </Field>
                                <Field label="Segundo Nombre" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="segundo_nombre"
                                    value={c.segundo_nombre ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="Apellidos" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="apellidos"
                                    value={c.apellidos ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="Fecha de Nacimiento" className="col-md-4">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_nacimiento"
                                    value={c.fecha_nacimiento ?? ""}
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
                                    <option value="Ciudadano">Ciudadano</option>
                                    <option value="Residente">Residente</option>
                                    <option value="Visa">Visa</option>
                                    <option value="Permiso de Trabajo">Permiso de Trabajo</option>
                                    <option value="Indocumentado">Indocumentado</option>
                                    <option value="Otro">Otro</option>
                                  </select>
                                </Field>

                                <Field label="A/USCIS" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="auscis"
                                    value={c.auscis ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                                    value={c.fecha_emision ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="Fecha Expiración" className="col-md-3">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    name="fecha_expiracion"
                                    value={c.fecha_expiracion ?? ""}
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
                                    placeholder="Número principal"
                                  />
                                </Field>
                                <Field label="Tel. Secundario" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="secundario"
                                    value={c.secundario ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    placeholder="Número alterno"
                                  />
                                </Field>
                                <Field label="WhatsApp" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="whatsapp_num"
                                    value={c.whatsapp_num ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    placeholder="Número de WhatsApp"
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

                                {/* toggles */}
                                <div className="col-12">
                                  <div className="small fw-semibold text-muted mb-1">
                                    Servicios de Mensajería
                                  </div>

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

                                <Field label="Dir. Correspondencia" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="dir_correspondencia"
                                    value={c.dir_correspondencia ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
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
                              <div className="row g-3">
                                <Field label="Dirección de Residencia" className="col-12">
                                  <input
                                    className="form-control form-control-sm"
                                    name="direccion"
                                    value={c.direccion ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    placeholder="Dirección completa"
                                  />
                                </Field>

                                <Field label="Calle" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="calle"
                                    value={c.calle ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="APT" className="col-md-2">
                                  <input
                                    className="form-control form-control-sm"
                                    name="apto"
                                    value={c.apto ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="Ciudad" className="col-md-3">
                                  <input
                                    className="form-control form-control-sm"
                                    name="ciudad"
                                    value={c.ciudad ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>

                                <Field label="Estado" className="col-md-3">
                                  <input
                                    className="form-control form-control-sm"
                                    name="estado"
                                    value={c.estado ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="Código Postal" className="col-md-3">
                                  <input
                                    className="form-control form-control-sm"
                                    name="codigo_postal"
                                    value={c.codigo_postal ?? ""}
                                    onChange={onChange}
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
                                      id={`copy-dir-${itemId}`}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          patchCliente(idx, {
                                            dir_correspondencia: c.direccion ?? "",
                                          });
                                        }
                                      }}
                                      disabled={readOnly}
                                    />
                                    <label className="form-check-label" htmlFor={`copy-dir-${itemId}`}>
                                      Copiar Dirección
                                    </label>
                                  </div>
                                </div>
                              </div>
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
                                    <option value="Empleado">Empleado</option>
                                    <option value="Independiente">Independiente</option>
                                    <option value="Contratista">Contratista</option>
                                    <option value="Jubilado">Jubilado</option>
                                    <option value="Desempleado">Desempleado</option>
                                    <option value="Otro">Otro</option>
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
                                    <option value="Semanal">Semanal</option>
                                    <option value="Quincenal">Quincenal</option>
                                    <option value="Mensual">Mensual</option>
                                    <option value="Bimestral">Bimestral</option>
                                    <option value="Trimestral">Trimestral</option>
                                    <option value="Semestral">Semestral</option>
                                    <option value="Anual">Anual</option>
                                  </select>
                                </Field>

                                <Field label="Ingreso por Período ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="ingreso_por_periodo"
                                    value={c.ingreso_por_periodo ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                    placeholder="0.00"
                                  />
                                </Field>

                                <Field label="Ingreso Anual ($)" className="col-md-4">
                                  <input
                                    className="form-control form-control-sm"
                                    name="ingreso_anual"
                                    value={c.ingreso_anual ?? ""}
                                    onChange={onChange}
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
                                    className="form-select form-select-sm"
                                    name="periodo_ingreso_ocasional"
                                    value={c.periodo_ingreso_ocasional ?? ""}
                                    onChange={onChange}
                                    disabled={readOnly}
                                  >
                                    <option value="">Seleccione</option>
                                    <option value="Único">Único</option>
                                    <option value="Mensual">Mensual</option>
                                    <option value="Trimestral">Trimestral</option>
                                    <option value="Semestral">Semestral</option>
                                    <option value="Anual">Anual</option>
                                  </select>
                                </Field>

                                <Field label="Ingreso por Período ocasional ($)" className="col-md-6">
                                  <input
                                    className="form-control form-control-sm"
                                    name="ingreso_por_periodo_ocasional"
                                    value={c.ingreso_por_periodo_ocasional ?? ""}
                                    onChange={onChange}
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

                {/* Datos Cobertura (ROOT_FIELDS) */}
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
                      <div className="d-flex align-items-center">
                        <i className="fas fa-shield-alt me-2 text-muted" />
                        <span className="fw-semibold">Datos Cobertura</span>
                      </div>
                    </button>
                  </h2>
                  <div
                    id={`collapse-cobertura-${itemId}`}
                    className="accordion-collapse collapse"
                    aria-labelledby={`cobertura-${itemId}`}
                    data-bs-parent={`#accordion-${itemId}`}
                  >
                    <div className="accordion-body px-4 py-4">
                      <div className="row g-3">
                        <Field label="Parentesco" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            value={m.parentesco || m.tipo || ""}
                            name="parentesco"
                            onChange={onChange}
                            placeholder="Tomador / Cónyuge / Hijo/a..."
                            disabled={readOnly}
                          />
                        </Field>

                        <Field label="Estado Cobertura" className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            name="estado_cobertura"
                            value={m.estado_cobertura || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          >
                            <option value="">Seleccione</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                            <option value="Medicare">Medicare</option>
                            <option value="Medicaid">Medicaid</option>
                          </select>
                        </Field>

                        <Field label="Código Póliza" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="codigo_poliza"
                            value={m.codigo_poliza || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>

                        <Field label="Vigencia (AAAA-MM)" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="vigencia"
                            placeholder="2025-01"
                            value={m.vigencia || ""}
                            onChange={onChange}
                            disabled={readOnly}
                          />
                        </Field>
                      </div>

                      {!readOnly && (
                        <div className="text-end mt-4">
                          <button
                            className="btn btn-primary btn-sm px-4"
                            onClick={() => onSaveCobertura?.(members[idx])}
                          >
                            <i className="fas fa-save me-2" />
                            Guardar Cobertura
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })}

      {/* Modal único */}
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
        // ⬇️ pasa el id del grupo y el callback que crea cobertura para EXISTENTES
        grupoFamiliarId={grupoFamiliarId}
        onCreateCoberturaDeClienteExistente={handleCreateCoberturaExistente}
      />
    </div>
  );
};

export default TomaDeDatos;
