import React, { useState } from 'react';
import UserCoverageIcon from "./UserCoverageIcon";
import MemberModal from "./MemberModal";

// Opcional: si aún quieres colores por tipo en la badge,
// crea un util pequeño o importa uno común:
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

  // Callbacks que consumirá MemberModal
  const createLocal = async (payload) => {
    const newId = familyMembers.length ? Math.max(...familyMembers.map(m => m.id || 0)) + 1 : 1;
    setFamilyMembers(prev => [...prev, { ...payload, id: newId }]);
  };

  const updateLocal = async (id, payload) => {
    setFamilyMembers(prev => prev.map(m => (m.id === id ? { ...payload, id } : m)));
  };

  const createRemote = async (payload) => {
    // delega al padre si tienes backend:
    if (typeof onCreateMemberRemote === 'function') {
      await onCreateMemberRemote(payload);
    } else {
      throw new Error("No hay handler remoto configurado.");
    }
  };

  return (
    <>
      {/* FontAwesome global si aún no lo tienes en index.html */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

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
      />
    </>
  );
};

export default ProspectoDatos;
