
import React, { useEffect, useMemo, useState } from "react";
import TelefonosInput from "./TelefonosInput";
import {
     fetchClienteContacto,
     upsertClienteComoContacto,
     linkClienteContacto,
     updateLinkClienteContacto,
   } from "../../services/contactosService";
import { joinNameParts } from "../../utils/names";

export default function ContactosAsociadosAccordion({
  clienteId = null,
  grupoFamiliarId = null,
  className = "",
  idiomaOptions = ["Spanish", "English"],
  relacionOptions = ["Cónyuge","Hijo/a","Padre","Madre","Sobrino","Tio/a","Hermano/a","Amigo/a","Otro"],
  readOnly = false,
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // [{contacto, link}]
  const [linkEditar, setLinkEditar] = useState(null); // si algún día quieres editar
  const [saving, setSaving] = useState(false);

  // ---- form local (crear/editar) ----
  const [form, setForm] = useState({
    nombre_completo: "",
    idioma: "",
    perteneceGF: "No",
    relacion: "",
    nota: "",
    telefonos: [],
    email_principal: "",
  });

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const resetForm = () =>
    setForm({
      nombre_completo: "",
      idioma: "",
      perteneceGF: "No",
      relacion: "",
      nota: "",
      telefonos: [],
      email_principal: "",
    });

  const puedeGuardar = useMemo(
    () => (form.nombre_completo || "").trim().length > 0 && (clienteId || grupoFamiliarId),
    [form.nombre_completo, clienteId, grupoFamiliarId]
  );

  // ---- carga inicial ----
  const cargar = async () => {
    if (!clienteId && !grupoFamiliarId) return;
    try {
      setLoading(true);
      const res = await fetchClienteContacto({ clienteId, grupoFamiliarId });
      const arr = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res ? [res] : []));
      const normalizados = arr.map((l) => ({
        contacto: l.contacto || {},
        link: {
          id: l.id,
          relacion: l.relacion,
          pertenece_al_grupo: !!l.pertenece_al_grupo,
          es_persona_contacto: !!l.es_persona_contacto,
          nota: l.nota || "",
        },
      }));
      setItems(normalizados);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [clienteId, grupoFamiliarId]);

  // ---- guardar (crea o actualiza vínculo) ----
  const handleSave = async () => {
    if (readOnly || !puedeGuardar) return;

    try {
      setSaving(true);

     // 1) Crear o registrar un CLIENTE como contacto
     const contactoRes = await upsertClienteComoContacto({
      nombre_completo: (form.nombre_completo || "").trim(),
      idioma: form.idioma || "",
      telefonos: Array.isArray(form.telefonos) ? form.telefonos : [],
      email_principal: form.email_principal || null,
      telefono: Array.isArray(form.telefonos) && form.telefonos[0]?.numero
        ? form.telefonos[0].numero
        : null,
      nota: form.nota || null,
    });
    const contacto = contactoRes?.contacto || {};
    const contactoId = contacto?.id;
    
      // 2) vínculo
      const perteneceBool = (form.perteneceGF || "").toString().toLowerCase().startsWith("s");
      const payloadLink = {
        clienteId,
        grupoFamiliarId,
        contactoId,
        relacion: form.relacion || null,
        perteneceAlGrupo: perteneceBool,
        esPersonaContacto: false,
        prioridad: 0,
        nota: form.nota || "",
      };

      let linkRes;
      if (linkEditar?.id) {
        linkRes = await updateLinkClienteContacto(linkEditar.id, {
          relacion: payloadLink.relacion,
          pertenece_al_grupo: payloadLink.perteneceAlGrupo,
          es_persona_contacto: payloadLink.esPersonaContacto,
          nota: payloadLink.nota,
        });
      } else {
        linkRes = await linkClienteContacto(payloadLink);
      }
      const linkFinal = linkEditar?.id ? linkRes : (linkRes?.link || linkRes);

      // 3) reflejar en UI
      if (linkEditar?.id) {
        setItems((prev) =>
          prev.map((it) =>
            it.link.id === linkEditar.id ? { contacto, link: linkFinal } : it
          )
        );
      } else {
        setItems((prev) => [{ contacto, link: linkFinal }, ...prev]);
      }

      // 4) limpiar para poder crear otro
      setLinkEditar(null);
      resetForm();
      // Si usas Bootstrap collapse, puedes cerrarlo con data-bs attributes desde el botón si prefieres
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el contacto.");
    } finally {
      setSaving(false);
    }
  };

  // ---- helpers de UI ----
  const ContactoCard = ({ contacto = {}, link = {} }) => {
    const nombre =
      contacto?.nombre_completo ||
      joinNameParts(contacto?.nombres || "", contacto?.apellidos || "");
    const idioma = contacto?.idioma || "—";
    const telefonos = Array.isArray(contacto?.telefonos) ? contacto.telefonos : [];
    const relacion = link?.relacion || "—";
    const pertenece = link?.pertenece_al_grupo ? "Sí" : "No";
    const nota = link?.nota || "—";
  
    // Ordena: primero los "principal: true"
    const telsOrdenados = [...telefonos].sort((a, b) =>
      (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
    );
  
    // Helper para formatear el número
    const fmt = (t) => {
      const cc = t?.codigo ? `${t.codigo} ` : "";
      return `${cc}${t?.numero || ""}`.trim();
    };
  
    return (
      <div className="card mb-2">
        <div className="card-body">
          <div className="d-flex align-items-start justify-content-between flex-wrap">
            <h6 className="fw-semibold mb-2">{nombre}</h6>
            {relacion && relacion !== "—" && (
              <span className="badge bg-light text-dark">{relacion}</span>
            )}
          </div>
  
          <div className="mt-2 small">
            <div className="mb-1"><strong>Idioma:</strong> {idioma}</div>
  
            {/* --- Teléfonos (lista) --- */}
            <div className="mb-1">
              <strong>Teléfonos:</strong>
              {telsOrdenados.length === 0 ? (
                <span className="ms-1">—</span>
              ) : (
                <ul className="list-unstyled ms-2 mb-0 mt-1">
                  {telsOrdenados.map((t, idx) => (
                    <li key={idx} className="d-flex align-items-center gap-2 mb-1">
                      <span>{fmt(t)}</span>
  
                      {/* Tipo: Movil/Trabajo/Casa/... */}
                      {t?.tipo && (
                        <span className="badge bg-secondary-subtle text-secondary-emphasis">
                          {t.tipo}
                        </span>
                      )}
  
                      {/* Principal */}
                      {t?.principal && (
                        <span className="badge bg-success-subtle text-success-emphasis">
                          Principal
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
  
            <div className="mb-1"><strong>Pertenece GF:</strong> {pertenece}</div>
            <hr className="my-2" />
            <div><strong>Nota:</strong> {nota}</div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={className}>
      {/* Título + contador */}
      <div className="d-flex align-items-center mb-2">
        <h6 className="mb-0">
          <i className="bi bi-people-fill me-2" /> Contactos Asociados
        </h6>
        <span className="badge bg-secondary ms-2">{items.length}</span>
      </div>

      {/* Acordeón: Crear / Editar */}
      <div className="accordion mb-3" id="accordionContactos">
        <div className="accordion-item">
          <h2 className="accordion-header" id="headingNuevo">
            <button
              className="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapseNuevo"
              aria-expanded="false"
              aria-controls="collapseNuevo"
            >
              {linkEditar ? "Editar contacto" : "Agregar contacto"}
            </button>
          </h2>
          <div
            id="collapseNuevo"
            className="accordion-collapse collapse"
            aria-labelledby="headingNuevo"
            data-bs-parent="#accordionContactos"
          >
            <div className="accordion-body">
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label small mb-1">Nombre Completo</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Nombre Completo"
                    value={form.nombre_completo}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const formatted = raw
                        .toLowerCase()
                        .replace(/\b\w/g, (ch) => ch.toUpperCase())
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

                <div className="col-12 col-md-6">
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

                <div className="col-12 col-md-6">
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

                <div className="col-12 col-md-6">
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
                  <div className="col-12 d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={() => { setLinkEditar(null); resetForm(); }}
                      disabled={saving}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSave}
                      disabled={!puedeGuardar || saving}
                    >
                      {saving ? "Guardando..." : (linkEditar ? "Actualizar" : "Guardar contacto")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de tarjetas */}
      {loading && <div className="text-muted small">Cargando contactos…</div>}

      {items.map(({ contacto, link }) => (
        <ContactoCard key={`${link?.id || contacto?.id || Math.random()}`} contacto={contacto} link={link} />
      ))}

      {!loading && items.length === 0 && (
        <div className="text-muted small">Sin contactos asociados aún.</div>
      )}
    </div>
  );
}
