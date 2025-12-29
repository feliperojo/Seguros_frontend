// src/pages/ContactosAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiRequest from "../services/api";
import { formatPhone334 } from "../utils/formatters";
import useToast from "../hooks/useToast";

// ⬇️ componentes ya existentes en tu proyecto
import LanguageSelect from "../components/selects/LanguageSelect";
import TelefonosPro from "../components/fase2/TelefonosPro";
import FormDireccion from "../components/FormDireccion";

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

// ===== helper para normalizar telefonos desde la base de datos =====
const normalizarTelefonos = (telefonos) => {
  if (Array.isArray(telefonos)) {
    return telefonos;
  }
  if (typeof telefonos === "string" && telefonos.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(telefonos);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

// ===== helper para formatear teléfono completo (indicativo + número) =====
const formatearTelefonoCompleto = (cliente) => {
  // Normalizar telefonos: puede venir como array, string JSON, o null
  const telefonos = normalizarTelefonos(cliente?.telefonos);
  
  // Priorizar array de telefonos si existe
  if (telefonos.length > 0) {
    const tel = telefonos[0];
    const indicativo = tel?.indicativo ? `+${tel.indicativo} ` : "";
    const numeroFormateado = formatPhone334(tel?.numero || "");
    return `${indicativo}${numeroFormateado}`.trim() || "—";
  }
  // Fallback al campo legacy
  if (cliente?.telefono) {
    return formatPhone334(cliente.telefono);
  }
  return "—";
};

/* ================ componente principal ================= */

export default function ContactosAdmin() {
  const toast = useToast();
  // ====== búsqueda/listado ======
  const [q, setQ] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [rows, setRows] = useState([]);
  const debRef = useRef(null);

  // ====== edición ======
  const empty = {
    id: null,
    tipo_contacto: "persona", // "persona" o "empresa"
    nombres: "",
    apellidos: "",
    nombre_completo: "",
    idioma: "",
    telefonos: [],
    email_principal: "",
    nota: "",
    estado_cliente: null,
    direccion: {
      calle: "",
      apto: "",
      ciudad: "",
      estado: "",
      codigo_postal: "",
      condado: "",
      dir_correspondencia: "",
      copi_dir: false,
    },
  };
  const [model, setModel] = useState(empty);
  const [saving, setSaving] = useState(false);

  // ====== vínculos del cliente ======
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // ====== estados para mostrar/ocultar secciones ======
  const [showTelefonos, setShowTelefonos] = useState(false);
  const [showDireccion, setShowDireccion] = useState(false);

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
        console.log("=== DATOS DE BÚSQUEDA DE CLIENTES ===");
        console.log("Respuesta completa de la API:", res);
        console.log("res.data:", res?.data);
        console.log("res (directo):", res);
        
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        console.log("Lista procesada que se guarda en rows:", list);
        console.log("Primer elemento de la lista (ejemplo):", list[0]);
        if (list[0]) {
          console.log("Campos disponibles en el primer elemento:", Object.keys(list[0]));
          console.log("estado_cliente del primer elemento:", list[0].estado_cliente);
          console.log("telefonos del primer elemento:", list[0].telefonos);
          console.log("telefono (legacy) del primer elemento:", list[0].telefono);
        }
        console.log("====================================");
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
      console.log("=== DATOS AL CARGAR CONTACTO INDIVIDUAL ===");
      console.log("Respuesta completa de la API:", detail);
      console.log("detail.data:", detail?.data);
      console.log("detail (directo):", detail);
      
      const c = detail?.data || detail || {};
      console.log("Cliente procesado (c):", c);
      console.log("Campos disponibles:", Object.keys(c));
      console.log("estado_cliente:", c.estado_cliente);
      console.log("telefonos:", c.telefonos);
      console.log("telefono (legacy):", c.telefono);
      console.log("==========================================");

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

      // Determinar tipo de contacto basado en estado_cliente
      // Si estado_cliente es "empresa", es una empresa
      // Si estado_cliente es "contacto" o no tiene primer_nombre/apellidos pero sí nombre_completo, es persona contacto
      const estadoClienteLower = (c.estado_cliente || "").toLowerCase();
      const esEmpresa = estadoClienteLower === "empresa" || 
        (!c.primer_nombre && !c.apellidos && c.nombre_completo);
      
      const tipoContacto = esEmpresa ? "empresa" : "persona";

      setModel({
        id: c.id,
        tipo_contacto: tipoContacto,
        nombres: [c.primer_nombre, c.segundo_nombre].filter(Boolean).join(" ") || "",
        apellidos: c.apellidos || "",
        nombre_completo: c.nombre_completo || "",
        idioma: c.idioma || "",
        email_principal: c.email || "",
        telefonos,
        nota: c.nota || "",
        estado_cliente: c.estado_cliente || null,
        direccion: {
          calle: c.calle || "",
          apto: c.apto || "",
          ciudad: c.ciudad || "",
          estado: c.estado || "",
          codigo_postal: c.codigo_postal || "",
          condado: c.condado || "",
          dir_correspondencia: c.dir_correspondencia || "",
          copi_dir: false,
        },
      });

      // Mostrar automáticamente las secciones si hay datos
      if (telefonos && telefonos.length > 0) {
        setShowTelefonos(true);
      }
      if (c.calle || c.ciudad || c.estado || c.codigo_postal) {
        setShowDireccion(true);
      }
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
      
      // Si cambia el tipo de contacto, limpiar campos según corresponda
      if (k === "tipo_contacto") {
        if (v === "empresa") {
          // Para empresa, limpiar nombres y apellidos, mantener nombre_completo para nombre comercial
          next.nombres = "";
          next.apellidos = "";
        }
      }
      
      // Actualizar nombre_completo solo para personas (nombres + apellidos)
      if ((k === "nombres" || k === "apellidos") && next.tipo_contacto === "persona") {
        next.nombre_completo = toTitle([next.nombres, next.apellidos].filter(Boolean).join(" "));
      }
      // Para empresas, el nombre_completo es el nombre comercial y se edita directamente
      
      return next;
    });
  };

  // Handler para cambios en dirección
  const handleDireccionChange = (name, value, direccionCompleta) => {
    setModel((m) => {
      const updatedDireccion = {
        ...(m.direccion || empty.direccion),
        [name]: value,
      };
      return {
        ...m,
        direccion: updatedDireccion,
      };
    });
  };

  // ====== guardar cambios ======
  const save = async () => {
    setSaving(true);
    try {
      const principal = Array.isArray(model.telefonos)
        ? model.telefonos.find((x) => x.principal)
        : null;

      // Crear dirección concatenada como texto simple (compatibilidad con backend)
      const direccionConcatenada = [
        model.direccion?.calle,
        model.direccion?.apto,
        model.direccion?.ciudad,
        model.direccion?.estado,
        model.direccion?.codigo_postal,
      ].filter(Boolean).join(" ");

      let payload;
      
      if (model.tipo_contacto === "empresa") {
        // Para empresas: usar nombre_completo como nombre comercial
        // estado_cliente será el nombre comercial (o "empresa" como valor fijo)
        // Dejar primer_nombre y apellidos como null
        payload = {
          primer_nombre: null,
          segundo_nombre: null,
          apellidos: null,
          nombre_completo: model.nombre_completo?.trim() || null,
          idioma: model.idioma || null,
          email: model.email_principal || null,
          telefonos: model.telefonos || [],
          nota: model.nota || null,
          telefono: principal?.numero ?? null,
          // Para empresas, guardamos "empresa" en estado_cliente
          estado_cliente: "empresa",
          activo: true,
          es_prospecto: false,
          // Datos de dirección - campos individuales
          calle: model.direccion?.calle || null,
          apto: model.direccion?.apto || null,
          ciudad: model.direccion?.ciudad || null,
          estado: model.direccion?.estado || null,
          codigo_postal: model.direccion?.codigo_postal || null,
          condado: model.direccion?.condado || null,
          // Dirección concatenada (para compatibilidad)
          direccion: direccionConcatenada || null,
          // Dirección de correspondencia
          dir_correspondencia: model.direccion?.dir_correspondencia || null,
        };
      } else {
        // Para personas: usar campos normales
        const { primer_nombre, segundo_nombre } = splitNames(model.nombres || "");
        payload = {
          primer_nombre,
          segundo_nombre,
          apellidos: model.apellidos?.trim() || null,
          nombre_completo: model.nombre_completo?.trim() || null,
          idioma: model.idioma || null,
          email: model.email_principal || null,
          telefonos: model.telefonos || [],
          nota: model.nota || null,
          telefono: principal?.numero ?? null,
          // Para contactos personas, usar "contacto"
          estado_cliente: "contacto",
          activo: true,
          es_prospecto: false,
          // Datos de dirección - campos individuales
          calle: model.direccion?.calle || null,
          apto: model.direccion?.apto || null,
          ciudad: model.direccion?.ciudad || null,
          estado: model.direccion?.estado || null,
          codigo_postal: model.direccion?.codigo_postal || null,
          condado: model.direccion?.condado || null,
          // Dirección concatenada (para compatibilidad)
          direccion: direccionConcatenada || null,
          // Dirección de correspondencia
          dir_correspondencia: model.direccion?.dir_correspondencia || null,
        };
      }

      if (model.id) {
        // Actualizar contacto existente
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
                  estado_cliente: payload.estado_cliente ?? r.estado_cliente,
                }
              : r
          )
        );
      } else {
        // Crear nuevo contacto
        const response = await apiRequest("/cliente/create", "POST", {
          clientes: [payload]
        });
        
        const nuevoContacto = response?.clientes?.[0] || response?.data?.clientes?.[0];
        if (nuevoContacto?.id) {
          // Actualizar el modelo con el ID del nuevo contacto
          setModel({ ...model, id: nuevoContacto.id });
          
          // Recargar el contacto para tener todos los datos actualizados
          await loadContact(nuevoContacto.id);
          
          // Limpiar búsqueda y recargar lista si es necesario
          toast.showSuccess("Contacto creado exitosamente");
        } else {
          throw new Error("No se recibió el ID del contacto creado");
        }
      }
    } catch (e) {
      console.error("Error al guardar:", e);
      toast.showError(`Error al guardar: ${e.message || "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setModel(empty);
    setLinks([]);
    setShowTelefonos(false);
    setShowDireccion(false);
  };

  // Permitir guardar si hay nombre_completo (tanto para crear como para editar)
  const canSave = useMemo(() => {
    const tieneNombre = model.nombre_completo?.trim().length > 0;
    return tieneNombre;
  }, [model.nombre_completo]);
  
  const esPersona = model.tipo_contacto === "persona";
  const esEmpresa = model.tipo_contacto === "empresa";
  const esCliente = model.estado_cliente?.toLowerCase() === "cliente";

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
                        const firstPhone = formatearTelefonoCompleto(r);
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
                <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0">{model.id ? "Editar Cliente" : "Crear Nuevo Contacto"}</h5>
                  {esCliente && (
                    <span className="badge bg-warning text-dark">
                      Solo lectura
                    </span>
                  )}
                </div>
                <div className="btn-group">
                  <button className="btn btn-outline-secondary btn-sm" onClick={resetForm}>
                    Nuevo / Limpiar
                  </button>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={save} 
                    disabled={!canSave || saving || esCliente}
                    title={esCliente ? "Los clientes no pueden ser editados desde aquí" : ""}
                  >
                    {saving ? "Guardando…" : model.id ? "Guardar" : "Crear"}
                  </button>
                </div>
              </div>
              {esCliente && (
                <div className="alert alert-warning alert-sm py-2 px-3 mb-3">
                  <small><strong>Nota:</strong> Los clientes no pueden ser editados desde aquí. Use el botón "Nuevo / Limpiar" para crear un nuevo contacto.</small>
                </div>
              )}

              <div className="row g-3">
                {/* Selector de tipo de contacto */}
                <div className="col-12">
                  <label className="form-label small">Tipo de Contacto *</label>
                  <select
                    className="form-select form-select-sm"
                    value={model.tipo_contacto}
                    onChange={(e) => setField("tipo_contacto", e.target.value)}
                    disabled={!!model.id || esCliente} // No permitir cambiar tipo si ya existe o es cliente
                  >
                    <option value="persona">Persona</option>
                    <option value="empresa">Empresa</option>
                  </select>
                  {model.id && (
                    <small className="form-text text-muted">
                      El tipo no puede cambiarse una vez creado el contacto
                    </small>
                  )}
                </div>

                {/* Campos para Persona */}
                {esPersona && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label small">Nombres</label>
                      <input
                        className="form-control form-control-sm"
                        value={model.nombres}
                        onChange={(e) => setField("nombres", e.target.value)}
                        placeholder="Primer y segundo nombre"
                        disabled={esCliente}
                        readOnly={esCliente}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small">Apellidos</label>
                      <input
                        className="form-control form-control-sm"
                        value={model.apellidos}
                        onChange={(e) => setField("apellidos", e.target.value)}
                        placeholder="Apellidos"
                        disabled={esCliente}
                        readOnly={esCliente}
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small">Nombre Completo</label>
                      <input
                        className="form-control form-control-sm bg-light"
                        value={model.nombre_completo}
                        readOnly
                        placeholder="Se genera automáticamente"
                      />
                      <small className="form-text text-muted">
                        Se genera automáticamente a partir de nombres y apellidos
                      </small>
                    </div>
                  </>
                )}

                {/* Campos para Empresa */}
                {esEmpresa && (
                  <div className="col-md-12">
                    <label className="form-label small">Nombre Comercial / Razón Social *</label>
                    <input
                      className="form-control form-control-sm"
                      value={model.nombre_completo}
                      onChange={(e) => setField("nombre_completo", e.target.value)}
                      placeholder="Ingrese el nombre de la empresa"
                      required
                      disabled={esCliente}
                      readOnly={esCliente}
                    />
                    <small className="form-text text-muted">
                      Este será el nombre comercial de la empresa
                    </small>
                  </div>
                )}

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
                    disabled={esCliente}
                  />
                </div>

                <div className="col-md-8">
                  <label className="form-label small">Nota</label>
                  <input
                    className="form-control form-control-sm"
                    value={model.nota || ""}
                    onChange={(e) => setField("nota", e.target.value)}
                    disabled={esCliente}
                    readOnly={esCliente}
                  />
                </div>

                {/* Botón para agregar/mostrar Teléfonos */}
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label small mb-0">Teléfonos</label>
                    {!esCliente && (
                      <button
                        type="button"
                        className={`btn btn-sm ${showTelefonos ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                        onClick={() => setShowTelefonos(!showTelefonos)}
                      >
                        <i className={`bi ${showTelefonos ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
                        {showTelefonos ? 'Ocultar' : 'Agregar Teléfono'}
                      </button>
                    )}
                  </div>
                  {showTelefonos && (
                    <div className="mt-2">
                      <TelefonosPro
                        value={model.telefonos}
                        onChange={(list) => setField("telefonos", list)}
                        readOnly={esCliente}
                        uiPreset="clean"
                        countrySelectWidth={200}
                        formatByCountry
                      />
                      {(!model.telefonos || model.telefonos.length === 0) && (
                        <div className="text-muted small mt-2">Sin teléfonos.</div>
                      )}
                    </div>
                  )}
                  {!showTelefonos && model.telefonos && model.telefonos.length > 0 && (
                    <div className="text-muted small mt-1">
                      {model.telefonos.length} teléfono(s) registrado(s)
                    </div>
                  )}
                </div>

                {/* Botón para agregar/mostrar Dirección */}
                <div className="col-12 mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label small mb-0">Dirección</label>
                    {!esCliente && (
                      <button
                        type="button"
                        className={`btn btn-sm ${showDireccion ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                        onClick={() => setShowDireccion(!showDireccion)}
                      >
                        <i className={`bi ${showDireccion ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
                        {showDireccion ? 'Ocultar' : 'Agregar Dirección'}
                      </button>
                    )}
                  </div>
                  {showDireccion && (
                    <div className="mt-2 border-top pt-3">
                      <FormDireccion
                        formData={model.direccion || empty.direccion}
                        onChange={handleDireccionChange}
                        editable={!esCliente}
                        hideCorrespondencia={true}
                      />
                    </div>
                  )}
                  {!showDireccion && model.direccion && (model.direccion.calle || model.direccion.ciudad) && (
                    <div className="text-muted small mt-1">
                      Dirección registrada: {[model.direccion.calle, model.direccion.ciudad].filter(Boolean).join(', ') || 'Dirección registrada'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* vínculos - solo mostrar si el contacto ya existe */}
          {model.id && (
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
          )}
        </div>
      </div>
    </div>
  );
}
