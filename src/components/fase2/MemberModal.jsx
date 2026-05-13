import React, { useEffect, useState } from "react";
import { sanitizeMoneyInput, formatMoney2 } from "../../services/ingresos";
import LanguageSelect from "../selects/LanguageSelect";
import { normalizeDateForInput } from "../../utils/formatters";
import MdyDashDateInput from "../common/MdyDashDateInput";
import apiRequest from "../../services/api";

/* ---------- Constantes de UI ---------- */
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

/* ---------- Helpers ---------- */
const buildFullName = (p="", s="", a="") => [p?.trim(), s?.trim(), a?.trim()].filter(Boolean).join(" ");
const capFirst = (t="") => (t ? t.trimStart().replace(/^./, c=>c.toUpperCase()) : "");
const capWords = (t="") => t.toLowerCase().replace(/\b\w/g, c=>c.toUpperCase());
const calcAge = (d) => {
  if (!d) return "";
  const b = new Date(d), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
};

export default function MemberModalCreate({
  open,
  onClose,
  editingMember = null,
  defaultCoberturaTipo = "Plan de salud",
  readOnly = false,
  isProspecto = false,
  onCreateLocal,
  onUpdateLocal,
  onCreateRemote,
  onRequestExistingClientModal,
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

      const [data, setData] = useState({
        primer_nombre: "",
        segundo_nombre: "",
        apellidos: "",
        nombreCompleto: "",
        nombre_completo: "",
        idioma: "",
        fechaNacimiento: "",
        edad: "",
        genero: "Masculino",
        ingresoAnual: "",
        nota: "",
        parentesco: "Tomador",
        estado_cobertura: "Sí",
        tipo: "Tomador",
      });

  // Estado para validación de existencia
  const [validating, setValidating] = useState(false);
  const [validationDone, setValidationDone] = useState(false);
  const [validationMatches, setValidationMatches] = useState([]);
  const [allowSaveAfterValidation, setAllowSaveAfterValidation] = useState(false);
  const [validationError, setValidationError] = useState("");

  /* -------- Hidratar al abrir -------- */
  useEffect(() => {
    if (!open) return;

    if (editingMember) {
      setData({
        ...editingMember,
        ingresoAnual: formatMoney2(
          editingMember.ingresoAnual ?? editingMember.ingreso_anual ?? ""
        ),
        nombreCompleto:
          editingMember.nombreCompleto ||
          editingMember.nombre_completo ||
          buildFullName(
            editingMember.primer_nombre,
            editingMember.segundo_nombre,
            editingMember.apellidos
          ),
        nombre_completo:
          editingMember.nombre_completo ||
          editingMember.nombreCompleto ||
          buildFullName(
            editingMember.primer_nombre,
            editingMember.segundo_nombre,
            editingMember.apellidos
          ),
      });
      setStep(2);
    } else {
      setData({
        primer_nombre: "",
        segundo_nombre: "",
        apellidos: "",
        nombreCompleto: "",
        nombre_completo: "",
        idioma: "",
        fechaNacimiento: "",
        edad: "",
        genero: "Masculino",
        ingresoAnual: "",
        nota: "",
        parentesco: "Tomador",
        estado_cobertura: "Sí",
        tipo: "Tomador",
      });
      setStep(1);
    }

    // Resetear estado de validación cada vez que se abre
    setValidating(false);
    setValidationDone(false);
    setValidationMatches([]);
    setAllowSaveAfterValidation(false);
    setValidationError("");
  }, [open, editingMember]);

  /* -------- Handlers -------- */
  const onChange = (e) => {
    const { name, value, type } = e.target;
    const sanitized = name === "ingresoAnual" ? sanitizeMoneyInput(value) : value;

    setData(prev => {
      let v = sanitized;
      if (["primer_nombre","segundo_nombre","apellidos"].includes(name)) v = capWords(sanitized);
      else if (["nota"].includes(name)) v = capFirst(sanitized);
      else if (!["number","date"].includes(type) && name !== "ingresoAnual") v = capFirst(sanitized);

      const next = { ...prev, [name]: v };
      if (name === "fechaNacimiento") next.edad = calcAge(v);
      if (["primer_nombre","segundo_nombre","apellidos"].includes(name)) {
          const nc = buildFullName(next.primer_nombre, next.segundo_nombre, next.apellidos);
  next.nombreCompleto = nc;
  next.nombre_completo = nc;
      }
      return next;
    });

    // Cada cambio invalida la validación previa
    setValidationDone(false);
    setValidationMatches([]);
    setAllowSaveAfterValidation(false);
    setValidationError("");
  };


   const selectTipo = (tipo) => {
       setData(prev => ({ ...prev, tipo, parentesco: tipo }));
       setStep(2);
     };

  const onBlurMoney = (field) => () =>
    setData(prev => ({ ...prev, [field]: formatMoney2(prev[field]) }));

  const handleValidateExistence = async () => {
    setValidationError("");
    setValidationDone(false);
    setValidationMatches([]);
    setAllowSaveAfterValidation(false);

    const nombreCompleto = buildFullName(
      data.primer_nombre,
      data.segundo_nombre,
      data.apellidos
    )
      .toString()
      .trim()
      .replace(/\s+/g, " ");

    const fechaNacimiento = data.fechaNacimiento
      ? normalizeDateForInput(data.fechaNacimiento)
      : "";

    if (!nombreCompleto || !fechaNacimiento) {
      setValidationError(
        "Para validar existencia debes ingresar al menos nombre completo y fecha de nacimiento."
      );
      return;
    }

    try {
      setValidating(true);

      const posibles = await apiRequest(
        `cliente/buscar?nombre=${encodeURIComponent(
          nombreCompleto
        )}&incluir_prospectos=false`,
        "GET"
      );

      const candidatos = Array.isArray(posibles?.data) ? posibles.data : [];

      const matches = candidatos.filter((c) => {
        const nombreBD = (
          c.nombre_completo ||
          buildFullName(
            c.primer_nombre || c.nombre || "",
            c.segundo_nombre || "",
            c.apellidos || c.apellido || ""
          )
        )
          .toString()
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase();

        const nombreInput = nombreCompleto.toLowerCase();

        // Coincidencia aproximada: todas las palabras del input deben aparecer
        // en el nombre de BD (en cualquier orden), o el nombre completo de BD
        // contiene al nombre ingresado (para manejar casos sin segundo nombre/apellido).
        const palabrasInput = nombreInput.split(" ").filter(Boolean);
        const palabrasCoinciden =
          palabrasInput.length > 0 &&
          palabrasInput.every((w) => nombreBD.includes(w));

        const nombreContiene =
          nombreBD.includes(nombreInput) || nombreInput.includes(nombreBD);

        const fechaBD = c.fecha_nacimiento
          ? normalizeDateForInput(c.fecha_nacimiento)
          : "";

        return (
          (palabrasCoinciden || nombreContiene) &&
          fechaBD === fechaNacimiento
        );
      });

      setValidationMatches(matches);
      setValidationDone(true);

      if (matches.length === 0) {
        // No hay coincidencias → habilitar guardar directo
        setAllowSaveAfterValidation(true);
      }
    } catch (err) {
      setValidationError(
        "Ocurrió un error al validar la existencia del cliente. Puedes intentar nuevamente."
      );
      if (import.meta.env.DEV) {
        console.error("Error validando existencia de cliente desde MemberModal:", err);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    // 1) Normaliza y arma el payload base
    const toNumber = (s) => {
      if (s === null || s === undefined || s === "") return null;
      // "1.234,56" -> 1234.56
      const n = String(s).replace(/\./g, "").replace(",", ".");
      const num = Number(n);
      return Number.isFinite(num) ? num : null;
    };

    const nombreCompletoFinal = buildFullName(
      data.primer_nombre, 
      data.segundo_nombre, 
      data.apellidos
    );
  
    const base = {
      // nombres
      primer_nombre: (data.primer_nombre || "").trim(),
      segundo_nombre: (data.segundo_nombre || "").trim(),
      apellidos: (data.apellidos || "").trim(),
      nombreCompleto: nombreCompletoFinal,
      nombre_completo: nombreCompletoFinal,

  
      // demográficos
      idioma: data.idioma || "",
      fecha_nacimiento: data.fechaNacimiento || "",
      edad: data.edad || "",
      genero: data.genero || "Masculino",
  
      // económicos / notas
      ingreso_anual: data.ingresoAnual,          // string formateado aquí
      nota: data.nota || "",
  
      // cobertura / tipo
      parentesco: data.parentesco || data.tipo || "Tomador",
      tipo: data.parentesco || data.tipo || "Tomador",
      estado_cobertura: data.estado_cobertura || "Sí",
      cobertura_tipo: defaultCoberturaTipo,
      // contact
      telefonos: Array.isArray(data.telefonos) ? data.telefonos : [],
    };

    
  
    try {
      setSaving(true);
  
      // 2) Update local si está editando
      if (editingMember && onUpdateLocal) {
        // el padre decide cómo actualizar el miembro existente
        await onUpdateLocal(editingMember.id, base);
        onClose?.();
        return;
      }
  
      // 3) Crear local (modo prospecto, sin backend)
      if (isProspecto && onCreateLocal) {
        await onCreateLocal(base);
        onClose?.();
        return;
      }
  
      // 4) Crear remoto (modo edición de grupo ya existente)
      if (!isProspecto && onCreateRemote) {
        const remotePayload = {
          ...base,
          // al backend SIEMPRE número
          ingreso_anual: toNumber(base.ingreso_anual),
        };
        // >>> IMPORTANTE: onCreateRemote debe retornar el miembro creado
        // (o al menos los datos necesarios para pintar la card).
        const created = await onCreateRemote(remotePayload);
  
        // Si tu padre NO inserta en el estado dentro de onCreateRemote,
        // habilita también onCreateLocal para insertar inmediatamente en UI.
        if (onCreateLocal && created) {
          await onCreateLocal(created); // respeta estado del padre
        }
  
        onClose?.();
        return;
      }
  
      // 5) Fallback: si nada aplica, cierra igual para no bloquear UX
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

  const mustValidateBeforeSave = !editingMember && !isProspecto;
  const canSave =
    !mustValidateBeforeSave ||
    (validationDone && (validationMatches.length === 0 || allowSaveAfterValidation));

  return (
    <div className="modal fade show d-block" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close" onClick={onClose} />
          </div>

          {/* PASO 1: Elegir tipo */}
          {step === 1 && (
            <div className="modal-body">
              <div className="row g-3">
                {TIPOS.map(t => (
                  <div key={t.tipo} className="col-md-4 col-sm-6">
                    <div
                      className={`card h-100 border-2 ${data.tipo===t.tipo?`border-${TYPE_COLOR[t.tipo]||"secondary"} bg-light`:"border-light"}`}
                      style={{cursor:"pointer"}}
                      onClick={() => selectTipo(t.tipo)}
                    >
                      <div className="card-body text-center py-4">
                        <div
                          className={`bg-${TYPE_COLOR[t.tipo]||"secondary"} text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3`}
                          style={{width:60, height:60}}
                        >
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

          {/* PASO 2: Formulario */}
          {step === 2 && (
            <div className="modal-body">
              {!editingMember && (
                <div className="d-flex align-items-center mb-3">
                  <button className="btn btn-outline-secondary btn-sm me-3" onClick={()=>setStep(1)}>
                    <i className="fas fa-arrow-left me-1" /> Cambiar Tipo
                  </button>
                  <span className={`badge bg-${color}`}><i className={`fas ${icon} me-1`} />{data.tipo}</span>
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
                  <LanguageSelect name="idioma" value={data.idioma} onChange={onChange} disabled={readOnly}/>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha de Nacimiento</label>
                  <MdyDashDateInput
                    allowManualEntry
                    valueIso={normalizeDateForInput(data.fechaNacimiento)}
                    minIso="1900-01-01"
                    maxIso="2099-12-31"
                    disabled={readOnly}
                    onChangeIso={(iso) =>
                      onChange({
                        target: { name: "fechaNacimiento", value: iso, type: "date" },
                      })
                    }
                  />
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

              {/* Bloque de validación de existencia */}
              <div className="mt-3">
                {validationError && (
                  <div className="alert alert-danger py-2 mb-2">
                    {validationError}
                  </div>
                )}

                {validationDone && validationMatches.length === 0 && (
                  <div className="alert alert-success py-2 mb-2">
                    No se encontraron clientes con el mismo nombre completo y fecha de nacimiento.
                    Puedes guardar este nuevo miembro con tranquilidad.
                  </div>
                )}

                {validationDone && validationMatches.length > 0 && (
                  <div className="alert alert-warning mb-2">
                    <p className="mb-2">
                      Se encontraron clientes con <strong>datos similares</strong> a los que ingresaste:
                    </p>
                    <ul className="mb-2">
                      {validationMatches.map((c) => (
                        <li key={c.id}>
                          <strong>{c.nombre_completo}</strong>{" "}
                          {c.fecha_nacimiento && `| Nac.: ${normalizeDateForInput(c.fecha_nacimiento)}`}{" "}
                          {c.estado_cliente && `| Estado: ${c.estado_cliente}`}
                        </li>
                      ))}
                    </ul>
                    <p className="mb-2">
                      ¿Alguno de estos clientes es el que deseas agregar al grupo familiar?
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => {
                          onRequestExistingClientModal?.();
                          onClose?.();
                        }}
                      >
                        Sí, usar buscador de clientes existentes
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setAllowSaveAfterValidation(true)}
                      >
                        No, ninguno coincide. Continuar y crear nuevo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving || validating}>
              Cancelar
            </button>
            {step === 2 && (
              <>
                {!readOnly && !editingMember && (
                  <button
                    type="button"
                    className="btn btn-outline-primary me-2"
                    onClick={handleValidateExistence}
                    disabled={saving || validating}
                  >
                    {validating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Validando…
                      </>
                    ) : (
                      <>Validar existencia</>
                    )}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || validating || (mustValidateBeforeSave && !canSave)}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Guardando…
                    </>
                  ) : (
                    <>Guardar</>
                  )}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
