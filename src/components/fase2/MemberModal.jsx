import React, { useState, useEffect } from "react";

// Paleta/iconos por tipo
const TYPE_COLOR = {
  Tomador: "primary", Conyuge: "info", "Hijo/a": "success", Hermano: "secondary",
  Dependiente: "secondary", Padre: "dark", Madre: "danger", Nieto: "warning",
  "Abuelo/a": "warning", "Suegro/a": "warning", "Tio/a": "warning", "Sobrino/a": "warning",
};
const TYPE_ICON = {
  Tomador: "fa-user-shield", Conyuge: "fa-user-friends", "Hijo/a": "fa-child",
  Hermano: "fa-user-friends", Padre: "fa-user-tie", Madre: "fa-user-nurse",
  Nieto: "fa-user-ninja", "Abuelo/a": "fa-user-astronaut", "Suegro/a": "fa-user-astronaut",
  "Tio/a": "fa-user-astronaut", "Sobrino/a": "fa-people-line",
};
const TIPOS = [
  { tipo: "Tomador",   label: "Tomador" },
  { tipo: "Conyuge",   label: "Cónyuge" },
  { tipo: "Hijo/a",    label: "Hijo/a" },
  { tipo: "Hermano",   label: "Hermano" },
  { tipo: "Padre",     label: "Padre" },
  { tipo: "Madre",     label: "Madre" },
  { tipo: "Nieto",     label: "Nieto" },
  { tipo: "Abuelo/a",  label: "Abuelo/a" },
  { tipo: "Suegro/a",  label: "Suegro/a" },
  { tipo: "Tio/a",     label: "Tio/a" },
  { tipo: "Sobrino/a", label: "Sobrino/a" },
];

const buildFullName = (p="", s="", a="") => [p?.trim(), s?.trim(), a?.trim()].filter(Boolean).join(" ");
const capFirst = (t="") => t ? t.trimStart().replace(/^./, c=>c.toUpperCase()) : "";
const capWords = (t="") => t.toLowerCase().replace(/\b\w/g, c=>c.toUpperCase());
const calcAge = (d) => {
  if (!d) return "";
  const b=new Date(d), t=new Date();
  let a=t.getFullYear()-b.getFullYear();
  const m=t.getMonth()-b.getMonth();
  if(m<0||(m===0 && t.getDate()<b.getDate())) a--;
  return a;
};

/**
 * MemberModal
 * props:
 * - open, onClose
 * - editingMember (obj | null)
 * - defaultCoberturaTipo (string)
 * - canAdd (bool), readOnly (bool), isProspecto (bool)
 * - onCreateLocal(payload)     -> para staging/local (Prospecto)
 * - onUpdateLocal(id, payload) -> editar local
 * - onCreateRemote(payload)    -> para grupo existente (llama al backend)
 */
