import React, { useState, useEffect } from "react";
import ClienteExistente from "../ClienteExistente"; // ⬅️ ajusta la ruta si es necesario
import { sanitizeMoneyInput, formatMoney2 } from "../../services/ingresos";

// Paleta/iconos por tipo (igual que antes)
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
  grupoFamiliarId, 
  onCreateCoberturaDeClienteExistente,          
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("nuevo");      // 'nuevo' | 'existente' ⬅️ nuevo
  const [tipoExistente, setTipoExistente] = useState("Tomador"); // ⬅️ nuevo

  const [data, setData] = useState({
    primer_nombre: "", segundo_nombre: "", apellidos: "", nombreCompleto: "",
    idioma: "", fechaNacimiento: "", edad: "", genero: "Masculino",
    ingresoAnual: "", nota: "", parentesco: "Tomador", estado_cobertura: "Si/No", tipo: "Tomador",
  });

  // hidratar al abrir
  useEffect(() => {
    if (!open) return;
    // reset de modo/tipo existente
    setMode("nuevo");
    setTipoExistente("Tomador");

    if (editingMember) {
      setData({
        ...editingMember,
        ingresoAnual: formatMoney2(editingMember.ingresoAnual ?? editingMember.ingreso_anual ?? ""),
        nombreCompleto:
          editingMember.nombreCompleto ||
          buildFullName(editingMember.primer_nombre, editingMember.segundo_nombre, editingMember.apellidos),
      });
      setStep(2);
    } else {
      setData({
        primer_nombre:"", segundo_nombre:"", apellidos:"", nombreCompleto:"",
        idioma:"", fechaNacimiento:"", edad:"", genero:"Masculino",
        ingresoAnual:"",  // queda vacío
        nota:"", parentesco:"Tomador", estado_cobertura:"Si/No", tipo:"Tomador"
      });
      setStep(1);
    }
    
  }, [open, editingMember]);

  const onChange = (e) => {
    const { name, value, type } = e.target;
  
    // si es dinero, sanitiza mientras escribe
    const val =
      name === "ingresoAnual" ? sanitizeMoneyInput(value) : value;
  
    setData(prev => {
      let v = val;
      if (["primer_nombre","segundo_nombre","apellidos"].includes(name)) v = capWords(val);
      else if (["idioma","nota"].includes(name)) v = capFirst(val);
      else if (!["number","date"].includes(type) && name !== "ingresoAnual") v = capFirst(val);
  
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
      fecha_nacimiento: data.fechaNacimiento ||  "",
     ingreso_anual: data.ingresoAnual ?? "",
     idioma:data.idioma || "",
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

    // Agregar un cliente EXISTENTE → crea cobertura y cierra modal
  const handleAddExisting = async (clienteSeleccionado) => {
   if (!clienteSeleccionado?.id) return;
    if (!grupoFamiliarId) {
      console.error("Falta grupoFamiliarId");
      return;
    }
    const payload = {
      grupo_familiar_id: grupoFamiliarId,
      cliente_id: clienteSeleccionado.id,
      tipo: data.parentesco || data.tipo || "Tomador",
      cobertura_tipo: defaultCoberturaTipo,
      estado_cobertura: data.estado_cobertura || "Si/No",
    };
    try {
      setSaving(true);
      // este callback se encarga de hacer el POST y de hacer setFamilyMembers en el padre
     await onCreateCoberturaDeClienteExistente?.(payload, clienteSeleccionado);
      // cerrar modal y resetear wizard
      setStep(1);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };


  // mapear cliente API → shape de miembro para pintar local (si hiciera falta)
// Reemplaza tu mapClienteToMember por este:
const mapClienteToMember = (c, tipoSel) => {
    const primer  = c.primer_nombre || c.nombre || "";
    const segundo = c.segundo_nombre || "";
    const apell   = c.apellidos || c.apellido || "";
    const fecha   = c.fecha_nacimiento || c.fechaNacimiento || "";
    const nombreCompleto = c.nombre_completo || buildFullName(primer, segundo, apell);
    const edad = calcAge(fecha);
    const genero = c.genero || "Masculino";
    const idioma  = c.idioma || ""; 
  
    return {
      // ---- plano (fallback que tu card también entiende)
      primer_nombre: primer,
      segundo_nombre: segundo,
      apellidos: apell,
      nombreCompleto,
      genero,
      edad,
      fecha_nacimiento: fecha,
      idioma,           
      // ---- metadatos de cobertura / UI
      parentesco: tipoSel,
      tipo: tipoSel,
      estado_cobertura: "Sí",
      cobertura_tipo: defaultCoberturaTipo,
      cliente_id: c.id,
      // ---- anidado como la card espera por defecto
      cliente: {
        id: c.id,
        primer_nombre: primer,
        segundo_nombre: segundo,
        apellidos: apell,
        nombre_completo: nombreCompleto, // 👈 usado por fullName
        genero,

        fecha_nacimiento: fecha,
        edad,
        telefono: c.telefono || "",
        idioma,
      },
    };
  };
  

  // elegir cliente existente → crear cobertura (remota) o card local
  // dentro de MemberModal
const handlePickExisting = async (cliente) => {
    // Validaciones básicas
    if (!grupoFamiliarId) {
      console.error("Falta grupoFamiliarId");
      return;
    }
    if (!cliente?.id) {
      console.error("Cliente inválido");
      return;
    }
  
    // payload mínimo para INSERT de cobertura
    const coberturaPayload = {
      grupo_familiar_id: grupoFamiliarId,
      cliente_id: cliente.id,
      parentesco: tipoExistente,   // == tipo seleccionado (Tomador, Cónyuge, etc.)
      tipo: tipoExistente,
      cobertura_tipo: defaultCoberturaTipo,
      estado_cobertura: "Sí",      // o "Si/No" si prefieres
    };
  
    try {
      setSaving(true);
  
      // ✅ SIEMPRE que sea "existente", usamos este callback
      if (onCreateCoberturaDeClienteExistente) {
        const created = await onCreateCoberturaDeClienteExistente(coberturaPayload, cliente);
  
        // Si tu backend NO devuelve el miembro listo para pintar,
        // puedes hacer un fallback local aquí (opcional):
        // if (!created?.miembro) await onCreateLocal?.(mapClienteToMember(cliente, tipoExistente));
      } else {
        // Si no nos pasaron el callback, al menos agregamos la card local (Prospecto)
        await onCreateLocal?.(mapClienteToMember(cliente, tipoExistente));
      }
  
      onClose?.();
    } finally {
      setSaving(false);
    }
  };
  
  const onBlurMoney = (field) => () => {
    setData(prev => ({ ...prev, [field]: formatMoney2(prev[field]) }));
  };
  

  if (!open) return null;

  const color = TYPE_COLOR[data.tipo] || "secondary";
  const icon  = TYPE_ICON[data.tipo]  || "fa-user-check";
  const title = step === 1
    ? (editingMember ? "Cambiar Tipo de Miembro" : "Seleccionar Tipo de Miembro1")
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

              {/* Tabs: Nuevo / Existente */}
              {!editingMember && (
                <ul className="nav nav-tabs mb-3">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${mode==='nuevo'?'active':''}`}
                      onClick={()=>setMode('nuevo')}
                    >
                      Nuevo
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${mode==='existente'?'active':''}`}
                      onClick={()=>setMode('existente')}
                    >
                      Existente
                    </button>
                  </li>
                </ul>
              )}

              {mode === 'nuevo' ? (
                <div className="row g-3">
                  {TIPOS.map(t => (
                    <div key={t.tipo} className="col-md-4 col-sm-6">
                      <div
                        className={`card h-100 border-2 ${data.tipo===t.tipo?`border-${TYPE_COLOR[t.tipo]||"secondary"} bg-light`:"border-light"}`}
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
              ) : (
                <>
                  <div className="row g-2 align-items-center mb-3">
                    <div className="col-auto">
                      <label className="form-label mb-0">Tipo</label>
                    </div>
                    <div className="col-auto">
                      <select
                        className="form-select form-select-sm"
                        value={tipoExistente}
                        onChange={(e)=>setTipoExistente(e.target.value)}
                      >
                        {TIPOS.map(t => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="col-auto">
                      <span className={`badge bg-${TYPE_COLOR[tipoExistente]||"secondary"}`}>{tipoExistente}</span>
                    </div>
                  </div>

                  <ClienteExistente onClienteSeleccionado={handlePickExisting} />
                </>
              )}
            </div>
          )}

          {/* PASO 2 (formulario) */}
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
                      <input
                        className="form-control"
                        inputMode="decimal"               
                        name="ingresoAnual"
                        value={data.ingresoAnual}
                        onChange={onChange}
                        onBlur={onBlurMoney("ingresoAnual")}
                        disabled={readOnly}
                        placeholder="0.00"
                      />
                    </div>

                <div className="col-md-3">
                  <label className="form-label">¿Está en Cobertura?</label>
                  <select className="form-select" name="estado_cobertura" value={data.estado_cobertura} onChange={onChange} disabled={readOnly}>
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

            {/* Guardar solo aplica para paso 2 o cuando hay edición */}
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
