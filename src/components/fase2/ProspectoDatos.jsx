import React, { useState } from 'react';
import UserCoverageIcon from "./UserCoverageIcon"; 


const getTypeColor = (tipo) => {
  switch (tipo) {
    case 'Tomador': return 'primary';
    case 'Conyuge': return 'info';
    case 'Hijo': return 'success';
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

const getTypeIcon = (tipo) => {
  switch (tipo) {
    case 'Tomador': return 'fa-user-shield';
    case 'Conyuge': return 'fa-user-friends';
    case 'Hijo/a': return 'fa-child';
    case 'Hermano': return 'fa-user-friends';
    case 'Padre': return 'fa-user-tie';
    case 'Madre': return 'fa-user-nurse';
    case 'Nieto': return 'fa-user-ninja';
    case 'Abuelo/a': return 'fa-user-astronaut';
    case 'Suegro/a': return 'fa-user-astronaut';
    case 'Tio/a': return 'fa-user-astronaut';
    case 'Sobrino/a': return 'fa-solid fa-people-line';
    default: return 'fa-user-check';

  }
};

// Tipos disponibles para seleccionar
const TIPOS_DISPONIBLES = [
  { tipo: 'Tomador', label: 'Tomador', descripcion: 'Titular de la póliza' },
  { tipo: 'Conyuge', label: 'Cónyuge', descripcion: 'Pareja o esposo/a' },
  { tipo: 'Hijo/a', label: 'Hijo', descripcion: 'Hijo o hija del tomador' },
  { tipo: 'Hermano', label: 'Hermano', descripcion: 'Hermano del tomador' },
  { tipo: 'Padre', label: 'Padre', descripcion: 'Padre del tomador' },
  { tipo: 'Madre', label: 'Madre', descripcion: 'Madre del tomador' },
  { tipo: 'Nieto', label: 'Nieto', descripcion: 'Nieto del tomador' },
  { tipo: 'Abuelo/a', label: 'Abuelo/a', descripcion: 'Abuelo/a del tomador' }, 
  { tipo: 'Suegro/a', label: 'Suegro/a', descripcion: 'Suegro del tomador' },
  { tipo: 'Tio/a', label: 'Tio/a', descripcion: 'Tio/a del tomador' },
  { tipo: 'Sobrino/a', label: 'Sobrino/a', descripcion: 'Sobrino del tomador' },
 
];


// 👉 reemplaza la utilidad actual
const buildFullName = (primer_nombre = "", segundo_nombre = "", apellidos = "") =>
  [primer_nombre?.trim(), segundo_nombre?.trim(), apellidos?.trim()]
    .filter(Boolean)
    .join(" ");


const ProspectoDatos = ({ familyMembers, setFamilyMembers, readOnly }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: selección tipo, 2: formulario datos
  const [editingMember, setEditingMember] = useState(null);
  const [memberData, setMemberData] = useState({
    primer_nombre: '', segundo_nombre: '',  apellidos: '', nombreCompleto: '',
    idioma: '', fechaNacimiento: '', edad: '',
    genero: 'Masculino', ingresoAnual: '', nota: '',
    parentesco: 'Tomador', estado_cobertura: 'Si/No', tipo: 'Tomador'
  });

  const handleAdd = () => {
    const clean = {
      nombre: '',  primer_nombre: '', segundo_nombre: '',   apellidos: '',
      nombreCompleto: '',
      idioma: '', fechaNacimiento: '', edad: '',
      genero: 'Masculino', ingresoAnual: '', nota: '',
      parentesco: 'Tomador', estado_cobertura: 'Si/No', tipo: 'Tomador'
    };
    setEditingMember(null);
    setMemberData(clean);
    setModalStep(1); // Empezar en paso 1
    setShowModal(true);
  };

  const handleEdit = (m) => {
    // cuando edites, recalcula por si viniera inconsistente
    const nombreCompleto = m.nombreCompleto || buildFullName(m.primer_nombre,m.segundo_nombre, m.apellidos);
    setEditingMember(m);
    setMemberData({ ...m, nombreCompleto });
    setModalStep(2); // Si es edición, ir directo al formulario
    setShowModal(true);
  };

  // 👉 util para calcular edad
const calculateAge = (birthdate) => {
  if (!birthdate) return "";
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

  // 👉 util: primera letra en mayúscula, resto igual
const capitalizeFirst = (str = "") => {
  if (!str) return "";
  const trimmed = str.trimStart(); // respeta espacios al principio si quieres
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// 👉 util: cada palabra con mayúscula (para nombres)
const capitalizeWords = (str = "") =>
  str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const TEXT_FIELDS_FIRST_CAP = [
  "idioma", "nota" // agrega aquí todos los text/textarea que quieras con solo primera letra
];

const NAME_FIELDS_WORDS_CAP = ["primer_nombre", "segundo_nombre", "apellidos"];

const onMemberChange = (e) => {
  const { name, value, type } = e.target;

  setMemberData((prev) => {
    // 1) Normaliza/Capitaliza según el campo
    let transformed = value;

    if (["primer_nombre", "segundo_nombre", "apellidos"].includes(name)) {
      transformed = capitalizeWords(value);       // Cada palabra en mayúscula
    } else if (["idioma", "nota"].includes(name)) {
      transformed = capitalizeFirst(value);       // Solo primera letra
    } else {
      // Para otros textos libres (no number/date)
      if (!["number", "date"].includes(type) && name !== "ingresoAnual") {
        transformed = capitalizeFirst(value);
      }
    }

    // 2) Construye el nuevo estado con el valor transformado
    const next = { ...prev, [name]: transformed };

    // 3) Derivados
    if (name === "fechaNacimiento") {
      next.edad = calculateAge(transformed);
    }

    // Recalcular el nombre completo si cambian las partes
    if (["primer_nombre", "segundo_nombre", "apellidos"].includes(name)) {
      next.nombreCompleto = buildFullName(
        next.primer_nombre,
        next.segundo_nombre,
        next.apellidos
      );
    }

    return next;
  });
};

  const handleTypeSelect = (valor) => {
    setMemberData(prev => ({
      ...prev,
      parentesco: valor, // ← lo que persistiremos en cobertura
      tipo: valor,       // ← para badges/íconos actuales
    }));
    setModalStep(2);
  };
  
 

  const handleSave = () => {
    const payload = {
      ...memberData,
      nombreCompleto: buildFullName(memberData.primer_nombre, memberData.segundo_nombre, memberData.apellidos),
      // por si alguien manipuló tipo, garantizamos consistencia:
      parentesco: memberData.parentesco || memberData.tipo || 'Tomador',
      tipo: memberData.parentesco || memberData.tipo || 'Tomador',
    };
  
    if (editingMember) {
      setFamilyMembers(prev =>
        prev.map(m => (m.id === editingMember.id ? { ...payload, id: editingMember.id } : m))
      );
    } else {
      const newId = familyMembers.length ? Math.max(...familyMembers.map(m => m.id)) + 1 : 1;
      setFamilyMembers(prev => [...prev, { ...payload, id: newId }]);
    }
    setShowModal(false);
    setModalStep(1);
  };
  

  const handleCloseModal = () => {
    setShowModal(false);
    setModalStep(1);
  };

  const handleBackToStep1 = () => {
    setModalStep(1);
  };

  // título dinámico del modal
  const getModalTitle = () => {
    if (modalStep === 1) {
      return editingMember ? 'Cambiar Tipo de Miembro' : 'Seleccionar Tipo de Miembro';
    }
    return (memberData.nombreCompleto && memberData.nombreCompleto.trim()) || 
           `Datos del ${memberData.tipo}`;
  };

  return (
    <>
      {/* Agregar Font Awesome si no está incluido */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0"><i className="fas fa-users me-2"></i>Añadir Miembros</h5>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>Añadir</button>
        </div>
        <div className="card-body">
          {familyMembers.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="fas fa-users fa-3x mb-3 opacity-50"></i>
              <p>No hay miembros agregados. Haz clic en "Añadir" para comenzar.</p>
            </div>
          ) : (
            <div className="row">
            {familyMembers.map((member) => (
              <div key={member.id} className="col-md-12 mb-3">
                <div className="card border">
                  <div className="card-body">
                    {/* Encabezado con badge y botón editar */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className={`badge bg-${getTypeColor(member.tipo)}`}>{member.tipo}</span>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleEdit(member)}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    </div>
          
                    {/* Contenido con 3 zonas: icono - nombre (centro) - detalles (derecha) */}
                    <div className="d-flex align-items-center">
                      {/* Icono */}
                   {/* Icono de estado de cobertura (verde/rojo/gris + check) */}
                    <div className="me-3 d-flex align-items-center justify-content-center" style={{ width: 50 }}>
                      <UserCoverageIcon status={member.estado_cobertura} size={50} />
                    </div>

          
                      {/* Nombre al centro (flex-grow para ocupar espacio central) */}
                      <div className="flex-grow-1 text-center">
                        <h6 className="mb-1">
                          {member.nombreCompleto || buildFullName(member.primer_nombre, member.segundo_nombre,member.apellidos)}
                        </h6>
                      </div>
          
                      {/* Info secundaria a la derecha */}
                      <div className="text-end" style={{ minWidth: 180 }}>
                        <small className="text-muted d-block">
                          Edad: {member.edad}
                        </small>
                        <small className="text-muted d-block">
                          Género: {member.genero}
                        </small>
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

      {/* Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{getModalTitle()}</h5>
                <button type="button" className="btn-close" onClick={handleCloseModal}></button>
              </div>

              {/* PASO 1: Selección de Tipo */}
              {modalStep === 1 && (
                <div className="modal-body">
                  <div className="text-center mb-4">
                    <h6 className="text-muted">¿Qué tipo de miembro deseas agregar?</h6>
                  </div>
                  <div className="row g-3">
                    {TIPOS_DISPONIBLES.map((item) => (
                      <div key={item.tipo} className="col-md-4 col-sm-6">
                        <div 
                          className={`card h-100 shadow-sm border-2 cursor-pointer transition-all ${
                            memberData.tipo === item.tipo ? `border-${getTypeColor(item.tipo)} bg-light` : 'border-light'
                          }`}
                          style={{ 
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            transform: memberData.tipo === item.tipo ? 'scale(1.02)' : 'scale(1)'
                          }}
                          onClick={() => handleTypeSelect(item.tipo)}
                          onMouseEnter={(e) => {
                            if (memberData.tipo !== item.tipo) {
                              e.currentTarget.style.transform = 'scale(1.02)';
                              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (memberData.tipo !== item.tipo) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '';
                            }
                          }}
                        >
                          <div className="card-body text-center py-4">
                            <div className={`mb-3`}>
                              <div 
                                className={`bg-${getTypeColor(item.tipo)} text-white rounded-circle d-inline-flex align-items-center justify-content-center`} 
                                style={{ width: 60, height: 60 }}
                              >
                                <i className={`fas ${getTypeIcon(item.tipo)} fa-lg`}></i>
                              </div>
                            </div>
                            <h6 className="card-title mb-2">{item.label}</h6>
                            <small className="text-muted">{item.descripcion}</small>
                            {memberData.tipo === item.tipo && (
                              <div className="mt-2">
                                <i className={`fas fa-check-circle text-${getTypeColor(item.tipo)}`}></i>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PASO 2: Formulario de Datos */}
              
              {modalStep === 2 && (
                <div className="modal-body">
                  {!editingMember && (
                    <div className="d-flex align-items-center mb-4">
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary btn-sm me-3"
                        onClick={handleBackToStep1}
                      >
                        <i className="fas fa-arrow-left me-1"></i> Cambiar Tipo
                      </button>
                      <div className="d-flex align-items-center">
                        <div className={`bg-${getTypeColor(memberData.tipo)} text-white rounded-circle d-flex align-items-center justify-content-center me-3`} style={{ width: 40, height: 40 }}>
                          <i className={`fas ${getTypeIcon(memberData.tipo)}`}></i>
                        </div>
                        <div>
                          <span className={`badge bg-${getTypeColor(memberData.tipo)}`}>{memberData.tipo}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">Primer Nombre</label>
                      <input
                        className="form-control"
                        name="primer_nombre"
                        value={memberData.primer_nombre}
                        onChange={onMemberChange}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Segundo nombre</label>
                        <input
                          className="form-control"
                          name="segundo_nombre"          // 👈 nuevo
                          value={memberData.segundo_nombre}
                          onChange={onMemberChange}
                          disabled={readOnly}
                        />
                      </div>

                    <div className="col-md-4">
                      <label className="form-label">Apellidos</label>
                      <input
                        className="form-control"
                        name="apellidos"
                        value={memberData.apellidos}
                        onChange={onMemberChange}
                        disabled={readOnly}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Idioma</label>
                      <select className="form-select" name="idioma" value={memberData.idioma} onChange={onMemberChange} disabled={readOnly}>
                        <option value="">Seleccione</option>
                        <option value="Español">Español</option>
                        <option value="Inglés">Inglés</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Fecha de Nacimiento</label>
                      <input type="date" className="form-control" name="fechaNacimiento" value={memberData.fechaNacimiento} onChange={onMemberChange} disabled={readOnly}/>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Edad</label>
                      <input type="number" className="form-control" name="edad" value={memberData.edad} onChange={onMemberChange} disabled={readOnly}/>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Género</label>
                      <select className="form-select" name="genero" value={memberData.genero} onChange={onMemberChange} disabled={readOnly}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Nota</label>
                      <textarea className="form-control" rows="3" name="nota" value={memberData.nota} onChange={onMemberChange}   disabled={readOnly}></textarea>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Ingreso Anual</label>
                      <input className="form-control" name="ingresoAnual" value={memberData.ingresoAnual} onChange={onMemberChange} disabled={readOnly}/>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">¿Está en Cobertura?</label>
                      <select className="form-select" name="estado_cobertura" value={memberData.estado_cobertura} onChange={onMemberChange} disabled={readOnly}>
                        <option value="Si/No">Si/No</option>
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                        <option value="Medicare">Medicare</option>
                        <option value="Medicaid">Medicaid</option>


                      </select>
                    </div>

                    {/* Campo tipo oculto pero funcional */}
                    <input type="hidden" name="tipo" value={memberData.tipo} />
                    <input type="hidden" name="relacion" value={memberData.relacion} />
                  </div>
                </div>
              )}
                {!readOnly && (
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancelar
                </button>
                {modalStep === 2 && (
                  <button type="button" className="btn btn-primary" onClick={handleSave}>
                    <i className="fas fa-save me-1"></i>
                    {editingMember ? 'Actualizar' : 'Guardar'}
                  </button>
                )}
              </div>
               )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProspectoDatos;