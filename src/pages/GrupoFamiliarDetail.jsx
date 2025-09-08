import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import ProspectoBarra from "../components/fase2/ProspectoBarra";
import Prospectogrupo from "../components/fase2/Prospectogrupo";
import ProspectoDatos from "../components/fase2/ProspectoDatos";
import TomaDeDatos from "../components/fase2/TomaDeDatos";
import GrupoFamiliarService from "../services/GrupoFamiliarService";

import { mapGrupoFromForm, mapClienteFromMember, mapCoberturaFromMember, stripNulls } from "../adapters/prospecto.mapper";
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// ================== Helpers ==================



// --- Helpers de etapas (ajusta si tu flujo no es lineal) ---
const NEXT_OF = {
  PROSPECTO: "COTIZACION",
  COTIZACION: "SEGUIMIENTO",
  SEGUIMIENTO: "TOMA_DATOS",
  TOMA_DATOS: "INSCRIPCION_INI",
  INSCRIPCION_INI: "GRUPO_FAMILIAR",
};

const nextOf = (code) => NEXT_OF[(code || "").toUpperCase()] || null;


const canAdvance = (from, to, ctx = {}) => {
  if (!from || !to) return false;
  if (nextOf(from) !== to) return false;



  return true;
};

// Convierte cualquier forma de estado en código UPPERCASE
const toEstadoCode = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") return raw.toUpperCase();
  if (typeof raw === "object")
    return (raw.codigo || raw.code || raw.cod || raw.nombre || "").toUpperCase();
  return null;
};


const calcAge = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a;
};

const capitalizeFirst = (s = "") =>
  s ? s.trimStart().replace(/^./, (c) => c.toUpperCase()) : "";

const capitalizeWords = (s = "") =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Desempaqueta respuesta: acepta {status,data} o el objeto directo
const unwrapFull = (res) => res?.data ?? res ?? {};

// ================== Mapeos ==================
// API FULL -> formData para Prospectogrupo (según tu JSON de ejemplo)
const mapFullToForm = (fullRaw) => {
  const g = unwrapFull(fullRaw);

  // persona_contacto llega como string "Nombre Apellidos"
  const pc = (g.persona_contacto || "").trim();
  const [nombre, ...rest] = pc.split(/\s+/);
  const apellidos = rest.join(" ");

  const tels = g.telefonos || {};

  return {
    // Información del Prospecto
    captadoPor: g.captado_por ?? "",
    cual: g.cual ?? "",
    asesor: g.responsable ?? "",

    // Persona de Contacto
    nombre: nombre || "",
    apellidos: apellidos || "",
    perteneceFamilia: g.pertenece_grupo_familiar ? "Sí" : "No",
    telefono1: tels.telefono_1 ?? "",
    telefono2: tels.telefono_2 ?? "",
    nota: g.nota ?? "",
    relacion: g.relacion ?? "",

    whatsapp: !!tels.whatsapp,
    telegram: !!tels.telegram,
    sms: !!tels.mensaje_sms,

    // Económicos
    zipCode: g.zip_code ?? "", // no viene en tu JSON; queda vacío
    ingresoFamiliar: g.ingreso_familiar_anual ?? "",
    personasCobertura: g.personas_cobertura ?? "",
    personasTaxes: g.personas_taxes ?? "",
  };
};

// API FULL -> members para ProspectoDatos
const mapFullToMembers = (fullRaw) => {
  const g = unwrapFull(fullRaw);
  const coberturas = Array.isArray(g.coberturas) ? g.coberturas : [];

  return coberturas.map((cov, idx) => {
    const cli = cov?.cliente || {};

    const first  = (cli.primer_nombre  || "").trim();
    const middle = (cli.segundo_nombre || "").trim();
    const last   = (cli.apellidos      || "").trim();

    // si tu API no trae los atómicos, usa nombre_completo como fallback
    let primer_nombre  = first;
    let segundo_nombre = middle;
    let apellidos      = last;

    if (!primer_nombre && !apellidos && cli.nombre_completo) {
      const partes = cli.nombre_completo.trim().split(/\s+/);
      primer_nombre  = partes[0] || "";
      apellidos      = partes.slice(1).join(" ");
      // segundo_nombre lo dejamos vacío salvo que lo manejes diferente
    }

    const nombreCompleto = [primer_nombre, segundo_nombre, apellidos]
      .filter(Boolean).join(" ");
    return {
      id: cli.id ?? idx + 1,
      cliente_id: cli.id ?? null,
      cobertura_id: cov.id ?? null,  

      primer_nombre,
      segundo_nombre,
      apellidos,
      nombreCompleto,

      fechaNacimiento: cli.fecha_nacimiento ?? "",
      edad: calcAge(cli.fecha_nacimiento),
      ingresoAnual: cli.ingreso_anual ?? "",

      parentesco: cov.parentesco ?? "Tomador",
      tipo: cov.parentesco ?? "Tomador",
      estado_cobertura: cov.estado_cobertura ?? "Si/No",

      // (campos opcionales si luego los usas)
      plan: cov.plan ?? null,
      metal: cov.metal ?? null,
      red: cov.red ?? null,
      ano_cobertura: cov.ano_cobertura ?? null,
    };
  });
};