export default function MemberModal({
  open,
  onClose,
  editingMember = null,
  defaultCoberturaTipo = "Plan de salud",
  canAdd = false,
  readOnly = false,
  isProspecto = false,
  onCreateLocal,
  onUpdateLocal,
  onCreateRemote,
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    primer_nombre: "", segundo_nombre: "", apellidos: "", nombreCompleto: "",
    idioma: "", fechaNacimiento: "", edad: "", genero: "Masculino",
    ingresoAnual: "", nota: "", parentesco: "Tomador", estado_cobertura: "Si/No", tipo: "Tomador",
  });

  // hidratar al abrir
  useEffect(() => {
    if (!open) return;
    if (editingMember) {
      setData({
        ...editingMember,
        nombreCompleto: editingMember.nombreCompleto ||
          buildFullName(editingMember.primer_nombre, editingMember.segundo_nombre, editingMember.apellidos),
      });
      setStep(2);
    } else {
      setData({
        primer_nombre:"", segundo_nombre:"", apellidos:"", nombreCompleto:"",
        idioma:"", fechaNacimiento:"", edad:"", genero:"Masculino", ingresoAnual:"",
        nota:"", parentesco:"Tomador", estado_cobertura:"Si/No", tipo:"Tomador"
      });
      setStep(1);
    }
  }, [open, editingMember]);

  const onChange = (e) => {
    const { name, value, type } = e.target;
    setData(prev => {
      let v = value;
      if (["primer_nombre","segundo_nombre","apellidos"].includes(name)) v = capWords(value);
      else if (["idioma","nota"].includes(name)) v = capFirst(value);
      else if (!["number","date"].includes(type) && name !== "ingresoAnual") v = capFirst(value);

      const next = { ...prev, [name]: v };
      if (name === "fechaNacimiento") next.edad = calcAge(v);
      if (["primer_nombre","segundo_nombre","apellidos"].includes(name)) {
        next.nombreCompleto = buildFullName(next.primer_nombre, next.segundo_nombre, next.apellidos);
      }
      return next;
    });
  };

  const selectTipo = (tipo) => setData(prev => ({ ...prev, tipo, parentesco: tipo })) || setStep(2);

  const handleSave = async () => {
    const payload = {
      ...data,
      nombreCompleto: buildFullName(data.primer_nombre, data.segundo_nombre, data.apellidos),
      parentesco: data.parentesco || data.tipo || "Tomador",
      tipo: data.parentesco || data.tipo || "Tomador",
      cobertura_tipo: defaultCoberturaTipo,
    };

    try {
      setSaving(true);
      if (editingMember && onUpdateLocal) {
        await onUpdateLocal(editingMember.id, payload);
      } else if (isProspecto && onCreateLocal) {
        await onCreateLocal(payload);
      } else if (!isProspecto && onCreateRemote) {
        await onCreateRemote(payload);
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const color = TYPE_COLOR[data.tipo] || "secondary";
  const icon  = TYPE_ICON[data.tipo]  || "fa-user-check";
  const title = step === 1
    ? (editingMember ? "Cambiar Tipo de Miembro" : "Seleccionar Tipo de Miembro")
    : (data.nombreCompleto?.trim() || `Datos del ${data.tipo}`);

  return (
    <div className="modal fade show d-block" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close" onClick={onClose} />
          </div>

          {/* PASO 1 */}
          {step===1 && (
            <div className="modal-body">
              <div className="row g-3">
                {TIPOS.map(t => (
                  <div key={t.tipo} className="col-md-4 col-sm-6">
                    <div
                      className={`card h-100 border-2 ${data.tipo===t.tipo?`border-${color} bg-light`:"border-light"}`}
                      style={{cursor:"pointer"}}
                      onClick={() => selectTipo(t.tipo)}
                    >
                      <div className="card-body text-center py-4">
                        <div className={`bg-${TYPE_COLOR[t.tipo]||"secondary"} text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3`}
                             style={{width:60, height:60}}>
                          <i className={`fas ${TYPE_ICON[t.tipo]||"fa-user"} fa-lg`} />
                        </div>
                        <h6 className="mb-0">{t.label}</h6>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2 */}
          {step===2 && (
            <div className="modal-body">
              {!editingMember && (
                <div className="d-flex align-items-center mb-3">
                  <button className="btn btn-outline-secondary btn-sm me-3" onClick={()=>setStep(1)}>
                    <i className="fas fa-arrow-left me-1" /> Cambiar Tipo
                  </button>
                  <span className={`badge bg-${color}`}>{data.tipo}</span>
                </div>
              )}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Primer Nombre</label>
                  <input className="form-control" name="primer_nombre" value={data.primer_nombre} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Segundo nombre</label>
                  <input className="form-control" name="segundo_nombre" value={data.segundo_nombre} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Apellidos</label>
                  <input className="form-control" name="apellidos" value={data.apellidos} onChange={onChange} disabled={readOnly}/>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Idioma</label>
                  <select className="form-select" name="idioma" value={data.idioma} onChange={onChange} disabled={readOnly}>
                    <option value="">Seleccione</option>
                    <option value="Español">Español</option>
                    <option value="Inglés">Inglés</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha de Nacimiento</label>
                  <input type="date" className="form-control" name="fechaNacimiento" value={data.fechaNacimiento} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Edad</label>
                  <input type="number" className="form-control" name="edad" value={data.edad} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Género</label>
                  <select className="form-select" name="genero" value={data.genero} onChange={onChange} disabled={readOnly}>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Nota</label>
                  <textarea className="form-control" rows="3" name="nota" value={data.nota} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Ingreso Anual</label>
                  <input className="form-control" name="ingresoAnual" value={data.ingresoAnual} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-3">
                  <label className="form-label">¿Está en Cobertura?</label>
                  <select className="form-select" name="estado_cobertura" value={data.estado_cobertura} onChange={onChange} disabled={readOnly}>
                    <option value="Si/No">Si/No</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                    <option value="Medicare">Medicare</option>
                    <option value="Medicaid">Medicaid</option>
                  </select>
                </div>

                <input type="hidden" name="tipo" value={data.tipo}/>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            {step===2 && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"/>Guardando…</> : <>Guardar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
