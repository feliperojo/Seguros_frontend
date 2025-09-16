import React, { useState } from 'react';
import UserCoverageIcon from "./UserCoverageIcon";
import MemberModal from "./MemberModal";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

const getTypeColor = (tipo) => {
  switch (tipo) {
    case 'Tomador': return 'primary';
    case 'Conyuge': return 'info';
    case 'Hijo/a': return 'success';
    case 'Hermano': return 'secondary';
    case 'Dependiente': return 'secondary';
    case 'Padre': return 'dark';
    case 'Madre': return 'danger';
    case 'Nieto': return 'warning';
    case 'Abuelo/a': return 'warning';
    case 'Suegro/a': return 'warning';
    case 'Tio/a': return 'warning';
    case 'Sobrino/a': return 'warning';
    default: return 'secondary';
  }
};

const buildFullName = (p="", s="", a="") =>
  [p?.trim(), s?.trim(), a?.trim()].filter(Boolean).join(" ");

/* ==== helpers para soporte de cliente EXISTENTE ==== */
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

const yaEstaEnElGrupo = (clienteId, members=[]) =>
  members.some(m => m.cliente_id === clienteId || m?.cliente?.id === clienteId);

const mapClienteToMember = (c, tipoSel, coberturaTipo="Plan de salud", estadoCobertura="Sí") => {
  const primer  = c.primer_nombre || c.nombre || "";
  const segundo = c.segundo_nombre || "";
  const apell   = c.apellidos || c.apellido || "";
  const fecha   = c.fecha_nacimiento || c.fechaNacimiento || "";
  const nombreCompleto = c.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g," ").trim();
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
/* =================================================== */

const ProspectoDatos = ({
  familyMembers,
  setFamilyMembers,
  readOnly,
  canAdd = false,
  estadoActual,
  isProspecto = false,
  defaultCoberturaTipo = "Plan de salud",
  onCreateMemberRemote,           // creación remota para "nuevo"
  onBlockedAddClick,
  grupoFamiliarId,                // ← si viene, habilita “cliente existente”
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const handleAdd = () => {
    if (!canAdd) {
      onBlockedAddClick && onBlockedAddClick();
      return;
    }
    setEditingMember(null);
    setModalOpen(true);
  };

  const handleEdit = (m) => {
    setEditingMember(m);
    setModalOpen(true);
  };

  // === Callbacks que consumirá MemberModal ===
  const createLocal = async (payload) => {
    const newId = familyMembers.length ? Math.max(...familyMembers.map(m => m.id || 0)) + 1 : 1;
    setFamilyMembers(prev => [...prev, { ...payload, id: newId }]);
  };

  const updateLocal = async (id, payload) => {
    setFamilyMembers(prev => prev.map(m => (m.id === id ? { ...payload, id } : m)));
  };

  const createRemote = async (payload) => {
    if (typeof onCreateMemberRemote === 'function') {
      await onCreateMemberRemote(payload);
    } else {
      throw new Error("No hay handler remoto configurado.");
    }
  };

  // Crear cobertura para CLIENTE EXISTENTE (cuando hay grupoFamiliarId)
  const handleCreateCoberturaExistente = async (payload, clienteSeleccionado) => {
    if (!grupoFamiliarId) return;                // en prospecto local no aplica
    if (!payload?.cliente_id) return;
    if (yaEstaEnElGrupo(payload.cliente_id, familyMembers)) return;

    const res = await GrupoFamiliarService.createCoberturaSimple({
      grupo_familiar_id: grupoFamiliarId,
      cliente_id: payload.cliente_id,
      parentesco: payload.tipo,                  // o payload.parentesco
      cobertura_tipo: payload.cobertura_tipo,
      estado_cobertura: payload.estado_cobertura,
    });

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
      const mLocal = mapClienteToMember(
        clienteSeleccionado,
        payload.tipo,
        payload.cobertura_tipo,
        payload.estado_cobertura
      );
      setFamilyMembers(prev => [...prev, mLocal]);
    }
    return res;
  };

  return (
    <>
  

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-users me-2" />
            Añadir Miembros
          </h5>

          {!readOnly && (
            canAdd ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
                Añadir
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled
                title={
                  (estadoActual || '').toUpperCase() === 'PROSPECTO'
                    ? 'Cambia el estado del grupo (distinto de Prospecto) para añadir miembros.'
                    : 'Activa el modo edición para añadir miembros.'
                }
                onClick={() => onBlockedAddClick && onBlockedAddClick()}
              >
                Añadir
              </button>
            )
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
              {familyMembers.map((member) => (
                <div key={member.id} className="col-md-12 mb-3">
                  <div className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className={`badge bg-${getTypeColor(member.tipo)}`}>
                          {member.tipo}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEdit(member)}
                          >
                            <i className="fas fa-edit" />
                          </button>
                        )}
                      </div>

                      <div className="d-flex align-items-center">
                        <div
                          className="me-3 d-flex align-items-center justify-content-center"
                          style={{ width: 50 }}
                        >
                          <UserCoverageIcon status={member.estado_cobertura} size={50} />
                        </div>

                        <div className="flex-grow-1 text-center">
                          <h6 className="mb-1">
                            {member.nombreCompleto ||
                              buildFullName(
                                member.primer_nombre,
                                member.segundo_nombre,
                                member.apellidos
                              )}
                          </h6>
                        </div>

                        <div className="text-end" style={{ minWidth: 180 }}>
                          <small className="text-muted d-block">Edad: {member.edad}</small>
                          <small className="text-muted d-block">Género: {member.genero}</small>
                          <small className="text-muted d-block">
                            Cobertura: {member.estado_cobertura}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ÚNICO modal: MemberModal */}
      <MemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingMember={editingMember}
        defaultCoberturaTipo={defaultCoberturaTipo}
        canAdd={canAdd}
        readOnly={readOnly}
        isProspecto={isProspecto}                
        onCreateLocal={createLocal}
        onUpdateLocal={updateLocal}
        onCreateRemote={createRemote}
        /* si hay grupo, habilitamos “cliente existente” con POST de cobertura */
        grupoFamiliarId={grupoFamiliarId}
        onCreateCoberturaDeClienteExistente={handleCreateCoberturaExistente}
      />
    </>
  );
};

export default ProspectoDatos;
