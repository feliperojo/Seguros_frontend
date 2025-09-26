import React, { useState, useEffect } from "react";
import UserCoverageIcon from "./UserCoverageIcon";
import MemberModal from "./MemberModal";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import { sanitizeMoneyInput, formatMoney2, formatMoneyDisplay, parseMoney } from "../../services/ingresos";
import { deriveCounts } from "../../utils/groupCounters";
import languages from "../../services/idiomas";
/* ---------- Helpers de UI ---------- */
const getTypeColor = (tipo) => {
  switch (tipo) {
    case "Tomador": return "primary";
    case "Conyuge": return "info";
    case "Hijo/a": return "success";
    case "Hermano":
    case "Dependiente": return "secondary";
    case "Padre": return "dark";
    case "Madre": return "danger";
    case "Nieto":
    case "Abuelo/a":
    case "Suegro/a":
    case "Tio/a":
    case "Sobrino/a": return "warning";
    default: return "secondary";
  }
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

const getMemberEdad = (m = {}) =>
  m.edad ?? calcAge(m.fecha_nacimiento || m.cliente?.fecha_nacimiento);

const getMemberGenero = (m = {}) => m.genero || m.cliente?.genero || "";

const yaEstaEnElGrupo = (clienteId, members = []) =>
  members.some((m) => m.cliente_id === clienteId || m?.cliente?.id === clienteId);

const mapClienteToMember = (
  c,
  tipoSel,
  coberturaTipo = "Plan de salud",
  estadoCobertura = "Sí"
) => {
  const primer = c.primer_nombre || c.nombre || "";
  const segundo = c.segundo_nombre || "";
  const apell = c.apellidos || c.apellido || "";
  const fecha = c.fecha_nacimiento || c.fechaNacimiento || "";
  const nombreCompleto =
    c.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g, " ").trim();
  const edad = calcAge(fecha);
  const genero = c.genero || "Masculino";

  return {
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
    cliente_id: c.id,
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

/* ---------- Subcomponente: Acordeón editable por miembro ---------- */
const MemberAccordionForm = ({ member, readOnly, onChange }) => {
  const accId = `acc-m-${member.id}`;
  const hdrId = `hdr-m-${member.id}`;
  const colId = `col-m-${member.id}`;

  const handle = (field) => (e) => {
    const value = e?.target?.value ?? e;
    onChange({ [field]: value });
  };

  const handleMoneyChange = (field) => (e) => {
       const raw = sanitizeMoneyInput(e.target.value);     // deja solo dígitos + separadores
       if (raw === "") {
         onChange({ [field]: null });
         return;
       }
      const num = parseMoney(raw);                        // ⇦ convierte “12.000,00” → 12000
       onChange({ [field]: Number.isFinite(num) ? num : null });
     };

      const handleMoneyBlur = (field) => (e) => {
         const pretty = formatMoney2(e.target.value);        // “12000” → “12.000,00”
        // NO reasignes el value del input aquí (controlado por React),
         // solo normaliza el estado si quieres:
         const num = parseMoney(pretty);
         onChange({ [field]: Number.isFinite(num) ? num : null });
       };



  const fechaBase = (member.fecha_nacimiento || member?.cliente?.fecha_nacimiento || "")
    .toString()
    .slice(0, 10);

  return (
    <div className="accordion mt-3" id={accId}>
      <div className="accordion-item">
        <h2 className="accordion-header" id={hdrId}>
          <button
            className="accordion-button collapsed"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target={`#${colId}`}
            aria-expanded="false"
            aria-controls={colId}
          >
            Datos del {member.tipo}
          </button>
        </h2>

        <div
          id={colId}
          className="accordion-collapse collapse"
          aria-labelledby={hdrId}
          data-bs-parent={`#${accId}`}
        >
          <div className="accordion-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Primer Nombre</label>
                <input
                  className="form-control form-control-sm"
                  value={member.primer_nombre || ""}
                  disabled={readOnly}
                  onChange={handle("primer_nombre")}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Segundo nombre</label>
                <input
                  className="form-control form-control-sm"
                  value={member.segundo_nombre || ""}
                  disabled={readOnly}
                  onChange={handle("segundo_nombre")}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Apellidos</label>
                <input
                  className="form-control form-control-sm"
                  value={member.apellidos || ""}
                  disabled={readOnly}
                  onChange={handle("apellidos")}
                />
              </div>

              <div className="col-md-4">
              <label className="form-label">Idioma</label>
                  <select
                    className="form-select form-select-sm"
                    value={member.idioma || member?.cliente?.idioma || ""}
                    disabled={readOnly}
                    onChange={handle("idioma")}
                  >
                    <option value="">Seleccione</option>
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.name}>
                        {lang.name}
                      </option>
                    ))}
                  </select>

              </div>

              <div className="col-md-4">
                <label className="form-label">Fecha de Nacimiento</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={fechaBase}
                  disabled={readOnly}
                  onChange={handle("fecha_nacimiento")}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Edad</label>
                <input
                  className="form-control form-control-sm"
                  disabled
                  value={member.edad ?? ""}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Género</label>
                <select
                  className="form-select form-select-sm"
                  value={member.genero || member?.cliente?.genero || ""}
                  disabled={readOnly}
                  onChange={handle("genero")}
                >
                  <option value="">Seleccione</option>
                  <option>Masculino</option>
                  <option>Femenino</option>
                  <option>Otro</option>
                </select>
              </div>

              <div className="col-md-4">
                  <label className="form-label">Ingreso Anual</label>
                  <input
  className="form-control form-control-sm"
  inputMode="decimal"
  value={
    readOnly
      ? formatMoneyDisplay(member.ingreso_anual ?? 0) // bonito solo en lectura
      : (member.ingreso_anual ?? "")                  // edición cruda (número o "")
            }
            disabled={readOnly}
            onChange={handleMoneyChange("ingreso_anual")}
            onBlur={handleMoneyBlur("ingreso_anual")}
            placeholder="0,00"
          />
                </div>

              <div className="col-md-4">
                <label className="form-label">¿Está en Cobertura?</label>
                <select
                  className="form-select form-select-sm"
                  value={member.estado_cobertura || ""}
                  disabled={readOnly}
                  onChange={handle("estado_cobertura")}
                >
                  <option value="Sí">Sí</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="col-md-12">
                <label className="form-label">Nota</label>
                <textarea
                  className="form-control form-control-sm"
                  value={member.nota || ""}
                  disabled={readOnly}
                  onChange={handle("nota")}
                />
              </div>
            </div>

            <div className="form-text mt-2">
              Los cambios se guardarán con el botón <strong>Guardar</strong> del formulario principal.
            </div>
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
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  /* ---- Mutadores locales con recálculo de derivados ---- */
  const recomputeDerived = (m) => {
    const fecha = m.fecha_nacimiento || m.cliente?.fecha_nacimiento;
    const edad = m.edad ?? calcAge(fecha);
    const nombre =
      m.nombreCompleto ||
      m.nombre_completo ||
      buildFullName(m.primer_nombre, m.segundo_nombre, m.apellidos) ||
      m?.cliente?.nombre_completo;
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
         const newId = familyMembers.length
           ? Math.max(...familyMembers.map((m) => m.id || 0)) + 1
           : 1;
         const merged = recomputeDerived({
           fecha_retiro: null, // default
           ...payload,
           id: newId,
         });
         setFamilyMembers((prev) => [...prev, merged]);
         setModalOpen(false);
       };
  const updateLocal = async (id, payload) => {
    setFamilyMembers((prev) =>
      prev.map((m) => (m.id === id ? recomputeDerived({ ...payload, id }) : m))
    );
  };

  const createRemote = async (payload) => {
    if (typeof onCreateMemberRemote === "function") {
      await onCreateMemberRemote(payload);
    } else {
      throw new Error("No hay handler remoto configurado.");
    }
  };

  // Crear cobertura para CLIENTE EXISTENTE (cuando hay grupoFamiliarId)
  const handleCreateCoberturaExistente = async (payload, clienteSeleccionado) => {
    if (!grupoFamiliarId || !payload?.cliente_id) return;
    if (yaEstaEnElGrupo(payload.cliente_id, familyMembers)) return;

    const res = await GrupoFamiliarService.createCoberturaSimple({
      grupo_familiar_id: grupoFamiliarId,
      cliente_id: payload.cliente_id,
      parentesco: payload.tipo,
      cobertura_tipo: payload.cobertura_tipo,
      estado_cobertura: payload.estado_cobertura,
    });

    if (res?.miembro?.cliente || res?.miembro) {
      const mSrv = res.miembro;
      const merged = {
        ...mSrv,
        tipo: mSrv.tipo || payload.tipo,
        parentesco: mSrv.parentesco || payload.tipo,
        estado_cobertura: mSrv.estado_cobertura || payload.estado_cobertura,
        cobertura_tipo: mSrv.cobertura_tipo || payload.cobertura_tipo,
      };
      setFamilyMembers((prev) => [...prev, recomputeDerived(merged)]);
    } else {
      const mLocal = mapClienteToMember(
        clienteSeleccionado,
        payload.tipo,
        payload.cobertura_tipo,
        payload.estado_cobertura
      );
      setFamilyMembers((prev) => [...prev, recomputeDerived(mLocal)]);
    }
    return res;
  };

  /* --------------------------- Render --------------------------- */
  return (
    <>
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-users me-2" />
            Añadir Miembros
          </h5>

          {!readOnly &&
            (canAdd ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
                Añadir
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
                Añadir
              </button>
            ))}
        </div>

        <div className="card-body">
          {familyMembers.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="fas fa-users fa-3x mb-3 opacity-50" />
              <p>No hay miembros agregados. Haz clic en "Añadir" para comenzar.</p>
            </div>
          ) : (
            <div className="row">
              {familyMembers.map((member) => (
                <div key={member.id} className="col-md-12 mb-3">
                  <div className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className={`badge bg-${getTypeColor(member.tipo)}`}>
                          {member.tipo}
                        </span>
                        {/* Botón de lápiz REMOVIDO: edición se hace en el acordeón */}
                      </div>

                      <div className="d-flex align-items-center">
                        <div
                          className="me-3 d-flex align-items-center justify-content-center"
                          style={{ width: 50 }}
                        >
                          <UserCoverageIcon status={member.estado_cobertura} size={50} />
                        </div>

                        <div className="flex-grow-1 text-center">
                          <h6 className="mb-1">{getMemberDisplayName(member)}</h6>
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

                      {/* Acordeón editable */}
                      <MemberAccordionForm
                        member={member}
                        readOnly={readOnly}
                        onChange={(patch) => updateMemberLocal(member.id, patch)}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
        grupoFamiliarId={grupoFamiliarId}
        onCreateCoberturaDeClienteExistente={handleCreateCoberturaExistente}
      />
    </>
  );
};

export default ProspectoDatos;
