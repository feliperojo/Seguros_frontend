import React, { useState } from 'react';
// en tu entry (p.ej. index.js)
import 'bootstrap/dist/css/bootstrap.min.css';
import { formatMoneyDisplay } from "../../services/ingresos";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
const Prospectogrupo = ({ formData, onChange, readOnly, grupoFamiliarId }) => {
  const [showGestion, setShowGestion] = useState(false);

  // Formato 3-3-sin límite: 123-456-xxxx...
  const formatPhone = (raw) => {
    const digits = String(raw || '').replace(/\D+/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  // Handler para teléfonos que respeta el onChange del padre
  const handlePhoneChange = (name) => (e) => {
    const formatted = formatPhone(e.target.value);
    onChange({ target: { name, value: formatted, type: 'text' } });
  };


// intenta varias rutas donde podría estar el grupo
 const resolvedGrupoId =
   (grupoFamiliarId ??                      // 👈 prioridad: viene del path
    formData?.grupo_familiar_id ??
    formData?.grupoFamiliarId ??
    formData?.grupo?.id ??
    formData?.grupo_id ??
    null);

console.log("Padre -> resolvedGrupoId:", resolvedGrupoId);


 

  return (
    <>
      {/* Información del Prospecto (captación) */}
      <div className="card mb-4">
        <div className="card-header text-white">
          <h5 className="mb-0">Información del Prospecto</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Captado por:</label>
              <select
                className="form-select"
                name="captadoPor"
                value={formData.captadoPor}
                onChange={onChange}
                disabled={readOnly}
              >
                <option value="Google">Google</option>
                <option value="Facebook">Facebook</option>
                <option value="Referido">Referido</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Cuál</label>
              <input
                type="text"
                className="form-control"
                name="cual"
                value={formData.cual}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Asesor</label>
              <input
                type="text"
                className="form-control"
                name="asesor"
                value={formData.asesor}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      </div>

      
      {/* Bloque económico */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">ZIP Code</label>
              <input
                type="text"
                className="form-control"
                name="zipCode"
                value={formData.zipCode}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            <div className="col-md-3">
                <label className="form-label">Ingreso Familiar</label>
                <input
                  type="text"
                  className="form-control"
                  name="ingresoFamiliar"
                  value={formatMoneyDisplay(formData.ingresoFamiliar ?? 0)}
                  onChange={onChange}
                  readOnly
                />
              <div className="form-text">Sumatoria de los ingresos de cada miembro.</div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Personas en Cobertura</label>
              <input
                  type="number"
                  className="form-control"
                  name="personasCobertura"
                  value={formData.personasCobertura ?? 0}
                  readOnly
                />
            
              <div className="form-text">Se calcula con miembros en “Sí” y sin retiro.</div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Personas en Taxes</label>
             
              <input
                type="number"
                className="form-control"
                name="personasTaxes"
                value={formData.personasTaxes ?? 0}
                readOnly
              />
              <div className="form-text">Se calcula con el número de miembros (cards).</div>
            </div>

          </div>
        </div>
      </div>
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Utilidades</h6>
          <div className="d-flex gap-2">
          <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    console.log('click Nueva Gestión', { readOnly, showGestionBefore: showGestion });
                    setShowGestion(true);
                  }}
                  
                >
                  <i className="fas fa-tasks me-1"></i> Nueva Gestión
                </button>
          </div>
        </div>
      </div>

      <NuevaTareaModal
  show={showGestion}
  onHide={() => setShowGestion(false)}
  grupoFamiliarId={resolvedGrupoId}         // <-- ahora pasa un valor más seguro
  // clienteId={formData?.cliente_id}      // opcional
/>


    

    </>
  );
};

export default Prospectogrupo;
