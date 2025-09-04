import React from "react";

// util: nombre completo
const fullName = (m) =>
  [m.nombre?.trim(), m.apellidos?.trim()].filter(Boolean).join(" ") ||
  m.nombreCompleto ||
  "Sin nombre";

// util: tiny input helper
const Field = ({ label, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label">{label}</label>
    {children}
  </div>
);

/**
 * Props:
 *  - familyMembers: array (misma estructura que ya usas en ProspectoDatos)
 *  - setFamilyMembers: fn(prev=>next)  (o onChange(memberIndex, patch))
 *  - onSaveMember?: fn(member)         (opcional, por si quieres “guardar” cada miembro)
 *  - onSaveCobertura?: fn(member)      (opcional, para guardar cobertura de ese miembro)
 */
const TomaDeDatos = ({
  familyMembers,
  setFamilyMembers,
  onSaveMember,
  onSaveCobertura,
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

  return (
    <div className="accordion" id="tomaDeDatosAccordion">
      {familyMembers.map((m, idx) => {
        const itemId = `m-${m.id || idx}`;
        return (
          <div className="accordion-item mb-2" key={itemId}>
            <h2 className="accordion-header" id={`${itemId}-header`}>
              <button
                className="accordion-button collapsed fw-semibold"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#${itemId}-body`}
                aria-expanded="false"
                aria-controls={`${itemId}-body`}
              >
                <span className="me-2 badge bg-secondary">{m.tipo || "Miembro"}</span>
                {fullName(m)}
              </button>
            </h2>

            <div
              id={`${itemId}-body`}
              className="accordion-collapse collapse"
              aria-labelledby={`${itemId}-header`}
              data-bs-parent="#tomaDeDatosAccordion"
            >
              <div className="accordion-body">
                {/* Sub-acordeón interno con dos secciones */}
                <div className="accordion" id={`${itemId}-inner`}>
                  {/* 1) Datos del Cliente */}
                  <div className="accordion-item mb-2">
                    <h2 className="accordion-header" id={`${itemId}-cliente-h`}>
                      <button
                        className="accordion-button fw-semibold"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#${itemId}-cliente`}
                        aria-expanded="true"
                        aria-controls={`${itemId}-cliente`}
                      >
                        Datos del Cliente
                      </button>
                    </h2>
                    <div
                      id={`${itemId}-cliente`}
                      className="accordion-collapse collapse show"
                      aria-labelledby={`${itemId}-cliente-h`}
                      data-bs-parent={`#${itemId}-inner`}
                    >
                      <div className="accordion-body">
                        <div className="row g-3">
                          <Field label="Nombre">
                            <input
                              className="form-control"
                              name="nombre"
                              value={m.nombre || ""}
                              onChange={onChange(idx)}
                            />
                          </Field>
                          <Field label="Apellidos">
                            <input
                              className="form-control"
                              name="apellidos"
                              value={m.apellidos || ""}
                              onChange={onChange(idx)}
                            />
                          </Field>
                          <Field label="Fecha de Nacimiento" className="col-md-4">
                            <input
                              type="date"
                              className="form-control"
                              name="fechaNacimiento"
                              value={m.fechaNacimiento || ""}
                              onChange={onChange(idx)}
                            />
                          </Field>
                          <Field label="Edad" className="col-md-2">
                            <input
                              type="number"
                              className="form-control"
                              name="edad"
                              value={m.edad || ""}
                              readOnly
                            />
                          </Field>
                          <Field label="Género" className="col-md-3">
                            <select
                              className="form-select"
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
                              className="form-select"
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
                              className="form-control"
                              name="nota"
                              value={m.nota || ""}
                              onChange={onChange(idx)}
                            />
                          </Field>
                        </div>

                        <div className="text-end mt-3">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => onSaveMember?.(familyMembers[idx])}
                          >
                            Guardar cliente
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2) Datos de la Cobertura */}
                  <div className="accordion-item">
                    <h2 className="accordion-header" id={`${itemId}-cob-h`}>
                      <button
                        className="accordion-button collapsed fw-semibold"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#${itemId}-cob`}
                        aria-expanded="false"
                        aria-controls={`${itemId}-cob`}
                      >
                        Datos de la Cobertura
                      </button>
                    </h2>
                    <div
                      id={`${itemId}-cob`}
                      className="accordion-collapse collapse"
                      aria-labelledby={`${itemId}-cob-h`}
                      data-bs-parent={`#${itemId}-inner`}
                    >
                      <div className="accordion-body">
                        <div className="row g-3">
                          {/* Parentesco: toma del tipo seleccionado */}
                          <Field label="Parentesco" className="col-md-3">
                            <input
                              className="form-control"
                              value={m.parentesco || m.tipo || ""}
                              name="parentesco"
                              onChange={onChange(idx)}
                              placeholder="Tomador / Cónyuge / Hijo/a ..."
                            />
                          </Field>

                          <Field label="Estado cobertura" className="col-md-3">
                            <select
                              className="form-select"
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
                              className="form-control"
                              name="codigo_poliza"
                              value={m.codigo_poliza || ""}
                              onChange={onChange(idx)}
                            />
                          </Field>

                          <Field label="Vigencia (AAAA-MM)" className="col-md-3">
                            <input
                              className="form-control"
                              name="vigencia"
                              placeholder="2025-01"
                              value={m.vigencia || ""}
                              onChange={onChange(idx)}
                            />
                          </Field>

                          {/* Agrega más campos si los usas: compania_id, plan, metal, red, precio, ... */}
                        </div>

                        <div className="text-end mt-3">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => onSaveCobertura?.(familyMembers[idx])}
                          >
                            Guardar cobertura
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /sub acordeón */}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TomaDeDatos;
