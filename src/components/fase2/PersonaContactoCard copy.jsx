// ContactosAsociadosAccordion.jsx
import React, { useEffect, useMemo, useState } from "react";
import TelefonosInput from "./TelefonosInput";
import {
  fetchClienteContacto,
  upsertContacto,
  linkClienteContacto,
  updateLinkClienteContacto,
} from "../../services/contactosService";
import "../../styles/ContactosAsociadosAccordion.css";

import { joinNameParts } from "../../utils/names";

export default function ContactosAsociadosAccordion({
  clienteId = null,
  grupoFamiliarId = null,
  className = "",
  idiomaOptions = ["Spanish", "English"],
  relacionOptions = ["Cónyuge", "Hijo/a", "Padre", "Madre", "Sobrino", "Tio/a", "Hermano/a", "Amigo/a", "Otro"],
  readOnly = false,
}) {
  // ---------- Styles in-component (self-contained) ----------
  const styles = `
    .caa-card { border: 1px solid rgba(0,0,0,.06); }
    .caa-card:hover { border-color: rgba(0,0,0,.12); }
    .caa-shadow { box-shadow: 0 6px 18px rgba(16,24,40,.06); }
    .caa-avatar { width:44px; height:44px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center;
      background: radial-gradient(120% 120% at 30% 20%, #dbeafe 0%, #eff6ff 40%, #ffffff 100%); border:1px solid rgba(0,0,0,.06); }
    .caa-avatar span { font-weight:700; font-size:.9rem; color:#1d4ed8; letter-spacing:.5px; }
    .caa-mono { font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; }
    .caa-pill-green { background:#d1fae5; color:#065f46; }
    .caa-pill-mint  { background:#e6fffb; color:#075985; }
    .caa-pill-gray  { background:#e5e7eb; color:#374151; }
    .caa-pill-blue  { background:#e0f2fe; color:#075985; }
    .caa-pill-wa    { background:#e7f8ed; color:#0a6c3a; }
    .caa-note { background:#f6f7f9; }
    .caa-copy { background:transparent; border:1px solid rgba(0,0,0,.06); border-radius:10px; padding:4px 10px; line-height:1.2;
      display:inline-flex; align-items:center; gap:.25rem; transition:background .15s ease,border-color .15s ease,transform .05s ease-in-out; }
    .caa-copy:hover{ background:#f8fafc; border-color:rgba(0,0,0,.12); }
    .caa-copy:active{ transform:scale(.98); }
    .accordion-item.caa-acc { border:0; border-radius:14px; overflow:hidden; }
    .accordion-button.caa-acc-btn { font-weight:600; }
    .accordion-button.caa-acc-btn .caa-sub { opacity:.9; font-weight:400; }
    .badge.caa-count { background:#dbeafe; color:#1d4ed8; }
  `;

  // ---------- State ----------
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // [{contacto, link}]
  const [linkEditar, setLinkEditar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre_completo: "",
    idioma: "",
    perteneceGF: "No",
    relacion: "",
    nota: "",
    telefonos: [],
    email_principal: "",
  });

  // ---------- Helpers ----------
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

  // ---------- Save / Update ----------
  const handleSave = async () => {
    if (readOnly || !puedeGuardar) return;
    try {
      setSaving(true);

      // 1) upsert contacto
      const contactoRes = await upsertContacto({
        nombre_completo: (form.nombre_completo || "").trim(),
        idioma: form.idioma || "",
        telefonos: Array.isArray(form.telefonos) ? form.telefonos : [],
        email_principal: form.email_principal || null,
      });
      const contacto = contactoRes?.contacto || contactoRes || {};
      const contactoId = contacto.id;

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
          prev.map((it) => (it.link.id === linkEditar.id ? { contacto, link: linkFinal } : it))
        );
      } else {
        setItems((prev) => [{ contacto, link: linkFinal }, ...prev]);
      }

      setLinkEditar(null);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el contacto.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- UI helpers ----------
  const getInitials = (name = "") =>
    name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");

  const BADGE_BY_TIPO = {
    Movil: "caa-pill-mint",
    Móvil: "caa-pill-mint",
    WhatsApp: "caa-pill-wa",
    Trabajo: "caa-pill-gray",
    Casa: "caa-pill-blue",
  };
  const telBadgeClass = (tipo) => BADGE_BY_TIPO[tipo] || "caa-pill-gray";

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const ContactoCard = ({ contacto = {}, link = {} }) => {
    const nombre =
      contacto?.nombre_completo ||
      joinNameParts(contacto?.nombres || "", contacto?.apellidos || "");
    const idioma = contacto?.idioma || "—";
    const telefonos = Array.isArray(contacto?.telefonos) ? contacto.telefonos : [];
    const relacion = link?.relacion || "—";
    const pertenece = link?.pertenece_al_grupo ? "Sí" : "No";
    const nota = link?.nota || "—";

    const telsOrdenados = [...telefonos].sort(
      (a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
    );
    const fmt = (t) => `${t?.codigo ? t.codigo + " " : ""}${t?.numero || ""}`.trim();

    return (
      <div className="card caa-card caa-shadow mb-3 border-0 rounded-4">
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-3">
            {/* Avatar */}
            <div className="caa-avatar"><span>{getInitials(nombre)}</span></div>

            <div className="flex-fill">
              <div className="d-flex align-items-start justify-content-between">
                <h6 className="fw-semibold mb-1">{nombre}</h6>
                {relacion && relacion !== "—" && (
                  <span className="badge rounded-pill bg-light text-dark border">{relacion}</span>
                )}
              </div>

              {/* Grid atributos */}
              <div className="row g-2 mt-1 small">
                <div className="col-12 col-md-6">
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <i className="bi bi-translate" aria-hidden="true"></i>
                    <span className="fw-semibold text-dark">Idioma:</span>
                    <span>{idioma}</span>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <i className="bi bi-people" aria-hidden="true"></i>
                    <span className="fw-semibold text-dark">Pertenece GF:</span>
                    <span>{pertenece}</span>
                  </div>
                </div>

                {/* Teléfonos */}
                <div className="col-12">
                  <div className="d-flex align-items-start gap-2 text-muted">
                    <i className="bi bi-telephone" aria-hidden="true"></i>
                    <div className="flex-fill">
                      <span className="fw-semibold text-dark me-1">Teléfonos:</span>
                      {telsOrdenados.length === 0 ? (
                        <span>—</span>
                      ) : (
                        <ul className="list-unstyled mb-0 mt-1">
                          {telsOrdenados.map((t, idx) => {
                            const numeroPlano = fmt(t);
                            return (
                              <li key={idx} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                <button
                                  type="button"
                                  className="caa-copy"
                                  title="Copiar número"
                                  aria-label={`Copiar ${numeroPlano}`}
                                  onClick={() => copyToClipboard(numeroPlano)}
                                >
                                  <span className="caa-mono">{numeroPlano}</span>
                                  <i className="bi bi-clipboard2-check ms-1" aria-hidden="true"></i>
                                </button>

                                {t?.tipo && (
                                  <span className={`badge rounded-pill ${telBadgeClass(t.tipo)}`}>
                                    {t.tipo}
                                  </span>
                                )}

                                {t?.principal && (
                                  <span className="badge rounded-pill caa-pill-green">Principal</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nota */}
                <div className="col-12">
                  <div className="caa-note rounded-3 p-2">
                    <div className="small text-muted mb-1">Nota</div>
                    <div className="small">{nota}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Render ----------
  return (
    <div className={className}>
      <style>{styles}</style>

      {/* Encabezado */}
      <div className="d-flex align-items-center mb-2">
        <h6 className="mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-people-fill text-primary" aria-hidden="true"></i>
          Contactos Asociados
        </h6>
        <span className="badge rounded-pill caa-count ms-2">{items.length}</span>
      </div>

      {/* Acordeón Crear/Editar */}
      <div className="accordion mb-3" id="accordionContactos">
        <div className="accordion-item caa-acc caa-shadow">
          <h2 className="accordion-header" id="headingNuevo">
            <button
              className="accordion-button collapsed caa-acc-btn"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapseNuevo"
              aria-expanded="false"
              aria-controls="collapseNuevo"
            >
              {linkEditar ? "Editar contacto" : "Agregar contacto"}
              <span className="ms-2 small text-muted caa-sub">
                {linkEditar ? "Actualiza los datos del contacto seleccionado" : "Crea un nuevo contacto asociado"}
              </span>
            </button>
          </h2>
          <div
            id="collapseNuevo"
            className="accordion-collapse collapse"
            aria-labelledby="headingNuevo"
            data-bs-parent="#accordionContactos"
          >
            <div className="accordion-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
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

                <div className="col-12 col-md-6">
                  <label className="form-label small mb-1">Correo</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="correo@dominio.com"
                    value={form.email_principal}
                    onChange={(e) => update("email_principal", e.target.value)}
                    disabled={readOnly}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label small mb-1">Teléfonos</label>
                  <TelefonosInput
                    value={form.telefonos}
                    onChange={(v) => update("telefonos", v)}
                    readOnly={readOnly}
                  />
                  <div className="form-text">
                    Marca un número como <b>Principal</b> y asigna el <b>Tipo</b> (Móvil/Trabajo/Casa/WhatsApp).
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small mb-1">Idioma</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.idioma}
                    onChange={(e) => update("idioma", e.target.value)}
                    disabled={readOnly}
                  >
                    <option value="">Seleccione…</option>
                    {idiomaOptions.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
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

                <div className="col-12 col-md-4">
                  <label className="form-label small mb-1">Relación</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.relacion}
                    onChange={(e) => update("relacion", e.target.value)}
                    disabled={readOnly}
                  >
                    <option value="">Seleccione…</option>
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
                    placeholder="Observaciones"
                    value={form.nota}
                    onChange={(e) => update("nota", e.target.value)}
                    disabled={readOnly}
                  />
                </div>

                {!readOnly && (
                  <div className="col-12 d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
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
                      {saving ? "Guardando…" : (linkEditar ? "Actualizar" : "Guardar contacto")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
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
