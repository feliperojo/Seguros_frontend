// src/pages/ContactosAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import apiRequest from "../services/api";

// ⬇️ componentes ya existentes en tu proyecto
import LanguageSelect from "../components/selects/LanguageSelect";
import TelefonosPro from "../components/fase2/TelefonosPro";

// Rutas base de navegación (ajústalas a tu router real)
// ⬇️ ya lo tienes
const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;

// ⬇️ nuevo
const GRUPO_FICHA_PATH = (id) => `/grupo_familiar/${id}`;

export const renderClienteLink = (clienteId, label = null) => {
  if (!clienteId) return "—";
  return (
    <Link
      to={CLIENTE_FICHA_PATH(clienteId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none"
      title="Abrir ficha del cliente en una nueva pestaña"
      onClick={(e) => e.stopPropagation()}
    >
      {label ?? clienteId}
    </Link>
  );
};

// ⬇️ nuevo: link al grupo
export const renderGrupoLink = (grupoId, label = null) => {
  if (!grupoId) return "—";
  return (
    <Link
      to={GRUPO_FICHA_PATH(grupoId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none"
      title={`Abrir grupo #${grupoId} en una nueva pestaña`}
      onClick={(e) => e.stopPropagation()}
    >
      {label ?? `#${grupoId}`}
    </Link>
  );
};


/* ================= utilidades ================= */

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

/* ================ componente principal ================= */

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
      if (term.length < 2) {
        setRows([]);
        setLoadingList(false);
        return;
      }
      setLoadingList(true);
      try {
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
      } else if (typeof c.telefonos === "string" && c.telefonos.trim().startsWith("[")) {
        try {
          telefonos = JSON.parse(c.telefonos);
        } catch (_) {}
      }

      // ✅ normalización para TelefonosPro
      telefonos = (telefonos || [])
        .filter((t) => (t?.numero || "").trim().length > 0)
        .map((t, i) => ({
          id: t?.id ?? `${i}-${t?.tipo ?? "Móvil"}`,
          tipo: t?.tipo || "Móvil",
          numero: t?.numero || "",
          principal: !!t?.principal || i === 0,
          iso: (t?.iso || "").toLowerCase() || undefined,
          indicativo: t?.indicativo || "",
        }));

      setModel({
        id: c.id,
        nombres: [c.primer_nombre, c.segundo_nombre].filter(Boolean).join(" ") || "",
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
    if (k === "nombres" || k === "apellidos" || k === "nombre_completo") v = toTitle(v);
    setModel((m) => {
      const next = { ...m, [k]: v };
      if (k === "nombres" || k === "apellidos") {
        next.nombre_completo = toTitle([next.nombres, next.apellidos].filter(Boolean).join(" "));
      }
      return next;
    });
  };

  // ====== guardar cambios ======
  const save = async () => {
    if (!model.id) return;
    setSaving(true);
    try {
      const { primer_nombre, segundo_nombre } = splitNames(model.nombres || "");
      const principal = Array.isArray(model.telefonos)
        ? model.telefonos.find((x) => x.principal)
        : null;

      const payload = {
        primer_nombre,
        segundo_nombre,
        apellidos: model.apellidos?.trim() || null,
        nombre_completo: model.nombre_completo?.trim() || null,
        idioma: model.idioma || null,
        email: model.email_principal || null,
        telefonos: model.telefonos || [],
        nota: model.nota || null,
        telefono: principal?.numero ?? null, // ← compat: teléfono plano (principal)
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

  /* ===================== render ===================== */

  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        {/* === Columna izquierda: listado === */}
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

              <div className="table-responsive" style={{ maxHeight: 420, overflow: "auto" }}>
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
                            <td className="fw-semibold">{r.nombre_completo}</td>
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

        {/* === Columna derecha: edición === */}
        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Editar Cliente</h5>
                <div className="btn-group">
                  <button className="btn btn-outline-secondary btn-sm" onClick={resetForm}>
                    Nuevo / Limpiar
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={save} disabled={!canSave || saving}>
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
                  <LanguageSelect
                    name="idioma"
                    value={model.idioma || ""}
                    onChange={(e) => setField("idioma", e.target.value)}
                    includeEmpty
                    includeOther
                    getValue={(l) => l.name}   // o (l) => l.code si prefieres guardar el code
                    getLabel={(l) => l.name}
                    className="form-select form-select-sm"
                    placeholder="Seleccione"
                  />
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
                  <label className="form-label small mb-1">Teléfonos</label>
                  <TelefonosPro
                    value={model.telefonos}
                    onChange={(list) => setField("telefonos", list)}
                    readOnly={false}
                    uiPreset="clean"
                    countrySelectWidth={200}
                    formatByCountry
                  />
                  {(!model.telefonos || model.telefonos.length === 0) && (
                    <div className="text-muted small mt-1">Sin teléfonos.</div>
                  )}
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
  {links.map((v) => {
    const gfId = v.grupo_familiar_id;
    const clienteId = v.cliente_id;
    const clienteNombre =
      v.cliente?.nombre_completo?.trim?.() ||
      v.cliente_nombre ||
      "—";

    return (
      <tr
        key={`${v.id}-${v.contacto_id}-${v.grupo_familiar_id}-${v.cliente_id}`}
      >
        {/* 🔗 ID del Grupo Familiar */}
        <td>
          {gfId ? (
            <a
              href={`/grupo_familiar/${gfId}`}
              className="text-decoration-none link-primary fw-semibold"
              target="_blank"
              rel="noreferrer"
              title={`Abrir ficha del grupo familiar #${gfId}`}
              onClick={(e) => e.stopPropagation()}
            >
              {gfId}
            </a>
          ) : (
            "—"
          )}
        </td>

        {/* 🔗 Nombre del Cliente */}
        <td>
          {clienteId ? (
            <a
              href={`/clientes/${clienteId}/ficha`}
              className="text-decoration-none link-primary fw-semibold"
              target="_blank"
              rel="noreferrer"
              title={`Abrir ficha del cliente ${clienteNombre}`}
              onClick={(e) => e.stopPropagation()}
            >
              {clienteNombre}
            </a>
          ) : (
            clienteNombre
          )}
        </td>

        {/* Resto de columnas */}
        <td>{v.relacion || "—"}</td>
        <td>{v.pertenece_al_grupo ? "Sí" : "No"}</td>
        <td>{v.nota || "—"}</td>
      </tr>
    );
  })}
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
