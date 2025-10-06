import React, { useEffect, useState } from "react";

/**
 * PersonaContactoCard
 * - Muestra switches + formulario como en el mockup.
 * - Si pasas `value` y `onChange`, funciona controlado; si no, usa estado interno.
 */
export default function PersonaContactoCard({
  className = "",
  // switches
  primary = false,
  addAnother = false,
  onTogglePrimary = () => {},
  onToggleAddAnother = () => {},

  // formulario (controlado/semicontrolado)
  value,
  onChange = () => {},

  // opciones de selects
  idiomaOptions = ["Spanish", "English"],
  relacionOptions = ["Cónyuge", "Hijo/a", "Padre/Madre", "Hermano/a", "Amigo/a", "Otro"],
}) {
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    idioma: "",
    perteneceGF: "",
    relacion: "",
    nota: "",
    relacionados: "",
    relacionados2: "",
    ...value,
  });

  // sincroniza si el padre cambia "value"
  useEffect(() => {
    if (value) setForm((f) => ({ ...f, ...value }));
  }, [value]);

  const update = (field, val) => {
    const next = { ...form, [field]: val };
    setForm(next);
    onChange(next);
  };

  return (
    <div className={className}>
      {/* Switches superiores */}
      <div className="mb-2">
        <div className="form-check form-check-inline">
          <input
            id="pc_primary"
            className="form-check-input"
            type="checkbox"
            checked={primary}
            onChange={(e) => onTogglePrimary(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="pc_primary">
            ¿Será esta la persona de Contacto?
          </label>
        </div>

        <div className="form-check form-check-inline ms-2">
          <input
            id="pc_addAnother"
            className="form-check-input"
            type="checkbox"
            checked={addAnother}
            onChange={(e) => onToggleAddAnother(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="pc_addAnother">
            Agregar a otra persona de Contacto
          </label>
        </div>
      </div>

      {/* Card con el formulario */}
      <div className="card">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">Persona de Contacto</h6>

          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small mb-1">Nombre Completo</label>
              <input
                className="form-control form-control-sm"
                placeholder="Nombre Completo"
                value={form.nombre}
                onChange={(e) => update("nombre", e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">Teléfono</label>
              <input
                className="form-control form-control-sm"
                placeholder="Teléfono"
                value={form.telefono}
                onChange={(e) => update("telefono", e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">Idioma</label>
              <select
                className="form-select form-select-sm"
                value={form.idioma}
                onChange={(e) => update("idioma", e.target.value)}
              >
                <option value="">Seleccione...</option>
                {idiomaOptions.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">¿Pertenece al Grupo Familiar?</label>
              <select
                className="form-select form-select-sm"
                value={form.perteneceGF}
                onChange={(e) => update("perteneceGF", e.target.value)}
              >
                <option value="">Sí/No</option>
                <option value="Si">Sí</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">Relación</label>
              <select
                className="form-select form-select-sm"
                value={form.relacion}
                onChange={(e) => update("relacion", e.target.value)}
              >
                <option value="">Seleccione...</option>
                {relacionOptions.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">Nota</label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                placeholder="Ingrese sus notas aquí..."
                value={form.nota}
                onChange={(e) => update("nota", e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">Contactos Relacionados</label>
              <input
                className="form-control form-control-sm"
                placeholder="Contactos Relacionados"
                value={form.relacionados}
                onChange={(e) => update("relacionados", e.target.value)}
              />
            </div>

            <div className="col-12">
              <input
                className="form-control form-control-sm"
                placeholder="Contactos Relacionados"
                value={form.relacionados2}
                onChange={(e) => update("relacionados2", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
