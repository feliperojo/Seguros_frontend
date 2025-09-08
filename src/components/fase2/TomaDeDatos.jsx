

import React from "react";
import UserCoverageIcon from "../fase2/UserCoverageIcon"; 


// util: nombre completo
const fullName = (m) =>
  [m.nombre?.trim(), m.apellidos?.trim()].filter(Boolean).join(" ") ||
  m.nombreCompleto ||
  "Sin nombre";

// util: campo de formulario
const Field = ({ label, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label small fw-semibold text-muted">{label}</label>
    {children}
  </div>
);

/**
 * Props:
 *  - familyMembers: array
 *  - setFamilyMembers: fn(prev=>next)
 *  - onSaveMember?: fn(member)
 *  - onSaveCobertura?: fn(member)
 *  - onDeleteMember?: fn(memberIndex)
 */
const TomaDeDatos = ({
  familyMembers,
  setFamilyMembers,
  onSaveMember,
  onSaveCobertura,
  onDeleteMember,
}) => {
  const updateMember = (idx, patch) => {
    setFamilyMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m))
    );
  };

  const onChange = (idx) => (e) => {
    const { name, value } = e.target;
    updateMember(idx, { [name]: value });
  };

  // Datos de ejemplo para la demo
  const sampleMembers = [
    {
      id: 1,
      tipo: "Tomador",
      nombre: "Jose David",
      apellidos: "Castillo Ospina",
      edad: 49,
      genero: "Masculino",
      fechaNacimiento: "1975-03-15",
      idioma: "Español",
      nota: "",
      parentesco: "Tomador",
      estado_cobertura: "Sí",
      codigo_poliza: "POL-001234",
      vigencia: "2025-01"
    },
    {
      id: 2,
      tipo: "Cónyuge",
      nombre: "Maria Elena",
      apellidos: "Rodriguez Lopez",
      edad: 45,
      genero: "Femenino",
      fechaNacimiento: "1979-07-22",
      idioma: "Español",
      nota: "",
      parentesco: "Cónyuge",
      estado_cobertura: "No",
      codigo_poliza: "",
      vigencia: ""
    }
  ];

  const members = familyMembers?.length > 0 ? familyMembers : sampleMembers;

  return (
    <div className="container-fluid p-0">
      {members.map((m, idx) => {
     const itemId = `member-${m.id || idx}`;

     const leftRightWidth = 180; // mismo ancho a izquierda y derecha para centrar TODO
   
        const badgeColor = m.tipo === "Tomador" ? "primary" : 
                          m.tipo === "Cónyuge" ? "success" : "secondary";
        
        return (
          <div className="card shadow-sm mb-3" key={itemId}>
            {/* Header de la card */}
            <div className="card-header bg-white border-0 px-4 py-3">
  <div className="d-flex align-items-center position-relative" style={{ minHeight: 64 }}>
    
    {/* IZQUIERDA: rol + icono */}
    <div
      className="d-flex flex-column justify-content-center align-items-start me-3"
      style={{ width: leftRightWidth }}
    >
      <span className="fw-semibold" style={{ color: '#0d6efd' }}>
        {m.tipo || 'Miembro'}
      </span>

      <div className="mt-2">
      <UserCoverageIcon status={m.estado_cobertura} size={50} />

      </div>
    </div>

    {/* CENTRO: nombre siempre centrado */}
    <div className="flex-grow-1 text-center">
      <span className="fw-semibold text-dark">{fullName(m)}</span>
    </div>

    {/* DERECHA: edad / género / estado + caneca */}
    <div
      className="d-flex align-items-center justify-content-end ms-3"
      style={{ width: leftRightWidth }}
    >
     <div className="text-start me-3">
  <div className="small">
    <span className="text-muted">Edad: </span>
    <span className="fw-semibold text-muted">{m.edad || 'N/A'}</span>
  </div>
  <div className="small text-muted">Género: {m.genero || '—'}</div>
</div>


      
    </div>
  </div>
</div>


            {/* Acordeones internos */}
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
                        <i className="fas fa-user me-2 text-muted"></i>
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
                      <div className="row g-3">
                        <Field label="Nombre" className="col-md-6">
                          <input
                            className="form-control form-control-sm"
                            name="nombre"
                            value={m.nombre || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>
                        <Field label="Apellidos" className="col-md-6">
                          <input
                            className="form-control form-control-sm"
                            name="apellidos"
                            value={m.apellidos || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>
                        <Field label="Fecha de Nacimiento" className="col-md-4">
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            name="fechaNacimiento"
                            value={m.fechaNacimiento || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>
                        <Field label="Edad" className="col-md-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            name="edad"
                            value={m.edad || ""}
                            readOnly
                          />
                        </Field>
                        <Field label="Género" className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            name="genero"
                            value={m.genero || ""}
                            onChange={onChange(idx)}
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
                            value={m.idioma || ""}
                            onChange={onChange(idx)}
                          >
                            <option value="">Seleccione</option>
                            <option value="Español">Español</option>
                            <option value="Inglés">Inglés</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </Field>
                        <Field label="Nota" className="col-12">
                          <textarea
                            rows={3}
                            className="form-control form-control-sm"
                            name="nota"
                            value={m.nota || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>
                      </div>

                      <div className="text-end mt-4">
                        <button
                          className="btn btn-primary btn-sm px-4"
                          onClick={() => onSaveMember?.(members[idx])}
                        >
                          <i className="fas fa-save me-2"></i>
                          Guardar Cliente
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

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
                      <div className="d-flex align-items-center">
                        <i className="fas fa-shield-alt me-2 text-muted"></i>
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
                            onChange={onChange(idx)}
                            placeholder="Tomador / Cónyuge / Hijo/a..."
                          />
                        </Field>

                        <Field label="Estado Cobertura" className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            name="estado_cobertura"
                            value={m.estado_cobertura || ""}
                            onChange={onChange(idx)}
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
                            onChange={onChange(idx)}
                          />
                        </Field>

                        <Field label="Vigencia (AAAA-MM)" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="vigencia"
                            placeholder="2025-01"
                            value={m.vigencia || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>
                      </div>

                      <div className="text-end mt-4">
                        <button
                          className="btn btn-primary btn-sm px-4"
                          onClick={() => onSaveCobertura?.(members[idx])}
                        >
                          <i className="fas fa-save me-2"></i>
                          Guardar Cobertura
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TomaDeDatos;