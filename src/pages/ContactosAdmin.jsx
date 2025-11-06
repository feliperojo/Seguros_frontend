// src/pages/ContactosAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import apiRequest from "../services/api";

// === utilidades ===

// Capitaliza cada palabra
const toTitle = (s = "") =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());

// Separa primer y segundo nombre
const splitNames = (n = "") => {
  const parts = (n || "").trim().split(/\s+/);
  const primer_nombre = parts[0] || null;
  const segundo_nombre = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { primer_nombre, segundo_nombre };
};

// === subcomponente: fila teléfono ===
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
          onChange={(e) =>
            onChange({ ...value, principal: !!e.target.checked })
          }
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

// === componente principal ===
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

  // ====== vínculos del cliente ======
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // ====== buscar clientes ======
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setRows([]); setLoadingList(false); return; }
      setLoadingList(true);
      try {
        // ✅ Buscar clientes
        const res = await apiRequest(
          `/cliente/buscar?nombre=${encodeURIComponent(term)}`,
          "GET"
        );
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
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

  // ====== cargar cliente seleccionado ======
  const loadContact = async (id) => {
    if (!id) return;

    // 1️⃣ Detalle del cliente
    try {
      const detail = await apiRequest(`/cliente/${id}`, "GET");
      const c = detail?.data || detail || {};

      let telefonos = [];
      if (Array.isArray(c.telefonos)) {
        telefonos = c.telefonos;
      } else if (
        typeof c.telefonos === "string" &&
        c.telefonos.trim().startsWith("[")
      ) {
        try {
          telefonos = JSON.parse(c.telefonos);
        } catch (_) {}
      }

      setModel({
        id: c.id,
        nombres: [c.primer_nombre, c.segundo_nombre]
          .filter(Boolean)
          .join(" ") || "",
        apellidos: c.apellidos || "",
        nombre_completo: c.nombre_completo || "",
        idioma: c.idioma || "",
        email_principal: c.email || "",
        telefonos,
        nota: c.nota || "",
      });
    } catch (e) {
      console.error("Error cargando cliente:", e);
      setModel(empty);
      setLinks([]);
      return;
    }

    // 2️⃣ vínculos cliente_contacto
    try {
      setLoadingLinks(true);
      const v = await apiRequest(`/cliente-contacto?contacto_id=${id}`, "GET");
      const links = Array.isArray(v?.data?.data)
        ? v.data.data
        : Array.isArray(v?.data)
        ? v.data
        : Array.isArray(v)
        ? v
        : [];
      setLinks(links);
    } catch (e) {
      console.error("Error cargando vínculos:", e);
      setLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  };

  // ====== handlers de campos ======
  const setField = (k, v) => {
    if (k === "nombres" || k === "apellidos" || k === "nombre_completo")
      v = toTitle(v);
    setModel((m) => {
      const next = { ...m, [k]: v };
      if (k === "nombres" || k === "apellidos") {
        next.nombre_completo = toTitle(
          [next.nombres, next.apellidos].filter(Boolean).join(" ")
        );
      }
      return next;
    });
  };

  // ====== manejo de teléfonos ======
  const addPhone = () =>
    setModel((m) => ({
      ...m,
      telefonos: [...(m.telefonos || []), { tipo: "", numero: "", principal: false }],
    }));

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

  // ====== guardar cambios ======
  const save = async () => {
    if (!model.id) return;
    setSaving(true);
    try {
      const { primer_nombre, segundo_nombre } = splitNames(model.nombres || "");

      const payload = {
        primer_nombre,
        segundo_nombre,
        apellidos: model.apellidos?.trim() || null,
        nombre_completo: model.nombre_completo?.trim() || null,
        idioma: model.idioma || null,
        email: model.email_principal || null,
        telefonos: model.telefonos || [],
        nota: model.nota || null,
        telefono:
          Array.isArray(model.telefonos) && model.telefonos[0]?.numero
            ? model.telefonos[0].numero
            : null,
        estado_cliente: "Cliente",
      };

      await apiRequest(`/cliente/${model.id}`, "PUT", payload);

      // refrescar listado
      setRows((prev) =>
        prev.map((r) =>
          r.id === model.id
            ? {
                ...r,
                nombre_completo: payload.nombre_completo ?? r.nombre_completo,
                idioma: payload.idioma ?? r.idioma,
                telefono: payload.telefono ?? r.telefono,
              }
            : r
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setModel(empty);
    setLinks([]);
  };

  const canSave = useMemo(() => !!model.id, [model.id]);

  // ====== render ======
  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        {/* === Columna izquierda === */}
        <div className="col-lg-5">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-3">Directorio de Clientes</h5>

              <div className="mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Buscar por nombre…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: 420, overflow: "auto" }}
              >
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
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
                          r.telefono ||
                          (Array.isArray(r.telefonos) && r.telefonos[0]?.numero) ||
                          "—";
                        return (
                          <tr key={r.id}>
                            <td className="fw-semibold">
                              {r.nombre_completo}
                            </td>
                            <td>{r.estado_cliente || "—"}</td>
                            <td>{firstPhone}</td>
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

        {/* === Columna derecha === */}
        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Editar Cliente</h5>
                <div className="btn-group">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={resetForm}
                  >
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
                    onChange={(e) =>
                      setField("nombre_completo", e.target.value)
                    }
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
                    <button
                      className="btn btn-outline-success btn-sm"
                      onClick={addPhone}
                    >
                      + Agregar Teléfono
                    </button>
                  </div>
                  {(model.telefonos || []).length === 0 && (
                    <div className="text-muted small mb-2">
                      Sin teléfonos.
                    </div>
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

          {/* vínculos */}
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
                        <tr
                          key={`${v.id}-${v.contacto_id}-${v.grupo_familiar_id}-${v.cliente_id}`}
                        >
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
                * Solo lectura aquí. La asociación se gestiona en la ficha del
                cliente/grupo.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
