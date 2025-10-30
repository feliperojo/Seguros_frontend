// src/pages/ContactosAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import apiRequest from "../services/api";

// util: capitaliza cada palabra
const toTitle = (s = "") =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());

// subcomponente: fila teléfono
function PhoneRow({ value, onChange, onRemove }) {
  const tipos = ["Móvil", "Trabajo", "WhatsApp", "Casa", "Otro"];
  return (
    <div className="d-flex gap-2 align-items-center mb-2">
      <select
        className="form-select form-select-sm"
        style={{ maxWidth: 160 }}
        value={value.tipo || ""}
        onChange={(e) => onChange({ ...value, tipo: e.target.value })}
      >
        <option value="">Tipo…</option>
        {tipos.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <input
        className="form-control form-control-sm"
        placeholder="Número"
        value={value.numero || ""}
        onChange={(e) => onChange({ ...value, numero: e.target.value })}
      />

      <div className="form-check ms-1">
        <input
          className="form-check-input"
          type="checkbox"
          checked={!!value.principal}
          onChange={(e) => onChange({ ...value, principal: !!e.target.checked })}
          id={`chk-${value.id || Math.random()}`}
        />
        <label className="form-check-label small">Principal</label>
      </div>

      <button
        type="button"
        className="btn btn-outline-danger btn-sm"
        onClick={onRemove}
        title="Quitar teléfono"
      >
        <i className="fas fa-trash" />
      </button>
    </div>
  );
}

export default function ContactosAdmin() {
  // ====== búsqueda/listado ======
  const [q, setQ] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [rows, setRows] = useState([]);
  const debRef = useRef(null);

  // ====== edición ======
  const empty = {
    id: null,
    nombres: "",
    apellidos: "",
    nombre_completo: "",
    idioma: "",
    telefonos: [],
    email_principal: "",
    nota: "",
  };
  const [model, setModel] = useState(empty);
  const [saving, setSaving] = useState(false);

  // ====== vínculos del contacto ======
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // buscar con debounce
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      const term = q.trim();
      setLoadingList(true);
      try {
// GET /contactos?s=...  (Laravel pagina: { data, links, meta })
      const res = await apiRequest(
            `/contactos?s=${encodeURIComponent(term)}&per_page=20`,
            "GET"
          );
          const list = Array.isArray(res?.data?.data)
            ? res.data.data                          // cuando apiRequest no unwrapea
            : Array.isArray(res?.data)
              ? res.data                              // si ya unwrapea .data
              : Array.isArray(res) ? res : [];
          setRows(list);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoadingList(false);
      }
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [q]);
  

  // cargar un contacto al seleccionar
 // cargar un contacto al seleccionar
const loadContact = async (id) => {
    if (!id) return;
  
   // 1) Detalle del contacto
   try {
     const detail = await apiRequest(`/contactos/${id}`, "GET");
     const c = detail?.data || detail || {};
     const telefonos = Array.isArray(c.telefonos) ? c.telefonos : [];
     setModel({
       id: c.id,
       nombres: c.nombres || "",
       apellidos: c.apellidos || "",
       nombre_completo: c.nombre_completo || "",
       idioma: c.idioma || "",
       email_principal: c.email_principal || "",
       telefonos,
       nota: c.nota || "",
     });
   } catch (e) {
     console.error("Error cargando contacto:", e);
     setModel(empty);
     setLinks([]);
     return; // no sigas si el contacto no cargó
   }
  
   try {
     const v = await apiRequest(`/cliente-contacto?contacto_id=${id}`, "GET");
     const links = Array.isArray(v?.data?.data)
       ? v.data.data
       : Array.isArray(v?.data)
         ? v.data
         : Array.isArray(v) ? v : [];
     setLinks(links);
   } catch (e) {
     console.error("Error cargando vínculos:", e);
     setLinks([]);
   } finally {
     setLoadingLinks(false);
   }
  };
  
  // handler: campos texto con capitalización
  const setField = (k, v) => {
    if (k === "nombres" || k === "apellidos") v = toTitle(v);
    if (k === "nombre_completo") v = toTitle(v);
    setModel((m) => {
      const next = { ...m, [k]: v };
      // si editan nombres/apellidos, refresca nombre_completo
      if (k === "nombres" || k === "apellidos") {
        next.nombre_completo = toTitle(
          [next.nombres, next.apellidos].filter(Boolean).join(" ")
        );
      }
      return next;
    });
  };

  // teléfonos
  const addPhone = () =>
    setModel((m) => ({ ...m, telefonos: [...(m.telefonos || []), { tipo: "", numero: "", principal: false }] }));
  const updatePhone = (idx, val) =>
    setModel((m) => {
      const arr = [...(m.telefonos || [])];
      arr[idx] = val;
      return { ...m, telefonos: arr };
    });
  const removePhone = (idx) =>
    setModel((m) => {
      const arr = [...(m.telefonos || [])];
      arr.splice(idx, 1);
      return { ...m, telefonos: arr };
    });

  // guardar (PUT)
  const save = async () => {
    if (!model.id) return;
    setSaving(true);
    try {
      const payload = {
        nombres: model.nombres?.trim() || null,
        apellidos: model.apellidos?.trim() || null,
        nombre_completo: model.nombre_completo?.trim() || null,
        idioma: model.idioma || null,
        email_principal: model.email_principal || null,
        telefonos: model.telefonos || [],
        nota: model.nota || null,
      };
      await apiRequest(`/contactos/${model.id}`, "PUT", payload);
      // refresca fila en tabla
      setRows((prev) =>
        prev.map((r) =>
          r.id === model.id ? { ...r, nombre_completo: model.nombre_completo, idioma: model.idioma } : r
        )
      );
    } catch (e) {
      console.error(e);
      // aquí podrías mostrar un toast
    } finally {
      setSaving(false);
    }
  };

  // limpiar/crear nuevo (si quisieras ampliar a creación)
  const resetForm = () => {
    setModel(empty);
    setLinks([]);
  };

  const canSave = useMemo(() => !!model.id, [model.id]);

  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        {/* ==== Columna izquierda: buscador + directorio ==== */}
        <div className="col-lg-5">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-3">Directorio de Contactos</h5>

              <div className="mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Buscar por nombre…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="table-responsive" style={{ maxHeight: 420, overflow: "auto" }}>
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Nombre</th>
                      <th>Idioma</th>
                      <th>Teléfono</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          Cargando…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const firstPhone =
                          Array.isArray(r.telefonos) && r.telefonos.length > 0
                            ? r.telefonos[0]?.numero
                            : r.telefono_principal_normalizado || "—";
                        return (
                          <tr key={r.id}>
                            <td className="fw-semibold">{r.nombre_completo}</td>
                            <td>{r.idioma || "—"}</td>
                            <td>{firstPhone || "—"}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => loadContact(r.id)}
                              >
                                Abrir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ==== Columna derecha: edición + vínculos ==== */}
        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Editar Contacto</h5>
                <div className="btn-group">
                  <button className="btn btn-outline-secondary btn-sm" onClick={resetForm}>
                    Nuevo / Limpiar
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={save}
                    disabled={!canSave || saving}
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small">Nombres</label>
                  <input
                    className="form-control form-control-sm"
                    value={model.nombres}
                    onChange={(e) => setField("nombres", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Apellidos</label>
                  <input
                    className="form-control form-control-sm"
                    value={model.apellidos}
                    onChange={(e) => setField("apellidos", e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small">Nombre Completo</label>
                  <input
                    className="form-control form-control-sm"
                    value={model.nombre_completo}
                    onChange={(e) => setField("nombre_completo", e.target.value)}
                  />
                </div>

               

                <div className="col-md-4">
                  <label className="form-label small">Idioma</label>
                  <select
                    className="form-select form-select-sm"
                    value={model.idioma || ""}
                    onChange={(e) => setField("idioma", e.target.value)}
                  >
                    <option value="">Seleccione…</option>
                    <option>Spanish</option>
                    <option>English</option>
                  </select>
                </div>

                <div className="col-md-8">
                  <label className="form-label small">Nota</label>
                  <input
                    className="form-control form-control-sm"
                    value={model.nota || ""}
                    onChange={(e) => setField("nota", e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label small mb-1">Teléfonos</label>
                    <button className="btn btn-outline-success btn-sm" onClick={addPhone}>
                      + Agregar Teléfono
                    </button>
                  </div>
                  {(model.telefonos || []).length === 0 && (
                    <div className="text-muted small mb-2">Sin teléfonos.</div>
                  )}
                  {(model.telefonos || []).map((p, idx) => (
                    <PhoneRow
                      key={idx}
                      value={p}
                      onChange={(val) => updatePhone(idx, val)}
                      onRemove={() => removePhone(idx)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6 className="mb-2">Grupos familiares asociados</h6>
              {loadingLinks ? (
                <div className="text-muted">Cargando…</div>
              ) : links.length === 0 ? (
                <div className="text-muted">Sin vínculos.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>ID GF</th>
                        <th>Cliente</th>
                        <th>Relación</th>
                        <th>¿Pertenece GF?</th>
                        <th>Nota</th>
                        
                      </tr>
                    </thead>
                    <tbody>
                      {links.map((v) => (
                        <tr key={`${v.id}-${v.contacto_id}-${v.grupo_familiar_id}-${v.cliente_id}`}>
                          <td>{v.grupo_familiar_id || "—"}</td>
                          <td>
                            {v.cliente?.nombre_completo
                              ? v.cliente.nombre_completo
                              : v.cliente_nombre || "—"}
                          </td>
                          <td>{v.relacion || "—"}</td>
                          <td>{v.pertenece_al_grupo ? "Sí" : "No"}</td>
                          <td>{v.nota || "—"}</td>
                        
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="form-text">
                * Solo lectura aquí. La asociación se gestiona en la ficha del cliente/grupo.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
