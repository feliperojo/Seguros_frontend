import React, { useEffect, useState } from "react";
import TelefonosInput from "./TelefonosInput";
import {
  fetchClienteContacto,
  upsertContacto,
  linkClienteContacto,
  updateLinkClienteContacto
} from "../../services/contactosService";
import { splitFullName, joinNameParts } from "../../utils/names";

export default function PersonaContactoCard({
  className = "",
  // IDs del padre
  clienteId = null,
  grupoFamiliarId = null,

  // switches
  primary = false,
  addAnother = false,
  onTogglePrimary = () => {},
  onToggleAddAnother = () => {},

  // formulario controlado/semicontrolado
  value,
  onChange = () => {},

  // selects
  idiomaOptions = ["Spanish", "English"],
  relacionOptions = ["Cónyuge", "Hijo/a", "Padre", "Madre", "Sobrino", "Tio/a", "Hermano/a", "Amigo/a", "Otro"],

  // callbacks
  onSaved = () => {},
  readOnly = false
}) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState(null);

  const [form, setForm] = useState({
    nombre_completo: "",
    idioma: "",
    perteneceGF: "",
    relacion: "",
    nota: "",
    telefonos: [],
    email_principal: "",
    ...value
  });

  useEffect(() => {
    if (value) setForm((f) => ({ ...f, ...value }));
  }, [value]);

  // Carga vínculo/ contacto si existe
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clienteId && !grupoFamiliarId) return;
      try {
        setLoading(true);
        const res = await fetchClienteContacto({ clienteId, grupoFamiliarId });
        const first = Array.isArray(res?.data) ? res.data[0] : (Array.isArray(res) ? res[0] : res);

        if (mounted && first) {
          setLink(first);
          const c = first.contacto || {};
          // Asegura tener nombre_completo visible aunque en BD estén separados
          const nombreCompleto =
            c.nombre_completo ||
            joinNameParts(c.nombres || "", c.apellidos || "");

          setForm((prev) => ({
            ...prev,
            nombre_completo: nombreCompleto || prev.nombre_completo,
            idioma: c.idioma || prev.idioma,
            telefonos: c.telefonos || [],
            email_principal: c.email_principal || "",
            relacion: first.relacion || prev.relacion,
            perteneceGF: first.pertenece_al_grupo ? "Si" : (prev.perteneceGF || ""),
            nota: first.nota || prev.nota
          }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clienteId, grupoFamiliarId]);

  const update = (field, val) => {
    const next = { ...form, [field]: val };
    setForm(next);
    onChange(next);
  };

  const handleSave = async () => {
    if (readOnly) return;
    const full = (form.nombre_completo || "").trim();
    if (!full) {
      alert("Ingresa el nombre del contacto.");
      return;
    }
    if (!clienteId && !grupoFamiliarId) {
      alert("Falta clienteId o grupoFamiliarId para asociar el contacto.");
      return;
    }

    try {
      setLoading(true);

      // 1) upsert contacto (el servicio deriva nombres/apellidos)
      const contactoRes = await upsertContacto({
        nombre_completo: full,
        idioma: form.idioma || "",
        telefonos: Array.isArray(form.telefonos) ? form.telefonos : [],
        email_principal: form.email_principal || null,
      });
      const contacto = contactoRes?.contacto || contactoRes || {};
      const contactoId = contacto.id;

      // 2) crear/actualizar vínculo
      const perteneceBool = (form.perteneceGF || "").toString().toLowerCase().startsWith("s");
      const payloadLink = {
        clienteId,
        grupoFamiliarId,
        contactoId,
        relacion: form.relacion || null,
        perteneceAlGrupo: perteneceBool,
        esPersonaContacto: !!primary,
        prioridad: 0,
        nota: form.nota || ""
      };

      let linkRes;
      if (link?.id) {
        linkRes = await updateLinkClienteContacto(link.id, {
          relacion: payloadLink.relacion,
          pertenece_al_grupo: payloadLink.perteneceAlGrupo,
          es_persona_contacto: payloadLink.esPersonaContacto,
          nota: payloadLink.nota
        });
      } else {
        linkRes = await linkClienteContacto(payloadLink);
      }

      setLink(link?.id ? linkRes : (linkRes?.link || linkRes));
      onSaved({ contacto, link: link?.id ? linkRes : (linkRes?.link || linkRes) });
      alert("Contacto guardado correctamente.");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el contacto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {/* switches */}
     

      {/* Card */}
      <div className="card">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">Persona de Contacto</h6>

          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small mb-1">Nombre Completo</label>
              <input
  className="form-control form-control-sm"
  placeholder="Nombre Completo"
  value={form.nombre_completo}
  onChange={(e) => {
    const raw = e.target.value;

    // formatea cada palabra con mayúscula inicial mientras se escribe
    const formatted = raw
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(/\s+/g, " ");

    update("nombre_completo", formatted);
  }}
  disabled={readOnly}
/>
            </div>

            <div className="col-12">
              <TelefonosInput
                value={form.telefonos}
                onChange={(v) => update("telefonos", v)}
                readOnly={readOnly}
              />
            </div>

            <div className="col-12">
              <label className="form-label small mb-1">Idioma</label>
              <select
                className="form-select form-select-sm"
                value={form.idioma}
                onChange={(e) => update("idioma", e.target.value)}
                disabled={readOnly}
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
                disabled={readOnly}
              >
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
                disabled={readOnly}
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
                disabled={readOnly}
              />
            </div>

            {!readOnly && (
              <div className="col-12 d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "Guardar contacto"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
