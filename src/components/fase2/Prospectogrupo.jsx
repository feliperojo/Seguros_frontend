import React from 'react';

const Prospectogrupo = ({ formData, onChange, readOnly }) => {
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
              <select className="form-select" name="captadoPor" value={formData.captadoPor} onChange={onChange} disabled={readOnly}>
                <option value="Google">Google</option>
                <option value="Facebook">Facebook</option>
                <option value="Referido">Referido</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Cuál</label>
              <input type="text" className="form-control" name="cual" value={formData.cual} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-4">
              <label className="form-label">Asesor</label>
              <input type="text" className="form-control" name="asesor" value={formData.asesor} onChange={onChange} disabled={readOnly}/>
            </div>
          </div>
        </div>
      </div>

      {/* Persona de Contacto */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Persona de Contacto</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Nombre</label>
              <input type="text" className="form-control" name="nombre" value={formData.nombre} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-3">
              <label className="form-label">Apellidos</label>
              <input type="text" className="form-control" name="apellidos" value={formData.apellidos} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-2">
              <label className="form-label">¿Pertenece al Grupo Familiar?</label>
              <select className="form-select" name="perteneceFamilia" value={formData.perteneceFamilia} onChange={onChange} disabled={readOnly}>
                <option value="No">No</option>
                <option value="Sí">Sí</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Teléfono 1</label>
              <input type="tel" className="form-control" name="telefono1" value={formData.telefono1} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-2">
              <label className="form-label">Teléfono 2</label>
              <input type="tel" className="form-control" name="telefono2" value={formData.telefono2} onChange={onChange} disabled={readOnly}/>
            </div>

            <div className="col-md-8">
              <label className="form-label">Nota</label>
              <input type="text" className="form-control" name="nota" value={formData.nota} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-4">
              <label className="form-label">Relación</label>
              <select className="form-select" name="relacion" value={formData.relacion} onChange={onChange} disabled={readOnly}>
                <option value="">Seleccione</option>
                <option value="Esposo/a">Esposo/a</option>
                <option value="Hijo/a">Hijo/a</option>
                <option value="Padre/Madre">Padre/Madre</option>
                <option value="Amigo/a">Amigo/a</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="col-12">
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="whatsapp" name="whatsapp" checked={formData.whatsapp} onChange={onChange} disabled={readOnly}/>
                <label className="form-check-label" htmlFor="whatsapp">WhatsApp</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="telegram" name="telegram" checked={formData.telegram} onChange={onChange} disabled={readOnly}/>
                <label className="form-check-label" htmlFor="telegram">Telegram</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="sms" name="sms" checked={formData.sms} onChange={onChange} disabled={readOnly}/>
                <label className="form-check-label" htmlFor="sms">SMS</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bloque económico (la “última imagen”) */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">ZIP Code</label>
              <input type="text" className="form-control" name="zipCode" value={formData.zipCode} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-3">
              <label className="form-label">Ingreso Familiar</label>
              <input type="text" className="form-control" name="ingresoFamiliar" value={formData.ingresoFamiliar} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-3">
              <label className="form-label">Personas en Cobertura</label>
              <input type="number" className="form-control" name="personasCobertura" value={formData.personasCobertura} onChange={onChange} disabled={readOnly}/>
            </div>
            <div className="col-md-3">
              <label className="form-label">Personas en Taxes</label>
              <input type="number" className="form-control" name="personasTaxes" value={formData.personasTaxes} onChange={onChange} disabled={readOnly}/>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Prospectogrupo;