// ================== Componente ==================
const GrupoFamiliarDetail = () => {
  const { id } = useParams();
  const [estadoActual, setEstadoActual] = useState("PROSPECTO");
  const [formData, setFormData] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const [toast, setToast] = useState({ show: false, type: "success", title: "", message: "" });
  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
    // Autocierre en 3.5s
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  };
  // Handler de cambios (respeta capitalizaciones que pediste)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      if (!prev) return prev;
      let v = value;
      if (name === "nombre" || name === "apellidos") v = capitalizeWords(value);
      else if ((type === "text" || type === "textarea") && !name.toLowerCase().includes("telefono"))
        v = capitalizeFirst(value);
      return { ...prev, [name]: type === "checkbox" ? checked : v };
    });
  };

  const reload = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const full = await GrupoFamiliarService.getFullById(id);
  
      setFormData(mapFullToForm(full));
      setFamilyMembers(mapFullToMembers(full));
  
      const g = full?.data ?? full ?? {};
      const code = toEstadoCode(g?.estado_actual) || "PROSPECTO";
      setEstadoActual(code);
    } catch (err) {
      console.error(err);
      setLoadError(err?.message || "No se pudo cargar el grupo.");
    } finally {
      setLoading(false);
    }
  };
  

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  const advanceState = async (targetCode) => {
    setAdvancing(true);
    try {
      await GrupoFamiliarService.setEstado(id, targetCode, `Cambio a ${targetCode}`);
      setEstadoActual(targetCode);
      await reload();
      showToast("success", "Etapa actualizada", `Ahora estás en ${targetCode}.`);
    } catch (e) {
      showToast("danger", "Error al cambiar de etapa", e?.message || "No fue posible cambiar de etapa.");
    } finally {
      setAdvancing(false);
    }
  };
  

  const handleSave = async (alsoAdvance = false) => {
  try {
    setSaving(true);

    const grupoPayload = stripNulls(mapGrupoFromForm(formData));
    const clientesPayload = (familyMembers || [])
      .filter(m => m?.cliente_id)
      .map(mapClienteFromMember)
      .map(stripNulls);
    const coberturasPayload = (familyMembers || [])
      .filter(m => m?.cobertura_id)
      .map(m => mapCoberturaFromMember(m, id))
      .map(stripNulls);

    await GrupoFamiliarService.fullUpdate(id, {
      ...grupoPayload,
      clientes: clientesPayload,
      coberturas: coberturasPayload,
    });

    if (alsoAdvance) {
      const from = (estadoActual || "").toUpperCase();
      const to = nextOf(from);
      if (!to) {
        showToast("warning", "No hay siguiente etapa", "No existe transición disponible.");
      } else if (!canAdvance(from, to, { formData, familyMembers })) {
        showToast("warning", "Faltan datos", "Completa los requisitos antes de avanzar.");
      } else {
        const ok = window.confirm(`¿Guardar y pasar a ${to}?`);
        if (ok) await advanceState(to);
      }
    }

    setIsEditing(false);
    await reload();
    showToast("success", alsoAdvance ? "Guardado y etapa actualizada" : "Actualización exitosa", "");
  } catch (e) {
    showToast("danger", "Error al actualizar", e?.message || "No se pudo guardar los cambios.");
  } finally {
    setSaving(false);
  }
};


  
  if (loading) {
    return (
      <div className="container py-5 text-center text-muted">
        <div className="spinner-border me-2" role="status" />
        Cargando...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger d-flex align-items-center">
          <i className="fa fa-triangle-exclamation me-2" />
          <div>{loadError}</div>
        </div>
        <button className="btn btn-outline-primary" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }

  const readOnly = !isEditing;

  return (
    
    <div className="container-fluid bg-light min-vh-100 py-4">
      <div className="container">
        {/* Toast flotante */}
<div
  className="toast-container position-fixed top-0 end-0 p-3"
  style={{ zIndex: 1080 }}
>
  <div
    className={`toast show ${toast.show ? "opacity-100" : "opacity-0"}`}
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    style={{
      transition: "opacity 200ms ease",
      minWidth: 320,
      pointerEvents: toast.show ? "auto" : "none"
    }}
  >
    <div className={`toast-header bg-${toast.type} text-white`}>
      <strong className="me-auto">{toast.title || "Notificación"}</strong>
      <button
        type="button"
        className="btn-close btn-close-white ms-2 mb-1"
        aria-label="Close"
        onClick={() => setToast((t) => ({ ...t, show: false }))}
      />
    </div>
    {toast.message && (
      <div className="toast-body bg-white text-dark">
        {toast.message}
      </div>
    )}
  </div>
</div>

        <ProspectoBarra currentCode={estadoActual} />

        <div className="d-flex justify-content-end mb-3">
        {readOnly ? (
  <div className="btn-toolbar gap-2">
    <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Editar</button>

    <div className="btn-group">
      <button
        type="button"
        className="btn btn-outline-secondary dropdown-toggle"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        disabled={advancing}
      >
        Acciones
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        {nextOf(estadoActual) && (
          <li>
            <button
              className="dropdown-item"
              disabled={advancing}
              onClick={async () => {
                const from = (estadoActual || "").toUpperCase();
                const to = nextOf(from);
                if (!canAdvance(from, to, { formData, familyMembers })) {
                  showToast("warning", "No disponible", "No puedes avanzar todavía.");
                  return;
                }
                const ok = window.confirm(`¿Pasar a ${to}?`);
                if (!ok) return;
                await advanceState(to);
              }}
            >
              Pasar a {nextOf(estadoActual)} →
            </button>
          </li>
        )}
      </ul>
    </div>
  </div>
) : (
  <div className="btn-toolbar gap-2">
    <button
      className="btn btn-secondary"
      onClick={() => { setIsEditing(false); reload(); }}
      disabled={saving || advancing}
    >
      Cancelar
    </button>

    <div className="btn-group">
      <button className="btn btn-success" onClick={() => handleSave(false)} disabled={saving || advancing}>
        {saving ? (<><span className="spinner-border spinner-border-sm me-2" />Guardando…</>) : "Guardar"}
      </button>
      <button
        type="button"
        className="btn btn-success dropdown-toggle dropdown-toggle-split"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        disabled={saving || advancing || !nextOf(estadoActual)}
      >
        <span className="visually-hidden">Toggle</span>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        {nextOf(estadoActual) && (
          <li>
            <button className="dropdown-item" onClick={() => handleSave(true)} disabled={saving || advancing}>
              Guardar y pasar a {nextOf(estadoActual)} →
            </button>
          </li>
        )}
      </ul>
    </div>
  </div>
)}

</div>

        {/* Captación + económicos */}
        <Prospectogrupo
          formData={formData}
          onChange={handleInputChange}
          readOnly={readOnly}
        />
      {["TOMA_DATOS", "INSCRIPCION_INI", "GRUPO_FAMILIAR"].includes(
  (estadoActual || "").toUpperCase()
) ? (
  <TomaDeDatos
    familyMembers={familyMembers}
    setFamilyMembers={setFamilyMembers}
    readOnly={readOnly}
    onSaveMember={(m) => console.log("Guardar cliente:", m)}
    onSaveCobertura={(m) => console.log("Guardar cobertura:", m)}
  />
) : (
  <ProspectoDatos
    familyMembers={familyMembers}
    setFamilyMembers={setFamilyMembers}
    readOnly={readOnly}
  />
)}
      </div>


    </div>
    
  );
  
};

export default GrupoFamiliarDetail;
